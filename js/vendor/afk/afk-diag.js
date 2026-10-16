/* ==========================================================================
 * afk-diag.js — 快取/儲存診斷(首頁「⚙ 設定」選單)
 *
 * 用途:玩家回報「圖一直重載 / 只剩無痕能開」這類問題時,拿得到現場數字,不必再靠猜。
 *
 * 🔒 全程唯讀:只 read localStorage / caches / navigator.storage,
 *    絕不 put/delete/清任何東西(見 CLAUDE.md「外掛絕不可盲呼叫會寫入存檔的函式」)。
 *
 * 快照可「📋 複製」成純文字回報。手機沒有 console,這是唯一拿得到這些數字的管道。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.AFK_TOGGLES && !AFK_TOGGLES.enabled('diag')) return;   // 🎚️ 外掛開關:關掉就透明放行原版行為

  // 這支自己的版本:從自己的 <script src="afk-diag.js?v=…"> 取。
  //   為什麼要:玩家回傳截圖時,得認得出「這是哪一版診斷產生的」——否則修好了也分不出他手上是新是舊
  //   (踩過:改完推上去,玩家看到一樣的錯,雙方都無從判斷是沒生效還是沒重載)。
  //   放標題是刻意的:內容整個失敗時,只有標題還會留在畫面上。
  var DIAG_VER = (function () {
    try {
      var s = document.querySelector('script[src*="afk-diag.js"]');
      var m = s && s.getAttribute('src').match(/[?&]v=([^&]+)/);
      return m ? m[1] : '?';
    } catch (e) { return '?'; }
  })();

  var IMG_CACHE = 'img-v3';           // ← 與 sw.js 同名(那邊是固定桶名,不隨版本換)
  var CODE_CACHE = 'code-v1';
  var ANIM_HASH_KEY = '/__afk-anim-hashes__';   // sw.js 存「一怪一雜湊」對帳記錄的合成 entry
  var IMG_HASH_KEY = '/__afk-img-hashes__';

  // 最近的 JS 錯誤:手機沒有 console,玩家回報「怪怪的」時這是唯一拿得到錯誤的管道。
  //   本檔在 </body> 前才載入,更早的錯誤抓不到;被 try/catch 吞掉的也抓不到(如離線結算迴圈內)——
  //   有東西就是線索,空的不代表沒問題。
  var ERRS = [];
  function pushErr(kind, msg, src) {
    if (ERRS.length >= 12) ERRS.shift();
    ERRS.push({ t: new Date().toLocaleTimeString('zh-TW'), kind: kind, msg: String(msg || '').slice(0, 200), src: String(src || '').split('/').pop().slice(0, 40) });
  }
  window.addEventListener('error', function (e) {
    // 資源(img/script/link/audio…)載入失敗時,錯誤物件「沒有 message」——只印 e.message 會得到一行空白的
    //   「錯誤:」,等於白抓(玩家實機回傳的就是這樣,看得到有事、卻不知道是誰)。這種要改抓元素與網址。
    var el = e.target;
    if (el && el !== window && el.tagName) {
      var url = el.src || el.href || '';
      var kind = el.tagName === 'IMG' ? '圖載入失敗' : el.tagName.toLowerCase() + ' 載入失敗';
      return pushErr(kind, url || '(沒有網址)', '');
    }
    pushErr('錯誤', e.message || '(沒有訊息)', e.filename);
  }, true);

  // 逐怪對帳的實際結果:SW 做完會回報。⚠️ 這也是唯一能認出「修正版 SW 有沒有在跑」的方法——
  //   CODE_VERSION 的雜湊不含 sw.js 自己,所以改了 sw.js 版本號不會變,「版本」那行看不出來。
  //   只有修正版會回報 skipped 欄位,舊版沒有。
  var ANIM_RECON = null;
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type === 'reconcile-anim-done') ANIM_RECON = d;
    });
  }
  window.addEventListener('unhandledrejection', function (e) { pushErr('未處理的拒絕', e.reason && (e.reason.message || e.reason), ''); });

  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }
  function kb(n) { return n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : mb(n); }   // 存檔多在幾百 KB~數 MB,用 MB 顯示會變 0.0

  // 逐桶統計:總筆數、怪物動畫幀數、圖片數。
  //   ⚠️ cache.keys() 在「筆數過多」的桶上會直接拋 Operation too large(玩家實機遇到,圖桶塞太多幀)。
  //      這正是我們最想知道的狀態,所以不能讓它把整份診斷帶走——單桶失敗就記下失敗,其餘照常。
  function bucketStats() {
    if (!window.caches) return Promise.resolve(null);
    return caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        return caches.open(n).then(function (c) { return c.keys(); }).then(function (ks) {
          var anim = 0, img = 0;
          ks.forEach(function (k) {
            if (/\/assets\/(anim|classanim)\//.test(k.url)) anim++;
            else if (/\/assets\/.*\.(png|jpg|jpeg|webp|gif)$/i.test(k.url)) img++;
          });
          return { name: n, total: ks.length, anim: anim, img: img };
        }).catch(function (e) { return { name: n, err: String(e.message || e) }; });
      }));
    }).catch(function (e) { return [{ name: '(列舉快取桶失敗)', err: String(e.message || e) }]; });
  }

  // 對帳記錄:記了幾筆。0 筆 = SW 下次載入會把「所有怪」判定成沒對過而整包清掉重抓
  function hashRecords() {
    if (!window.caches) return Promise.resolve({});
    return caches.open(IMG_CACHE).then(function (c) {
      return Promise.all([c.match(ANIM_HASH_KEY), c.match(IMG_HASH_KEY)]);
    }).then(function (rs) {
      return Promise.all(rs.map(function (r) { return r ? r.json().catch(function () { return null; }) : null; }));
    }).then(function (js) {
      return {
        anim: js[0] ? Object.keys(js[0]).length : null,
        img: js[1] ? Object.keys(js[1]).length : null
      };
    }).catch(function () { return { anim: null, img: null }; });
  }

  // localStorage 有 ~5MB 的硬上限(與 Cache 配額是兩回事)。逼近上限時 saveGame 會寫不進去,
  //   所以這裡要看得到「用了幾 %」與「誰在吃空間」,不能只給一個總數。
  var LS_LIMIT = 5 * 1024 * 1024;
  function localStorageStats() {
    var total = 0, saves = 0, items = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var b = (k.length + (localStorage.getItem(k) || '').length) * 2;   // UTF-16 約 ×2 bytes
        total += b;
        items.push([k, b]);
        if (/^lineage_idle_save_/.test(k)) saves++;
      }
    } catch (e) { return null; }
    items.sort(function (a, b) { return b[1] - a[1]; });
    return { total: total, saves: saves, top: items.slice(0, 5) };
  }

  // UA 原始字串太長沒人讀得下去,解析成人看得懂的;原始字串仍保留在最後一行(型號細節只有它有)
  function uaSummary() {
    var ua = navigator.userAgent, m;
    var browser = (m = ua.match(/(Edg|OPR|SamsungBrowser|Firefox|Chrome)\/([\d.]+)/)) ?
      ({ Edg: 'Edge', OPR: 'Opera', SamsungBrowser: 'Samsung 瀏覽器' }[m[1]] || m[1]) + ' ' + m[2].split('.')[0] :
      (/Safari/.test(ua) ? 'Safari' : '未知瀏覽器');
    var os = (m = ua.match(/Android ([\d.]+)/)) ? 'Android ' + m[1] :
      (m = ua.match(/(?:iPhone )?OS ([\d_]+)/)) ? 'iOS ' + m[1].replace(/_/g, '.') :
      /Windows NT 10/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : '未知系統';
    var dev = (m = ua.match(/Android [\d.]+; ([^;)]+)/)) ? ' / ' + m[1].trim() : '';
    return browser + ' / ' + os + dev;
  }

  // 卡頓類問題:背包/倉庫件數是已知的 O(n) 成本來源,先看這兩個數字比什麼都快。
  //   ⚠️ 一律「讀存檔」而不是讀全域 player——診斷入口在主選單,那裡根本沒載入角色(實測過,
  //      讀 player 只會得到「未載入」的廢資訊)。讀存檔則八格都看得到,且純唯讀。
  //   名稱/職業/等級重用遊戲自己的 slotSummary()(職業已翻中文、也處理得了舊明文存檔),
  //   只有它沒提供的「背包/傭兵件數」才自己讀。格數走 SAVE_SLOT_MAX,別自己寫死。
  function slotMax() { return (typeof SAVE_SLOT_MAX !== 'undefined') ? SAVE_SLOT_MAX : 16; }
  // 好幾個欄位都要讀同一份存檔,而解壓一格可能上百 KB × 16 格(手機上很有感)→ 解一次共用。
  //   collect() 開頭清空,重開診斷一定拿到當下的值。
  var _saveCache = {};
  function savePlayer(s) {
    if (!(s in _saveCache)) {
      try { _saveCache[s] = JSON.parse(_saveUnwrap(_lzGet('lineage_idle_save_' + s)).payload).p; }   // 存檔結構 {v,p,ms,ticks},玩家在 p
      catch (e) { _saveCache[s] = null; }
    }
    return _saveCache[s];
  }
  function charSummary() {
    var out = [];
    for (var s = 1; s <= slotMax(); s++) {
      try {
        var sum = (typeof slotSummary === 'function') ? slotSummary(s) : null;
        if (!sum) continue;
        var inv = '?', allies = '?', chase = 0;
        var d = savePlayer(s);
        // 😤 被追殺清單:離線期間野外每次重生有 5% 變成「白目玩家」遭遇＝玩家型 NPC 戰鬥,
        //   是除了血盟團戰以外另一條會讓結算變貴的路徑,而且是**逐角色**的(診斷別處看不到)。
        if (d) { inv = (d.inv || []).length; allies = (d.allies || []).length; chase = (d.trollPlayers || []).length; }
        out.push('第' + s + '格: ' + (sum.name || '(未命名)') + ' / ' + sum.cls + ' Lv' + sum.lv +
          ' / 背包 ' + inv + ' 件 / 傭兵 ' + allies + (chase ? ' / 被追殺 ' + chase + ' 人' : '') +
          (sum.classic ? ' / 經典' : '') + (sum.traditional ? ' / 傳統' : ''));
      } catch (e) { out.push('第' + s + '格: ⚠️ 讀取失敗(' + String(e.message).slice(0, 40) + ')'); }
    }
    return out.length ? '\n          ' + out.join('\n          ') : '(沒有任何存檔)';
  }

  // 倉庫是「依模式共用桶」、不綁存檔位,故獨立列。
  //   後綴對照 js/12 的 modeSuffix():''=一般 / _classic=經典 / _tradonly=傳統 / _trad=經典+傳統
  var WH_BUCKETS = [['', '一般'], ['_classic', '經典'], ['_tradonly', '傳統'], ['_trad', '經典+傳統']];
  function warehouseSummary() {
    var out = [];
    WH_BUCKETS.forEach(function (b) {
      try {
        var raw = _lzGet('lineage_idle_warehouse' + b[0]);
        if (!raw) return;
        out.push(b[1] + ': ' + (JSON.parse(raw).items || []).length + ' 件');
      } catch (e) { out.push(b[1] + ': 讀取失敗'); }
    });
    return out.length ? out.join(' / ') : '(無)';
  }

  // 離線收益類問題:先看關掉時停在哪張圖、隔多久,比對玩家說法
  function offlineAnchors() {
    var out = [];
    for (var s = 1; s <= slotMax(); s++) {
      var ts = localStorage.getItem('afk_ts_' + s);
      if (!ts) continue;
      var mapId = localStorage.getItem('afk_map_' + s) || '?';
      var mins = Math.round((Date.now() - (+ts)) / 60000);
      var name = mapId;
      try { if (window.AFK_EXTRA && AFK_EXTRA.mapName) name = AFK_EXTRA.mapName(mapId) || mapId; } catch (e) {}
      out.push('第' + s + '格: ' + name + '(' + (mins >= 60 ? Math.floor(mins / 60) + ' 小時前' : mins + ' 分鐘前') + ')');
    }
    return out.length ? out.join('\n          ') : '(無)';
  }

  // 「同樣掛一晚,有的跑 30 分鐘、有的 2 分鐘」這類回報的第一現場:結算實際花多久、其中多少是
  //   逐格完整模擬(慢)、多少被快轉掉(快),以及這次為什麼是這樣。資料來自外掛自己的
  //   afk_hist_<格>(純 JSON,不是玩家存檔),只讀不寫。
  //   ⚠ 每格印「全部保留的紀錄」而不是只印最新一筆:玩家不小心多登入一次,那筆想看的就被擠掉了
  //     (紀錄是 unshift + 只留最近 5 筆)。要回報問題的人通常不會注意到這件事。
  function fmtDur(ms) {
    var m = Math.floor(ms / 60000);
    if (m < 1) return Math.max(0, Math.round(ms / 1000)) + ' 秒';
    if (m < 60) return m + ' 分';
    return Math.floor(m / 60) + ' 時' + (m % 60 ? ' ' + (m % 60) + ' 分' : '');
  }
  // 結算統計快取(存檔裡的 _offStats):命中就跳過取樣與 BOSS 首打 → 同一隻角色快慢差最多的一項
  function offStatsNote(s) {
    var p = savePlayer(s), c = p && p._offStats;
    if (!c || !c.savedAt) return '統計快取 無';
    return '統計快取 有(' + fmtDur(Math.max(0, Date.now() - c.savedAt)) + '前 · BOSS ' + Object.keys(c.boss || {}).length + ' 種)';
  }
  function clock(ms) {
    var d = new Date(ms);
    if (isNaN(d.getTime())) return '?';
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  // 一筆紀錄 → 2~3 行。欄位新舊都有,舊紀錄沒有的就不印(不要印出空白或 undefined 誤導判讀)。
  function settleRec(r) {
    var L = [];
    var head = clock(r.loginTs) + ' ' + (r.map || '?') + ' 掛' + fmtDur(r.realMs || 0);
    if (r.settleMs != null) head += ' → 結算 ' + (r.settleMs / 1000).toFixed(1) + ' 秒';
    if (r.died) head += ' ⚠️陣亡';
    if (r.capped) head += ' ·24h上限';
    if (r.settleSeq) head += ' [本次開啟第 ' + r.settleSeq + ' 次結算]';
    L.push(head);

    var why = '';
    try { if (r.fastWhy && window.__afk && __afk.fastWhyText) why = __afk.fastWhyText(r.fastWhy); } catch (e) {}
    var a = [];
    if (why) a.push(why);
    // ⚠️ 「平均 ms/事件」不能拿來比兩隻角色:分母只是快轉呼叫次數,一個事件可能殺 1 隻也可能殺 20 隻
    //   (batchE)。唯一可比的單位是「µs/隻」——所以同一行一定要把總擊殺數與 batchE 一起印出來。
    var killN = 0;
    try { (r.kills || []).forEach(function (k) { killN += (k && k.cnt) || 0; }); } catch (e) {}
    if (r.fastEvents) {
      a.push('事件 ' + r.fastEvents + ' 個·平均 ' + (r.settleMs / r.fastEvents).toFixed(2) + ' ms'
        + (r.batchE != null ? '(每事件殺 ' + r.batchE + ' 隻)' : ''));
    }
    if (killN) a.push('共殺 ' + killN + ' 隻·' + Math.round(r.settleMs * 1000 / killN) + ' µs/隻');
    if (r.simTicks != null) a.push('真模擬 ' + fmtDur(r.simTicks * 100));
    if (r.ckptN) a.push('存檔 ' + r.ckptN + ' 次 ' + (r.ckptMs / 1000).toFixed(1) + ' 秒(' + Math.round(r.ckptMs / Math.max(1, r.settleMs) * 100) + '%)');
    if (a.length) L.push('· ' + a.join(' · '));

    // 「為什麼這台這隻特別慢」的鑑別欄位:平均值分不出「每次貴一點」和「卡了幾次超大的」,
    //   而背景時間/等畫面時間根本不是在計算——這幾個一起看才知道 156 秒到底是什麼組成的。
    var b = [];
    if (r.hiddenMs != null) b.push('背景 ' + (r.hiddenMs / 1000).toFixed(1) + ' 秒');
    if (r.paceMs != null) b.push('等畫面 ' + (r.paceMs / 1000).toFixed(1) + ' 秒');
    if (r.sliceN) {
      var slow = 0, h = r.sliceHist || [];
      for (var i = 3; i < h.length; i++) slow += h[i] || 0;   // 索引 3 起 = ≥256ms 的切片
      b.push('切片 ' + r.sliceN + ' 個·最久 ' + r.sliceMax + ' ms' + (slow ? '·≥256ms 有 ' + slow + ' 個' : ''));
    }
    if (r.invMax) b.push('背包峰值 ' + r.invMax);
    if (r.allies >= 0) b.push('傭兵 ' + r.allies);
    if (r.petsOut >= 0) b.push('出戰寵物 ' + r.petsOut);
    if (r.pvpOn != null) b.push('野外PVP ' + (r.pvpOn ? '開' : '關'));
    if (r.trollN > 0) b.push('被追殺 ' + r.trollN + ' 人');
    if (b.length) L.push('· ' + b.join(' · '));

    // ⏱ 分段耗時:上面那些只講「總共多久、卡不卡」,這行才回答「時間到底花在哪一段」。
    //   擊殺全鏈(掉落/經驗/收集冊)、出怪、血盟讀取、存檔各佔多少,以及 localStorage 被讀了幾次
    //   (iOS 上每次存取都不便宜,而它跟角色狀態有關 → 兩隻角色差幾十倍時第一個要看的就是這行)。
    var p = r.perf;
    if (p) {
      var pct = function (ms) { return Math.round(ms / Math.max(1, r.settleMs) * 100) + '%'; };
      var c = [];
      if (p.kill != null) c.push('擊殺 ' + (p.kill / 1000).toFixed(1) + 's(' + pct(p.kill) + ')');
      if (p.spawn != null) c.push('出怪 ' + (p.spawn / 1000).toFixed(1) + 's(' + pct(p.spawn) + ')');
      if (p.clan) c.push('血盟讀取 ' + (p.clan / 1000).toFixed(1) + 's(' + pct(p.clan) + ')');
      if (p.save) c.push('存檔 ' + (p.save / 1000).toFixed(1) + 's(' + pct(p.save) + ')');
      if (p.lsGet) c.push('localStorage 讀 ' + p.lsGet + ' 次/' + p.lsGetMB + ' MB·寫 ' + p.lsSet + ' 次');
      if (c.length) L.push('· 分段 ' + c.join(' · '));
    }
    return L;
  }
  // 🏴 血盟戰況:離線結算會不會被 NPC 血盟「團戰」拖垮,取決於有沒有 NPC 血盟處於「宣戰中且仇恨>80」
  //   (那是 npcClanMaybeStartGroupBattle 的候選條件)。團戰一開打,場上就持續補滿敵盟的玩家型 NPC
  //   ＝完整職業對戰,實測會讓結算慢兩位數倍。
  //   ⚠ 一定要用讀的、不要問玩家「你有沒有宣戰過」——宣戰有兩條路(王族按宣戰、對求和回應「嗆聲」),
  //     而且血盟世界是**同模式所有角色共用**,可能是別隻角色很久以前做的,本人不會記得。
  //   讀法比照遊戲自己的路徑;讀不到就說讀不到,不要靜靜顯示 0 讓人誤判成「沒事」。
  function clanWarState() {
    if (typeof _clanReadState !== 'function' || typeof clanModeKey !== 'function') return '(這版核心沒有血盟系統)';
    var st = null;
    try { st = _clanReadState(); } catch (e) {}
    if (!st) return '⚠️ 血盟資料讀取失敗';
    var out = [];
    try {
      var mine = (typeof clanGetModeInfo === 'function') ? clanGetModeInfo(player) : null;
      out.push('目前角色的血盟: ' + (mine && mine.name ? mine.name : '(未加入或未載入角色)'));
    } catch (e) { out.push('目前角色的血盟: (讀取失敗)'); }
    ['normal', 'classic'].forEach(function (mode) {
      var w = st.npcWorlds && st.npcWorlds[mode];
      if (!w || !Array.isArray(w.clans)) return;
      var war = w.clans.filter(function (c) { return c && c.war; });
      var hot = war.filter(function (c) { return c.hatred > 80; });
      var hostile = w.clans.filter(function (c) { return c && c.hostile; });
      out.push((mode === 'normal' ? '一般' : '經典') + '世界: NPC 血盟 ' + w.clans.length
        + ' 個 / 宣戰中 ' + war.length + ' / 其中仇恨>80(會開團戰) ' + hot.length + ' / 敵對 ' + hostile.length
        + (hot.length ? '  ⚠️ 離線會被開團戰(除非關掉「掛機期間遭遇玩家對戰」)' : ''));
      if (war.length) out.push('  宣戰中: ' + war.map(function (c) { return (c.name || '?') + '(仇恨' + Math.round(c.hatred || 0) + ')'; }).join('、'));
    });
    return out.length ? '\n          ' + out.join('\n          ') : '(無資料)';
  }
  function offlineSettle() {
    var out = [];
    for (var s = 1; s <= slotMax(); s++) {
      var arr = null;
      try { arr = JSON.parse(localStorage.getItem('afk_hist_' + s) || 'null'); } catch (e) {}
      if (!Array.isArray(arr) || !arr.length) continue;
      var sum = null;
      try { sum = (typeof slotSummary === 'function') ? slotSummary(s) : null; } catch (e) {}
      out.push('第' + s + '格' + (sum ? ' ' + sum.cls + ' Lv' + sum.lv : '') + '（' + arr.length + ' 筆）/ ' + offStatsNote(s));
      arr.forEach(function (r) {
        if (!r) return;
        settleRec(r).forEach(function (ln, i) { out.push((i === 0 ? '  ' : '    ') + ln); });
      });
    }
    return out.length ? '\n          ' + out.join('\n          ') : '(還沒有任何離線結算紀錄)';
  }

  // ── 存檔健康:玩家回報「創血盟失敗 / 寵物不給放生 / 進度不見」時的第一現場 ──────────
  //   共同根因是核心的 _roleSaveAllowed() 為 false → saveGame() 一律回 false(js/13:1301)。
  //   血盟建立與寵物放生都會檢查存檔結果並整筆回滾,所以症狀看起來是「功能壞掉」,
  //   實際上是「這個分頁的所有進度都沒在存」——嚴重度差很多,要一眼看得出來。
  var GUARD_KEY = (typeof ROLE_DELETED_GUARD_KEY !== 'undefined') ? ROLE_DELETED_GUARD_KEY : 'fb5_deleted_role_guards_v1';
  function saveHealth() {
    if (typeof player === 'undefined' || !player || !player.cls) return '(未載入角色,無法判斷)';
    if (typeof _roleFingerprint !== 'function' || typeof _roleSaveAllowed !== 'function') return '(這版核心沒有存檔世代機制)';
    var fp = _roleFingerprint(player);
    var stored = (typeof _roleReadSavePlayer === 'function') ? _roleReadSavePlayer(currentSlot) : null;
    var storedFp = stored ? _roleFingerprint(stored) : null;
    var guards = {};
    try { guards = _roleReadObject(GUARD_KEY) || {}; } catch (e) {}
    var allowed = _roleSaveAllowed();
    if (allowed) return '✅ 正常(第' + currentSlot + '格)';
    var why = guards[fp]
      ? '此角色在「已刪除名單」內(曾被刪除;名單保留 30 天)'
      : (storedFp && storedFp !== fp)
        ? '本分頁的角色世代跟存檔裡的對不上——通常是「同時開了兩個分頁 / PWA 與瀏覽器各一個」,另一邊動過之後這邊就過期了'
        : '不明(指紋:' + fp + ' / 磁碟:' + (storedFp || '空') + ')';
    return '❌ 已停止寫入,這個分頁的進度不會被保存!' +
      '\n          原因: ' + why +
      '\n          影響: 創血盟會失敗、寵物不給放生、經驗金幣掉落全部不會存下來' +
      '\n          先做: 關掉這個分頁重開一個(若仍相同,把這份診斷回報)';
  }

  // 匯入時「相同角色已存在」被誤擋:舊存檔沒有身分碼(enSeed)時,核心用「名字|職業」推導一組。
  //   沒取過名字的同職業角色會推導出一模一樣的碼 → 明明是不同角色卻被判成同一個。
  //   這裡把每格的碼列出來並標明是「隨機」還是「推導」,撞號時一眼看得出是不是誤判。
  function identitySeeds() {
    if (typeof _seedHash !== 'function') return '(這版核心沒有身分碼機制)';
    var rows = [], seen = {}, dup = {};
    for (var s = 1; s <= slotMax(); s++) {
      var p = (typeof _roleReadSavePlayer === 'function') ? _roleReadSavePlayer(s) : null;
      if (!p || !p.cls) continue;
      var derived = 'es' + _seedHash((p.name || '') + '|' + (p.cls || '') + '|lz').toString(36);
      var seed = p.enSeed || derived;
      var isDerived = (seed === derived);
      if (seen[seed]) dup[seed] = true;
      seen[seed] = (seen[seed] || 0) + 1;
      rows.push({ s: s, seed: seed, isDerived: isDerived, name: p.name || '(未命名)', cls: p.cls });
    }
    if (!rows.length) return '(沒有任何存檔)';
    var out = rows.map(function (r) {
      return '第' + r.s + '格: ' + r.seed + (r.isDerived ? ' (舊檔推導)' : ' (隨機)') +
        (dup[r.seed] ? '  ⚠️ 與其他格撞號' : '');
    });
    var dupSeeds = Object.keys(dup);
    if (dupSeeds.length) {
      var allDerived = rows.filter(function (r) { return dup[r.seed]; }).every(function (r) { return r.isDerived; });
      out.push(allDerived
        ? '→ 撞號的都是「舊檔推導」碼 = 很可能是不同角色被誤判成同一個(匯入會被擋)'
        : '→ 撞號的含「隨機」碼 = 很可能真的是同一個角色的複本');
    }
    return '\n          ' + out.join('\n          ');
  }

  // 寵物「不給放生 / 不見了」:出戰歸屬記的是 char:<身分碼>(js/22:209)。
  //   若那組碼已經沒有任何角色持有(換過身分碼),牠會被判成「其他角色出戰中」→ 放生鈕根本不顯示。
  function petOwnership() {
    if (typeof _petRosterRead !== 'function' || typeof _petBucketKey !== 'function') return '(這版核心沒有寵物名冊)';
    var roster = _petRosterRead(_petBucketKey());   // ⚠ 不可用 petRoster():它會設 _petRosterDirty(有副作用),診斷必須全程唯讀
    if (roster === null) return '⚠️ 寵物名冊讀取失敗(簽章不符)';
    if (!roster.length) return '(沒有寵物)';
    var owners = {};
    for (var s = 1; s <= slotMax(); s++) {
      var p = (typeof _roleReadSavePlayer === 'function') ? _roleReadSavePlayer(s) : null;
      if (p && p.enSeed) owners['char:' + p.enSeed] = s;
    }
    var orphan = [], locked = 0, out = 0;
    roster.forEach(function (p) {
      if (p.locked) locked++;
      var k = p.outOwner ? String(p.outOwner) : '';
      if (!k) return;
      out++;
      if (!owners[k]) orphan.push((typeof petDisplayName === 'function' ? petDisplayName(p) : p.form) + ' → ' + k);
    });
    var s1 = '共 ' + roster.length + ' 隻 / 出戰中 ' + out + ' / 鎖定 ' + locked + '(鎖定的不顯示放生鈕,這是正常的)';
    if (!orphan.length) return s1;
    return s1 + '\n          ❌ 下列寵物的主人碼沒有對應到任何角色 → 誰都不能操作/放生:' +
      '\n          ' + orphan.join('\n          ');
  }

  // ── 當下的記憶體／畫面量測(自己算,不依賴 afk-blackbox) ──────────────
  //   黑盒子 2026-07-27 暫停載入後，這段若還掛在它身上，玩家手動交出來的診斷就剛好少了
  //   最關鍵的欄位。這裡是純唯讀的一次性計算：不寫 IndexedDB、沒有心跳、不上傳，
  //   只在玩家按下「快取診斷」那一刻跑一次。
  function liveStats() {
    var o = {};
    try {
      var m = performance.memory;
      if (m) { o.mu = Math.round(m.usedJSHeapSize / 1048576); o.ml = Math.round(m.jsHeapSizeLimit / 1048576); }
    } catch (e) {}
    try { o.dom = document.getElementsByTagName('*').length; } catch (e) {}
    try {
      var px = 0, ims = document.images, n = ims.length;
      for (var i = 0; i < n; i++) px += (ims[i].naturalWidth || 0) * (ims[i].naturalHeight || 0);
      o.img = n; o.imgmb = Math.round(px * 4 / 1048576);   // iOS 沒有 performance.memory,這是那邊唯一的記憶體量化指標
    } catch (e) {}
    try {
      var el = function (id) { var e2 = document.getElementById(id); return e2 ? e2.childElementCount : -1; };
      o.vfx = el('vfx-layer'); o.mob = el('mob-list'); o.log = el('combat-log') + el('sys-log');
    } catch (e) {}
    try { if (typeof state !== 'undefined' && state) { o.tk = state.ticks; o.run = state.running ? 1 : 0; } } catch (e) {}
    try { if (typeof mapState !== 'undefined' && mapState) o.map = String(mapState.current || ''); } catch (e) {}
    try { if (typeof player !== 'undefined' && player) { o.inv = (player.inv || []).length; o.ally = (player.allies || []).length; } } catch (e) {}
    // 白畫面的直接證據:主容器被壓成 0 或整個推出視窗
    try {
      var bad = [];
      ['app-stage', 'game-screen'].forEach(function (id) {
        var e3 = document.getElementById(id);
        if (!e3 || e3.classList.contains('hidden')) return;
        if (e3.clientWidth < 50 || e3.clientHeight < 50) { bad.push(id + '=' + e3.clientWidth + 'x' + e3.clientHeight); return; }
        var r = e3.getBoundingClientRect();
        if (r.bottom < 20 || r.right < 20 || r.top > innerHeight - 20 || r.left > innerWidth - 20) bad.push(id + '離屏');
      });
      o.view = bad.length ? bad.join(' ') : 'ok';
    } catch (e) { o.view = '?'; }
    return o;
  }

  function collect() {
    var out = {};
    _saveCache = {};   // 每次重開診斷都重讀存檔,不吃上一次的舊值
    var _jobs = [];
    // 診斷的意義就是「出事時還讀得到」——任一欄位拋錯都不可以把整份帶走(實機踩過:
    //   cache.keys() 拋 Operation too large,整個診斷只印一行「診斷失敗」,其他全沒了)。
    var jobs = { push: function (p) { _jobs.push(Promise.resolve(p).catch(function () {})); } };

    function put(k, fn) { try { out[k] = fn(); } catch (e) { out[k] = '⚠️ 讀取失敗: ' + String(e.message || e).slice(0, 80); } }

    put('診斷版本', function () { return DIAG_VER; });   // 複製成文字回報時也要認得出是哪一版產生的
    put('時間', function () { return new Date().toLocaleString('zh-TW'); });
    put('開啟方式', function () {
      return ((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone)
        ? 'PWA(已安裝的 App)' : '瀏覽器分頁';
    });
    put('網址', function () { return location.origin + location.pathname; });
    put('瀏覽器', uaSummary);
    put('螢幕', function () {
      return innerWidth + '×' + innerHeight + ' / 像素密度 ' + (devicePixelRatio || 1) +
        (document.body.classList.contains('m-mobile') ? ' / 手機版面' : ' / 桌機版面') +
        ' / 上方橫幅 ' + (getComputedStyle(document.documentElement).getPropertyValue('--orig-bar-h').trim() || '0');
    });
    if (navigator.connection) put('網路', function () {
      return (navigator.connection.effectiveType || '?') +
        (navigator.connection.saveData ? ' / ⚠️ 省流量模式(圖可能抓不下來)' : '');
    });
    // 這段擺最前面:玩家是為了「當掉/白畫面」來開這個視窗的,證據要第一眼就看到
    put('目前狀態', function () {
      var n = liveStats();
      var mem = (n.mu != null && n.ml) ? n.mu + '/' + n.ml + ' MB(' + Math.round(n.mu / n.ml * 100) + '%)'
        : '此瀏覽器不提供(iPhone 都是這樣→改看下面的圖片量)';
      return '記憶體 ' + mem + '(只算JS·不含圖片)' +
        '\n          圖片 ' + (n.img != null ? n.img + ' 張·解碼約 ' + n.imgmb + ' MB' : '?') +
        ' / DOM ' + n.dom + ' 節點 / 特效 ' + n.vfx + ' / 怪卡 ' + n.mob + ' / 日誌 ' + n.log +
        '\n          畫面 ' + n.view + ' / 地圖 ' + (n.map || '?') + ' / tick ' + (n.tk != null ? n.tk : '?') +
        (n.run ? ' / 戰鬥中' : '') + ' / 背包 ' + (n.inv != null ? n.inv + ' 件' : '?');
    });
    put('存檔健康', saveHealth);   // 擺在角色前面:它是「進度到底有沒有在存」,比其他欄位都急
    put('角色', charSummary);
    put('角色身分碼', identitySeeds);
    put('寵物歸屬', petOwnership);
    put('倉庫', warehouseSummary);
    put('離線錨點', offlineAnchors);
    put('血盟戰況', clanWarState);
    put('離線結算', offlineSettle);

    var ls = localStorageStats();
    if (!ls) out.localStorage = '❌ 讀取失敗(可能被瀏覽器擋掉)';
    else {
      var pct = (ls.total / LS_LIMIT * 100).toFixed(1);
      out.localStorage = kb(ls.total) + ' / 上限約 ' + mb(LS_LIMIT) + '(用了 ' + pct + '%)' +
        (ls.total > LS_LIMIT * 0.9 ? '  ⚠️ 快滿了,存檔可能寫不進去!' : '') +
        '\n          存檔 ' + ls.saves + ' 格。吃最多的:\n          ' +
        ls.top.map(function (t) { return '· ' + t[0] + '  ' + kb(t[1]); }).join('\n          ');
    }

    // Service Worker 狀態:沒被控制 = 圖不會走快取,全部走網路
    if (navigator.serviceWorker) {
      out.SW控制中 = navigator.serviceWorker.controller ? '是' : '❌ 否(圖不會走快取!)';
      jobs.push(navigator.serviceWorker.getRegistration().then(function (r) {
        if (!r) { out.SW註冊 = '❌ 無'; return; }
        out.SW註冊 = '有' + (r.waiting ? ' ⚠️ 有新版在等待接手' : '') + (r.installing ? ' ⏳ 安裝中' : '');
      }).catch(function () { out.SW註冊 = '讀取失敗'; }));
    } else out.SW控制中 = '瀏覽器不支援';

    // 這份 index.html 目前引用的 sw 版本(認得出「程式有沒有真的換版」)
    jobs.push(fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (v) { out.版本 = '加掛版 ' + v.app + ' / ' + v.code + ' / ' + v.build; })
      .catch(function () { out.版本 = '讀不到 version.json'; }));

    // 配額:用量逼近配額時瀏覽器會開始丟東西
    if (navigator.storage && navigator.storage.estimate) {
      jobs.push(navigator.storage.estimate().then(function (e) {
        var pct = e.quota ? (e.usage / e.quota * 100).toFixed(1) : '?';
        out.儲存用量 = mb(e.usage) + ' / 配額 ' + mb(e.quota) + '(用了 ' + pct + '%)';
      }).catch(function () { out.儲存用量 = '讀取失敗'; }));
    }
    if (navigator.storage && navigator.storage.persisted) {
      jobs.push(navigator.storage.persisted().then(function (p) {
        out.持久化儲存 = p ? '是(不會被系統回收)' : '否(空間不足時可能被回收)';
      }).catch(function () {}));
    }

    jobs.push(bucketStats().then(function (bs) {
      if (!bs) { out.快取桶 = '瀏覽器不支援 Cache'; return; }
      if (!bs.length) { out.快取桶 = '❌ 一個都沒有(完全沒快取)'; return; }
      out.快取桶 = '\n          ' + bs.map(function (b) {
        if (b.err) return b.name + ': ⚠️ 數不出來 —— ' + b.err +
          (/too large/i.test(b.err) ? '\n            ↑ 這桶大到瀏覽器列舉不動。sw.js 的逐怪對帳用的是同一個呼叫,代表它在這台機器上每次載入都會拋錯掛掉。' : '');
        var extra = [];
        if (b.anim) extra.push('怪物幀 ' + b.anim);
        if (b.img) extra.push('圖 ' + b.img);
        return b.name + ': ' + b.total + ' 筆' + (extra.length ? '(' + extra.join(' / ') + ')' : '');
      }).join('\n          ');
    }));

    // 「怪物無記錄」有兩種完全不同的成因,講錯會嚇到人:
    //   (a) 真的沒對過 → 下次載入每隻怪都對不上 → 整包清掉重抓(要示警)
    //   (b) 圖桶大到 cache.keys() 拋 Operation too large → reconcileAnim 在寫記錄前就早退
    //       → 記錄永遠是空的,但它同時也一張都沒清(不會重抓,只是這台永遠對不了動畫的帳)
    //   (b) 要靠 SW 回報的 skipped 才分得出來,而那則訊息是非同步進來的 → 先占位,
    //   等 Promise.all 之後(ANIM_RECON 已到齊)再填,才不會誤報也不會打亂欄位順序。
    var HASH = null;
    out.對帳記錄 = '(計算中)';
    jobs.push(hashRecords().then(function (h) { HASH = h; }));

    return Promise.all(_jobs).then(function () {
      out.對帳記錄 = !HASH ? '❌ 讀取失敗' :
        ('怪物 ' + (HASH.anim !== null ? HASH.anim + ' 隻'
          : (ANIM_RECON && ANIM_RECON.skipped)
            ? '⏭️ 尚未建立(逐怪對帳被跳過,見下方;沒清任何圖、不會重抓)'
            : '❌ 無記錄(下次載入會整包重抓!)') +
         ' / 圖片 ' + (HASH.img === null ? '❌ 無記錄' : HASH.img + ' 張'));
      put('逐怪對帳', function () {
        if (!ANIM_RECON) return '(這次載入沒收到回報)';
        if (ANIM_RECON.skipped) return '⏭️ 跳過 —— ' + ANIM_RECON.skipped + '(✅ 修正版 SW 生效中:沒清任何圖)';
        return '清掉 ' + ANIM_RECON.evicted + ' 張';
      });
      out.最近錯誤 = ERRS.length ?
        '\n          ' + ERRS.map(function (e) { return '· [' + e.t + '] ' + e.kind + ': ' + e.msg + (e.src ? '  (' + e.src + ')' : ''); }).join('\n          ') :
        '(這次開啟後沒抓到;更早的或被 try/catch 吞掉的抓不到)';
      out.UA原始 = navigator.userAgent;
      return out;
    });
  }

  function fmt(o) {
    return Object.keys(o).map(function (k) {
      return k.padEnd ? (k + ':').padEnd(10, '　') + ' ' + o[k] : k + ': ' + o[k];
    }).join('\n');
  }

  function openModal() {
    if (_layer) return;   // 已開著就別再壓一層歷史(舊 _layer 會被覆寫成孤兒、永遠關不掉)
    buildModal();
    var body = document.getElementById('m-diag-body');
    body.textContent = '讀取中…';
    var modal = document.getElementById('m-diag-modal');
    modal.classList.add('open');
    if (window.AFK_UI && AFK_UI.openLayer) _layer = AFK_UI.openLayer(hideModal);
    collect().then(function (o) {
      var txt = fmt(o);
      body.textContent = txt;
      var btn = document.getElementById('m-diag-copy');
      btn.onclick = function () {
        var done = function () { btn.textContent = '✅ 已複製'; setTimeout(function () { btn.textContent = '📋 複製全部'; }, 1500); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback);
        else fallback();
        function fallback() {   // 手機/非安全環境的備援:選取讓使用者自己複製
          var r = document.createRange(); r.selectNodeContents(body);
          var s = getSelection(); s.removeAllRanges(); s.addRange(r);
          btn.textContent = '請長按選取複製';
        }
      };
      var sbtn = document.getElementById('m-diag-save');
      sbtn.onclick = function () {
        try {
          var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
          var name = 'afk-diag-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
            '-' + p(d.getHours()) + p(d.getMinutes()) + '.txt';   // 純 ASCII 檔名:中文檔名經通訊軟體轉傳常變亂碼
          var blob = new Blob(['﻿' + txt], { type: 'text/plain;charset=utf-8' });   // BOM:Windows 記事本開才不會整份中文變亂碼
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = name; a.style.display = 'none';
          document.body.appendChild(a); a.click();
          setTimeout(function () { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 2000);
          sbtn.textContent = '✅ 已下載';
          setTimeout(function () { sbtn.textContent = '💾 下載檔案'; }, 1500);
        } catch (e) {
          sbtn.textContent = '下載失敗,請用複製';
        }
      };
    }).catch(function (e) { body.textContent = '診斷失敗:' + e.message; });
  }

  var _layer = null;
  function hideModal() { var m = document.getElementById('m-diag-modal'); if (m) m.classList.remove('open'); _layer = null; }
  function closeModal() { if (_layer && window.AFK_UI) AFK_UI.closeLayer(_layer); else hideModal(); }

  function buildModal() {
    if (document.getElementById('m-diag-modal')) return;
    var m = document.createElement('div');
    m.id = 'm-diag-modal';
    m.innerHTML =
      '<div id="m-diag-card">' +
        '<div id="m-diag-head">' +
          '<span id="m-diag-title">🩺 快取診斷 <span id="m-diag-ver">' + DIAG_VER + '</span></span>' +
          '<button id="m-diag-close" title="關閉">✕</button>' +
        '</div>' +
        '<pre id="m-diag-body"></pre>' +
        '<div id="m-diag-foot">' +
          '<button id="m-diag-copy">📋 複製全部</button>' +
          '<button id="m-diag-save">💾 下載檔案</button>' +
          '<span id="m-diag-note">回報問題時,把這份貼給維護者</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    document.getElementById('m-diag-close').addEventListener('click', closeModal);
    m.addEventListener('click', function (e) { if (e.target === m) closeModal(); });
  }

  function injectCSS() {
    if (document.getElementById('m-diag-style')) return;
    var s = document.createElement('style');
    s.id = 'm-diag-style';
    s.textContent =
      '#m-diag-modal{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:100000;display:none;align-items:center;justify-content:center;padding:12px}' +
      '#m-diag-modal.open{display:flex}' +
      '#m-diag-card{background:#111827;border:1px solid #374151;border-radius:12px;max-width:640px;width:100%;max-height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
      '#m-diag-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #374151}' +
      '#m-diag-title{color:#fbbf24;font-weight:700}' +
      '#m-diag-ver{color:#6b7280;font-weight:400;font-size:11px;font-family:monospace}' +
      '#m-diag-close{color:#9ca3af;background:none;border:0;font-size:18px;cursor:pointer;padding:2px 6px}' +
      '#m-diag-body{margin:0;padding:12px 14px;overflow:auto;color:#e5e7eb;font-size:12px;line-height:1.65;white-space:pre-wrap;word-break:break-all;flex:1}' +
      '#m-diag-foot{display:flex;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #374151}' +
      '#m-diag-copy,#m-diag-save{background:#1d4ed8;color:#fff;border:0;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer;flex:none}' +
      '#m-diag-save{background:#047857}' +
      '#m-diag-note{color:#6b7280;font-size:11px}' +
      '@media(max-width:420px){#m-diag-foot{flex-wrap:wrap}#m-diag-note{width:100%;order:3}}';
    document.head.appendChild(s);
  }

  function init() {
    if (!document.getElementById('main-menu')) { console.warn('[AFK-diag] 找不到 #main-menu,診斷停用。'); return; }
    injectCSS();
    window.AFK_SETTINGS = window.AFK_SETTINGS || { _items: [], add: function (it) { this._items.push(it); } };
    AFK_SETTINGS.add({ label: '🩺 快取診斷', onClick: openModal });
    console.log('[AFK-diag] hooks OK');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

// The shipped game is fixed; only explicitly catalogued extras are configurable.
(function () {
    const key = 'lineage_optional_addons_v1';
    const catalog = [
        ['mobile','行動裝置版','行動支援','整合底部導覽、浮動日誌、技能快捷列、長按說明與觸控版面。'],
        ['invlist','背包條列式','顯示偏好','武器、防具與道具改為一行一件。'],
        ['eqlist','主角裝備條列式','顯示偏好','主角裝備改為部位清單；隊友裝備浮窗維持原樣。'],
        ['npclist','村莊 NPC 清單','顯示偏好','村莊改以角色清單操作，關閉恢復地圖。'],
        ['statlist','能力面板條列式','顯示偏好','能力改為卡片條列，保留本版能力來源說明。'],
        ['dollcursor','關閉娃娃游標','顯示偏好','保留一般滑鼠游標，移除娃娃游標與光點。'],
        ['notip','關閉物品懸浮說明','顯示偏好','滑鼠移到物品上不彈出說明；技能、能力來源與長按說明保留。'],
        ['keepview','返回時保留日誌分頁','顯示偏好','切回遊戲時保留原本的戰鬥／系統日誌分頁，不自動切到系統日誌。'],
        ['sellconfirm','販賣好裝備前確認','操作便利','手動販賣好裝備前顯示確認，原有防誤觸保護維持開啟。'],
        ['whbatch','倉庫批次存取','操作便利','倉庫可進入批次模式，勾選後整疊搬移。'],
        ['history','離線掛機歷史','掛機資訊','查看本機各角色最近五次離線結算，不改變收益規則。'],
        ['slotinfo','選角掛機資訊','掛機資訊','選角卡顯示離開地圖、經過時間及是否具備離線資格。'],
        ['synccompress','存檔即時壓縮','系統與角色','網頁存檔當下完成壓縮；大存檔可能使畫面短暫停頓，安裝版維持原流程。'],
        ['loadslots','16 格角色','系統與角色','增加第 9～16 格。關閉只隱藏，資料與帳號匯出仍完整保留。'],
        ['gear','齒輪加速器','額外玩法','開啟原版齒輪面板：1～64 倍、自動回村／復活、指定黑市。會加快雙方戰鬥並消耗復活資源；關頁離線維持原規則。'],
        ['ancdrop','遠古裝備來源與傳承','額外玩法','開放遠古裝備來源與製作傳承；關閉不回收已取得裝備。'],
        ['relicaffix','重複遺物詞綴','額外玩法','重複取得的遺物可帶祝福、遠古或武器屬性；關閉保留既有詞綴。'],
        ['retrial','試煉重複兌換','額外玩法','試煉材料可持續掉落與重複兌換；關閉不回收材料與獎勵。'],
        ['anyclass','裝備不限職業／性別','額外玩法','放寬裝備資格；關閉後不符資格的裝備會卸回背包。']
    ].map(([id,name,group,desc]) => ({id,name,group,desc,def:false}));
    const mobile = new Set('mobile battlehud mapbar nozoom statusicon battlebuffs skillbar petui backnav touchtip toast'.split(' '));
    const fixed = new Set('lzcache clanroster allyslim dex wiki storage quotawarn diag powersave autobuy training dograce junkmgr mercguard squadsync relicbatch bmprice bossavoid bossring itemsearch npclabel mobname trackinfo trackmaps relicguard wpnfix enhtarget attrbatch cursebatch modalguard locksafe buyercompat traditional warehouse pwa'.split(' '));
    const optional = new Set(catalog.map(item => item.id)), registry = [], byId = new Map(), overrides = new Map();
    let stored = {v:1,enabled:{}};
    try { const value = JSON.parse(_lsGet(key)); if (value?.v === 1 && value.enabled && typeof value.enabled === 'object' && !Array.isArray(value.enabled)) stored = value; } catch (e) {}
    const active = Object.fromEntries(catalog.map(item => [item.id, stored.enabled[item.id] === true]));
    window.AFK_TOGGLES = {
        register(spec) {
            if (!spec?.id || byId.has(spec.id)) return;
            const entry = {...spec,def:fixed.has(spec.id)};
            registry.push(entry); byId.set(spec.id,entry);
        },
        enabled(id) {
            if (overrides.has(id)) return overrides.get(id);
            if (mobile.has(id)) return active.mobile;
            return optional.has(id) ? active[id] : fixed.has(id);
        },
        // Runtime overrides remain available to existing integration fixtures, never persisted.
        set(id,on) { overrides.set(id,!!on); },
        list() { return registry.slice(); }
    };
    for (const item of catalog) AFK_TOGGLES.register(item);
    window.optionalAddons = {
        catalog, key,
        selection() { return {...active}; },
        save(selection) {
            const value = JSON.stringify({...stored,v:1,enabled:{...stored.enabled,...Object.fromEntries(catalog.map(item => [item.id,selection[item.id] === true]))}});
            const before = _lsGet(key);
            if (!_lsSet(key,value) || _lsGet(key) !== value) {
                if (_lsGet(key) !== before) { if (before == null) _lsRemove(key); else _lsSet(key,before); }
                throw Error('加掛設定儲存失敗，尚未重新載入，請重試。');
            }
        }
    };
})();

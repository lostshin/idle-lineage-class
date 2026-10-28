// Portable account data is explicit: never copy device preferences or storage locks.
const ACCOUNT_FORMAT = 'idle-lineage-account';
const ACCOUNT_MARKET_KEY = 'fb5_pandora_relic_market_v1';
const RACE_LEDGER_KEY = 'fb5_race_claims_v1';
function accountClone(value) { return JSON.parse(JSON.stringify(value)); }
function accountRoleId(p) { return p && (p.enSeed || ('es' + _seedHash((p.name || '') + '|' + p.cls + '|lz').toString(36))); }
function accountRead(key, signed = false, fallback = null) {
    const raw = _lzGet(key);
    if (raw == null) return accountClone(fallback);
    const u = signed ? _saveUnwrap(raw) : {payload:raw, ok:true};
    if (!u.ok) throw Error('資料校驗失敗：' + key);
    try { return JSON.parse(u.payload); } catch (e) { throw Error('資料無法讀取：' + key); }
}
function accountMergeRaceTickets(incoming, current, owner) {
    const ticketId = (t, i) => t.id || owner+'|'+t.raceId+'|'+t.dogIdx+'|'+i;
    const claimed = new Set(current.flatMap((t, i) => t.claimed ? [ticketId(t, i)] : []));
    return incoming.map((t, i) => ({...t, claimed:!!t.claimed || claimed.has(ticketId(t, i))}));
}
function accountRoleDoc(slot) {
    const d = accountRead('lineage_idle_save_' + slot, true);
    if (d != null && (!d.p || !d.p.cls || !Array.isArray(d.p.inv))) throw Error('角色 ' + slot + ' 資料無效。');
    return d;
}
function accountIdleRequired(readOnly = false) {
    if (_roleOtherActiveSessions(readOnly).length) throw Error('其他角色分頁仍在遊玩，請先回到選角頁再操作。');
}
function buildAccountSnapshot() { return accountSnapshot(false); }
function buildRecoveryAccountSnapshot() {
    if (!player.cls || player.dead || document.getElementById('game-screen').classList.contains('hidden')) throw Error('請在存活角色的遊戲畫面匯出救援帳號。');
    if (state.ff || catchupActive()) throw Error('正在結算，請完成後再匯出救援帳號。');
    if (!_roleSaveAllowed()) throw Error('角色存檔位已變更，無法匯出此分頁的救援帳號。');
    accountIdleRequired(true);
    syncSaveConfig();
    sanitizeState();
    _mercMonotonicExpGuard();
    return accountSnapshot(true);
}
function accountSnapshot(recovery) {
    accountIdleRequired(recovery);
    if (!recovery && state.running && player.cls) {
        window.__fb5CloseFlush = true;
        try { if (saveGame() !== true) throw Error('目前角色未能儲存，匯出已取消。'); }
        finally { window.__fb5CloseFlush = false; }
    }
    if (!recovery && _mercLedgerOutbox.length) { _mercLedgerFlush(); if (_mercLedgerOutbox.length) throw Error('傭兵經驗尚未寫入，請稍後重試。'); }
    const roles = Array.from({length:SAVE_SLOT_MAX}, (_, i) => recovery && i + 1 === currentSlot ? {...accountRoleDoc(i + 1),...JSON.parse(saveStateJson())} : accountRoleDoc(i + 1));
    const seen = new Set();
    roles.forEach((d, i) => {
        if (!d) return;
        const id = accountRoleId(d.p); if (seen.has(id)) throw Error('帳號有重複角色身分。'); seen.add(id); d.p.enSeed = id;
        if (!_FS) {
            d.p.accountAddonPrefs = {};
            for (const prefix of ADDON_ROLE_PREFS) {
                const value = _lzGet(prefix + (i + 1));
                if (value != null) d.p.accountAddonPrefs[prefix] = value;
            }
        }
        const ref = antharasRoleRef(d.p, i + 1); d.p.antharasClearDay = antharasRoleClearDay(ref);
        d.p.accountParty = (d.p.allies || []).map(a => ({id:accountRoleId(a), auto:accountClone(a._autoBuff || {}), potPct:a.potPct, exp:a._expGained || 0, alignment:a._alignmentDelta || 0}));
        d.p.allies = []; d.p.summonsV2 = []; d.p.guardsV2 = [];
    });
    const ledger = accountRead(MERC_LEDGER_KEY,false,[]);
    if (recovery) {
        const seen = new Set(ledger.map(row => row.uid));
        for (const row of _mercLedgerOutbox) if (row?.uid && !seen.has(row.uid)) { ledger.push(accountClone(row)); seen.add(row.uid); }
    }
    return validateAccount({format:ACCOUNT_FORMAT,schema:2,source:_FS?'desktop':'web',version:GAME_VERSION,exportedAt:new Date().toISOString(),roles,
        ...(recovery ? {importNotes:['救援帳號：目前角色取自未確認儲存的記憶體進度；其他角色與共用資料取自可讀取的本機存檔，寵物含目前名冊進度。請先保留原檔，再確認匯入。']} : {}),
        shared:{modes:accountLocalModes(recovery),market:accountRead(ACCOUNT_MARKET_KEY,true,null),raceClaims:accountRead(RACE_LEDGER_KEY,true,[]),diamonds:pandoraGetSharedDiamonds(),clan:clanExportSharedState(),ledger,autosell:accountRead(AUTOSELL_GLOBAL_KEY,false,null)}});
}
function accountLocalModes(recovery = false) {
    const modes = {};
    for (const classicMode of [false, true]) {
        const p = {classicMode}, suffix = modeSuffix(classicMode, false);
        const warehouse = accountRead(whKey(p), false, {items:[],gold:0});
        let pets = accountRead(PET_ROSTER_KEY + suffix, true, []);
        if (recovery && _petRosterKey === PET_ROSTER_KEY + suffix) {
            const stored = new Map(pets.map(p => [p.uid,p])), tombs = {..._petTombsRead(PET_ROSTER_KEY + suffix),..._petReleasedUids};
            for (const p of _petRoster) stored.set(p.uid,{...stored.get(p.uid),..._petPersist(p)});
            pets = [...stored.values()].filter(p => !tombs[p.uid]);
        }
        if (!Array.isArray(warehouse.items) || !Array.isArray(pets)) throw Error('共用倉庫或寵物名冊無效。');
        const dex = {};
        for (const key of [CARDDEX_KEY,EQUIPDEX_KEY,MISCDEX_KEY,RELICDEX_KEY]) dex[key] = accountRead(_dexKey(key,p),false,{});
        modes[classicMode ? 'classic' : 'normal'] = {warehouse,pets:portablePetRoster(pets),dex};
    }
    return modes;
}
function validateAccount(a) {
    if (!a || a.format !== ACCOUNT_FORMAT || ![1,2].includes(a.schema) || !Array.isArray(a.roles) || a.roles.length !== (a.schema === 1 ? 8 : SAVE_SLOT_MAX) || !a.shared) throw Error('不是支援的帳號存檔。');
    if (a.schema === 1) { a.roles = a.roles.concat(Array(SAVE_SLOT_MAX - 8).fill(null)); a.schema = 2; }
    if (a.source !== (_FS?'desktop':'web')) throw Error('網頁版與安裝版帳號存檔彼此獨立，無法交互匯入。');
    if(a.shared.raceClaims!==undefined&&(!Array.isArray(a.shared.raceClaims)||a.shared.raceClaims.some(id=>typeof id!=='string')))throw Error('賽狗結算紀錄無效。');
    if(a.shared.market!==undefined&&a.shared.market!==null&&(typeof a.shared.market!=='object'||Array.isArray(a.shared.market)||!Number.isFinite(a.shared.market.diamonds)))throw Error('黑市共用資料無效。');
    const ids = new Set();
    for (const d of a.roles) {
        if (d === null) continue;
        if (!d?.p?.cls || !CLAN_CLASS_NAMES[d.p.cls] || !Array.isArray(d.p.inv) || !Number.isFinite(d.p.lv) || d.p.lv < 1 || d.p.lv > 100) throw Error('帳號角色資料無效。');
        const id = accountRoleId(d.p); if (ids.has(id)) throw Error('帳號包含重複角色。'); ids.add(id);
    }
    for (const mode of ['normal','classic']) {
        const m = a.shared.modes?.[mode];
        if (!m || !Array.isArray(m.warehouse?.items) || !Number.isFinite(m.warehouse.gold) || !Array.isArray(m.pets) || m.pets.length > PET_STORAGE_MAX || !m.dex || typeof m.dex !== 'object') throw Error('帳號共用資料無效。');
        for (const key of [CARDDEX_KEY,EQUIPDEX_KEY,MISCDEX_KEY,RELICDEX_KEY]) if (!m.dex[key] || typeof m.dex[key] !== 'object' || Array.isArray(m.dex[key])) throw Error('圖鑑資料無效。');
    }
    if (!Number.isFinite(a.shared.diamonds) || a.shared.diamonds < 0 || !a.shared.clan?.modes || !a.shared.clan?.members || !Array.isArray(a.shared.ledger)) throw Error('龍鑽、血盟或經驗帳本無效。');
    return a;
}
// Convert the fork's local full backup through the same account preview, never clear storage.
function accountFromForkBackup(pack) {
    if(_FS)throw Error('加掛版網頁備份不能匯入安裝版。');
    if(pack.schema!==1||!pack.keys||typeof pack.keys!=='object'||Array.isArray(pack.keys)||Object.keys(pack.keys).length!==pack.keyCount||Object.values(pack.keys).some(v=>typeof v!=='string'))throw Error('完整備份格式不完整，未匯入任何資料。');
    function read(key,signed=false,fallback=null){
        let raw=pack.keys[key];if(raw==null)return accountClone(fallback);
        if(raw.startsWith('LZ1:'))raw=LZString.decompressFromUTF16(raw.slice(4));
        if(raw==null)throw Error('備份資料無法解壓：'+key);
        if(raw.startsWith('SIG2:'))throw Error('備份包含安裝版資料，無法匯入網頁版。');
        const u=signed?_saveUnwrap(raw):{ok:true,payload:raw};if(!u.ok)throw Error('備份資料校驗失敗：'+key);
        return JSON.parse(u.payload);
    }
    for(const key of Object.keys(pack.keys))if(/^lineage_idle_save_\d+$/.test(key)&&Number(key.split('_').at(-1))>SAVE_SLOT_MAX&&read(key,true)?.p?.cls)throw Error('備份超過十六格角色，請先在來源端整理或逐角色匯入。未寫入任何資料。');
    const notes=['加掛版完整備份：只匯入帳號進度與支援的角色偏好，不移植外掛開關、裝置設定或工作階段。'];
    const roles=Array.from({length:SAVE_SLOT_MAX},(_,i)=>{
        const d=read('lineage_idle_save_'+(i+1),true);if(!d)return null;const p=d.p;if(!p?.cls)throw Error('備份角色資料無效。');p.config||={};const c=p.config,slot=i+1;
        p.accountAddonPrefs = {};
        for (const prefix of ADDON_ROLE_PREFS) if (pack.keys[prefix + slot] != null) p.accountAddonPrefs[prefix] = pack.keys[prefix + slot];
        if(pack.keys['afk_trad_'+slot]!=null)c.randomEnhance=pack.keys['afk_trad_'+slot]==='1';
        if(pack.keys['afk_autobuy_magicbarrier_'+slot]!=null)c.barrierStock=pack.keys['afk_autobuy_magicbarrier_'+slot]==='1';
        if(pack.keys['afk_bossavoid_'+slot]!=null){const maps=JSON.parse(pack.keys['afk_bossavoid_'+slot]);if(maps&&typeof maps==='object'&&!Array.isArray(maps)){c.bossAvoid={};for(const [map,ids]of Object.entries(maps))if(DB.maps[map]&&Array.isArray(ids)&&ids.length)c.bossAvoid[map]=ids.filter(id=>DB.mobs[id]);}}
        const hunt=pack.keys.afk_toggle_bossring!=='0'&&(pack.keys['afk_bossring_on_'+slot]??pack.keys.afk_bossring_on??'1')==='1';
        c.bossMode=c.setTeleport?'avoid':hunt?'hunt':'off';if(hunt&&c.setTeleport)notes.push('角色 '+slot+' 原先同時開找王／避王，匯入採避王；可在角色設定切換。');
        p.enSeed=accountRoleId(p);p.accountParty=(p.allies||[]).map(a=>({id:accountRoleId(a),auto:accountClone(a._autoBuff||{}),potPct:a.potPct,exp:a._expGained||0,alignment:a._alignmentDelta||0}));p.allies=[];p.summonsV2=[];p.guardsV2=[];return d;
    });
    const modes={};for(const classicMode of [false,true]){const p={classicMode},suffix=modeSuffix(classicMode,false),dex={};for(const key of [CARDDEX_KEY,EQUIPDEX_KEY,MISCDEX_KEY,RELICDEX_KEY])dex[key]=read(_dexKey(key,p),false,{});modes[classicMode?'classic':'normal']={warehouse:read(whKey(p),false,{items:[],gold:0}),pets:portablePetRoster(read(PET_ROSTER_KEY+suffix,true,[])),dex};}
    const market=read(ACCOUNT_MARKET_KEY,true,null);
    return validateAccount({format:ACCOUNT_FORMAT,schema:2,source:'web',version:GAME_VERSION,exportedAt:pack.exportedAt||'',roles,importNotes:notes,shared:{modes,market,diamonds:market?.diamonds||0,clan:read(CLAN_STATE_KEY,true,_clanDefaultState()),ledger:read(MERC_LEDGER_KEY,false,[]),raceClaims:read(RACE_LEDGER_KEY,true,[]),autosell:read(AUTOSELL_GLOBAL_KEY,false,null)}});
}
function parseAccountFile(raw) {
    if(String(raw).trim().startsWith('{')){const pack=JSON.parse(raw);if(pack.format==='idle-lineage-full')return accountFromForkBackup(pack);}
    if (!_FS && String(raw).startsWith('SIG2:')) throw Error('安裝版帳號檔無法匯入網頁版。');
    if (_FS && typeof _FS.sign === 'function' && !String(raw).startsWith('SIG2:')) throw Error('安裝版只支援安裝版簽發的帳號檔。');
    const u = _saveUnwrap(String(raw));
    if (!u.signed || !u.ok) throw Error('帳號存檔校驗失敗，未匯入任何資料。');
    return validateAccount(JSON.parse(u.payload));
}
// Old versions export one role per file; combine a folder of them into one account preview.
function accountFromRoleFiles(entries) {
    if(_FS)throw Error('安裝版不支援一次匯入多個網頁版角色檔。');
    const files=entries.map(f=>{
        if(String(f.raw).startsWith('SIG2:'))throw Error(f.name+' 是安裝版存檔，無法匯入網頁版。');
        const u=_saveUnwrap(String(f.raw));if(!u.ok)throw Error(f.name+' 校驗失敗，未匯入任何資料。');
        let d;try{d=JSON.parse(u.payload);}catch(e){throw Error(f.name+' 不是有效的存檔。');}
        if(d?.format==='idle-lineage-desktop-save')throw Error(f.name+' 是安裝版存檔，無法匯入網頁版。');
        if(!d?.p?.cls||!CLAN_CLASS_NAMES[d.p.cls]||!Array.isArray(d.p.inv))throw Error(f.name+' 不是角色存檔；帳號檔請單獨匯入。');
        const slot=Number((/fable5_save_(\d+)_/.exec(f.name)||[])[1]);
        return {...f,d,signed:u.signed,slot};
    });
    if(files.length>SAVE_SLOT_MAX)throw Error('請一次最多選 16 個角色檔。');
    const ids=new Map();
    for(const f of files){const id=accountRoleId(f.d.p);if(ids.has(id))throw Error(ids.get(id)+' 與 '+f.name+' 是同一個角色，請只選一個。');ids.set(id,f.name);}
    const roles=Array(SAVE_SLOT_MAX).fill(null),pending=[];
    for(const f of files)(f.slot>=1&&f.slot<=SAVE_SLOT_MAX&&!roles[f.slot-1]?(roles[f.slot-1]=f):pending.push(f));
    for(const f of pending)roles[roles.indexOf(null)]=f;
    const newest=list=>list.reduce((a,b)=>!a||b.lastModified>a.lastModified?b:a,null);
    const modes=accountLocalModes(),sources=[];
    for(const mode of ['normal','classic']){
        const f=newest(files.filter(x=>!!x.d.p.classicMode===(mode==='classic')&&x.d.wh));if(!f)continue;
        modes[mode].warehouse={items:f.d.wh.items||[],gold:Math.max(0,Math.floor(Number(f.d.wh.gold)||0))};
        if(Array.isArray(f.d.pets))modes[mode].pets=portablePetRoster(f.d.pets);
        sources.push((mode==='classic'?'經典':'一般')+'倉庫與寵物取自 '+f.name);
    }
    const latest=newest(files.filter(x=>x.d.pandoraDiamonds!==undefined||x.d.clanState));
    if(latest)sources.push('龍鑽與血盟取自 '+latest.name);
    const notes=files.filter(f=>!f.signed).map(f=>f.name+' 沒有完整性簽章（可能是舊版檔），仍照常讀取。');
    return validateAccount({format:ACCOUNT_FORMAT,schema:2,source:'web',version:GAME_VERSION,exportedAt:new Date(newest(files).lastModified).toISOString(),importNotes:notes,
        sharedNote:'共 '+files.length+' 個角色檔：'+sources.join('；')+'。舊版角色檔不含圖鑑與傭兵隊伍：圖鑑維持本機現有資料，隊伍需重新編組。',
        roles:roles.map(f=>{if(!f)return null;const d=accountClone(f.d);for(const k of ['wh','pets','pandoraDiamonds','clanState'])delete d[k];d.p.enSeed=accountRoleId(d.p);d.p.allies=[];d.p.accountParty=[];return d;}),
        shared:{modes,market:accountRead(ACCOUNT_MARKET_KEY,true,null),raceClaims:[],diamonds:latest?.d.pandoraDiamonds!==undefined?Math.max(0,Math.floor(Number(latest.d.pandoraDiamonds)||0)):pandoraGetSharedDiamonds(),
            clan:latest?.d.clanState||clanExportSharedState(),ledger:[],autosell:accountRead(AUTOSELL_GLOBAL_KEY,false,null)}});
}
function accountImportFromFiles(entries) {
    const isAccount=raw=>{try{const t=String(raw).trim();if(t.startsWith('{')&&JSON.parse(t).format==='idle-lineage-full')return true;return JSON.parse(_saveUnwrap(t).payload).format===ACCOUNT_FORMAT;}catch(e){return false;}};
    if(entries.length===1&&(_FS||String(entries[0].raw).startsWith('SIG2:')||isAccount(entries[0].raw)))return parseAccountFile(String(entries[0].raw));
    if(entries.some(f=>isAccount(f.raw)))throw Error('帳號檔請單獨匯入，不要和角色檔一起選。');
    return accountFromRoleFiles(entries);
}
function planAccountImport(data, choices = {}) {
    validateAccount(data); accountIdleRequired();
    if (state.running) throw Error('請先返回角色選擇頁。');
    const current = Array.from({length:SAVE_SLOT_MAX},(_,i)=>accountRoleDoc(i+1));
    const reserved = new Set(), actions = [], before = current.map((d,i)=>_lsGet('lineage_idle_save_'+(i+1)));
    // Existing identity wins its current position, before new characters claim positions.
    data.roles.forEach((d,i)=>{if(!d)return;const at=current.findIndex(c=>c && accountRoleId(c.p)===accountRoleId(d.p));if(at>=0){reserved.add(at+1);actions.push({source:i+1,target:at+1,kind:'update',doc:accountClone(d)});}});
    data.roles.forEach((d,i)=>{
        if (!d || actions.some(a=>a.source===i+1)) return;
        const target=i+1, conflict=!!current[i] || reserved.has(target);
        const replace=choices[target]===true && !reserved.has(target);
        actions.push({source:i+1,target,kind:conflict?(replace?'replace':'skip'):'add',conflict,blocked:reserved.has(target),doc:accountClone(d)});
        if (!conflict || replace) reserved.add(target);
    });
    return {data:accountClone(data),actions:actions.sort((a,b)=>a.source-b.source),before};
}
// A synchronous transaction verifies each write and restores exact original bytes on failure.
function accountWriteBatch(writes, action) {
    const keys=[...new Set(writes.map(w=>w.key).concat(action?[ACCOUNT_MARKET_KEY,CLAN_STATE_KEY]:[]))];
    const before=keys.map(key=>({key,raw:_lsGet(key)}));
    try {
        for (const w of writes) {
            if (w.value == null) { _lzRemoveStored(w.key); if (_lsGet(w.key) != null) throw Error('儲存失敗：'+w.key); }
            else if (!(w.raw ? _lzSetStoredRaw(w.key,w.value) : _lzSet(w.key,w.value)) || (w.raw ? _lsGet(w.key) : _lzGet(w.key))!==w.value) throw Error('儲存失敗：'+w.key);
        }
        if (action) action();
        return {ok:true};
    } catch (e) {
        let restored=true;
        for (const b of before.reverse()) {
            if (_lsGet(b.key) === b.raw) continue;
            if (b.raw == null) { _lzRemoveStored(b.key); restored=restored&&_lsGet(b.key)==null; }
            else restored=!!_lzSetStoredRaw(b.key,b.raw)&&restored;
        }
        return {ok:false,error:String(e.message||e)+(restored?'；已還原變更前資料。':'；回復失敗，請保留匯入檔並重新載入。')};
    }
}
function applyAccountImport(plan) {
    try {
        accountIdleRequired(); if (state.running) throw Error('請先回到選角頁。');
        for(let i=0;i<SAVE_SLOT_MAX;i++) if(_lsGet('lineage_idle_save_'+(i+1))!==plan.before[i]) throw Error('角色資料已變動，請重新預覽匯入。');
        const data=validateAccount(plan.data), final=Array.from({length:SAVE_SLOT_MAX},(_,i)=>accountRoleDoc(i+1)), imported=new Set(), writes=[];
        for (const a of plan.actions) if(a.kind!=='skip') { const d=accountClone(a.doc);d.p.raceTickets=accountMergeRaceTickets(d.p.raceTickets||[],final[a.target-1]?.p.raceTickets||[],accountRoleId(d.p));d.p.enSeed=accountRoleId(d.p);d.p._roleEpoch=_roleEpoch();d.p.allies=[];d.p.summonsV2=[];d.p.guardsV2=[];final[a.target-1]=d;imported.add(d.p.enSeed); }
        const slots=new Map(final.flatMap((d,i)=>d?[[accountRoleId(d.p),i+1]]:[]));
        const oldLedger=accountRead(MERC_LEDGER_KEY,false,[]), ledger=new Map();
        for(const row of oldLedger.concat(data.shared.ledger)) {
            if(!row?.uid || !row.enSeed || !slots.has(row.enSeed)) continue;
            if(!imported.has(row.enSeed) && !oldLedger.includes(row)) continue;
            const prev=ledger.get(row.uid);if(!prev || row.claimed)ledger.set(row.uid,{...row,slot:String(slots.get(row.enSeed)),claimed:!!(row.claimed||prev?.claimed)});
        }
        for(let i=0;i<SAVE_SLOT_MAX;i++) {
            const d=final[i]; if(!d)continue;
            if(imported.has(accountRoleId(d.p))) {
                d.p.accountParty=(d.p.accountParty||[]).filter(r=>r.id!==accountRoleId(d.p)&&slots.has(r.id)&&!!final[slots.get(r.id)-1].p.classicMode===!!d.p.classicMode).map(r=>({...r,slot:slots.get(r.id)}));
                writes.push({key:'lineage_idle_save_'+(i+1),value:_saveWrap(JSON.stringify(d))});
                if (!_FS) for (const [prefix, value] of Object.entries(addonRolePreferences(d.p))) {
                    if (ADDON_ROLE_PREFS.includes(prefix) && typeof value === 'string') writes.push({key:prefix+(i+1),value,raw:true});
                }
            }
        }
        const clan=accountClone(data.shared.clan), validIds=new Set(final.filter(Boolean).map(d=>clanRoleId(d.p)));
        for(const id of Object.keys(clan.members)) if(!validIds.has(id))delete clan.members[id];
        const oldClan=clanExportSharedState();
        for(const d of final.filter(Boolean)) if(!imported.has(accountRoleId(d.p))) {
            const id=clanRoleId(d.p),mode=clanModeKey(d.p);
            if(oldClan.members[id] && clan.modes[mode]?.leaderId===oldClan.modes[mode]?.leaderId)clan.members[id]=oldClan.members[id];
            else delete clan.members[id];
        }
        for(const mode of ['normal','classic']) {
            if(clan.modes[mode]&&!validIds.has(clan.modes[mode].leaderId)){clan.modes[mode]=null;for(const id of Object.keys(clan.members))if(clan.members[id].mode===mode)delete clan.members[id];}
            const m=data.shared.modes[mode],p={classicMode:mode==='classic'},suffix=modeSuffix(p.classicMode,false);
            writes.push({key:whKey(p),value:JSON.stringify(m.warehouse)},{key:whKey(p)+'_rm',value:'{}'},
                {key:PET_ROSTER_KEY+suffix,value:_saveWrap(JSON.stringify(portablePetRoster(m.pets)))},{key:PET_ROSTER_KEY+suffix+'_rm',value:_saveWrap('{}')});
            for(const key of [CARDDEX_KEY,EQUIPDEX_KEY,MISCDEX_KEY,RELICDEX_KEY])writes.push({key:_dexKey(key,p),value:JSON.stringify(m.dex[key])});
            writes.push({key:_mercEmploymentKey(p.classicMode),value:'{}'});
            for(let n=1;n<=SAVE_SLOT_MAX;n++)writes.push({key:_mercEmployerBucketKey(p.classicMode,n),value:null});
        }
        if(data.shared.market)writes.push({key:ACCOUNT_MARKET_KEY,value:_saveWrap(JSON.stringify(data.shared.market))});
        const raceClaims=[...new Set(accountRead(RACE_LEDGER_KEY,true,[]).concat(data.shared.raceClaims||[]))];
        writes.push({key:RACE_LEDGER_KEY,value:_saveWrap(JSON.stringify(raceClaims))});
        writes.push({key:MERC_LEDGER_KEY,value:JSON.stringify([...ledger.values()])},{key:AUTOSELL_GLOBAL_KEY,value:data.shared.autosell?JSON.stringify(data.shared.autosell):null});
        const result=accountWriteBatch(writes,()=>{const pd=pandoraRestoreSharedDiamonds(data.shared.diamonds);if(!pd?.ok)throw Error(pd?.error||'龍鑽還原失敗');const c=clanRestoreSharedState(clan);if(!c?.ok)throw Error(c?.error||'血盟還原失敗');});
        if(!result.ok)return result;
        _petRoster=[];_petRosterKey=null;_petRosterDirty=false;_petReleasedUids={};_whLoadUids=null;_mercLedgerOutbox=[];
        player.cls=null;_clanScanCache={mode:null,at:0,roles:null};_roleSessionForget();renderLoadSelect();return {ok:true,imported:plan.actions.filter(a=>a.kind!=='skip').length,skipped:plan.actions.filter(a=>a.kind==='skip').length};
    } catch(e) {return {ok:false,error:e.message};}
}
function restoreAccountParty() {
    if(!player.accountParty)return;
    const refs=player.accountParty;delete player.accountParty;
    player.allies=refs.map(ref=>{const d=_roleReadSavePlayer(ref.slot);if(!d||accountRoleId(d)!==ref.id||ref.id===accountRoleId(player)||!!d.classicMode!==!!player.classicMode)return null;const a=buildAlly(String(ref.slot));if(a){a._autoBuff=ref.auto||{};a.potPct=ref.potPct;a._expGained=ref.exp||0;a._alignmentDelta=ref.alignment||0;}return a;}).filter(Boolean);
    syncMercenaryEmploymentRegistry();renderSquadPanel();
}
function transferDialog(id,title,body) {
    let dialog=document.getElementById(id);
    if(!dialog){dialog=document.createElement('div');dialog.id=id;dialog.className='transfer-overlay';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');document.body.appendChild(dialog);}
    dialog._returnFocus=document.activeElement;dialog.innerHTML='<section class="panel transfer-frame"><header class="panel-header">'+partyEscape(title)+'</header><div class="transfer-body">'+body+'</div></section>';dialog.hidden=false;
    const first=dialog.querySelector('input,button,select');first?.focus();
    return dialog;
}
function closeTransferDialog(dialog) {dialog.hidden=true;if(dialog._returnFocus?.isConnected)dialog._returnFocus.focus();}
document.addEventListener('keydown',event=>{
    const d=Array.from(document.querySelectorAll('.transfer-overlay')).find(d=>!d.hidden);if(!d)return;
    if(event.key==='Escape'&&!event.defaultPrevented&&!event.isComposing){event.preventDefault();closeTransferDialog(d);}
    if(event.key==='Tab'){const focus=Array.from(d.querySelectorAll('input,button,select')).filter(e=>!e.disabled);const first=focus[0],last=focus[focus.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
async function exportAccount(recovery = false) {
    try {
        const a=recovery ? buildRecoveryAccountSnapshot() : buildAccountSnapshot(),raw=_saveWrap(JSON.stringify(a)),file=(_FS?'idle_lineage_desktop_account_':'fable5_account_')+(recovery?'recovery_':'')+new Date().toISOString().slice(0,10)+'.json';
        if(window.showSaveFilePicker){try{const h=await window.showSaveFilePicker({suggestedName:file,types:[{description:'帳號存檔',accept:{'application/json':['.json']}}]});const w=await h.createWritable();await w.write(raw);await w.close();return;}catch(e){if(e.name==='AbortError')return;}}
        downloadSaveFile(raw,file);
    } catch(e) {alert('帳號匯出失敗：'+e.message);}
}
function importAccount() {
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.multiple=true;
    input.onchange=async()=>{if(!input.files.length)return;try{const entries=await Promise.all(Array.from(input.files,async f=>({name:f.name,raw:await f.text(),lastModified:f.lastModified})));showAccountImport(accountImportFromFiles(entries));}catch(e){alert('帳號匯入失敗：'+e.message);}};input.click();
}
function showAccountImport(data) {
    const plan=planAccountImport(data),rows=plan.actions.map(a=>{
        const old=slotSummary(a.target),p=a.doc.p,label=(p.name||'未命名')+' '+(CLAN_CLASS_NAMES[p.cls]||p.cls)+' Lv.'+p.lv;
        return '<div class="transfer-role"><b>角色 '+a.source+' → 第 '+a.target+' 格'+(a.target>visibleSaveSlotMax()?'（目前隱藏，開啟 16 格角色後可使用）':'')+'</b><span>'+partyEscape(label)+'</span>'+(a.blocked?'<p class="transfer-note">此格已保留給另一位匯入角色；請先整理角色位置，再匯入本角色。</p>':a.conflict?'<label>此格已有 '+partyEscape(old?.name||old?.cls||'其他角色')+'，是否取代？ <select data-account-choice="'+a.source+'" '+(a.blocked?'disabled':'')+'><option value="keep">保留，跳過此角色</option><option value="replace">取代</option></select></label>':'<small>'+(a.kind==='update'?'更新相同角色':'匯入空格')+'</small>')+'</div>';
    }).join('');
    const dialog=transferDialog('account-import-dialog','匯入帳號',rows+'<p class="transfer-note">'+(data.sharedNote?partyEscape(data.sharedNote)+' 龍鑽 '+data.shared.diamonds+' 顆。':'共用資料將依此檔還原：一般／經典倉庫、4 種圖鑑、寵物、血盟／城堡、傭兵經驗與龍鑽 '+data.shared.diamonds+' 顆。')+'寵物回保管；未匯入角色的失效隊伍與血盟關係解除。空格不刪除現有角色。</p><p class="transfer-note">相同角色將以這份檔案取代目前進度；請確認檔案日期：'+partyEscape(data.exportedAt)+'</p><p id="account-import-status" role="status"></p><div class="transfer-actions"><button class="btn" id="account-import-confirm">確認匯入</button><button class="btn" id="account-import-cancel">取消</button></div>');
    if(data.importNotes?.length)dialog.querySelector('.transfer-body').insertAdjacentHTML('afterbegin','<div class="transfer-note">'+data.importNotes.map(n=>'<p>'+partyEscape(n)+'</p>').join('')+'</div>');
    dialog.querySelector('#account-import-cancel').onclick=()=>closeTransferDialog(dialog);
    dialog.querySelector('#account-import-confirm').onclick=()=>{
        const choices={};dialog.querySelectorAll('[data-account-choice]').forEach(s=>choices[s.dataset.accountChoice]=s.value==='replace');
        const fresh=planAccountImport(data,choices);if(fresh.before.some((v,i)=>v!==plan.before[i])){dialog.querySelector('#account-import-status').textContent='資料已變動，請取消後重新匯入。';return;}
        const r=applyAccountImport(fresh);dialog.querySelector('#account-import-status').textContent=r.ok?'已匯入 '+r.imported+' 位角色，跳過 '+r.skipped+' 位。':r.error;
        if(r.ok){dialog.querySelector('#account-import-confirm').disabled=true;dialog.querySelector('#account-import-cancel').textContent='完成';}
    };
}
function loadRenameSelected() {
    const slot=_loadSelectedSlot,doc=accountRoleDoc(slot);if(!doc)return;
    const count=Math.max(0,Math.floor(Number(doc.p.renameCount)||0)),id=accountRoleId(doc.p);
    const dialog=transferDialog('rename-dialog','修改暱稱','<label for="rename-input">人物暱稱（最多 12 字）</label><input id="rename-input" maxlength="12" value="'+partyEscape(doc.p.name||'')+'" autocomplete="off"><p class="transfer-note">'+(count?'此次消耗 1 顆龍鑽，目前 '+pandoraGetSharedDiamonds()+' 顆。':'此角色首次修改免費。之後每次消耗 1 顆龍鑽。')+'</p><p id="rename-status" role="status"></p><div class="transfer-actions"><button class="btn" id="rename-confirm">確認</button><button class="btn" id="rename-cancel">取消</button></div>');
    const input=dialog.querySelector('#rename-input');input.focus();input.select();
    dialog.querySelector('#rename-cancel').onclick=()=>closeTransferDialog(dialog);
    input.onkeydown=e=>{if(e.isComposing||e.keyCode===229)return;if(e.key==='Enter'){e.preventDefault();dialog.querySelector('#rename-confirm').click();}};
    dialog.querySelector('#rename-confirm').onclick=()=>{
        const status=dialog.querySelector('#rename-status'),name=input.value.trim();
        if(!name||name.length>12||/[<>&"'\x00-\x1f]/.test(name)){status.textContent='請輸入 1～12 字的有效暱稱。';return;}
        if(name===(doc.p.name||'')){closeTransferDialog(dialog);return;}
        try{
            accountIdleRequired();const latest=accountRoleDoc(slot);if(accountRoleId(latest.p)!==id||JSON.stringify(latest)!==JSON.stringify(doc))throw Error('角色已變動，請重新開啟改名。');
            const cost=count?1:0;if(pandoraGetSharedDiamonds()<cost)throw Error('龍之鑽石不足。');
            if(_roleReadObject(ROLE_SESSION_REGISTRY_KEY)[_roleSessionId]&&state.running)throw Error('請返回選角頁再改名。');
            latest.p.name=name;latest.p.renameCount=count+1;latest.p.enSeed=id;latest.p._roleEpoch=_roleEpoch();
            const writes=[{key:'lineage_idle_save_'+slot,value:_saveWrap(JSON.stringify(latest))}];
            for(let n=1;n<=SAVE_SLOT_MAX;n++) {
                if(n===slot)continue;
                const d=accountRoleDoc(n);if(!d)continue;let changed=false;
                for(const a of d.p.allies||[])if(accountRoleId(a)===id){a.name=name;a._allyName=name;changed=true;}
                if(changed)writes.push({key:'lineage_idle_save_'+n,value:_saveWrap(JSON.stringify(d))});
            }
            const result=accountWriteBatch(writes,()=>{if(cost){const r=pandoraAdjustSharedDiamonds(-cost);if(!r?.ok)throw Error(r?.error||'龍鑽扣款失敗');}});
            if(!result.ok)throw Error(result.error);
            if(player && accountRoleId(player)===id){player.name=name;player.renameCount=count+1;player._roleEpoch=latest.p._roleEpoch;}
            for(const a of player.allies||[])if(accountRoleId(a)===id){a.name=name;a._allyName=name;}
            _clanScanCache={mode:null,at:0,roles:null};renderLoadSelect();closeTransferDialog(dialog);
        }catch(e){status.textContent='修改失敗：'+e.message;input.focus();}
    };
}

// Failure cases: untrusted origins, forged/expired visitor identity, stale writes, hidden cards,
// cross-user edits, duplicate comments, XSS payloads, abuse, deleted users and expired sessions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHandler } from '../src/worker.mjs';

export function testDatabase() {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec('PRAGMA foreign_keys=ON');
    sqlite.exec(readFileSync(new URL('../migrations/0001_lobby.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../migrations/0002_greeting.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../migrations/0003_presence_map.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../migrations/0004_presence_actor.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../migrations/0005_site_presence.sql', import.meta.url), 'utf8'));
    sqlite.exec(readFileSync(new URL('../migrations/0006_comments_users.sql', import.meta.url), 'utf8'));
    return {
        sqlite,
        prepare(sql) {
            let args = [];
            const stmt = {
                bind(...values) { args = values; return stmt; },
                async first() { return sqlite.prepare(sql).get(...args) || null; },
                async all() { return { results: sqlite.prepare(sql).all(...args) }; },
                async run() { const r = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; }
            };
            return stmt;
        },
        async batch(stmts) {
            sqlite.exec('BEGIN');
            try { const results = []; for (const s of stmts) results.push(await s.run()); sqlite.exec('COMMIT'); return results; }
            catch (error) { sqlite.exec('ROLLBACK'); throw error; }
        }
    };
}

test('social API ownership, privacy, retry safety and lifecycle', async () => {
    const DB = testDatabase();
    const env = { DB, ALLOWED_ORIGINS: 'https://game.test', ADMIN_USER_IDS: '' };
    const api = createHandler();
    async function request(path, { method = 'GET', token, body, origin = 'https://game.test', ip = '127.0.0.1' } = {}) {
        const headers = { Origin: origin, 'CF-Connecting-IP': ip };
        if (token) headers.Authorization = 'Bearer ' + token;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const res = await api.fetch(new Request('https://api.test/v1' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
        return { status: res.status, headers: res.headers, data: await res.json() };
    }
    async function login(sub) {
        const deviceKey = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sub))), b => b.toString(16).padStart(2, '0')).join('');
        const result = await request('/auth/guest', { method: 'POST', body: { deviceKey } });
        assert.equal(result.status, 200);
        return result.data;
    }
    assert.equal((await request('/cards', { origin: 'https://evil.test' })).status, 403);
    assert.equal((await request('/cards', { origin: 'null' })).status, 403);
    assert.equal((await request('/me')).status, 401);
    assert.equal((await request('/me', { token: 'forged' })).status, 401);
    const a = await login('synthetic-a'), b = await login('synthetic-b'), admin = await login('synthetic-admin');
    env.ADMIN_USER_IDS = admin.user.id;
    assert.equal((await request('/auth/guest', { method: 'POST', body: { deviceKey: 'guessable' } })).status, 400);
    assert.equal((await request('/auth/google', { method: 'POST', body: {} })).status, 401);
    const card = { name: '合成騎士', intro: '一起聊配裝', progress: '象牙塔', cls: 'knight', avatar: '男騎士', level: 65, equipment: { name: '武士刀 +6' } };
    assert.equal((await request('/me/card', { method: 'PUT', token: a.token, body: { card: { ...card, player: { gold: 1 } }, version: 0 } })).status, 400);
    let result = await request('/me/card', { method: 'PUT', token: a.token, body: { card, version: 0 } });
    assert.equal(result.status, 200);
    assert.equal(result.data.version, 1);
    assert.equal((await request('/me/card', { method: 'PUT', token: a.token, body: { card, version: 0 } })).status, 409);
    assert.equal((await request('/cards/' + a.user.id, { method: 'PUT', token: b.token, body: { card } })).status, 404);
    result = await request('/cards/' + a.user.id, { token: b.token });
    assert.equal(result.data.card.name, card.name);
    assert.equal((await request('/greeting',{method:'POST',token:a.token,body:{}})).status,200);
    assert.ok((await request('/cards/'+a.user.id,{token:b.token})).data.greetingAt>0);
    assert.equal(JSON.stringify(result.data).includes('synthetic-a'), false);
    assert.equal(JSON.stringify(result.data).includes('subject'), false);
    assert.equal((await request('/me/card', { method: 'PUT', token: b.token, body: { card: { ...card, name: '合成法師' }, version: 0 } })).status, 200);
    await request('/cards/' + a.user.id + '/favorite', { method: 'PUT', token: b.token, body: {} });
    await request('/cards/' + a.user.id + '/favorite', { method: 'PUT', token: b.token, body: {} });
    assert.equal((await request('/cards?view=favorites', { token: b.token })).data.cards.length, 1);
    assert.equal((await request('/cards?view=favorites', { token: a.token })).data.cards.length, 0);
    const commentPath = '/cards/' + a.user.id + '/comments';
    const comment = { text: '<img src=x onerror=alert(1)>', requestId: crypto.randomUUID() };
    const first = await request(commentPath, { method: 'POST', token: b.token, body: comment });
    assert.equal(first.status, 201);
    assert.equal((await request(commentPath, { method: 'POST', token: b.token, body: comment })).data.id, first.data.id);
    assert.equal((await request(commentPath, { token: b.token })).data.comments.length, 1);
    assert.equal((await request(commentPath, { token: b.token })).data.comments[0].text, comment.text);
    assert.equal((await request(commentPath, { method: 'POST', token: b.token, body: { ...comment, text: 'changed' } })).status, 409);
    const c = await login('synthetic-c');
    assert.equal((await request('/comments/' + first.data.id, { method: 'DELETE', token: c.token })).status, 403);
    assert.equal((await request('/comments/' + first.data.id, { method: 'DELETE', token: a.token })).status, 200);
    assert.equal((await request(commentPath, { token: b.token })).data.comments.length, 0);
    await request(commentPath, { method: 'POST', token: b.token, body: comment });
    assert.equal((await request(commentPath, { token: b.token })).data.comments.length, 0);
    await request('/me/card', { method: 'DELETE', token: a.token, body: { version: 1 } });
    assert.equal((await request('/cards/' + a.user.id, { token: b.token })).status, 404);
    assert.equal((await request(commentPath, { method: 'POST', token: b.token, body: { text: 'hi', requestId: crypto.randomUUID() } })).status, 404);
    assert.equal((await request('/cards?view=favorites', { token: b.token })).data.cards.length, 0);
    assert.equal((await request('/me/card', { method: 'PUT', token: a.token, body: { card, version: 2 } })).status, 200);
    const second = await request(commentPath, { method: 'POST', token: c.token, body: { text: '測試管理', requestId: crypto.randomUUID() } });
    assert.equal((await request('/comments/' + second.data.id, { method: 'DELETE', token: admin.token })).status, 200);
    assert.equal((await request('/admin/users/' + c.user.id + '/suspend', { method: 'POST', token: b.token, body: {} })).status, 403);
    assert.equal((await request('/admin/users/' + c.user.id + '/suspend', { method: 'POST', token: admin.token, body: {} })).status, 200);
    assert.equal((await request('/me', { token: c.token })).status, 401);
    const tooLong = await request(commentPath, { method: 'POST', token: b.token, body: { text: '字'.repeat(301), requestId: crypto.randomUUID() } });
    assert.equal(tooLong.status, 400);
    for (let i = 0; i < 6; i++) await request(commentPath, { method: 'POST', token: b.token, body: { text: '合成留言' + i, requestId: crypto.randomUUID() } });
    assert.equal((await request(commentPath, { method: 'POST', token: b.token, body: { text: 'too many', requestId: crypto.randomUUID() } })).status, 429);
    assert.equal((await request('/me', { token: a.token })).data.user.id, a.user.id);
    await request('/auth/logout', { method: 'POST', token: a.token, body: {} });
    assert.equal((await request('/me', { token: a.token })).status, 401);
    const again = await login('synthetic-a');
    assert.equal(again.user.id, a.user.id);
    assert.equal((await request('/me', { method: 'DELETE', token: again.token, body: { confirm: true } })).status, 200);
    assert.equal((await request('/cards/' + a.user.id, { token: b.token })).status, 404);
    assert.equal((await request('/me', { token: again.token })).status, 401);
    DB.sqlite.close();
});

test('loopback and file clients get explicit CORS without allowing arbitrary websites',async()=>{
    const api=createHandler(),env={DB:testDatabase(),ALLOWED_ORIGINS:'https://lostshin.github.io',ALLOW_LOCAL_CLIENTS:'true'};
    for(const origin of ['http://localhost:8000','http://127.0.0.1:59321','http://[::1]:8000','null']){
        const response=await api.fetch(new Request('https://api.test/v1/me',{headers:{Origin:origin}}),env);
        assert.equal(response.status,401,origin);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
    }
    for(const origin of ['https://evil.test','http://localhost.evil.test:8000','http://192.168.1.1:8000']){
        const response=await api.fetch(new Request('https://api.test/v1/me',{headers:{Origin:origin}}),env);
        assert.equal(response.status,403,origin);
    }
    env.DB.sqlite.close();
});

test('online list and live maps respect published cards, heartbeats and location consent', async () => {
    const DB=testDatabase(),api=createHandler(),env={DB,ALLOWED_ORIGINS:'https://game.test'};
    async function request(path,method='GET',data,token){
        const r=await api.fetch(new Request('https://api.test/v1'+path,{method,headers:{Origin:'https://game.test','CF-Connecting-IP':'synthetic',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}),env);
        return {status:r.status,data:await r.json()};
    }
    const visitors=[];
    for(let i=0;i<3;i++)visitors.push((await request('/auth/guest','POST',{deviceKey:String(i+1).repeat(64)})).data);
    const [a,b,c]=visitors;
    for(const v of [a,b])assert.equal((await request('/me/card','PUT',{card:{name:v===a?'合成在線':'合成離線',shareMap:true},version:0},v.token)).status,200);
    assert.equal((await request('/presence','POST',{map:'象牙塔7樓'},a.token)).status,200);
    assert.equal((await request('/presence','POST',{map:'未公開位置'},c.token)).status,200);
    DB.sqlite.prepare('UPDATE users SET last_seen=? WHERE id=?').run(Date.now()-180000,b.user.id);
    let result=await request('/cards?view=online','GET',undefined,c.token);
    assert.equal(result.status,200);assert.deepEqual(result.data.cards.map(v=>v.id),[a.user.id]);assert.equal(result.data.cards[0].currentMap,'象牙塔7樓');
    result=await request('/cards/'+a.user.id,'GET',undefined,c.token);assert.equal(result.data.currentMap,'象牙塔7樓');
    assert.equal((await request('/presence','POST',{map:'<img src=x onerror=alert(1)>'},a.token)).status,200);
    assert.equal((await request('/cards/'+a.user.id,'GET',undefined,c.token)).data.currentMap,'<img src=x onerror=alert(1)>');
    assert.equal((await request('/presence','POST',{map:'字'.repeat(101)},a.token)).status,400);
    assert.equal((await request('/presence','POST',{map:'象牙塔',player:{gold:99}},a.token)).status,400);
    assert.equal((await request('/presence','POST',{map:'象牙塔'})).status,401);
    assert.equal((await request('/me/card','PUT',{card:{name:'不公開地圖',shareMap:false},version:1},a.token)).status,200);
    assert.equal((await request('/presence','POST',{map:'不應公開'},a.token)).status,200);
    assert.equal((await request('/cards/'+a.user.id,'GET',undefined,c.token)).data.currentMap,'');
    assert.equal((await request('/me/card','PUT',{card:{name:'公開地圖',shareMap:true},version:2},a.token)).status,200);
    assert.equal((await request('/presence','POST',{map:'古魯丁村莊'},a.token)).status,200);
    assert.equal((await request('/cards/'+a.user.id,'GET',undefined,c.token)).data.currentMap,'古魯丁村莊');
    DB.sqlite.prepare('UPDATE users SET last_seen=? WHERE id=?').run(Date.now()-1800001,a.user.id);
    assert.equal((await request('/cards/'+a.user.id,'GET',undefined,c.token)).data.currentMap,'');
    assert.equal((await request('/cards?view=online','GET',undefined,c.token)).data.cards.length,0);
    DB.sqlite.close();
});

test('live players do not need cards and class/sex always come from the latest actor heartbeat', async()=>{
    const DB=testDatabase(),api=createHandler(),env={DB,ALLOWED_ORIGINS:'https://game.test'};
    async function request(path,method='GET',data,token){const r=await api.fetch(new Request('https://api.test/v1'+path,{method,headers:{Origin:'https://game.test','CF-Connecting-IP':'synthetic-live',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}),env);return{status:r.status,data:await r.json()};}
    const a=(await request('/auth/guest','POST',{deviceKey:'a'.repeat(64)})).data,b=(await request('/auth/guest','POST',{deviceKey:'b'.repeat(64)})).data;
    const actor={name:'合成女法師',cls:'mage',avatar:'女法師'};
    assert.equal((await request('/presence','POST',{actor,map:'不公開地圖'},a.token)).status,200);
    let result=await request('/players','GET',undefined,b.token);assert.equal(result.status,200);assert.equal(result.data.players.length,1);assert.deepEqual(result.data.players[0].actor,actor);assert.equal(result.data.players[0].hasCard,false);assert.ok(!JSON.stringify(result.data).includes('不公開地圖'));
    assert.equal((await request('/me','GET',undefined,a.token)).data.card,null);
    assert.equal((await request('/greeting','POST',{},a.token)).status,200);assert.ok((await request('/players','GET',undefined,b.token)).data.players[0].greetingAt>0);
    assert.equal((await request('/presence','POST',{actor:{...actor,avatar:'女騎士'}},a.token)).status,400);
    assert.equal((await request('/presence','POST',{actor:{...actor,inventory:[]}},a.token)).status,400);
    assert.equal((await request('/presence','POST',{actor:{...actor,cls:'unknown'}},a.token)).status,400);
    assert.equal((await request('/presence','POST',{actor})).status,401);
    assert.equal((await request('/me/card','PUT',{card:{name:'舊騎士名片',cls:'knight',avatar:'男騎士'},version:0},a.token)).status,200);
    result=await request('/players','GET',undefined,b.token);assert.deepEqual(result.data.players[0].actor,actor);assert.equal(result.data.players[0].hasCard,true);
    assert.equal((await request('/cards/'+a.user.id,'GET',undefined,b.token)).data.card.name,'舊騎士名片');
    DB.sqlite.prepare('DELETE FROM rate_limits').run();
    for(const [cls,avatars]of Object.entries({royal:['王子','公主'],knight:['男騎士','女騎士'],elf:['男妖精','女妖精'],mage:['男法師','女法師'],dark:['男黑暗妖精','女黑暗妖精'],dragon:['男龍騎士','女龍騎士'],illusion:['男幻術士','女幻術士'],warrior:['男戰士','女戰士']}))for(const avatar of avatars){
        DB.sqlite.prepare('DELETE FROM rate_limits').run();const current={name:'當前'+avatar,cls,avatar};assert.equal((await request('/presence','POST',{actor:current},a.token)).status,200);assert.deepEqual((await request('/players','GET',undefined,b.token)).data.players[0].actor,current);
    }
    DB.sqlite.prepare('UPDATE users SET last_seen=? WHERE id=?').run(Date.now()-180000,a.user.id);assert.equal((await request('/players','GET',undefined,b.token)).data.players.length,0);
    assert.equal((await request('/players?offset=-1','GET',undefined,b.token)).status,400);
    await request('/me','DELETE',{confirm:true},a.token);assert.equal((await request('/players','GET',undefined,b.token)).data.players.length,0);DB.sqlite.close();
});

test('backend headcount uses the same fresh users as players and is not limited by pagination or session count', async()=>{
    const DB=testDatabase(),api=createHandler(),env={DB,ALLOWED_ORIGINS:'https://game.test'};
    async function request(path,method='GET',data,token){const r=await api.fetch(new Request('https://api.test/v1'+path,{method,headers:{Origin:'https://game.test','CF-Connecting-IP':'count-fixture',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}),env);return{status:r.status,data:await r.json()};}
    const key='c'.repeat(64),a=(await request('/auth/guest','POST',{deviceKey:key})).data,b=(await request('/auth/guest','POST',{deviceKey:key})).data;
    const actor={name:'合成人數',cls:'knight',avatar:'男騎士'};
    let r=await request('/presence','POST',{actor},a.token);assert.equal(r.status,200);assert.equal(r.data.onlineCount,1);assert.ok(Math.abs(r.data.serverTime-Date.now())<1000);
    r=await request('/presence','POST',{actor},b.token);assert.equal(r.data.onlineCount,1);
    for(let i=0;i<24;i++)DB.sqlite.prepare('INSERT INTO users(id,subject,last_seen,presence_actor) VALUES(?,?,?,?)').run('fixture-'+i,'fixture-'+i,Date.now(),JSON.stringify(actor));
    DB.sqlite.prepare('INSERT INTO users(id,subject,last_seen,presence_actor,suspended) VALUES(?,?,?,?,?)').run('suspended','suspended',Date.now(),JSON.stringify(actor),1);
    DB.sqlite.prepare('INSERT INTO users(id,subject,last_seen,presence_actor) VALUES(?,?,?,?)').run('expired','expired',Date.now()-180000,JSON.stringify(actor));
    r=await request('/players','GET',undefined,a.token);assert.equal(r.data.players.length,20);assert.equal(r.data.onlineCount,25);assert.equal(r.data.next,20);assert.ok(r.data.serverTime>0);
    r=await request('/players?offset=20','GET',undefined,a.token);assert.equal(r.data.players.length,5);assert.equal(r.data.onlineCount,25);
    r=await request('/presence','POST',{actor},a.token);assert.equal(r.data.onlineCount,25);
    assert.equal((await request('/players','GET')).status,401);
    DB.sqlite.close();
});

test('official site visitors are distinct from local/file and other GitHub project heartbeats',async()=>{
    const DB=testDatabase(),api=createHandler(),env={DB,ALLOWED_ORIGINS:'https://lostshin.github.io',ALLOW_LOCAL_CLIENTS:'true'};
    async function request(path,method='GET',data,token,origin='https://lostshin.github.io'){
        const r=await api.fetch(new Request('https://api.test/v1'+path,{method,headers:{Origin:origin,'CF-Connecting-IP':'site-count-test',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}),env);return{status:r.status,data:await r.json()};
    }
    const visitors=[];for(const key of ['d','e','f','1'])visitors.push((await request('/auth/guest','POST',{deviceKey:key.repeat(64)})).data);
    const[a,local,file,other]=visitors,actor={name:'合成來源計數',cls:'knight',avatar:'男騎士'};
    let r=await request('/presence','POST',{actor,page:'/idle-lineage-class/'},a.token);assert.equal(r.status,200);assert.equal(r.data.siteOnlineCount,1);assert.equal(r.data.onlineCount,1);
    r=await request('/presence','POST',{actor,page:'/idle-lineage-class/'},local.token,'http://localhost:8000');assert.equal(r.status,200);assert.equal(r.data.siteOnlineCount,1);assert.equal(r.data.onlineCount,2);
    r=await request('/presence','POST',{actor,page:''},file.token,'null');assert.equal(r.status,200);assert.equal(r.data.siteOnlineCount,1);
    r=await request('/presence','POST',{actor,page:'/another-game/'},other.token);assert.equal(r.status,200);assert.equal(r.data.siteOnlineCount,1);assert.equal(r.data.onlineCount,4);
    const same=(await request('/auth/guest','POST',{deviceKey:'d'.repeat(64)})).data;assert.equal(same.user.id,a.user.id);
    r=await request('/presence','POST',{actor,page:'/idle-lineage-class/index.html'},same.token);assert.equal(r.data.siteOnlineCount,1);
    DB.sqlite.prepare('UPDATE users SET site_seen=? WHERE id=?').run(Date.now()-180000,a.user.id);
    r=await request('/presence','POST',{actor,page:'/idle-lineage-class/'},same.token,'http://localhost:8000');assert.equal(r.data.siteOnlineCount,0);
    r=await request('/presence','POST',{actor},a.token);assert.equal(r.status,200);assert.equal(r.data.siteOnlineCount,0);
    r=await request('/presence','POST',{actor,page:'/idle-lineage-class/'},a.token);assert.equal(r.data.siteOnlineCount,1);
    r=await request('/players?offset=10000','GET',undefined,local.token,'http://localhost:8000');assert.equal(r.data.players.length,0);assert.equal(r.data.siteOnlineCount,1);assert.equal(r.data.onlineCount,4);
    DB.sqlite.prepare('UPDATE users SET suspended=1 WHERE id=?').run(a.user.id);assert.equal((await request('/players','GET',undefined,local.token)).data.siteOnlineCount,0);
    assert.equal((await request('/presence','POST',{actor,page:123},local.token)).status,400);DB.sqlite.close();
});

test('recent official visitors survive 24 hours, count only 30 minutes and accept unpublished messages',async()=>{
    const DB=testDatabase(),api=createHandler(),env={DB,ALLOWED_ORIGINS:'https://lostshin.github.io'};
    async function request(path,method='GET',data,token,origin='https://lostshin.github.io'){
        const r=await api.fetch(new Request('https://api.test/v1'+path,{method,headers:{Origin:origin,'CF-Connecting-IP':'recent-fixture',...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}),env);return{status:r.status,data:await r.json()};
    }
    const a=(await request('/auth/guest','POST',{deviceKey:'a'.repeat(64)})).data,b=(await request('/auth/guest','POST',{deviceKey:'b'.repeat(64)})).data,c=(await request('/auth/guest','POST',{deviceKey:'c'.repeat(64)})).data;
    const actor={name:'未發名片女法師',cls:'mage',avatar:'女法師'};
    for(const v of [a,b,c])assert.equal((await request('/presence','POST',{actor,page:'/idle-lineage-class/'},v.token)).status,200);
    DB.sqlite.prepare('UPDATE users SET site_seen=? WHERE id=?').run(Date.now()-3600000,b.user.id);
    DB.sqlite.prepare('UPDATE users SET site_seen=? WHERE id=?').run(Date.now()-86400001,c.user.id);
    let r=await request('/players?view=recent','GET',undefined,a.token);
    assert.equal(r.status,200);assert.equal(r.data.siteRecentCount,1);assert.equal(r.data.players.length,2);assert.ok(r.data.players.some(p=>p.id===b.user.id));
    assert.equal((await request('/cards/'+b.user.id,'GET',undefined,a.token)).data.presence,true);
    assert.equal((await request('/cards/'+b.user.id+'/favorite','PUT',{},a.token)).status,404);
    const message={text:'旅人你好 <img src=x>',requestId:crypto.randomUUID()},path='/cards/'+b.user.id+'/comments';
    const sent=await request(path,'POST',message,a.token);assert.equal(sent.status,201);
    assert.equal((await request(path,'POST',message,a.token)).data.id,sent.data.id);
    r=await request(path,'GET',undefined,b.token);assert.equal(r.data.comments.length,1);assert.equal(r.data.comments[0].author,actor.name);
    assert.equal((await request('/comments/'+sent.data.id,'DELETE',{},c.token)).status,403);
    assert.equal((await request('/comments/'+sent.data.id,'DELETE',{},b.token)).status,200);
    assert.equal((await request(path,'GET',undefined,a.token)).data.comments.length,0);
    assert.equal(DB.sqlite.prepare('SELECT COUNT(*) n FROM cards').get().n,0);
    assert.equal((await request('/presence','POST',{actor,page:'/idle-lineage-class/'},a.token,'http://localhost:8000')).status,403);
    const repeat=(await request('/auth/guest','POST',{deviceKey:'a'.repeat(64)})).data;assert.equal(repeat.user.id,a.user.id);
    assert.equal((await request('/presence','POST',{actor,page:'/idle-lineage-class/index.html'},repeat.token)).data.siteRecentCount,1);
    DB.sqlite.prepare('UPDATE users SET site_seen=? WHERE id=?').run(Date.now()-1800001,a.user.id);
    assert.equal((await request('/players?view=recent','GET',undefined,repeat.token)).data.siteRecentCount,0);
    DB.sqlite.prepare('UPDATE users SET suspended=1 WHERE id=?').run(b.user.id);
    assert.equal((await request('/cards/'+b.user.id,'GET',undefined,a.token)).status,404);
    DB.sqlite.close();
});

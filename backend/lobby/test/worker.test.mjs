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

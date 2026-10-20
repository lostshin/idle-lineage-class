// Failure cases: a wrong origin is accepted, ownership leaks, retries duplicate
// comments, stale edits overwrite data, or unpublished/deleted cards remain readable.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const base = process.argv[2], reportPath = process.argv[3];
if (!base || !/^https:\/\//.test(base)) throw Error('Pass the HTTPS lobby API URL explicitly');
const reports = [], visitors = [];
async function request(path, method = 'GET', data, token, origin = 'https://lostshin.github.io') {
    const response = await fetch(base + '/v1' + path, { method, headers: { Origin: origin, ...(data ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(15000) });
    return { status: response.status, data: await response.json(), headers: response.headers };
}
async function check(name, fn) {
    try { await fn(); reports.push({ name, status: 'PASS' }); }
    catch (error) { reports.push({ name, status: 'FAIL', error: error.message }); throw error; }
}
async function guest() {
    const result = await request('/auth/guest', 'POST', { deviceKey: randomBytes(32).toString('hex') });
    assert.equal(result.status, 200); visitors.push(result.data); return result.data;
}
try {
    await check('unapproved origins cannot use the public API', async () => {
        const r = await request('/cards', 'GET', undefined, undefined, 'https://unapproved.example');
        assert.equal(r.status, 403); assert.equal(r.headers.get('access-control-allow-origin'), null);
    });
    const a = await guest(), b = await guest();
    const card = { name: '合成大廳驗收', intro: '自動驗收完成後會刪除此名片', cls: 'knight', avatar: '男騎士' };
    await check('a visitor publishes a card and a different visitor reads it', async () => {
        assert.equal((await request('/me/card', 'PUT', { card, version: 0 }, a.token)).status, 200);
        const r = await request('/cards/' + a.user.id, 'GET', undefined, b.token);
        assert.equal(r.status, 200); assert.deepEqual(r.data.card, { ...card, progress: '' });
        assert.equal(r.headers.get('cache-control'), 'no-store');
        assert.equal(r.headers.get('access-control-allow-origin'), 'https://lostshin.github.io');
        assert.equal(JSON.stringify(r.data).includes(a.token), false);
    });
    await check('stale writes and cross-visitor edits are rejected', async () => {
        assert.equal((await request('/me/card', 'PUT', { card, version: 0 }, a.token)).status, 409);
        assert.equal((await request('/cards/' + a.user.id, 'PUT', { card }, b.token)).status, 404);
    });
    await check('favorites belong to their owner', async () => {
        assert.equal((await request('/cards/' + a.user.id + '/favorite', 'PUT', {}, b.token)).status, 200);
        assert.equal((await request('/cards?view=favorites', 'GET', undefined, b.token)).data.cards.length, 1);
        assert.equal((await request('/cards?view=favorites', 'GET', undefined, a.token)).data.cards.length, 0);
    });
    await check('retrying one comment creates exactly one entry and the card owner can delete it', async () => {
        const path = '/cards/' + a.user.id + '/comments';
        const comment = { text: '合成訪客留言', requestId: randomUUID() };
        const first = await request(path, 'POST', comment, b.token);
        assert.equal(first.status, 201);
        assert.equal((await request(path, 'POST', comment, b.token)).data.id, first.data.id);
        const rows = (await request(path, 'GET', undefined, a.token)).data.comments;
        assert.equal(rows.length, 1); assert.equal(rows[0].canDelete, true);
        assert.equal((await request('/comments/' + first.data.id, 'DELETE', undefined, a.token)).status, 200);
        assert.equal((await request(path, 'GET', undefined, a.token)).data.comments.length, 0);
    });
    await check('unpublishing removes the card from reads and favorites', async () => {
        assert.equal((await request('/me/card', 'DELETE', { version: 1 }, a.token)).status, 200);
        assert.equal((await request('/cards/' + a.user.id, 'GET', undefined, b.token)).status, 404);
        assert.equal((await request('/cards?view=favorites', 'GET', undefined, b.token)).data.cards.length, 0);
    });
} finally {
    for (const visitor of visitors) await check('synthetic visitor and its data are deleted', async () => {
        assert.equal((await request('/me', 'DELETE', { confirm: true }, visitor.token)).status, 200);
        assert.equal((await request('/me', 'GET', undefined, visitor.token)).status, 401);
    });
    if (reportPath) await writeFile(reportPath, JSON.stringify({ method: 'Public Cloudflare HTTPS API with synthetic visitors; not a browser E2E', url: base, date: new Date().toISOString(), workerSourceSha256: createHash('sha256').update(await readFile(new URL('../src/worker.mjs', import.meta.url))).digest('hex'), reports }, null, 2));
}
console.log({ checks: reports.length, passed: reports.filter(r => r.status === 'PASS').length });

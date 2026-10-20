const CLASSES = new Set(['royal', 'knight', 'elf', 'mage', 'dark', 'dragon', 'illusion', 'warrior']);
const AVATARS = new Set(['王子', '公主', '男騎士', '女騎士', '男妖精', '女妖精', '男法師', '女法師', '男黑暗妖精', '女黑暗妖精', '男龍騎士', '女龍騎士', '男幻術士', '女幻術士', '男戰士', '女戰士']);
const now = () => Date.now();
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (value, limit, required = false) => {
    if (typeof value !== 'string' || [...value.trim()].length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) fail(400, '文字格式或長度不正確。');
    if (required && !value.trim()) fail(400, '請填寫內容。');
    return value.trim();
};
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
const random = () => crypto.randomUUID() + crypto.randomUUID();
const statement = (env, sql, ...args) => env.DB.prepare(sql).bind(...args);
const first = (env, sql, ...args) => statement(env, sql, ...args).first();
const run = (env, sql, ...args) => statement(env, sql, ...args).run();
const all = async (env, sql, ...args) => (await statement(env, sql, ...args).all()).results;
const publicCard = row => ({ id: row.user_id, card: JSON.parse(row.payload), version: row.version, updatedAt: row.updated_at, lastSeen: row.last_seen, greetingAt: row.greeting_at || 0, currentMap: JSON.parse(row.payload).shareMap && row.last_seen > now() - 120000 ? row.current_map || '' : '' });

function localOrigin(origin) {
    // file:// uses opaque Origin:null; sessions are explicit bearer tokens, never cookies.
    if (origin === 'null') return true;
    try {
        const url = new URL(origin);
        return url.origin === origin && ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { return false; }
}

function validateCard(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, '名片格式不正確。');
    const allowed = ['name', 'intro', 'progress', 'cls', 'avatar', 'level', 'equipment', 'shareMap'];
    if (Object.keys(input).some(key => !allowed.includes(key))) fail(400, '名片包含未允許的欄位。');
    const card = { name: text(input.name, 12, true), intro: text(input.intro ?? '', 200), progress: text(input.progress ?? '', 100) };
    if (input.shareMap !== undefined) { if (typeof input.shareMap !== 'boolean') fail(400, '地圖分享設定不正確。'); card.shareMap = input.shareMap; }
    if (input.cls !== undefined) { if (!CLASSES.has(input.cls)) fail(400, '職業不正確。'); card.cls = input.cls; }
    if (input.avatar !== undefined) { if (!AVATARS.has(input.avatar)) fail(400, '外觀不正確。'); card.avatar = input.avatar; }
    if (input.level !== undefined) { if (!Number.isInteger(input.level) || input.level < 1 || input.level > 100) fail(400, '等級不正確。'); card.level = input.level; }
    if (input.equipment !== undefined) {
        if (!input.equipment || Object.keys(input.equipment).some(k => k !== 'name')) fail(400, '展示裝備格式不正確。');
        card.equipment = { name: text(input.equipment.name, 100, true) };
    }
    return card;
}

async function body(request) {
    if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, '請使用 JSON 格式。');
    const reader = request.body?.getReader();
    if (!reader) fail(400, '缺少請求內容。');
    const chunks = []; let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16384) { await reader.cancel(); fail(413, '內容過大。'); }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    try {
        const value = JSON.parse(new TextDecoder().decode(bytes));
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, '內容格式不正確。');
        return value;
    } catch { fail(400, '內容格式不正確。'); }
}

async function rate(env, key, limit, period = 60000) {
    const bucket = Math.floor(now() / period);
    const row = await first(env, 'INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count', key + ':' + bucket, (bucket + 1) * period);
    if (row.count > limit) fail(429, '操作太頻繁，請稍後再試。');
}

export function createHandler() {
    return {
        async fetch(request, env) {
            const origin = request.headers.get('Origin');
            const origins = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
            const allowed = origin && (origins.includes(origin) || (env.ALLOW_LOCAL_CLIENTS === 'true' && localOrigin(origin)));
            const headers = {
                'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin', 'Referrer-Policy': 'no-referrer'
            };
            if (allowed) Object.assign(headers, {
                'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '600'
            });
            const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers });
            try {
                if (!allowed) fail(403, '此來源無法使用大廳服務。');
                if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
                if (!env.DB) fail(503, '大廳服務尚未設定完成。');
                const url = new URL(request.url), path = url.pathname, method = request.method;
                if (path === '/v1/auth/guest' && method === 'POST') {
                    const ipKey = await hash(origin + ':' + request.headers.get('CF-Connecting-IP'));
                    await rate(env, 'auth:' + ipKey, 20);
                    const data = await body(request);
                    if (!/^[a-f0-9]{64}$/.test(data.deviceKey || '')) fail(400, '訪客識別格式不正確。');
                    const subject = await hash(data.deviceKey);
                    if (!await first(env, 'SELECT id FROM users WHERE subject=?', subject)) await rate(env, 'new-visitor:' + ipKey, 10, 3600000);
                    await run(env, 'INSERT INTO users(id,subject) VALUES(?,?) ON CONFLICT(subject) DO NOTHING', crypto.randomUUID(), subject);
                    const user = await first(env, 'SELECT * FROM users WHERE subject=?', subject);
                    if (user.suspended) fail(403, '此社交帳號已停權。');
                    const token = random(), expiresAt = now() + 86400000;
                    await run(env, 'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)', await hash(token), user.id, expiresAt);
                    return json({ token, expiresAt, user: { id: user.id, admin: (env.ADMIN_USER_IDS || '').split(',').includes(user.id) } });
                }
                const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9-]{72})$/)?.[1];
                if (!token) fail(401, '請重新連接大廳。');
                const tokenHash = await hash(token);
                const user = await first(env, 'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?', tokenHash, now());
                if (!user) fail(401, '連線已逾時，請重新連接大廳。');
                if (user.suspended) fail(403, '此社交帳號已停權。');
                const admin = (env.ADMIN_USER_IDS || '').split(',').includes(user.id);
                await rate(env, 'read:' + user.id, 120);
                if (path === '/v1/auth/logout' && method === 'POST') {
                    await run(env, 'DELETE FROM sessions WHERE token_hash=?', tokenHash); return json({ ok: true });
                }
                if (path === '/v1/me' && method === 'GET') {
                    const row = await first(env, 'SELECT c.*,u.last_seen,u.greeting_at,u.current_map FROM cards c JOIN users u ON u.id=c.user_id WHERE c.user_id=?', user.id);
                    return json({ user: { id: user.id, admin }, card: row ? { ...publicCard(row), published: !!row.published } : null });
                }
                if (path === '/v1/me' && method === 'DELETE') {
                    const data = await body(request); if (data.confirm !== true) fail(400, '請確認刪除社交帳號。');
                    await run(env, 'DELETE FROM users WHERE id=?', user.id); return json({ ok: true });
                }
                if (path === '/v1/presence' && method === 'POST') {
                    const data = await body(request);
                    if (Object.keys(data).some(key => key !== 'map')) fail(400, '連線狀態包含未允許的欄位。');
                    const map = text(data.map ?? '', 100);
                    const card = await first(env, 'SELECT payload FROM cards WHERE user_id=? AND published=1', user.id);
                    await rate(env, 'presence:' + user.id, 6);
                    await run(env, 'UPDATE users SET last_seen=?,current_map=? WHERE id=?', now(), card && JSON.parse(card.payload).shareMap ? map : '', user.id);
                    return json({ ok: true });
                }
                if (path === '/v1/greeting' && method === 'POST') {
                    await rate(env, 'greeting:' + user.id, 6);
                    const at = now();
                    await run(env, 'UPDATE users SET greeting_at=?,last_seen=? WHERE id=?', at, at, user.id);
                    return json({ greetingAt: at });
                }
                if (path === '/v1/me/card' && (method === 'PUT' || method === 'DELETE')) {
                    const data = await body(request);
                    if (!Number.isInteger(data.version) || data.version < 0) fail(400, '缺少名片版本。');
                    let changed;
                    if (method === 'PUT') {
                        const card = validateCard(data.card);
                        await rate(env, 'publish:' + user.id, 12);
                        changed = data.version === 0
                            ? await run(env, 'INSERT INTO cards(user_id,payload,version,published,updated_at) VALUES(?,?,1,1,?) ON CONFLICT(user_id) DO NOTHING', user.id, JSON.stringify(card), now())
                            : await run(env, 'UPDATE cards SET payload=?,version=version+1,published=1,updated_at=? WHERE user_id=? AND version=?', JSON.stringify(card), now(), user.id, data.version);
                    } else changed = await run(env, 'UPDATE cards SET published=0,version=version+1,updated_at=? WHERE user_id=? AND version=?', now(), user.id, data.version);
                    if (!changed.meta.changes) fail(409, '名片已在其他視窗更新，請重新載入後再編輯。');
                    return json({ version: data.version + 1 });
                }
                if (path === '/v1/cards' && method === 'GET') {
                    const view = url.searchParams.get('view') || 'recent';
                    if (!['recent', 'online', 'favorites'].includes(view)) fail(400, '名片列表不正確。');
                    const offset = Number(url.searchParams.get('offset') || 0);
                    if (!Number.isInteger(offset) || offset < 0 || offset > 10000) fail(400, '分頁不正確。');
                    const rows = await all(env, 'SELECT c.*,u.last_seen,u.greeting_at,u.current_map FROM cards c JOIN users u ON u.id=c.user_id WHERE c.published=1 AND u.suspended=0' +
                        (view === 'online' ? ' AND u.last_seen>?' : '') +
                        (view === 'favorites' ? ' AND EXISTS(SELECT 1 FROM favorites f WHERE f.card_id=c.user_id AND f.owner_id=?)' : '') +
                        ' ORDER BY u.last_seen DESC,c.user_id LIMIT 21 OFFSET ?', ...(view === 'online' ? [now() - 120000, offset] : view === 'favorites' ? [user.id, offset] : [offset]));
                    return json({ cards: rows.slice(0, 20).map(publicCard), next: rows.length > 20 ? offset + 20 : null });
                }
                const cardRoute = path.match(/^\/v1\/cards\/([a-f0-9-]{36})(?:\/(favorite|comments))?$/);
                if (cardRoute) {
                    const id = cardRoute[1], action = cardRoute[2];
                    const row = await first(env, 'SELECT c.*,u.last_seen,u.greeting_at,u.current_map FROM cards c JOIN users u ON u.id=c.user_id WHERE c.user_id=? AND c.published=1 AND u.suspended=0', id);
                    if (!row) fail(404, '這張名片目前未公開。');
                    if (!action && method === 'GET') {
                        const favorite = !!await first(env, 'SELECT 1 FROM favorites WHERE owner_id=? AND card_id=?', user.id, id);
                        return json({ ...publicCard(row), favorite });
                    }
                    if (action === 'favorite' && ['PUT', 'DELETE'].includes(method)) {
                        if (method === 'PUT') await run(env, 'INSERT INTO favorites(owner_id,card_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING', user.id, id, now());
                        else await run(env, 'DELETE FROM favorites WHERE owner_id=? AND card_id=?', user.id, id);
                        return json({ ok: true });
                    }
                    if (action === 'comments' && method === 'GET') {
                        const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
                        if (!Number.isSafeInteger(before) || before < 1) fail(400, '分頁不正確。');
                        const rows = await all(env, 'SELECT m.id,m.author_id,m.text,m.created_at,c.payload FROM comments m JOIN users u ON u.id=m.author_id LEFT JOIN cards c ON c.user_id=u.id AND c.published=1 WHERE m.card_id=? AND m.text IS NOT NULL AND u.suspended=0 AND m.id<? ORDER BY m.id DESC LIMIT 21', id, before);
                        return json({ comments: rows.slice(0, 20).map(m => ({ id: m.id, authorId: m.author_id, author: m.payload ? JSON.parse(m.payload).name : '冒險者', text: m.text, createdAt: m.created_at, canDelete: admin || user.id === m.author_id || user.id === id })), next: rows.length > 20 ? rows[19].id : null });
                    }
                    if (action === 'comments' && method === 'POST') {
                        const data = await body(request), value = text(data.text, 300, true);
                        if (!/^[a-f0-9-]{36}$/.test(data.requestId || '')) fail(400, '留言識別碼不正確。');
                        const bodyHash = await hash(id + ':' + value);
                        const existing = await first(env, 'SELECT id,body_hash FROM comments WHERE author_id=? AND request_id=?', user.id, data.requestId);
                        if (existing) { if (existing.body_hash !== bodyHash) fail(409, '留言內容與上次送出不同。'); return json({ id: existing.id }); }
                        await rate(env, 'comment:' + user.id, 5);
                        await run(env, 'INSERT INTO comments(card_id,author_id,request_id,text,body_hash,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM cards c JOIN users u ON u.id=c.user_id WHERE c.user_id=? AND c.published=1 AND u.suspended=0) ON CONFLICT(author_id,request_id) DO NOTHING', id, user.id, data.requestId, value, bodyHash, now(), id);
                        const written = await first(env, 'SELECT id,body_hash FROM comments WHERE author_id=? AND request_id=?', user.id, data.requestId);
                        if (!written) fail(404, '這張名片目前未公開。');
                        if (written.body_hash !== bodyHash) fail(409, '留言內容與上次送出不同。');
                        return json({ id: written.id }, 201);
                    }
                }
                const commentRoute = path.match(/^\/v1\/comments\/(\d+)$/);
                if (commentRoute && method === 'DELETE') {
                    const row = await first(env, 'SELECT * FROM comments WHERE id=?', Number(commentRoute[1]));
                    if (!row) fail(404, '找不到留言。');
                    if (!admin && row.author_id !== user.id && row.card_id !== user.id) fail(403, '無法刪除這則留言。');
                    await run(env, 'UPDATE comments SET text=NULL WHERE id=?', row.id); return json({ ok: true });
                }
                const suspend = path.match(/^\/v1\/admin\/users\/([a-f0-9-]{36})\/suspend$/);
                if (suspend && method === 'POST') {
                    if (!admin) fail(403, '需要管理權限。');
                    if (suspend[1] === user.id) fail(400, '無法停權自己。');
                    await env.DB.batch([
                        statement(env, 'UPDATE users SET suspended=1 WHERE id=?', suspend[1]),
                        statement(env, 'DELETE FROM sessions WHERE user_id=?', suspend[1])
                    ]);
                    return json({ ok: true });
                }
                fail(404, '找不到此操作。');
            } catch (error) {
                if (error.status === 429) headers['Retry-After'] = '60';
                return json({ error: error.status ? error.message : '大廳暫時無法連線，請稍後再試。' }, error.status || 503);
            }
        },
        async scheduled(_event, env) {
            await env.DB.batch(['sessions', 'rate_limits'].map(table => statement(env, 'DELETE FROM ' + table + ' WHERE expires_at<?', now())));
        }
    };
}

export default createHandler();

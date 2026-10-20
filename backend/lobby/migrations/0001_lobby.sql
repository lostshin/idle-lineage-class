PRAGMA foreign_keys = ON;
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL UNIQUE,
    suspended INTEGER NOT NULL DEFAULT 0,
    last_seen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);
CREATE TABLE cards (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    version INTEGER NOT NULL,
    published INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
);
CREATE TABLE favorites (
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES cards(user_id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(owner_id, card_id)
);
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL REFERENCES cards(user_id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    text TEXT,
    body_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(author_id, request_id)
);
CREATE INDEX comments_card_page ON comments(card_id, id DESC);
CREATE INDEX cards_public_page ON cards(published, updated_at DESC, user_id);
CREATE INDEX users_recent ON users(last_seen DESC);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

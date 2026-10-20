CREATE TABLE comments_next (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    text TEXT,
    body_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(author_id, request_id)
);
INSERT INTO comments_next SELECT * FROM comments;
UPDATE sqlite_sequence SET seq=MAX(seq,COALESCE((SELECT seq FROM sqlite_sequence WHERE name='comments'),0)) WHERE name='comments_next';
DROP TABLE comments;
ALTER TABLE comments_next RENAME TO comments;
CREATE INDEX comments_card_page ON comments(card_id,id DESC);
CREATE INDEX users_site_recent ON users(site_seen DESC,id);

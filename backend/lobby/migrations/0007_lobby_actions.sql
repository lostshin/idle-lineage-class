ALTER TABLE users ADD COLUMN action_cursor INTEGER NOT NULL DEFAULT 0;
CREATE TABLE lobby_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('greet','nod','cheer')),
    actor TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id,request_id)
);

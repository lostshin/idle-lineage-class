-- Heartbeats update last_seen and site_seen every few minutes; only site_seen is queried by index.
DROP INDEX IF EXISTS users_recent;

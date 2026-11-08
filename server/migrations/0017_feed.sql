-- each person's precomputed For you feed, ranked at build time so GET /api/feed only reads rows in order
CREATE TABLE feed_items (
  user_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  card TEXT NOT NULL,
  PRIMARY KEY (user_id, position)
);

-- built_at is null until the first build finishes; building_since claims a rebuild so two requests don't both run one
CREATE TABLE feed_state (
  user_id TEXT PRIMARY KEY,
  built_at TEXT,
  building_since TEXT
);

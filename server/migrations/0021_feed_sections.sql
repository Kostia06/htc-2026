-- the feed is now ranked per section (all, jobs, events, hackathons, courses); the table is a cache, so it is rebuilt
-- rather than migrated, and clearing feed_state makes every person's next request start that rebuild
DROP TABLE feed_items;
CREATE TABLE feed_items (
  user_id TEXT NOT NULL,
  section TEXT NOT NULL,
  position INTEGER NOT NULL,
  card TEXT NOT NULL,
  PRIMARY KEY (user_id, section, position)
);
DELETE FROM feed_state;

-- what a person did with a card: saved cards make the Saved section, dismissed ones never come back and steer ranking
CREATE TABLE feed_actions (
  user_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('save', 'dismiss')),
  card TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX feed_actions_by_action ON feed_actions (user_id, action, created_at);

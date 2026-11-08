-- from 0030_voice_draft.sql
-- the report is rebuilt after every answer, so /finish can hand back a finished one instead of waiting on a model
ALTER TABLE voice_sessions ADD COLUMN draft_ciphertext TEXT;
ALTER TABLE voice_sessions ADD COLUMN draft_iv TEXT;
-- how many turns the draft was built from; a draft missing turns is never shown as the final report
ALTER TABLE voice_sessions ADD COLUMN draft_turns INTEGER;
-- set while one rebuild runs, so turns arriving meanwhile don't start a second model call
ALTER TABLE voice_sessions ADD COLUMN draft_building_since TEXT;
-- a turn arrived during a rebuild: the running one goes round once more instead
ALTER TABLE voice_sessions ADD COLUMN draft_dirty INTEGER NOT NULL DEFAULT 0;


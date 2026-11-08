-- from 0027_voice_overall.sql
-- the report's 0-100 score, saved at finish so history shows the same number the person saw
ALTER TABLE voice_sessions ADD COLUMN overall INTEGER;

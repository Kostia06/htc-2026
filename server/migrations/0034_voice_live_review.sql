-- live review: when each answer happened, from the client's clock, so replay needs no transcript matching afterwards
ALTER TABLE voice_turns ADD COLUMN at_sec REAL;
ALTER TABLE voice_turns ADD COLUMN answer_start_sec REAL;
-- a coaching tip written during the call for a weak answer, sealed like the answer it rewrites
ALTER TABLE voice_turns ADD COLUMN tip_ciphertext TEXT;
ALTER TABLE voice_turns ADD COLUMN tip_iv TEXT;
-- set once a session spends its one live research tip, so a run of weak answers can't run up the bill
ALTER TABLE voice_sessions ADD COLUMN live_tip_claimed_at TEXT;
-- the delivery habits seen in this session, e.g. ["we","hedging"]; only labels, never what was said
ALTER TABLE voice_sessions ADD COLUMN delivery_issues TEXT;
-- a headset that reconnects mid-call opens a new ElevenLabs conversation; its ids are kept so deleting the session deletes them too
ALTER TABLE voice_sessions ADD COLUMN extra_conversation_ids TEXT;
-- the phone can open a past session's review in the headset; mode stays 'interview' for the existing check
ALTER TABLE headset_launches ADD COLUMN review_session_id TEXT;

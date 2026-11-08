-- "In VR" from a road step: the session remembers the step so finishing it marks the step done
ALTER TABLE voice_sessions ADD COLUMN step_id TEXT;
-- the phone's interview picks travel with a headset launch, like the step does
ALTER TABLE headset_launches ADD COLUMN posting_id TEXT;
ALTER TABLE headset_launches ADD COLUMN difficulty TEXT;
ALTER TABLE headset_launches ADD COLUMN interview_length TEXT;

-- replay: ElevenLabs keeps the recording, we keep only its id; the report is sealed per user like the turns
ALTER TABLE voice_sessions ADD COLUMN conversation_id TEXT;
ALTER TABLE voice_sessions ADD COLUMN report_ciphertext TEXT;
ALTER TABLE voice_sessions ADD COLUMN report_iv TEXT;

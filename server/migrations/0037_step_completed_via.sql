-- 'resume' for steps copied as already done from the resume: they show on the road but never count toward a streak
ALTER TABLE roadmap_steps ADD COLUMN completed_via TEXT;
-- resume steps live in the fixed slots -60..-53 (RESUME_POSITION, eight at most), so earlier ones can be tagged in place
UPDATE roadmap_steps SET completed_via = 'resume' WHERE position >= -60 AND position < -52 AND status = 'done';

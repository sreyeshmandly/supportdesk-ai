ALTER TABLE tickets
  ADD COLUMN triage_status
    ENUM('pending', 'queued', 'completed', 'failed', 'skipped')
    NOT NULL DEFAULT 'pending',
  ADD INDEX idx_triage_recovery (triage_status, id);

-- Prevent historical tickets from being automatically sent to the AI.
UPDATE tickets
SET triage_status = 'skipped';

-- Existing tickets that already have a triage suggestion are complete.
UPDATE tickets AS t
SET t.triage_status = 'completed'
WHERE EXISTS (
  SELECT 1
  FROM ai_suggestions AS s
  WHERE s.ticket_id = t.id
    AND s.type = 'triage'
);

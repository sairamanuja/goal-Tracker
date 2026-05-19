-- Prevent duplicate active escalation rows when manual and cron checks run together.
CREATE UNIQUE INDEX IF NOT EXISTS "Escalation_open_unique_no_quarter_idx"
ON "Escalation" ("ruleId", "targetId", "cycleId")
WHERE "status" = 'OPEN' AND "quarter" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Escalation_open_unique_quarter_idx"
ON "Escalation" ("ruleId", "targetId", "cycleId", "quarter")
WHERE "status" = 'OPEN' AND "quarter" IS NOT NULL;

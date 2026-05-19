-- Keep historical achievement rows consistent with the status contract:
-- "Not Started" means no actual progress has been logged yet.
UPDATE "Achievement"
SET
  "actual" = NULL,
  "completionDate" = NULL,
  "score" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'NOT_STARTED';

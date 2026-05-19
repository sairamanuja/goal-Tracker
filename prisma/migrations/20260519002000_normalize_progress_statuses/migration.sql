-- Align existing achievement statuses with the status/score contract used by
-- the application layer.

-- A non-timeline row with a full score is no longer merely "On Track".
UPDATE "Achievement" AS a
SET
  "status" = 'COMPLETED',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Goal" AS g
WHERE a."goalId" = g."id"
  AND g."uomType" <> 'TIMELINE'
  AND a."status" = 'ON_TRACK'
  AND a."score" = 100;

-- A non-timeline completed row must actually meet the target.
UPDATE "Achievement" AS a
SET
  "status" = 'ON_TRACK',
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Goal" AS g
WHERE a."goalId" = g."id"
  AND g."uomType" <> 'TIMELINE'
  AND a."status" = 'COMPLETED'
  AND (a."score" IS NULL OR a."score" < 100);

-- Timeline "On Track" represents in-progress work, so it should not carry a
-- completion date or formula score yet.
UPDATE "Achievement" AS a
SET
  "completionDate" = NULL,
  "score" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Goal" AS g
WHERE a."goalId" = g."id"
  AND g."uomType" = 'TIMELINE'
  AND a."status" = 'ON_TRACK'
  AND a."completionDate" IS NOT NULL;

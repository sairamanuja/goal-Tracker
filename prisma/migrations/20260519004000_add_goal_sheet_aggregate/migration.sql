-- Add a sheet-level lifecycle aggregate. Goal.status/isLocked remain mirrored
-- for existing UI/query compatibility, but GoalSheet is now the canonical
-- lifecycle record for submit/return/approve/unlock.

CREATE TABLE "GoalSheet" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "status" "GoalStatus" NOT NULL DEFAULT 'DRAFT',
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "returnComment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoalSheet_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GoalSheet"
ADD CONSTRAINT "GoalSheet_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoalSheet"
ADD CONSTRAINT "GoalSheet_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "GoalCycle"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GoalSheet_userId_cycleId_key"
ON "GoalSheet"("userId", "cycleId");

CREATE INDEX "GoalSheet_cycleId_status_idx"
ON "GoalSheet"("cycleId", "status");

CREATE INDEX "GoalSheet_userId_status_idx"
ON "GoalSheet"("userId", "status");

ALTER TABLE "Goal" ADD COLUMN "sheetId" TEXT;

INSERT INTO "GoalSheet" (
  "id",
  "userId",
  "cycleId",
  "status",
  "isLocked",
  "returnComment",
  "createdAt",
  "updatedAt"
)
SELECT
  'sheet_' || md5(g."userId" || ':' || g."cycleId") AS "id",
  g."userId",
  g."cycleId",
  CASE
    WHEN bool_and(g."status" = 'APPROVED') THEN 'APPROVED'::"GoalStatus"
    WHEN bool_or(g."status" = 'SUBMITTED') THEN 'SUBMITTED'::"GoalStatus"
    WHEN bool_or(g."status" = 'RETURNED') THEN 'RETURNED'::"GoalStatus"
    ELSE 'DRAFT'::"GoalStatus"
  END AS "status",
  bool_and(g."isLocked") AS "isLocked",
  max(g."returnComment") AS "returnComment",
  min(g."createdAt") AS "createdAt",
  max(g."updatedAt") AS "updatedAt"
FROM "Goal" g
JOIN "User" u ON u."id" = g."userId"
WHERE u."role" = 'EMPLOYEE'
GROUP BY g."userId", g."cycleId";

UPDATE "Goal" g
SET "sheetId" = 'sheet_' || md5(g."userId" || ':' || g."cycleId")
FROM "User" u
WHERE u."id" = g."userId"
  AND u."role" = 'EMPLOYEE';

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_sheetId_fkey"
FOREIGN KEY ("sheetId") REFERENCES "GoalSheet"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Goal_sheetId_idx" ON "Goal"("sheetId");

CREATE OR REPLACE FUNCTION enforce_goal_sheet_status_invariants()
RETURNS trigger AS $$
DECLARE
  sheet_count integer;
  sheet_total numeric;
BEGIN
  IF NEW."status" IN ('SUBMITTED', 'APPROVED') THEN
    SELECT COUNT(*), COALESCE(SUM("weightage"), 0)
    INTO sheet_count, sheet_total
    FROM "Goal"
    WHERE "sheetId" = NEW."id";

    IF sheet_count = 0 THEN
      RAISE EXCEPTION 'Cannot submit/approve an empty goal sheet';
    END IF;

    IF sheet_count > 8 THEN
      RAISE EXCEPTION 'Maximum 8 goals allowed per employee per cycle';
    END IF;

    IF ABS(sheet_total - 100) > 0.001 THEN
      RAISE EXCEPTION 'Goal sheet total weightage must equal 100 before submit/approve';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GoalSheet_status_invariants_trigger"
BEFORE INSERT OR UPDATE OF "status"
ON "GoalSheet"
FOR EACH ROW
EXECUTE FUNCTION enforce_goal_sheet_status_invariants();

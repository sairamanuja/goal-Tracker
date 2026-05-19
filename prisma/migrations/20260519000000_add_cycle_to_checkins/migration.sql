-- Tie manager check-ins to a goal cycle so quarterly feedback does not
-- collide across years or cycles.
ALTER TABLE "CheckIn" ADD COLUMN "cycleId" TEXT;

UPDATE "CheckIn"
SET "cycleId" = (
    SELECT "id"
    FROM "GoalCycle"
    WHERE "status" = 'ACTIVE'
    ORDER BY "createdAt" DESC
    LIMIT 1
)
WHERE "cycleId" IS NULL;

DELETE FROM "CheckIn" WHERE "cycleId" IS NULL;

ALTER TABLE "CheckIn" ALTER COLUMN "cycleId" SET NOT NULL;

DROP INDEX "CheckIn_managerId_employeeId_quarter_key";

CREATE UNIQUE INDEX "CheckIn_managerId_employeeId_cycleId_quarter_key"
ON "CheckIn"("managerId", "employeeId", "cycleId", "quarter");

CREATE INDEX "CheckIn_cycleId_quarter_idx"
ON "CheckIn"("cycleId", "quarter");

ALTER TABLE "CheckIn"
ADD CONSTRAINT "CheckIn_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "GoalCycle"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

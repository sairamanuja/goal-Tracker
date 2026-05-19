-- Attach escalations to the goal cycle that produced them and add indexes
-- used by dashboard/report/escalation lookups.
ALTER TABLE "Escalation" ADD COLUMN "cycleId" TEXT;

UPDATE "Escalation"
SET "cycleId" = (
    SELECT "id"
    FROM "GoalCycle"
    WHERE "status" = 'ACTIVE'
    ORDER BY "createdAt" DESC
    LIMIT 1
)
WHERE "cycleId" IS NULL;

DELETE FROM "Escalation" WHERE "cycleId" IS NULL;

ALTER TABLE "Escalation" ALTER COLUMN "cycleId" SET NOT NULL;

ALTER TABLE "Escalation"
ADD CONSTRAINT "Escalation_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "GoalCycle"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Goal_cycleId_status_idx" ON "Goal"("cycleId", "status");
CREATE INDEX "Goal_userId_cycleId_status_idx" ON "Goal"("userId", "cycleId", "status");
CREATE INDEX "Goal_sharedFromId_idx" ON "Goal"("sharedFromId");
CREATE INDEX "Achievement_userId_quarter_idx" ON "Achievement"("userId", "quarter");
CREATE INDEX "Achievement_quarter_score_idx" ON "Achievement"("quarter", "score");
CREATE INDEX "CheckIn_employeeId_cycleId_quarter_idx" ON "CheckIn"("employeeId", "cycleId", "quarter");
CREATE INDEX "AuditLog_goalId_createdAt_idx" ON "AuditLog"("goalId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "Escalation_cycleId_status_idx" ON "Escalation"("cycleId", "status");
CREATE INDEX "Escalation_ruleId_targetId_cycleId_status_idx" ON "Escalation"("ruleId", "targetId", "cycleId", "status");
CREATE INDEX "Escalation_targetId_status_idx" ON "Escalation"("targetId", "status");

CREATE UNIQUE INDEX "Escalation_open_cycle_quarter_key"
ON "Escalation"("ruleId", "targetId", "cycleId", "quarter")
WHERE "status" = 'OPEN' AND "quarter" IS NOT NULL;

CREATE UNIQUE INDEX "Escalation_open_cycle_no_quarter_key"
ON "Escalation"("ruleId", "targetId", "cycleId")
WHERE "status" = 'OPEN' AND "quarter" IS NULL;

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_weightage_range_check"
CHECK ("weightage" >= 10 AND "weightage" <= 100);

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_target_non_negative_check"
CHECK ("target" >= 0);

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_percentage_target_range_check"
CHECK ("uomType" <> 'PERCENTAGE' OR "target" <= 100);

CREATE OR REPLACE FUNCTION enforce_goal_sheet_invariants()
RETURNS trigger AS $$
DECLARE
  sheet_owner_role "Role";
  sheet_count integer;
  sheet_total numeric;
  submitted_count integer;
BEGIN
  SELECT "role"
  INTO sheet_owner_role
  FROM "User"
  WHERE "id" = NEW."userId";

  IF sheet_owner_role <> 'EMPLOYEE' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*), COALESCE(SUM("weightage"), 0)
  INTO sheet_count, sheet_total
  FROM "Goal"
  WHERE "userId" = NEW."userId"
    AND "cycleId" = NEW."cycleId";

  IF sheet_count > 8 THEN
    RAISE EXCEPTION 'Maximum 8 goals allowed per employee per cycle';
  END IF;

  IF NEW."status" IN ('SUBMITTED', 'APPROVED')
     AND (TG_OP = 'INSERT' OR OLD."status" IS DISTINCT FROM NEW."status") THEN
    IF ABS(sheet_total - 100) > 0.001 THEN
      RAISE EXCEPTION 'Goal sheet total weightage must equal 100 before submit/approve';
    END IF;

    SELECT COUNT(*)
    INTO submitted_count
    FROM "Goal"
    WHERE "userId" = NEW."userId"
      AND "cycleId" = NEW."cycleId"
      AND "status" IN ('SUBMITTED', 'APPROVED');

    IF submitted_count = 0 THEN
      RAISE EXCEPTION 'Cannot submit/approve an empty goal sheet';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Goal_sheet_invariants_trigger"
AFTER INSERT OR UPDATE OF "userId", "cycleId", "weightage", "status"
ON "Goal"
FOR EACH ROW
EXECUTE FUNCTION enforce_goal_sheet_invariants();

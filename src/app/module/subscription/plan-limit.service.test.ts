import assert from "node:assert/strict";
import test from "node:test";
import { PLAN_LIMITS, PlanLimitService } from "./plan-limit.service";

test("plan limits are configured for all three plans", () => {
  assert.deepEqual(Object.keys(PLAN_LIMITS), ["FREE", "PRO", "BUSINESS"]);
  assert.equal(PlanLimitService.getMemberLimit("FREE"), 5);
  assert.equal(PlanLimitService.getProjectLimit("PRO"), 15);
  assert.equal(
    PlanLimitService.getStorageLimit("BUSINESS"),
    50 * 1024 * 1024 * 1024,
  );
});

test("plan limit helpers resolve the configured values", () => {
  assert.equal(PlanLimitService.getTaskLimit("FREE"), 100);
  assert.equal(PlanLimitService.getMaxFileSize("PRO"), 25 * 1024 * 1024);
  assert.deepEqual(
    PlanLimitService.getPlanLimits("BUSINESS"),
    PLAN_LIMITS.BUSINESS,
  );
});

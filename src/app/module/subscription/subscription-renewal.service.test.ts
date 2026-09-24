import assert from "node:assert/strict";
import test from "node:test";
import { SubscriptionRenewalService } from "./subscription-renewal.service";

test("renewal eligibility is true only for active paid subscriptions that expired", () => {
  const now = new Date("2026-10-26T00:00:00.000Z");

  assert.equal(
    SubscriptionRenewalService.isRenewalEligible(
      {
        plan: "PRO",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-10-25T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
      } as any,
      now,
    ),
    true,
  );

  assert.equal(
    SubscriptionRenewalService.isRenewalEligible(
      {
        plan: "FREE",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-10-25T00:00:00.000Z"),
        cancelAtPeriodEnd: false,
      } as any,
      now,
    ),
    false,
  );

  assert.equal(
    SubscriptionRenewalService.isRenewalEligible(
      {
        plan: "PRO",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2026-10-25T00:00:00.000Z"),
        cancelAtPeriodEnd: true,
      } as any,
      now,
    ),
    false,
  );
});

test("renewal period moves by one calendar month from the prior period end", () => {
  const from = new Date("2026-09-25T00:00:00.000Z");
  const next = SubscriptionRenewalService.calculateNextPeriod(from);

  assert.equal(next.start.toISOString(), "2026-09-25T00:00:00.000Z");
  assert.equal(next.end.toISOString(), "2026-10-25T00:00:00.000Z");
});

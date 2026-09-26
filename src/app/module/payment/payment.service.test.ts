import assert from "node:assert/strict";
import test from "node:test";
import {
  SubscriptionPlan,
  SubscriptionStatus,
} from "../../../generated/prisma/enums";
import { PaymentServices } from "./payment.service";

test("checkout price is derived from the server-side subscription plan", () => {
  assert.equal(PaymentServices.getPlanPrice(SubscriptionPlan.PRO), 49);
  assert.equal(PaymentServices.getPlanPrice(SubscriptionPlan.BUSINESS), 99);
  assert.equal(PaymentServices.getPlanPrice(SubscriptionPlan.FREE), 0);
});

test("checkout eligibility only allows supported subscription states", () => {
  assert.equal(
    PaymentServices.isCheckoutEligibleForSubscription({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.ACTIVE,
    } as any),
    true,
  );

  assert.equal(
    PaymentServices.isCheckoutEligibleForSubscription({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.PAST_DUE,
    } as any),
    true,
  );

  assert.equal(
    PaymentServices.isCheckoutEligibleForSubscription({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.CANCELLED,
    } as any),
    false,
  );

  assert.equal(
    PaymentServices.isCheckoutEligibleForSubscription({
      plan: SubscriptionPlan.PRO,
      status: SubscriptionStatus.EXPIRED,
    } as any),
    false,
  );
});

import { SubscriptionRenewalService } from "../module/subscription/subscription-renewal.service";

let renewalJobTimer: NodeJS.Timeout | null = null;

export const startSubscriptionRenewalJob = (intervalMs = 60 * 60 * 1000) => {
  if (renewalJobTimer) {
    return renewalJobTimer;
  }

  renewalJobTimer = setInterval(() => {
    void SubscriptionRenewalService.processRenewalBatch().catch(
      (error: unknown) => {
        console.error("Subscription renewal job failed:", error);
      },
    );
  }, intervalMs);

  return renewalJobTimer;
};

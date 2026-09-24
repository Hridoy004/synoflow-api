import type {
  PaymentProvider,
  PaymentStatus,
  SubscriptionPlan,
} from "../../../generated/prisma/enums";

export interface ICheckoutPayload {
  organizationId: string;
  plan: SubscriptionPlan;
}

export interface IWebhookPayload {
  transactionId: string;
  status: PaymentStatus;
  paymentUrl?: string | null;
}

export interface IPaymentSummary {
  id: string;
  organizationId: string;
  userId: string;
  provider: PaymentProvider;
  transactionId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  paymentUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

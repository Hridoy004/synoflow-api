import type {
  PaymentProvider,
  PaymentStatus,
} from "../../../generated/prisma/enums";

export interface ICheckoutPayload {
  subscriptionId: string;
}

export interface IWebhookPayload {
  paymentId?: string;
  subscriptionId?: string;
  organizationId?: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  paymentUrl?: string | null;
}

export interface IPaymentSummary {
  id: string;
  organizationId: string;
  subscriptionId?: string | null;
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

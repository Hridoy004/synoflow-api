import z from "zod";
import {
  PaymentStatus,
  SubscriptionPlan,
} from "../../../generated/prisma/enums";

const checkoutSchema = z
  .object({
    organizationId: z.string().min(1),
    plan: z.enum([
      SubscriptionPlan.FREE,
      SubscriptionPlan.PRO,
      SubscriptionPlan.BUSINESS,
    ]),
  })
  .strict();

const webhookSchema = z
  .object({
    transactionId: z.string().min(1),
    status: z.nativeEnum(PaymentStatus),
    paymentUrl: z.string().url().optional().or(z.literal("")),
  })
  .strict();

export const PaymentValidation = {
  checkoutSchema,
  webhookSchema,
};

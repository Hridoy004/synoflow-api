import z from "zod";
import { PaymentStatus } from "../../../generated/prisma/enums";

const checkoutSchema = z
  .object({
    subscriptionId: z
      .string()
      .trim()
      .uuid("Subscription ID must be a valid UUID."),
  })
  .strict();

const webhookSchema = z
  .object({
    paymentId: z.string().trim().min(1).optional(),
    subscriptionId: z.string().trim().min(1).optional(),
    organizationId: z.string().trim().min(1).optional(),
    providerTransactionId: z.string().trim().min(1).optional(),
    status: z.nativeEnum(PaymentStatus),
    paymentUrl: z.string().url().optional().or(z.literal("")),
  })
  .strict();

export const PaymentValidation = {
  checkoutSchema,
  webhookSchema,
};

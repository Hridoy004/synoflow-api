import { z } from "zod";
import { SubscriptionPlan } from "../../../generated/prisma/enums";

const createCheckoutSchema = z.object({
  plan: z.enum([SubscriptionPlan.PRO, SubscriptionPlan.BUSINESS], {
    error: "plan must be PRO or BUSINESS",
  }),
});

export const PaymentValidation = {
  createCheckoutSchema,
};

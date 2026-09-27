import { Router } from "express";
import { SystemRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const organizationPaymentRouter = Router({ mergeParams: true });

organizationPaymentRouter.post(
	"/checkout",
	auth(),
	validateRequest(PaymentValidation.createCheckoutSchema),
	PaymentController.createCheckout,
);

organizationPaymentRouter.get(
	"/",
	auth(),
	PaymentController.getOrganizationPayments,
);

const paymentRouter = Router();

// Public — bKash calls this directly, no auth header is sent.
paymentRouter.get("/bkash/callback", PaymentController.bkashCallback);

paymentRouter.get(
	"/all-payments",
	auth(SystemRole.ADMIN, SystemRole.SUPER_ADMIN),
	PaymentController.getAllPayments,
);

paymentRouter.get("/:paymentId", auth(), PaymentController.getSinglePayment);

export const OrganizationPaymentRoutes = organizationPaymentRouter;
export const PaymentRoutes = paymentRouter;

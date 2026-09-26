import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

router.post(
  "/checkout",
  auth(),
  validateRequest(PaymentValidation.checkoutSchema),
  PaymentController.createCheckout,
);

router.get("/", auth(), PaymentController.getPayments);

router.post(
  "/webhook",
  validateRequest(PaymentValidation.webhookSchema),
  PaymentController.webhook,
);

router.get("/:paymentId", auth(), PaymentController.getPayment);

export const PaymentRoutes = router;

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
  PaymentController.checkout,
);

router.get("/", auth(), PaymentController.getPayments);

router.get("/:paymentId", auth(), PaymentController.getPayment);

router.post(
  "/webhook",
  validateRequest(PaymentValidation.webhookSchema),
  PaymentController.webhook,
);

export const PaymentRoutes = router;

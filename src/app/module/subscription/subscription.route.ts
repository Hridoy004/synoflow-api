import { Router } from "express";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionValidation } from "./subscription.validation";

const router = Router({ mergeParams: true });

router.get("/", auth(), SubscriptionController.getSubscription);
router.post(
	"/",
	auth(),
	validateRequest(SubscriptionValidation.createSubscriptionSchema),
	SubscriptionController.createSubscription,
);
router.patch(
	"/",
	auth(),
	validateRequest(SubscriptionValidation.updateSubscriptionSchema),
	SubscriptionController.updateSubscription,
);
router.post(
	"/cancel",
	auth(),
	validateRequest(SubscriptionValidation.cancelSubscriptionSchema),
	SubscriptionController.cancelSubscription,
);

export const SubscriptionRoutes = router;

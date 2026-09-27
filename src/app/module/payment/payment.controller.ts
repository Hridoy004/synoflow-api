import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { handleBkashCallback } from "./payment-webhook.service";
import { PaymentServices } from "./payment.service";

const getOrganizationId = (req: Request) => {
	const { organizationId } = req.params;

	if (typeof organizationId !== "string" || organizationId.length === 0) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid organization ID.");
	}

	return organizationId;
};

const createCheckout = catchAsync(async (req: Request, res: Response) => {
	const organizationId = getOrganizationId(req);
	const user = req.user!;

	const payment = await PaymentServices.createCheckoutPayment(
		organizationId,
		user.userId,
		req.body.plan,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Checkout session created successfully",
		data: { paymentId: payment.id, paymentUrl: payment.paymentUrl },
	});
});

const getOrganizationPayments = catchAsync(
	async (req: Request, res: Response) => {
		const organizationId = getOrganizationId(req);
		const user = req.user!;

		const { data, meta } = await PaymentServices.getOrganizationPayments(
			organizationId,
			user.userId,
			req.query,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Payments retrieved successfully",
			data,
			meta,
		});
	},
);

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await PaymentServices.getAllPayments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payments retrieved successfully",
		data,
		meta,
	});
});

const getSinglePayment = catchAsync(async (req: Request, res: Response) => {
	const paymentId = req.params.paymentId as string;
	const user = req.user!;

	const result = await PaymentServices.getSinglePayment(paymentId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment retrieved successfully",
		data: result,
	});
});

/**
 * bKash redirects the user's BROWSER here (GET) after checkout — this is
 * not a JSON API consumer, so it responds with a redirect to the frontend
 * instead of sendResponse.
 */
const bkashCallback = catchAsync(async (req: Request, res: Response) => {
	const paymentID = req.query.paymentID as string | undefined;
	const status = req.query.status as
		| "success"
		| "failure"
		| "cancel"
		| undefined;

	if (!paymentID || !status) {
		return res.redirect(`${config.frontend_url}/billing/failed`);
	}

	const result = await handleBkashCallback(paymentID, status);

	if (result.result === "success") {
		return res.redirect(
			`${config.frontend_url}/billing/success?paymentId=${result.paymentId}`,
		);
	}

	return res.redirect(
		`${config.frontend_url}/billing/failed?paymentId=${result.paymentId}`,
	);
});

export const PaymentController = {
	createCheckout,
	getOrganizationPayments,
	getAllPayments,
	getSinglePayment,
	bkashCallback,
};

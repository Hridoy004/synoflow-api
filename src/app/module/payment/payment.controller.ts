import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IQuery } from "../../interfaces";
import { handleBkashCallback } from "./payment-webhook.service";
import { PaymentServices } from "./payment.service";

const getOrganizationId = (req: Request) => {
	const { organizationId } = req.params;

	if (typeof organizationId !== "string" || organizationId.length === 0) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid organization ID.");
	}

	return organizationId;
};

const getRequestUser = (req: Request) => {
	const user = req.user;

	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request.",
		);
	}

	return user;
};

const getPaymentQuery = (req: Request): IQuery => ({
	searchTerm:
		typeof req.query.searchTerm === "string" ? req.query.searchTerm : undefined,
	page: typeof req.query.page === "string" ? req.query.page : undefined,
	limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
	sortOrder:
		typeof req.query.sortOrder === "string" ? req.query.sortOrder : undefined,
	sortBy: typeof req.query.sortBy === "string" ? req.query.sortBy : undefined,
});

const createCheckout = catchAsync(async (req: Request, res: Response) => {
	const organizationId = getOrganizationId(req);
	const user = getRequestUser(req);

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
		const user = getRequestUser(req);

		const { data, meta } = await PaymentServices.getOrganizationPayments(
			organizationId,
			user.userId,
			getPaymentQuery(req),
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
	const { data, meta } = await PaymentServices.getAllPayments(
		getPaymentQuery(req),
	);

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
	const user = getRequestUser(req);

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

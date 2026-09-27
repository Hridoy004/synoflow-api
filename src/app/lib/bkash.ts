import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../utils/AppError";
import { redisClient } from "./redis";

export const getBkashIdToken = async () => {
	try {
		const IdTokenKey = "bkash:idToken";
		const RefreshTokenKey = "bkash:refreshToken";

		let bkashIdToken = await redisClient.get(IdTokenKey);
		const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey);

		const bkashRefreshToken = await redisClient.get(RefreshTokenKey);
		const bkashRefreshTokenTTL = await redisClient.ttl(RefreshTokenKey);

		if (
			(bkashIdTokenTTL <= 600 || !bkashIdToken) &&
			bkashRefreshToken &&
			bkashRefreshTokenTTL > 600
		) {
			const refreshTokenResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						username: config.bkash_username,
						password: config.bkash_password,
					},
					body: JSON.stringify({
						app_key: config.bkash_app_key,
						app_secret: config.bkash_app_secret,
						refresh_token: bkashRefreshToken,
					}),
				},
			);
			if (!refreshTokenResponse.ok) {
				throw new AppError(
					httpStatus.BAD_GATEWAY,
					"Bkash Access Token Grant Failed",
				);
			}

			const bkashRefreshTokenResult = await refreshTokenResponse.json();

			bkashIdToken = bkashRefreshTokenResult.id_token as string;

			await redisClient.set(IdTokenKey, bkashIdToken, {
				expiration: { type: "EX", value: 60 * 60 },
			});

			return bkashIdToken;
		}

		if (bkashIdTokenTTL > 600) {
			return bkashIdToken;
		}

		const response = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					username: config.bkash_username,
					password: config.bkash_password,
				},
				body: JSON.stringify({
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);

		if (!response.ok) {
			throw new AppError(
				httpStatus.BAD_GATEWAY,
				"Bkash Access Token Grant Failed",
			);
		}

		const result = await response.json();

		await redisClient.set(IdTokenKey, result.id_token, {
			expiration: { type: "EX", value: 60 * 60 },
		});

		await redisClient.set(RefreshTokenKey, result.refresh_token, {
			expiration: { type: "EX", value: 60 * 60 * 24 * 28 },
		});

		bkashIdToken = result.id_token;

		return bkashIdToken;
	} catch (error: any) {
		if (error instanceof AppError) {
			throw error;
		}
		throw new AppError(httpStatus.BAD_GATEWAY, error.message);
	}
};

export interface CreateBkashPaymentPayload {
	amount: number;
	merchantInvoiceNumber: string;
	callbackURL: string;
}

export interface CreateBkashPaymentResult {
	paymentID: string;
	bkashURL: string;
}

export const createBkashPayment = async (
	payload: CreateBkashPaymentPayload,
): Promise<CreateBkashPaymentResult> => {
	const idToken = await getBkashIdToken();

	const response = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/create`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: idToken as string,
				"X-APP-Key": config.bkash_app_key,
			},
			body: JSON.stringify({
				mode: "0011",
				payerReference: payload.merchantInvoiceNumber,
				callbackURL: payload.callbackURL,
				amount: payload.amount.toFixed(2),
				currency: "BDT",
				intent: "sale",
				merchantInvoiceNumber: payload.merchantInvoiceNumber,
			}),
		},
	);

	const result = await response.json().catch(() => null);

	if (!response.ok || !result?.paymentID || !result?.bkashURL) {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			result?.statusMessage ?? "Bkash Create Payment Failed",
		);
	}

	return {
		paymentID: result.paymentID as string,
		bkashURL: result.bkashURL as string,
	};
};

export interface ExecuteBkashPaymentResult {
	transactionStatus?: string;
	trxID?: string;
	paymentID?: string;
	statusCode?: string;
	statusMessage?: string;
}

export const executeBkashPayment = async (
	paymentID: string,
): Promise<ExecuteBkashPaymentResult> => {
	const idToken = await getBkashIdToken();

	const response = await fetch(
		`${config.bkash_base_url}/tokenized/checkout/execute`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
				Authorization: idToken as string,
				"X-APP-Key": config.bkash_app_key,
			},
			body: JSON.stringify({ paymentID }),
		},
	);

	const result = await response.json().catch(() => null);

	if (!response.ok || !result) {
		throw new AppError(httpStatus.BAD_GATEWAY, "Bkash Execute Payment Failed");
	}

	return result as ExecuteBkashPaymentResult;
};

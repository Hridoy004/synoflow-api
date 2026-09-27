import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type z from "zod";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (
	zodSchema: z.ZodObject,
	source: "body" | "params" | "query" = "body",
) => {
	return catchAsync((req: Request, res: Response, next: NextFunction) => {
		const payload = req[source] ?? {};

		const result = zodSchema.safeParse(payload);

		if (!result.success) {
			console.log(result.error);
			console.log(result.error.issues);

			throw new AppError(
				httpStatus.BAD_REQUEST,
				result.error.issues[0].message,
			);
		}

		if (source === "query") {
			Object.defineProperty(req, "query", {
				value: result.data,
				configurable: true,
				writable: true,
				enumerable: true,
			});
		} else {
			req[source] = result.data;
		}

		next();
	});
};

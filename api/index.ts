import type { Request, Response } from "express";
import app from "../src/app";
import { redisClient } from "../src/app/lib/redis";

let redisConnection: Promise<void> | undefined;

redisClient.on("end", () => {
	redisConnection = undefined;
});

const connectRedis = () => {
	if (redisClient.isReady) {
		return Promise.resolve();
	}

	if (!redisConnection) {
		redisConnection = redisClient
			.connect()
			.then(() => undefined)
			.catch((error: unknown) => {
				redisConnection = undefined;
				throw error;
			});
	}

	return redisConnection;
};

const handler = async (request: Request, response: Response) => {
	await connectRedis();
	app(request, response);
};

export default handler;

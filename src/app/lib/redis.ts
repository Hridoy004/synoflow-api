import httpStatus from "http-status";
import { createClient } from "redis";
import config from "../config";
import { AppError } from "../utils/AppError";

const connectionTimeoutMs = 3000;
let redisConnection: Promise<void> | undefined;

export const redisClient = createClient({
	username: config.redis_user,
	password: config.redis_password,
	disableOfflineQueue: true,
	socket: {
		host: config.redis_host,
		port: Number(config.redis_port),
		connectTimeout: connectionTimeoutMs,
		reconnectStrategy: (retries) => (retries >= 1 ? false : 250),
	},
});

redisClient.on("end", () => {
	redisConnection = undefined;
});

redisClient.on("error", (err) => {
	console.error("Redis Client Error:", err.message);
});

redisClient.on("reconnecting", () => {
	console.log("Redis reconnecting...");
});

redisClient.on("ready", () => {
	console.log("Redis ready!");
});

const waitForRedisReady = () =>
	new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error("Redis connection timed out"));
		}, connectionTimeoutMs);

		const cleanup = () => {
			clearTimeout(timeout);
			redisClient.off("ready", onReady);
			redisClient.off("error", onError);
		};

		const onReady = () => {
			cleanup();
			resolve();
		};

		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};

		redisClient.once("ready", onReady);
		redisClient.once("error", onError);
	});

export const ensureRedisConnected = async () => {
	if (redisClient.isReady) {
		return;
	}

	if (!redisConnection) {
		const connection = redisClient.isOpen
			? waitForRedisReady()
			: redisClient.connect().then(() => undefined);

		redisConnection = connection.catch((error: unknown) => {
			redisConnection = undefined;
			console.error("Redis connection failed:", error);
			throw new AppError(
				httpStatus.SERVICE_UNAVAILABLE,
				"Redis service is temporarily unavailable.",
			);
		});
	}

	return redisConnection;
};

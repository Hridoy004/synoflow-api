import type { Request, Response } from "express";
import app from "../src/app";

const handler = (request: Request, response: Response) => {
	app(request, response);
};

export default handler;

import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;

const adapter = new PrismaPg({
	connectionString,
	max: 1,
	connectionTimeoutMillis: 5000,
	idleTimeoutMillis: 10000,
});
const prisma = new PrismaClient({ adapter });

export { prisma };

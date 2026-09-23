import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";
import { UserStatus } from "../../../generated/prisma/enums";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { UpdateMyProfilePayload } from "./user.interface";

const safeUserSelect = {
	id: true,
	name: true,
	email: true,
	imageUrl: true,
	systemRole: true,
	status: true,
	createdAt: true,
	updatedAt: true,
} as const;

const updateMyProfile = async (
	userId: string,
	payload: UpdateMyProfilePayload,
) => {
	const currentUser = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			isDeleted: true,
			status: true,
		},
	});

	if (!currentUser) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (currentUser.isDeleted || currentUser.status === UserStatus.SUSPENDED) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Your account has been suspended or deleted. Please contact support.",
		);
	}

	return prisma.user.update({
		where: { id: userId },
		data: {
			...(payload.name !== undefined && { name: payload.name }),
		},
		select: safeUserSelect,
	});
};

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.user.findUnique({
		where: {
			id: userId,
		},
		select: {
			imagePublicId: true,
			imageUrl: true,
		},
	});

	const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},

					async (error, result) => {
						if (error) {
							return reject(error);
						}

						if (!result) {
							return reject(new Error("No result returned from Cloudinary"));
						}

						resolve(result);
					},
				)
				.end(buffer);
		},
	);

	const updatedUser = await prisma.user.update({
		where: {
			id: userId,
		},

		data: {
			imageUrl: cloudinaryResult.secure_url,
			imagePublicId: cloudinaryResult.public_id,
		},

		omit: {
			password: true,
		},
	});

	if (currentUser?.imagePublicId && currentUser.imageUrl) {
		await cloudinary.uploader.destroy(currentUser.imagePublicId);
	}

	return updatedUser;
};

export const UserServices = {
	updateMyProfile,
	uploadProfileImage,
};

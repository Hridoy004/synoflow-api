import z from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Please provide a valid email address.");

const passwordSchema = z
  .string()
  .min(1, "Password is required")
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[a-z]/, "Password must contain at least 1 lowercase letter.")
  .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter.")
  .regex(/[0-9]/, "Password must contain at least 1 number.")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character.");

const otpSchema = z
  .string()
  .min(1, "OTP is required")
  .length(6, "OTP must be exactly 6 characters long.")
  .regex(/^\d{6}$/, "OTP must contain only numbers.");

const contactNumberSchema = z
  .string()
  .trim()
  .min(7, "Contact number is too short.")
  .max(20, "Contact number is too long.")
  .optional();

const UserRegistrationZodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters long.")
    .max(100, "Name must not exceed 100 characters."),
  email: emailSchema,
  password: passwordSchema,
  patient: z
    .object({
      contactNumber: contactNumberSchema,
    })
    .optional(),
  user: z
    .object({
      contactNumber: contactNumberSchema,
    })
    .optional(),
});

const UserEmailVerifyZodSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

const LoginZodSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const ForgotPasswordZodSchema = z.object({
  email: emailSchema,
});

const ResetPasswordZodSchema = z.object({
  email: emailSchema,
  newPassword: passwordSchema,
  otp: otpSchema,
});

export const UserValidation = {
  UserRegistrationZodSchema,
  UserEmailVerifyZodSchema,
  LoginZodSchema,
  ForgotPasswordZodSchema,
  ResetPasswordZodSchema,
};

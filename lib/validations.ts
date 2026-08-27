import { z } from "zod";

//  Login Schema

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"), // Must be a proper email format

  password: z.string().min(1, "Password is required"), // Can't be empty (no length check for login — the account already exists)
});

// Signup Schema

export const signupSchema = z
  .object({
    name: z
      .string()
      .min(3, "Name must be at least 3 characters")
      .max(50, "Name must be 50 characters or less"),

    email: z
      .string()
      .min(1, "Email is required")
      .email("Please enter a valid email"),

    // 8-char floor matches resetPasswordSchema and /api/account/change-password.
    password: z.string().min(8, "Password must be at least 8 characters"),

    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"], // Attach the error to the confirmPassword field
  });

// Password Recovery Schemas

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
});

// 8-char floor, matching signupSchema and /api/account/change-password.
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

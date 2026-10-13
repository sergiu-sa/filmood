import { z } from "zod";

//  Login Schema

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"), // Must be a proper email format

  password: z.string().min(1, "Password is required"), // Can't be empty (no length check for login — the account already exists)
});

// Supabase's password rule (Auth → Password security: minimum 8, "Letters and digits"), checked before anything is
// sent. Its letters are a–z and A–Z only, so [A-Za-z], not \p{L}: "æøåæøå12" is refused there too.
export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";

// Forms show the first message only, so the order of the checks is the order a person is asked to fix them.
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[A-Za-z]/, "Add a letter.")
  .regex(/[0-9]/, "Add a number.");

export const passwordProblem = (password: string): string | null =>
  passwordSchema.safeParse(password).error?.issues[0]?.message ?? null;

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

    password: passwordSchema,

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

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
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

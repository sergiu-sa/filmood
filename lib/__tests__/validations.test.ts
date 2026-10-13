import { loginSchema, signupSchema, resetPasswordSchema } from "@/lib/validations";

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "secret123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "secret123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailErrors = result.error.issues.filter((i) => i.path[0] === "email");
      expect(emailErrors.length).toBeGreaterThan(0);
    }
  });

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwErrors = result.error.issues.filter((i) => i.path[0] === "password");
      expect(pwErrors.length).toBeGreaterThan(0);
    }
  });

  it("rejects when both fields are missing", () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  const validData = {
    name: "Sergiu",
    email: "sergiu@example.com",
    password: "password123",
    confirmPassword: "password123",
  };

  it("accepts valid signup data", () => {
    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 3 characters", () => {
    const result = signupSchema.safeParse({ ...validData, name: "AB" });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 50 characters", () => {
    const result = signupSchema.safeParse({ ...validData, name: "A".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("accepts name at exactly 3 characters (boundary)", () => {
    const result = signupSchema.safeParse({ ...validData, name: "ABC" });
    expect(result.success).toBe(true);
  });

  it("accepts name at exactly 50 characters (boundary)", () => {
    const result = signupSchema.safeParse({ ...validData, name: "A".repeat(50) });
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({ ...validData, password: "1234567", confirmPassword: "1234567" });
    expect(result.success).toBe(false);
  });

  it("rejects when passwords do not match", () => {
    const result = signupSchema.safeParse({ ...validData, password: "password123", confirmPassword: "different" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const matchError = result.error.issues.find((i) => i.path[0] === "confirmPassword");
      expect(matchError?.message).toBe("Passwords do not match");
    }
  });

  it("rejects invalid email in signup", () => {
    const result = signupSchema.safeParse({ ...validData, email: "bad-email" });
    expect(result.success).toBe(false);
  });
});

// Supabase's "Letters and digits" rule counts only a–z and A–Z as letters, so æøå alone don't pass.
describe.each([
  ["signupSchema", (password: string) => signupSchema.safeParse({ name: "Sergiu", email: "s@example.com", password, confirmPassword: password })],
  ["resetPasswordSchema", (password: string) => resetPasswordSchema.safeParse({ password, confirmPassword: password })],
])("%s password rule", (_name, parse) => {
  // The form shows the first message, so "abc" asks for the length before the number.
  it.each([
    ["abcdefgh", "Add a number."],
    ["12345678", "Add a letter."],
    ["æøåæøå12", "Add a letter."],
    ["abcd123", "Use at least 8 characters."],
    ["abc", "Use at least 8 characters."],
  ])("rejects %s with %s", (password, message) => {
    const result = parse(password);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.find((i) => i.path[0] === "password")?.message).toBe(message);
    }
  });

  it("accepts abcd1234", () => {
    expect(parse("abcd1234").success).toBe(true);
  });
});

import { authErrorMessage } from "@/lib/auth-errors";
import type { AuthError } from "@supabase/supabase-js";

const err = (code: string, message = "raw gotrue text") =>
  ({ code, message }) as AuthError;

describe("authErrorMessage", () => {
  it("explains invalid_credentials without blaming one field", () => {
    const text = authErrorMessage(err("invalid_credentials"));
    expect(text).toMatch(/don't match an account/i);
    expect(text).toMatch(/reset your password/i);
  });

  it("points email_not_confirmed at the inbox", () => {
    expect(authErrorMessage(err("email_not_confirmed"))).toMatch(
      /needs its email confirmed/i,
    );
  });

  it.each(["email_exists", "user_already_exists"])(
    "routes %s to logging in instead",
    (code) => {
      expect(authErrorMessage(err(code))).toMatch(/already exists/i);
    },
  );

  it("falls through to the raw message for unmapped codes", () => {
    expect(authErrorMessage(err("some_new_code", "Something specific"))).toBe(
      "Something specific",
    );
  });

  it("falls through when there is no code at all", () => {
    expect(authErrorMessage({ message: "Network error" } as AuthError)).toBe(
      "Network error",
    );
  });
});

import type { AuthError } from "@supabase/supabase-js";

/**
 * GoTrue's raw messages are terse and `invalid_credentials` is actively misleading;
 *   it's the identical response whether the password is wrong or no such account exists.
 * Map the codes users actually hit onto text that says what to do next;
 *  fall through to the raw message for the rest.
 */
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That email and password don't match an account. Check both — or reset your password.";
    case "email_not_confirmed":
      return "This account still needs its email confirmed. Open the link we emailed you, then log in.";
    case "email_exists":
    case "user_already_exists":
      return "An account already exists for this email. Log in instead, or reset your password.";
    case "weak_password":
      return "That password is too weak. Use a longer one with a mix of letters and numbers.";
    case "same_password":
      return "That's already your current password. Choose a different one.";
    case "over_email_send_rate_limit":
      return "Too many emails requested in a short window. Wait a while before trying again.";
    default:
      return error.message;
  }
}

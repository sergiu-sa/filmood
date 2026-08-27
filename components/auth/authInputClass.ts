/**
 * Shared text-input styling for the auth pages (login, signup, forgot/reset password):
 *   gold focus ring normally, rose ring when the field has an error.
 * Kept in one place so a token change lands everywhere at once.
 */
export function authInputClass(hasError?: boolean): string {
  return `w-full px-4 py-[13px] rounded-xl text-sm outline-none transition-all border ${
    hasError
      ? "border-[var(--rose)] shadow-[0_0_0_3px_var(--rose-soft)]"
      : "border-[var(--border)] focus:border-[var(--gold)] focus:shadow-[0_0_0_3px_var(--gold-soft)]"
  }`;
}

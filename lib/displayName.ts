import type { User } from "@supabase/supabase-js";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * The name saved on the account, "" when there is none. Account saves `full_name` and signup
 * saves `name`; Supabase merges both into `user_metadata`, so an edit on Account wins.
 */
export function savedName(user: User): string {
  return text(user.user_metadata?.full_name) || text(user.user_metadata?.name);
}

/** The name shown for a signed-in user: the saved one, else the email's local part. */
export function displayName(user: User): string {
  return savedName(user) || user.email?.split("@")[0] || "User";
}

/** The avatar letter for a name, upper-cased. */
export function avatarInitial(name: string): string {
  // Array.from keeps an emoji whole. Not Intl.Segmenter: Next supports Firefox 111+,
  // which has none before 125, so a flag or a ZWJ emoji shows its first part.
  return (Array.from(name)[0] ?? "U").toUpperCase();
}

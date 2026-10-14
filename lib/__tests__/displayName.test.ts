import type { User } from "@supabase/supabase-js";
import { avatarInitial, displayName, savedName } from "@/lib/displayName";

const user = (email: string | undefined, user_metadata?: Record<string, unknown>) =>
  ({ id: "u1", email, user_metadata }) as unknown as User;

describe("savedName", () => {
  it("prefers the name saved on Account over the one typed at signup", () => {
    expect(savedName(user("d@x.io", { full_name: "Sergiu", name: "Filmood E2E" }))).toBe("Sergiu");
  });

  it("falls back to the signup name, then to nothing", () => {
    expect(savedName(user("d@x.io", { name: "Filmood E2E" }))).toBe("Filmood E2E");
    expect(savedName(user("d@x.io", {}))).toBe("");
    expect(savedName(user("d@x.io"))).toBe("");
  });

  it("trims, and skips blank or non-string values", () => {
    expect(savedName(user("d@x.io", { full_name: "  Ada  " }))).toBe("Ada");
    expect(savedName(user("d@x.io", { full_name: "   ", name: "Filmood E2E" }))).toBe("Filmood E2E");
    expect(savedName(user("d@x.io", { full_name: 42, name: ["x"] }))).toBe("");
  });
});

describe("displayName", () => {
  it("shows the saved name when there is one", () => {
    expect(displayName(user("d@x.io", { full_name: "Sergiu" }))).toBe("Sergiu");
  });

  it("falls back to the email's local part, then to User", () => {
    expect(displayName(user("e2e+test@filmood.app", {}))).toBe("e2e+test");
    expect(displayName(user(undefined, {}))).toBe("User");
  });
});

describe("avatarInitial", () => {
  it("is the name's first letter, upper-cased", () => {
    expect(avatarInitial("sergiu")).toBe("S");
    expect(avatarInitial("émile")).toBe("É");
  });

  it("keeps a character outside the basic plane whole", () => {
    expect(avatarInitial("𝓢ergiu")).toBe("𝓢");
    expect(avatarInitial("👩 Dev")).toBe("👩");
  });

  it("falls back to U for an empty name", () => {
    expect(avatarInitial("")).toBe("U");
  });
});

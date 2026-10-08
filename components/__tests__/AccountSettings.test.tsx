/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@supabase/supabase-js";
import AccountSettings from "@/components/profile/AccountSettings";

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { updateUser: vi.fn() } } }));
vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: async () => ({}) }));

const user = { id: "u1", email: "a@example.com", user_metadata: { full_name: "Ada" } } as unknown as User;

describe("AccountSettings", () => {
  afterEach(() => vi.unstubAllGlobals());

  // The error is marked by a rose border only, so the role is what tells a screen reader.
  it("announces a failed password change", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Current password is incorrect" }, { status: 400 })));
    const u = userEvent.setup();
    render(<AccountSettings user={user} />);

    await u.click(screen.getByRole("button", { name: "Change" }));
    await u.type(screen.getByLabelText("Current password"), "old-password");
    await u.type(screen.getByLabelText("New password"), "new-password");
    await u.type(screen.getByLabelText("Confirm"), "new-password");
    await u.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
  });
});

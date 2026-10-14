/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@supabase/supabase-js";
import AccountSettings from "@/components/profile/AccountSettings";
import { supabase } from "@/lib/supabase";
import { PASSWORD_HINT } from "@/lib/validations";

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
    await u.type(screen.getByLabelText("New password"), "new-password1");
    await u.type(screen.getByLabelText("Confirm"), "new-password1");
    await u.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
  });

  it("shows the rule under New password and refuses a password without a number before sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const u = userEvent.setup();
    render(<AccountSettings user={user} />);

    await u.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByLabelText("New password")).toHaveAccessibleDescription(PASSWORD_HINT);
    await u.type(screen.getByLabelText("Current password"), "old-password");
    await u.type(screen.getByLabelText("New password"), "newpassword");
    await u.type(screen.getByLabelText("Confirm"), "newpassword");
    await u.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Add a number.");

    // The same text set again changes nothing a screen reader would announce.
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a number.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // The toast mounts with its text, which screen readers don't reliably announce.
  it("announces a save in a region that's already there", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user }, error: null });
    render(<AccountSettings user={user} />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(status).toHaveTextContent("Changes saved"));
  });
});

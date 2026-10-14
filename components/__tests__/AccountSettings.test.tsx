/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  // Signup saves the name as `name`, Account as `full_name`; the hero shows whichever is there.
  it("starts Full name as the name typed at signup, and saves only what changed", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user }, error: null });
    const signedUp = { id: "u2", email: "e2e@example.com", user_metadata: { name: "Filmood E2E" } } as unknown as User;
    render(<AccountSettings user={signedUp} />);
    expect(screen.getByLabelText("Full name")).toHaveValue("Filmood E2E");

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(supabase.auth.updateUser).toHaveBeenCalledWith({}));
  });

  it("sends a cleared Full name, then shows the signup name the hero falls back to", async () => {
    const signedUp = { id: "u2", email: "e2e@example.com", user_metadata: { name: "Filmood E2E" } } as unknown as User;
    const cleared = { ...signedUp, user_metadata: { name: "Filmood E2E", full_name: "" } } as unknown as User;
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user: cleared }, error: null });
    const u = userEvent.setup();
    const { rerender } = render(<AccountSettings user={signedUp} />);

    await u.click(screen.getByRole("button", { name: "Edit Full name" }));
    await u.clear(screen.getByLabelText("Full name"));
    await u.click(screen.getByRole("button", { name: "Save changes" }));
    expect(supabase.auth.updateUser).toHaveBeenLastCalledWith({ data: { full_name: "" } });
    await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveValue("Filmood E2E"));

    // AuthProvider hands the updated user down; a second save has nothing new to send.
    rerender(<AccountSettings user={cleared} />);
    await u.click(screen.getByRole("button", { name: "Save changes" }));
    expect(supabase.auth.updateUser).toHaveBeenLastCalledWith({});
  });

  it("sends an email-only change without the name", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user }, error: null });
    const signedUp = { id: "u2", email: "e2e@example.com", user_metadata: { name: "Filmood E2E" } } as unknown as User;
    const u = userEvent.setup();
    render(<AccountSettings user={signedUp} />);

    await u.click(screen.getByRole("button", { name: "Edit Email address" }));
    await u.clear(screen.getByLabelText("Email address"));
    await u.type(screen.getByLabelText("Email address"), "new@example.com");
    await u.click(screen.getByRole("button", { name: "Save changes" }));
    expect(supabase.auth.updateUser).toHaveBeenLastCalledWith({ email: "new@example.com" });
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

  it("announces a second save inside the toast's 2.4 s, and keeps it up for its own 2.4 s", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame"] });
    try {
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({ data: { user }, error: null });
      render(<AccountSettings user={user} />);
      const status = screen.getByRole("status");
      const save = async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
        await act(async () => {});
        act(() => vi.advanceTimersByTime(16));
      };

      await save();
      const first = status.firstElementChild;
      expect(status).toHaveTextContent("Changes saved");
      act(() => vi.advanceTimersByTime(1000));
      await save();
      // The same text left in place changes nothing a screen reader would announce.
      expect(status.firstElementChild).not.toBe(first);
      expect(status).toHaveTextContent("Changes saved");

      act(() => vi.advanceTimersByTime(1500));
      expect(status).toHaveTextContent("Changes saved");
      act(() => vi.advanceTimersByTime(1000));
      expect(status).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });
});

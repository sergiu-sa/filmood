/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ExplorePanel from "@/components/dashboard/ExplorePanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: vi.fn() }));

let user: { id: string } | null = null;
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user, loading: false, signOut: vi.fn() }),
}));

describe("ExplorePanel", () => {
  // Collapsed, it's only hidden visually; inert keeps its controls out of the Tab order.
  it("collapses a closed desktop panel and takes it out of the Tab order", () => {
    const { container, rerender } = render(<ExplorePanel isOpen={false} onClose={vi.fn()} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.gridTemplateRows).toBe("0fr");
    expect(wrapper.style.maxHeight).toBe("");
    // Without the inner clip, a 0fr row still shows its content's full height.
    const inner = wrapper.firstElementChild as HTMLElement;
    expect([inner.style.overflow, inner.style.minHeight]).toEqual(["hidden", "0"]);
    expect(wrapper).toHaveAttribute("inert");
    rerender(<ExplorePanel isOpen onClose={vi.fn()} />);
    expect(wrapper.style.gridTemplateRows).toBe("1fr");
    expect(wrapper).not.toHaveAttribute("inert");
  });

  // Each error is marked by a rose border only, so the role is what tells a screen reader.
  describe("errors", () => {
    afterEach(() => {
      user = null;
      vi.unstubAllGlobals();
    });

    it("announces a failed create", async () => {
      user = { id: "u1" };
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "Failed to create session" }, { status: 500 })));
      render(<ExplorePanel isOpen onClose={vi.fn()} />);
      // The tab, then the button under it.
      await userEvent.click(screen.getAllByRole("button", { name: "Create session" })[1]);
      expect(await screen.findByRole("alert")).toHaveTextContent("Failed to create session");
    });

    it("announces a join code that isn't six characters", async () => {
      render(<ExplorePanel isOpen onClose={vi.fn()} />);
      await userEvent.click(screen.getByRole("button", { name: "Join with code" }));
      await userEvent.type(screen.getByLabelText("Session code"), "AB1");
      await userEvent.click(screen.getByRole("button", { name: "Join" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a 6-character code");
    });
  });
});

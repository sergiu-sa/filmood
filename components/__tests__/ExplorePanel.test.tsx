/**
 * @vitest-environment jsdom
 */
import { render } from "@testing-library/react";
import ExplorePanel from "@/components/dashboard/ExplorePanel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: vi.fn() }));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
}));

describe("ExplorePanel", () => {
  // Collapsed, it's only hidden visually; inert keeps its controls out of the Tab order.
  it("collapses a closed desktop panel and takes it out of the Tab order", () => {
    const { container, rerender } = render(<ExplorePanel isOpen={false} onClose={vi.fn()} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.gridTemplateRows).toBe("0fr");
    expect(wrapper.style.maxHeight).toBe("");
    expect(wrapper).toHaveAttribute("inert");
    rerender(<ExplorePanel isOpen onClose={vi.fn()} />);
    expect(wrapper.style.gridTemplateRows).toBe("1fr");
    expect(wrapper).not.toHaveAttribute("inert");
  });
});

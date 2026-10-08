/**
 * @vitest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardShell from "@/components/dashboard/DashboardShell";

vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: async () => ({}) }));
vi.mock("@/components/dashboard/SearchToolbar", () => ({ default: () => null }));
vi.mock("@/components/dashboard/MoodPanel", () => ({ default: () => null }));

/** A panel's Close, found by what sits beside it in that panel's footer. */
const closeBeside = (text: string) => within(screen.getByText(text).parentElement!).getByRole("button", { name: "Close" });

describe("DashboardShell, desktop", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => Response.json({ films: [] }))));
  afterEach(() => vi.unstubAllGlobals());

  // Closed, a panel is inert, so focus on its Close would fall to <body>.
  it("hands focus back to the box after a panel's Close", async () => {
    const user = userEvent.setup();
    render(<DashboardShell />);

    const explore = screen.getByRole("button", { name: /^Discover together/ });
    await user.click(explore);
    await user.click(closeBeside("Sessions expire after 4 hours"));
    expect(explore).toHaveAttribute("aria-expanded", "false");
    expect(explore).toHaveFocus();

    const trending = screen.getByRole("button", { name: "Trending today" });
    await user.click(trending);
    await user.click(closeBeside("Full search"));
    expect(trending).toHaveAttribute("aria-expanded", "false");
    expect(trending).toHaveFocus();
  });
});

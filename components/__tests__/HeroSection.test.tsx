/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import HeroSection from "@/components/dashboard/HeroSection";

let user: { email: string } | null = null;
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user, loading: false }),
}));
vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: async () => ({}) }));

let reducedMotion = false;
vi.mock("@/lib/useMediaQuery", () => ({
  useMediaQuery: (query: string) => query.includes("reduced-motion") && reducedMotion,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The right column fetches on its own; this file is about the left one.
vi.mock("@/components/dashboard/HeroFeatureFilm", () => ({ default: () => null }));
vi.mock("@/components/dashboard/HeroNowShowing", () => ({ default: () => null }));
vi.mock("@/components/dashboard/HeroPersonalized", () => ({ default: () => null }));
vi.mock("@/components/dashboard/HeroDateline", () => ({ default: () => null }));

const cycler = () => screen.getByRole("link", { name: /^Start with mood/ });
const moodOf = (el: HTMLElement) => new URL(el.getAttribute("href")!, "http://localhost").searchParams.get("mood");

/** /api/mood-history answers with this top mood; the other two calls answer empty. */
function stubFetch(topMood: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.startsWith("/api/mood-history")
        ? { top: topMood ? [{ mood: topMood }] : [] }
        : url.startsWith("/api/watchlist")
          ? { watchlist: [] }
          : { session: null };
      return { ok: true, json: async () => body };
    }),
  );
}

describe("HeroSection", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    user = null;
    reducedMotion = false;
  });

  it("links the cycling word straight to its mood's results, without announcing every swap", () => {
    render(<HeroSection />);
    expect(cycler()).toHaveAccessibleName("Start with mood Laugh");
    expect(cycler()).toHaveAttribute("href", "/results?mood=laugh&src=tile");
    expect(cycler()).not.toHaveAttribute("aria-live");
  });

  it("links each guest chip by the mood's title, and counts the rest", () => {
    render(<HeroSection />);
    for (const [name, key] of [
      ["Need to laugh", "laugh"],
      ["Want to disappear", "escape"],
      ["Feel uneasy", "unsettled"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `/results?mood=${key}&src=tile`);
    }
    expect(screen.getByText(/\+ 9 more/)).toBeInTheDocument();
  });

  it("moves the word on, and its link with it", () => {
    render(<HeroSection />);
    act(() => vi.advanceTimersByTime(3500));
    expect(moodOf(cycler())).toBe("escape");
  });

  it("holds the word while the pointer is on it", () => {
    render(<HeroSection />);
    fireEvent.mouseEnter(cycler());
    act(() => vi.advanceTimersByTime(10_000));
    expect(moodOf(cycler())).toBe("laugh");
    fireEvent.mouseLeave(cycler());
    act(() => vi.advanceTimersByTime(3500));
    expect(moodOf(cycler())).toBe("escape");
  });

  // Hovering mid-fade cancels the swap; the word must come back, not stay faded out.
  it("shows the word it holds when the pointer lands during a fade", () => {
    render(<HeroSection />);
    act(() => vi.advanceTimersByTime(3100));
    expect(cycler().style.opacity).toBe("0");
    fireEvent.mouseEnter(cycler());
    act(() => vi.advanceTimersByTime(1000));
    expect(cycler().style.opacity).toBe("1");
    expect(moodOf(cycler())).toBe("laugh");
  });

  it("holds the word while it has focus", () => {
    render(<HeroSection />);
    fireEvent.focus(cycler());
    act(() => vi.advanceTimersByTime(10_000));
    expect(moodOf(cycler())).toBe("laugh");
  });

  it("never moves under reduced motion", () => {
    reducedMotion = true;
    render(<HeroSection />);
    act(() => vi.advanceTimersByTime(10_000));
    expect(moodOf(cycler())).toBe("laugh");
  });

  it("offers a signed-in user their last mood again, in its own words", async () => {
    user = { email: "sam@example.com" };
    stubFetch("cry");
    render(<HeroSection />);
    await act(async () => {});
    const again = screen.getByRole("link", { name: "Need to let it out" });
    expect(again).toHaveAttribute("href", "/results?mood=cry&src=tile");
    expect(again.parentElement).toHaveTextContent("Need to let it out again?");
    expect(screen.getByRole("link", { name: /continue/i })).toHaveAttribute("href", "/results?mood=cry&src=tile");
  });

  it("shows the guest headline to a signed-in user with no history", async () => {
    user = { email: "sam@example.com" };
    stubFetch(null);
    render(<HeroSection />);
    await act(async () => {});
    expect(screen.getByText(/Play Your/)).toBeInTheDocument();
  });
});

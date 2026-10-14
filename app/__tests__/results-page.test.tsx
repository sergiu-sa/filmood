/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResultsPage from "@/app/results/page";

// The discover effect alone: children are stubs, and every request is answered by hand.

const router = { replace: vi.fn(), push: vi.fn() };
let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => params,
}));
vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("@/lib/useServices", () => ({ useDeviceServices: () => [] }));
vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: async () => ({}) }));
vi.mock("@/components/Breadcrumb", () => ({ default: () => null }));
vi.mock("@/components/results/MoodHeader", () => ({
  default: ({ headingRef }: { headingRef: React.Ref<HTMLHeadingElement> }) => (
    <h1 ref={headingRef} tabIndex={-1}>
      Need to laugh
    </h1>
  ),
}));
vi.mock("@/components/results/ResultsNotice", () => ({ default: () => null }));
vi.mock("@/components/results/TopPick", () => ({ ResultsTopPick: () => null }));
vi.mock("@/components/results/ResultsGrid", () => ({
  default: ({ films }: { films: { id: number; title: string }[] }) => (
    <ul>
      {films.map((f) => (
        <li key={f.id}>{f.title}</li>
      ))}
    </ul>
  ),
}));
// A profile save that leaves the request as it is.
vi.mock("@/components/results/FilterBar", () => ({
  default: ({ refetch }: { refetch: () => void }) => (
    <button type="button" onClick={refetch}>
      Save to profile
    </button>
  ),
}));

const requests: {
  query: string;
  src: string | null;
  answer: (title: string) => Promise<void>;
  fail: () => Promise<void>;
}[] = [];

const body = (title: string) => ({
  moods: [],
  droppedMoods: [],
  films: [{ id: 1, title }],
  filters: { time: null, era: null, where: "mine" },
  seed: 9,
  relaxed: 0,
  partial: false,
  suggestions: [],
  relatedMoods: [],
  interpreted: null,
});

const A = "mood=laugh&where=mine&services=netflix&seed=9";
const B = "mood=laugh&time=short&where=mine&services=netflix&seed=9";
const C = "mood=laugh&time=long&where=mine&services=netflix&seed=9";

function open(search: string) {
  params = new URLSearchParams(search);
  const view = render(<ResultsPage />);
  return (next: string) => {
    params = new URLSearchParams(next);
    view.rerender(<ResultsPage />);
  };
}

const save = () => userEvent.click(screen.getByRole("button", { name: "Save to profile" }));

describe("results page", () => {
  beforeEach(() => {
    requests.length = 0;
    sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url: string) =>
          new Promise<Response>((resolve) => {
            // The query as the guard compares it, and the src the route logs by, apart.
            const sp = new URLSearchParams(url.split("?")[1]);
            const src = sp.get("src");
            sp.delete("src");
            requests.push({
              query: sp.toString(),
              src,
              answer: (title) => act(async () => resolve(new Response(JSON.stringify(body(title))))),
              // A 5xx that isn't JSON: the retryable error.
              fail: () => act(async () => resolve(new Response("", { status: 502 }))),
            });
          }),
      ),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("src, which the route logs a search by", () => {
    it("sends direct for a search this tab hasn't been shown: a shared link, a typed URL", async () => {
      open(A);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      expect(requests[0].src).toBe("direct");
    });

    it("sends the URL's src for a search the user just made", async () => {
      open(`${A}&src=tile`);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      expect(requests[0].src).toBe("tile");
    });

    // Back, Forward and reload mount the page again on a URL whose src is gone.
    it("sends none for a search this tab has been shown", async () => {
      open(`${A}&src=tile`);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      await requests[0].answer("A film");
      cleanup();

      open(A);
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1].src).toBeNull();
    });

    // The route logs an answer it sent, even one the page had moved on from.
    it("sends none for a search answered after the page moved on", async () => {
      const go = open(A);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      go(B);
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      await requests[0].answer("A film");

      go(A);
      await vi.waitFor(() => expect(requests).toHaveLength(3));
      expect(requests[2].src).toBeNull();
    });

    // A failed search logged nothing, so Try again's answer is the one to log.
    it("sends direct again after a failure", async () => {
      open(A);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      await requests[0].fail();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      expect(requests[1].src).toBe("direct");
    });

    // "My services" confirmed unchanged: the same query with src=filter fetches nothing.
    it("drops a src that leaves the query as it is, so a reload can't send it", async () => {
      const go = open(A);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      await requests[0].answer("A film");
      router.replace.mockClear();

      go(`${A}&src=filter`);
      expect(router.replace).toHaveBeenCalledWith(`/results?${A}`, { scroll: false });
      expect(requests).toHaveLength(1);
    });

    it("still searches when sessionStorage is blocked, as a new search", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("SecurityError");
      });
      open(A);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      await requests[0].answer("A film");
      expect(requests[0].src).toBe("direct");
      expect(screen.getByText("A film")).toBeInTheDocument();
    });
  });

  it("refetches the same query after a save, and the older answer can't replace the newer", async () => {
    open(A);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await requests[0].answer("Viaplay film");

    await save();
    await save();
    expect(requests.map((r) => r.query)).toEqual([A, A, A]);
    // The same search with other services: the first request credited it.
    expect(requests.map((r) => r.src)).toEqual(["direct", null, null]);
    await requests[2].answer("Max film");
    await requests[1].answer("Netflix film");
    expect(screen.getByText("Max film")).toBeInTheDocument();
    expect(screen.queryByText("Netflix film")).toBeNull();
  });

  // B1 was searched with the old saved services; B2 after the save.
  it("drops a filter's answer that was in flight when the save refetched", async () => {
    const go = open(A);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await requests[0].answer("A film");

    go(B);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    await save();
    expect(requests.map((r) => r.query)).toEqual([A, B, B]);
    await requests[2].answer("B, new services");
    await requests[1].answer("B, old services");
    expect(screen.getByText("B, new services")).toBeInTheDocument();
    expect(screen.queryByText("B, old services")).toBeNull();
  });

  it("doesn't fetch a query still on screen, and drops the answer it went back past", async () => {
    const go = open(A);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await requests[0].answer("A film");

    go(B);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    go(A);
    await requests[1].answer("B film");
    expect(requests).toHaveLength(2);
    expect(screen.getByText("A film")).toBeInTheDocument();
    expect(screen.queryByText("B film")).toBeNull();
  });

  // The Try again that recovered it is gone, so focus would fall to <body>.
  it("moves focus to the heading when an answer replaces an error", async () => {
    open(A);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await requests[0].fail();
    expect(screen.getByRole("heading", { name: "Couldn't reach the film database." })).toHaveFocus();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    await requests[1].answer("A film");
    expect(screen.getByRole("heading", { name: "Need to laugh" })).toHaveFocus();
  });

  // A filter change, or a save's refetch, never moves focus.
  it("leaves focus alone when an answer replaces an answer", async () => {
    const go = open(A);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await requests[0].answer("A film");

    await save();
    await requests[1].answer("A film, new services");
    expect(screen.getByRole("button", { name: "Save to profile" })).toHaveFocus();

    go(B);
    await vi.waitFor(() => expect(requests).toHaveLength(3));
    await requests[2].answer("B film");
    expect(screen.getByRole("button", { name: "Save to profile" })).toHaveFocus();
  });

  // While Try again refetches, the last answer and its filter bar are back on screen.
  describe("during Try again's refetch", () => {
    async function retryingB() {
      const go = open(A);
      await vi.waitFor(() => expect(requests).toHaveLength(1));
      await requests[0].answer("A film");
      go(B);
      await vi.waitFor(() => expect(requests).toHaveLength(2));
      await requests[1].fail();
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      await vi.waitFor(() => expect(requests).toHaveLength(3));
      return go;
    }

    it("leaves focus where the user put it", async () => {
      await retryingB();
      screen.getByRole("button", { name: "Save to profile" }).focus();
      await requests[2].answer("B film");
      expect(screen.getByRole("button", { name: "Save to profile" })).toHaveFocus();
    });

    // A click on a button doesn't focus it in Safari, so focus can still be on <body>.
    it("doesn't count a new query's answer as the recovery", async () => {
      const go = await retryingB();
      expect(document.body).toHaveFocus();
      go(C);
      await vi.waitFor(() => expect(requests).toHaveLength(4));
      await requests[3].answer("C film");
      expect(screen.getByRole("heading", { name: "Need to laugh" })).not.toHaveFocus();
    });
  });
});

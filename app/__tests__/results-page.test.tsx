/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
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

const requests: { query: string; answer: (title: string) => Promise<void>; fail: () => Promise<void> }[] = [];

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
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url: string) =>
          new Promise<Response>((resolve) => {
            requests.push({
              query: url.split("?")[1],
              answer: (title) => act(async () => resolve(new Response(JSON.stringify(body(title))))),
              // A 5xx that isn't JSON: the retryable error.
              fail: () => act(async () => resolve(new Response("", { status: 502 }))),
            });
          }),
      ),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("refetches the same query after a save, and the older answer can't replace the newer", async () => {
    open(A);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await requests[0].answer("Viaplay film");

    await save();
    await save();
    expect(requests.map((r) => r.query)).toEqual([A, A, A]);
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

  // §14: a filter change, or a save's refetch, never moves focus.
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
});

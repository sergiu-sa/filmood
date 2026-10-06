/**
 * @vitest-environment jsdom
 */
import { render, waitFor } from "@testing-library/react";
import FilmActions from "@/components/film/FilmActions";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let user: { id: string } | null = null;
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user, loading: false }),
}));
vi.mock("@/lib/getAuthToken", () => ({
  getAuthHeaders: async () =>
    user ? { "Content-Type": "application/json", Authorization: "Bearer t" } : { "Content-Type": "application/json" },
}));

const fetchMock = vi.fn(async (url: string) =>
  url === "/api/watchlist" ? Response.json({ watchlist: [] }) : new Response(null, { status: 204 }),
);

const viewPosts = () => fetchMock.mock.calls.filter(([url]) => url === "/api/film-views");

// Lets every effect's getAuthHeaders().then(fetch) land.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// The page mounts a copy per layout; only the one with recordView posts.
const renderBoth = () => (
  <>
    <FilmActions movieId={7} movieTitle="Film 7" posterPath={null} layout="row" recordView />
    <FilmActions movieId={7} movieTitle="Film 7" posterPath={null} layout="column" />
  </>
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FilmActions film view", () => {
  it("posts the film id once for a signed-in user, with the Bearer header", async () => {
    user = { id: "u1" };
    const { rerender } = render(renderBoth());

    await waitFor(() => expect(viewPosts()).toHaveLength(1));
    const [, init] = viewPosts()[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer t" });
    expect(JSON.parse(init.body as string)).toEqual({ movie_id: 7 });

    // A token refresh hands out a new user object for the same account.
    user = { id: "u1" };
    rerender(renderBoth());
    await settle();
    expect(viewPosts()).toHaveLength(1);
  });

  it("posts nothing for a guest", async () => {
    user = null;
    render(renderBoth());

    await settle();
    expect(viewPosts()).toHaveLength(0);
  });
});

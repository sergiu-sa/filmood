/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { useFilms } from "@/lib/useFilms";

const film = (id: number) => ({ id, title: `Film ${id}`, poster_path: null, release_date: "2020-01-01", vote_average: 7, overview: "" });
const answer = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("useFilms", () => {
  it.each([
    ["a 500", () => answer({ error: "Failed to search films" }, 500), { message: "Couldn't reach the film database.", retryable: true }],
    ["no answer", () => Promise.reject(new TypeError("Failed to fetch")), { message: "Couldn't reach the film database.", retryable: true }],
    // The same request would get the same 400.
    ["a 400", () => answer({ error: "Invalid genre" }, 400), { message: "Invalid genre", retryable: false }],
  ])("reads %s as an error, not as no films", async (_label, respond, error) => {
    fetchMock.mockImplementation(respond);
    const { result } = renderHook(() => useFilms("/api/movies/browse?category=trending"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toEqual(error);
    expect(result.current.films).toEqual([]);
  });

  it("never lets an older url's late answer replace a newer one", async () => {
    let settleOld: (r: Response) => void = () => {};
    fetchMock.mockImplementation((url: string) =>
      url === "/old" ? new Promise<Response>((r) => (settleOld = r)) : answer({ films: [film(2)] }),
    );
    const { result, rerender } = renderHook(({ url }) => useFilms(url), { initialProps: { url: "/old" } });
    rerender({ url: "/new" });
    await waitFor(() => expect(result.current.films).toEqual([film(2)]));

    await act(async () => {
      settleOld(Response.json({ films: [film(1)] }));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current.films).toEqual([film(2)]);
  });

  it("keeps the last answer while asked for nothing, and shows it again without a refetch", async () => {
    fetchMock.mockImplementation(() => answer({ films: [film(1)], totalPages: 40 }));
    const { result, rerender } = renderHook(({ url }: { url: string | null }) => useFilms(url), {
      initialProps: { url: "/list" as string | null },
    });
    await waitFor(() => expect(result.current.films).toEqual([film(1)]));

    rerender({ url: null });
    rerender({ url: "/list" });
    expect(result.current.loading).toBe(false);
    expect(result.current.films).toEqual([film(1)]);
    expect(result.current.totalPages).toBe(40);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fetches again on a new attempt, loading until it answers", async () => {
    fetchMock.mockImplementationOnce(() => answer({ error: "Failed" }, 500));
    fetchMock.mockImplementationOnce(() => answer({ films: [film(1)] }));
    const { result, rerender } = renderHook(({ attempt }) => useFilms("/list", attempt), {
      initialProps: { attempt: 0 },
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    rerender({ attempt: 1 });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.films).toEqual([film(1)]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

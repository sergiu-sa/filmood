import { tmdbError } from "@/lib/api-errors";
import { TMDBError } from "@/lib/tmdb-fetch";

describe("tmdbError", () => {
  // 404 is the one upstream status that describes the client's request.
  it("forwards a 404 so an unknown film stays a 404", async () => {
    const res = tmdbError(new TMDBError(404, "/movie/999"), "Not found");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Not found" });
  });

  // A rotated key or a rate limit is our outage. Emitting TMDB's 401 would
  // drop it out of 5xx alerting and collide with this app's "not signed in".
  it.each([401, 403, 429, 502, 503])(
    "reports %i as a 500, not as the client's problem",
    (status) => {
      expect(tmdbError(new TMDBError(status, "/movie/1"), "Failed").status).toBe(500);
    },
  );

  // Response.json throws on null-body statuses; forwarding them verbatim would
  // turn a handled failure into an unhandled one inside the route's catch.
  it.each([204, 304])("does not forward null-body status %i", (status) => {
    expect(() =>
      tmdbError(new TMDBError(status, "/movie/1"), "Failed"),
    ).not.toThrow();
  });

  it("routes a missing key to a 500", () => {
    const res = tmdbError(new Error("TMDB API key not configured"), "Failed");
    expect(res.status).toBe(500);
  });
});

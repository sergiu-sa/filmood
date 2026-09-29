import { pickTopFilm } from "@/lib/topPick";

const f = (id: number, vote_average: number, vote_count: number) => ({ id, vote_average, vote_count });

describe("pickTopFilm", () => {
  it("returns null for no films", () => {
    expect(pickTopFilm([])).toBeNull();
  });

  // The raw-max pick this replaces chose the 9.1.
  it("prefers a well-voted 7.8 over a thinly voted 9.1", () => {
    const films = [f(1, 9.1, 40), f(2, 7.8, 20_000), f(3, 6.5, 3_000), f(4, 6.8, 5_000), f(5, 7.0, 2_000)];
    expect(pickTopFilm(films)?.id).toBe(2);
  });

  it("picks the highest rating when vote counts match", () => {
    const films = [f(1, 7.0, 1_000), f(2, 8.0, 1_000), f(3, 7.5, 1_000)];
    expect(pickTopFilm(films)?.id).toBe(2);
  });

  it("keeps the first film on a tie", () => {
    const films = [f(1, 7.5, 1_000), f(2, 7.5, 1_000)];
    expect(pickTopFilm(films)?.id).toBe(1);
  });

  it("copes with films that have no votes", () => {
    expect(pickTopFilm([f(1, 0, 0), f(2, 0, 0)])?.id).toBe(1);
  });
});

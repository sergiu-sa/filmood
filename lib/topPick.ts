/**
 * Bayesian pick: (v·R + m·C) / (v + m), C = pool mean. Stops a 9.1 from 40
 * votes beating a 7.8 from 20k. Pure; the results page runs it.
 */
export function pickTopFilm<T extends { vote_average: number; vote_count: number }>(
  films: T[],
  m = 500,
): T | null {
  if (films.length === 0) return null;
  const mean = films.reduce((sum, f) => sum + f.vote_average, 0) / films.length;
  const score = (f: T) => (f.vote_count * f.vote_average + m * mean) / (f.vote_count + m);
  return films.reduce((best, f) => (score(f) > score(best) ? f : best));
}

import { vi } from "vitest";

/** Answers each TMDB path with its body, or with the status when it's a number. Unlisted paths 404. */
export function mockTMDB(answers: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname.replace(/^\/3/, "");
      const answer = path in answers ? answers[path] : 404;
      const status = typeof answer === "number" ? answer : 200;
      return { ok: status === 200, status, json: async () => answer };
    }),
  );
}

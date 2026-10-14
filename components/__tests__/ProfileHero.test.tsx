/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import ProfileHero from "@/components/profile/ProfileHero";

vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: async () => ({}) }));

const user = (user_metadata: Record<string, unknown>) =>
  ({ id: "u1", email: "d@example.com", created_at: "2026-09-01T00:00:00Z", user_metadata }) as unknown as User;

describe("ProfileHero", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ watchlistCount: 0, moodPicks: 0, topMood: null, sessionsJoined: 0 })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("takes the avatar letter from the name it shows, not the email", async () => {
    render(<ProfileHero user={user({ full_name: "Sergiu" })} />);
    expect(screen.getByText("Sergiu")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.queryByText("D")).toBeNull();
    await screen.findByText("00"); // the stats have landed
  });

  it("shows the name typed at signup when none is saved on Account", async () => {
    render(<ProfileHero user={user({ name: "Filmood E2E" })} />);
    expect(screen.getByText("Filmood E2E")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
    await screen.findByText("00"); // the stats have landed
  });
});

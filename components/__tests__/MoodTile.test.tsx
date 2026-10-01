/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import MoodTile from "@/components/mood/MoodTile";
import { ACCENT_VARS } from "@/lib/constants";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("MoodTile", () => {
  it("is a link named by the mood's title and one-liner", () => {
    render(<MoodTile moodKey="easy" href="/results?mood=easy&src=tile" />);
    const link = screen.getByRole("link", { name: "Need a hug — Warm, gentle, comforting" });
    expect(link).toHaveAttribute("href", "/results?mood=easy&src=tile");
    expect(link).toHaveTextContent("Need a hug");
    expect(link).toHaveTextContent("Warm, gentle, comforting");
  });

  it("marks the mood with its accent", () => {
    render(<MoodTile moodKey="easy" href="/results?mood=easy" />);
    const dot = screen.getByRole("link").querySelector('[aria-hidden="true"]');
    expect(dot?.getAttribute("style")).toContain(ACCENT_VARS.teal.base);
  });

  // An inherited property name must not read as a mood.
  it("renders nothing for a key that isn't a mood", () => {
    const { container } = render(<MoodTile moodKey="constructor" href="/results?mood=constructor" />);
    expect(container).toBeEmptyDOMElement();
  });
});

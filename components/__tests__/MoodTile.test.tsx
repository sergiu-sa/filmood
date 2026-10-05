/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("full: keeps the same name and adds the signature film as a hint", () => {
    render(<MoodTile moodKey="easy" href="/results?mood=easy&src=tile" variant="full" />);
    const link = screen.getByRole("link", { name: "Need a hug — Warm, gentle, comforting" });
    expect(link).toHaveTextContent("like The Holdovers");
    const icons = link.querySelectorAll("svg");
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute("aria-hidden", "true");
  });

  it("full: shows a long signature title whole", () => {
    render(<MoodTile moodKey="thrilling" href="/results?mood=thrilling" variant="full" />);
    expect(screen.getByRole("link")).toHaveTextContent("like Mission: Impossible - Dead Reckoning Part One");
  });

  it("compact has no hint and no arrow", () => {
    render(<MoodTile moodKey="easy" href="/results?mood=easy" />);
    const link = screen.getByRole("link");
    expect(link).not.toHaveTextContent(/like /);
    expect(link.querySelector("svg")).toBeNull();
  });

  it.each(["compact", "full"] as const)("%s hands its accent to the shared hover state", (variant) => {
    render(<MoodTile moodKey="easy" href="/results?mood=easy" variant={variant} />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("mood-tile");
    expect(link.style.getPropertyValue("--tile-accent")).toBe(ACCENT_VARS.teal.base);
  });

  // An inherited property name must not read as a mood.
  it("renders nothing for a key that isn't a mood", () => {
    const { container } = render(<MoodTile moodKey="constructor" href="/results?mood=constructor" />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("toggle", () => {
    const onToggle = vi.fn();
    afterEach(() => onToggle.mockClear());

    it("is a button with the link's name, unpressed, and no href", () => {
      render(<MoodTile moodKey="easy" pressed={false} onToggle={onToggle} />);
      const button = screen.getByRole("button", { name: "Need a hug — Warm, gentle, comforting" });
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button).not.toHaveAttribute("href");
      expect(button).toHaveClass("mood-tile");
      expect(button.querySelector("svg")).toBeNull();
    });

    it("hands its key to onToggle", () => {
      render(<MoodTile moodKey="easy" pressed={false} onToggle={onToggle} />);
      fireEvent.click(screen.getByRole("button"));
      expect(onToggle).toHaveBeenCalledExactlyOnceWith("easy");
    });

    it("pressed: a check, the accent fill and a heavier accent border", () => {
      render(<MoodTile moodKey="easy" pressed onToggle={onToggle} />);
      const button = screen.getByRole("button", { pressed: true });
      expect(button.querySelectorAll("svg")).toHaveLength(1);
      expect(button.style.border).toContain("1.5px solid");
      expect(button.getAttribute("style")).toContain(ACCENT_VARS.teal.soft);
    });

    it("renders nothing for a key that isn't a mood", () => {
      const { container } = render(<MoodTile moodKey="constructor" pressed={false} onToggle={onToggle} />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});

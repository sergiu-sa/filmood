/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import MoodPanel from "@/components/dashboard/MoodPanel";
import { allMoods } from "@/lib/moodMap";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The viewport width the mocked media queries answer for.
let width = 1440;
let reducedMotion = false;
vi.mock("@/lib/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    if (query.includes("reduced-motion")) return reducedMotion;
    const max = Number(/max-width: (\d+)px/.exec(query)?.[1]);
    return Number.isFinite(max) && width <= max;
  },
}));

// jsdom has no ResizeObserver; this one reports once, as a first layout would.
class FakeResizeObserver {
  constructor(private cb: () => void) {}
  observe() {
    this.cb();
  }
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", FakeResizeObserver);

const onClose = vi.fn();
const tileName = (m: (typeof allMoods)[number]) => `${m.tagLabel} — ${m.description}`;
const grid = () => screen.getAllByRole("link")[0].parentElement!;

describe("MoodPanel", () => {
  afterEach(() => {
    width = 1440;
    reducedMotion = false;
    vi.clearAllMocks();
  });

  it("links every mood straight to its results, in mood order", () => {
    render(<MoodPanel isOpen onClose={onClose} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(allMoods.length);
    allMoods.forEach((m, i) => {
      expect(links[i]).toHaveAccessibleName(tileName(m));
      expect(links[i]).toHaveAttribute("href", `/results?mood=${m.key}&src=tile`);
    });
  });

  it("desktop: asks how you want to feel and explains the next page, with no eyebrow or Close", () => {
    render(<MoodPanel isOpen onClose={onClose} />);
    expect(screen.getByRole("heading", { level: 2, name: "How do you want to feel?" })).toBeInTheDocument();
    expect(screen.getByText(/On the next page you can add a second mood/)).toBeInTheDocument();
    expect(screen.queryByText("What to watch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: tileName(allMoods[0]) })).toHaveTextContent(/like /);
  });

  it("in the sheet: eyebrow, compact tiles and a Close that closes", () => {
    width = 390;
    render(<MoodPanel isOpen embedded onClose={onClose} />);
    expect(screen.getByText("What to watch")).toBeInTheDocument();
    expect(screen.queryByText(/On the next page/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: tileName(allMoods[0]) })).not.toHaveTextContent(/like /);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has no selection, submit, counter or Era/Tempo controls", () => {
    render(<MoodPanel isOpen onClose={onClose} />);
    expect(screen.queryByRole("button", { name: /find films/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/pick up to/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Slow-burn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Before 1990" })).not.toBeInTheDocument();
  });

  it.each([
    [1440, 4],
    [900, 4],
    [899, 3],
    [640, 3],
    [639, 2],
    [390, 2],
  ])("at %ipx the grid has %i columns", (w, columns) => {
    width = w;
    render(<MoodPanel isOpen onClose={onClose} />);
    expect(grid().style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
  });

  // Collapsed, it's only hidden visually; inert takes its tiles out of the Tab order.
  it("takes a closed desktop panel out of the Tab order", () => {
    const { container, rerender } = render(<MoodPanel isOpen={false} onClose={onClose} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.maxHeight).toBe("0");
    expect(wrapper).toHaveAttribute("inert");
    rerender(<MoodPanel isOpen onClose={onClose} />);
    expect(wrapper).not.toHaveAttribute("inert");
  });

  // The collapse is an inline transition, which globals.css's reduced-motion rules can't reach.
  it("opens and closes without animating under reduced motion", () => {
    reducedMotion = true;
    const { container } = render(<MoodPanel isOpen onClose={onClose} />);
    expect((container.firstChild as HTMLElement).style.transition).toBe("none");
  });

  // The sheet's tiles read it as their scroll-margin, so focus never leaves one under the pinned field.
  it("in the sheet, publishes the pinned footer's height to its tiles", () => {
    render(<MoodPanel isOpen embedded onClose={onClose} />);
    const root = screen.getByRole("heading", { level: 2 }).closest("[style*='--sheet-footer-h']");
    expect(root).not.toBeNull();
    expect(root).toContainElement(screen.getAllByRole("link")[0]);
  });

  it.each([false, true])("has the describe field (embedded: %s)", (embedded) => {
    render(<MoodPanel isOpen embedded={embedded} onClose={onClose} />);
    expect(screen.getByLabelText("Or describe it in your own words")).toBeInTheDocument();
  });
});

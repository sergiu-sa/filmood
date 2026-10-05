/**
 * @vitest-environment jsdom
 */
import { render } from "@testing-library/react";
import MoodGrid from "@/components/mood/MoodGrid";

// The viewport width the mocked media queries answer for.
let width = 1440;
vi.mock("@/lib/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    const max = Number(/max-width: (\d+)px/.exec(query)?.[1]);
    return Number.isFinite(max) && width <= max;
  },
}));

const grid = (container: HTMLElement) => container.firstChild as HTMLElement;

describe("MoodGrid", () => {
  afterEach(() => {
    width = 1440;
  });

  it.each([
    [1440, 4],
    [900, 4],
    [899, 3],
    [640, 3],
    [639, 2],
    [390, 2],
  ])("at %ipx it has %i columns", (w, columns) => {
    width = w;
    const { container } = render(<MoodGrid>tiles</MoodGrid>);
    expect(grid(container).style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
  });

  it("spaces tiles 12px apart unless told otherwise", () => {
    const { container, rerender } = render(<MoodGrid>tiles</MoodGrid>);
    expect(grid(container).style.gap).toBe("12px");
    rerender(<MoodGrid gap={10}>tiles</MoodGrid>);
    expect(grid(container).style.gap).toBe("10px");
  });
});

/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import Breadcrumb from "@/components/Breadcrumb";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let width = 1440;
vi.mock("@/lib/useMediaQuery", () => ({
  useMediaQuery: (query: string) => width <= Number(/max-width: (\d+)px/.exec(query)?.[1]),
}));

const items = [
  { label: "Home", href: "/" },
  { label: "Browse", href: "/browse" },
  { label: "Fight Club" },
];

describe("Breadcrumb", () => {
  afterEach(() => {
    width = 1440;
  });

  // The negative margin takes the extra height back out of the layout, so the row doesn't grow.
  it("gives every link a 44px tall target below 900, without growing the row", () => {
    width = 899;
    render(<Breadcrumb items={items} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    links.forEach((link) => {
      expect(link.style.minHeight).toBe("44px");
      expect(link.style.margin).toBe("-8px 0px");
    });
  });

  it("leaves the links their own height from 900", () => {
    width = 900;
    render(<Breadcrumb items={items} />);
    screen.getAllByRole("link").forEach((link) => {
      expect(link.style.minHeight).toBe("");
      expect(link.style.margin).toBe("");
    });
  });

  it("links every item but the last, which is the current page", () => {
    render(<Breadcrumb items={items} />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/browse");
    expect(screen.queryByRole("link", { name: "Fight Club" })).not.toBeInTheDocument();
    expect(screen.getByText("Fight Club")).toBeInTheDocument();
  });
});

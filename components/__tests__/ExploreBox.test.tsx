/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import ExploreBox from "@/components/dashboard/ExploreBox";

describe("ExploreBox", () => {
  // A role="button" box around real buttons put controls inside a control.
  it("is no button itself; its button says whether the panel is open", () => {
    const { container, rerender } = render(<ExploreBox onExpand={vi.fn()} isExpanded={false} />);
    expect(container.querySelector('[role="button"], [tabindex]')).toBeNull();
    expect(screen.getByRole("button", { name: "Start or join a session" })).toHaveAttribute("aria-expanded", "false");

    rerender(<ExploreBox onExpand={vi.fn()} isExpanded />);
    expect(screen.getByRole("button", { name: "Start or join a session" })).toHaveAttribute("aria-expanded", "true");
  });

  it("opens once from its button, and from a click anywhere on the box", () => {
    const onExpand = vi.fn();
    render(<ExploreBox onExpand={onExpand} isExpanded={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Start or join a session" }));
    expect(onExpand).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("heading", { name: "Discover together" }));
    expect(onExpand).toHaveBeenCalledTimes(2);
  });
});

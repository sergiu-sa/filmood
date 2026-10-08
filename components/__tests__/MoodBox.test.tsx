/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import MoodBox from "@/components/dashboard/MoodBox";

vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => true }));

describe("MoodBox", () => {
  // A role="button" box around a real button put two controls in the Tab order, one inside the other.
  it("has one control, the button, which says whether the board is open", () => {
    const { container, rerender } = render(<MoodBox onExpand={vi.fn()} isExpanded={false} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName("Open the mood board");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector('[role="button"], [tabindex]')).toBeNull();

    rerender(<MoodBox onExpand={vi.fn()} isExpanded />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles once from the button, and from a click anywhere on the box", () => {
    const onExpand = vi.fn();
    render(<MoodBox onExpand={onExpand} isExpanded={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open the mood board" }));
    expect(onExpand).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("heading", { name: "Pick your mood" }));
    expect(onExpand).toHaveBeenCalledTimes(2);
  });
});

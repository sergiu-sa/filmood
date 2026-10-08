/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterGroup from "@/components/mood/FilterGroup";

const options = [
  { value: null, label: "Any" },
  { value: "short" as const, label: "Under 100 min" },
  { value: "long" as const, label: "Long" },
];

function renderGroup(props: Partial<Parameters<typeof FilterGroup>[0]> = {}) {
  const onChange = vi.fn();
  render(<FilterGroup label="Time" options={options} value={null} onChange={onChange} {...props} />);
  return { onChange };
}

describe("FilterGroup", () => {
  it("is a named radiogroup with its options as radios", () => {
    renderGroup({ value: "short" });
    const group = screen.getByRole("radiogroup", { name: "Time" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Under 100 min" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Any" })).toHaveAttribute("aria-checked", "false");
  });

  it("keeps only the checked option in the Tab order", () => {
    renderGroup({ value: "short" });
    const tabbable = screen.getAllByRole("radio").filter((r) => r.tabIndex === 0);
    expect(tabbable).toEqual([screen.getByRole("radio", { name: "Under 100 min" })]);
  });

  // Every selection is a search, so arrows only move focus.
  it("moves focus with the arrows, wrapping, without selecting", async () => {
    const user = userEvent.setup();
    const { onChange } = renderGroup({ value: "long" });
    screen.getByRole("radio", { name: "Long" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Any" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Long" })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("selects with Space, and Any selects null", async () => {
    const user = userEvent.setup();
    const { onChange } = renderGroup({ value: "long" });
    screen.getByRole("radio", { name: "Long" }).focus();

    await user.keyboard("{ArrowLeft} ");
    expect(onChange).toHaveBeenLastCalledWith("short");
    await user.keyboard("{ArrowLeft} ");
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("moves with Up and Down when vertical", async () => {
    const user = userEvent.setup();
    renderGroup({ orientation: "vertical" });
    screen.getByRole("radio", { name: "Any" }).focus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Under 100 min" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(screen.getByRole("radio", { name: "Long" })).toHaveFocus();
  });

  // The radiogroup pattern: both axes in either orientation, plus Home and End.
  it("moves with either axis and Home/End in a horizontal group, without selecting", async () => {
    const user = userEvent.setup();
    const { onChange } = renderGroup();
    screen.getByRole("radio", { name: "Any" }).focus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("radio", { name: "Under 100 min" })).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("radio", { name: "Any" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Long" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Any" })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves with Left and Right when vertical", async () => {
    const user = userEvent.setup();
    renderGroup({ orientation: "vertical" });
    screen.getByRole("radio", { name: "Any" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Under 100 min" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Long" })).toHaveFocus();
  });

  it("ignores a click on the checked option", async () => {
    const user = userEvent.setup();
    const { onChange } = renderGroup({ value: "short" });
    await user.click(screen.getByRole("radio", { name: "Under 100 min" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("points an option at the popover it controls", () => {
    render(
      <FilterGroup
        label="Where"
        options={[{ value: "mine", label: "My services", controls: "services-picker" }]}
        value={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("radio", { name: "My services" })).toHaveAttribute("aria-controls", "services-picker");
  });
});

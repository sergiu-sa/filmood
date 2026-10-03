/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import MoodDescribe from "@/components/mood/MoodDescribe";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

const field = () => screen.getByLabelText("Or describe it in your own words");
const echo = () => screen.getByRole("status");
const type = (value: string) => fireEvent.change(field(), { target: { value } });
const settle = () => act(() => vi.advanceTimersByTime(300));
const submit = () => fireEvent.submit(field().closest("form")!);
const pushedText = () => new URL(push.mock.calls[0][0], "http://localhost").searchParams.get("text");

describe("MoodDescribe", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("labels the field and caps it at the search's text limit", () => {
    render(<MoodDescribe />);
    expect(field()).toHaveAttribute("maxLength", "120");
    expect(field()).toHaveAttribute("placeholder", "e.g. cozy 80s heist");
  });

  it("reads the text once typing stops, not on every key", () => {
    render(<MoodDescribe />);
    type("cozy 80s heist with robots");
    expect(echo()).toBeEmptyDOMElement();
    settle();
    expect(echo()).toHaveTextContent("We'll read that as");
    for (const chip of ["Need a hug", "Need a rush", "Before 1990"]) expect(echo()).toHaveTextContent(chip);
    expect(echo()).toHaveTextContent("Didn't recognise: robots");
  });

  it("waits for a pause, not for each key", () => {
    render(<MoodDescribe />);
    type("fun");
    act(() => vi.advanceTimersByTime(200));
    type("funny");
    act(() => vi.advanceTimersByTime(200));
    expect(echo()).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(100));
    expect(echo()).toHaveTextContent("Need to laugh");
  });

  it("says which mood a third one left out", () => {
    render(<MoodDescribe />);
    type("funny dark scary");
    settle();
    expect(echo()).toHaveTextContent("Need to laugh");
    expect(echo()).toHaveTextContent("Go dark");
    expect(echo()).toHaveTextContent("Two moods at a time — left out Feel uneasy.");
  });

  it("reads a tempo word as a Time", () => {
    render(<MoodDescribe />);
    type("slow burn noir");
    settle();
    expect(echo()).toHaveTextContent("Go dark");
    expect(echo()).toHaveTextContent("Long & immersive");
  });

  it("asks for a feeling word and won't search without one", () => {
    render(<MoodDescribe />);
    type("80s");
    settle();
    expect(echo()).toHaveTextContent("Add a feeling word — like funny, dark or cozy.");
    submit();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Show films" })).toHaveAttribute("aria-disabled", "true");
  });

  it("says when nothing matched", () => {
    render(<MoodDescribe />);
    type("xyz");
    settle();
    expect(echo()).toHaveTextContent("Nothing in “xyz” matched a mood. Try a feeling word like funny, dark or cozy.");
  });

  it("searches the trimmed text from the describe field", () => {
    render(<MoodDescribe />);
    type("  cozy  ");
    submit();
    expect(push).toHaveBeenCalledWith("/results?text=cozy&src=text");
  });

  it("encodes what was typed", () => {
    render(<MoodDescribe />);
    type("rom com & heist");
    submit();
    expect(pushedText()).toBe("rom com & heist");
  });

  // The gate reads the current text, so Enter never waits on the echo's debounce.
  it("searches at once, before the reading has caught up", () => {
    render(<MoodDescribe />);
    type("funny");
    submit();
    expect(push).toHaveBeenCalledOnce();
  });

  it("does nothing with empty text", () => {
    render(<MoodDescribe />);
    type("   ");
    submit();
    expect(push).not.toHaveBeenCalled();
  });

  it("names the button by its text on desktop and by its label when compact", () => {
    const { unmount } = render(<MoodDescribe />);
    expect(screen.getByRole("button", { name: "Show films" })).toHaveTextContent("Show films");
    unmount();
    render(<MoodDescribe compact />);
    expect(screen.getByRole("button", { name: "Show films" })).not.toHaveTextContent("Show films");
  });

  it("announces the reading politely", () => {
    render(<MoodDescribe />);
    expect(echo()).toHaveAttribute("aria-live", "polite");
  });
});

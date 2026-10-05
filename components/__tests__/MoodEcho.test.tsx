/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
import MoodEcho from "@/components/mood/MoodEcho";

const echo = () => screen.getByRole("status");
const settle = () => act(() => vi.advanceTimersByTime(300));

// Home's readings (no picked tiles) are covered through MoodDescribe.test.tsx.
describe("MoodEcho", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("leaves the text's mood out when two tiles are picked", () => {
    render(<MoodEcho text="cozy" picked={["laugh", "dark"]} />);
    settle();
    expect(echo()).toHaveTextContent("Two moods at a time — left out Need a hug.");
    expect(echo()).not.toHaveTextContent("We'll read that as");
  });

  it("fills the one free slot with the text's first mood, in the route's order", () => {
    render(<MoodEcho text="cozy scary" picked={["laugh"]} />);
    settle();
    expect(echo()).toHaveTextContent("We'll read that asNeed a hug");
    expect(echo()).toHaveTextContent("Two moods at a time — left out Feel uneasy.");
  });

  it("adds no chip for a mood that's already picked", () => {
    render(<MoodEcho text="cozy" picked={["easy"]} />);
    settle();
    expect(echo()).toBeEmptyDOMElement();
  });

  it("doesn't ask for a feeling word once a tile is picked", () => {
    render(<MoodEcho text="80s heist" picked={["laugh"]} />);
    settle();
    expect(echo()).toHaveTextContent("We'll read that asNeed a rush·Before 1990");
    expect(echo()).not.toHaveTextContent(/feeling word/);
  });

  it("reads a filter alone without a leading separator", () => {
    render(<MoodEcho text="80s" picked={["laugh"]} />);
    settle();
    expect(echo()).toHaveTextContent(/^We'll read that asBefore 1990$/);
  });

  it("leaves out a Time or Era the page set, since it beats the text's", () => {
    render(<MoodEcho text="cozy slow 80s" picked={[]} time="medium" era="fresh" />);
    settle();
    expect(echo()).toHaveTextContent(/^We'll read that asNeed a hug$/);
  });

  it("still asks for a feeling word with no tile, even when the page set the text's era", () => {
    render(<MoodEcho text="80s" era="fresh" />);
    settle();
    expect(echo()).toHaveTextContent("Add a feeling word — like funny, dark or cozy.");
  });
});

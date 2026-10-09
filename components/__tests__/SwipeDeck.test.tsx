/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import SwipeDeck from "@/components/group/SwipeDeck";
import type { DeckFilm } from "@/lib/types";

vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => false }));

const film = (id: number): DeckFilm => ({
  id,
  title: `Title ${id}`,
  overview: "",
  poster_path: null,
  release_date: "2010-01-01",
  vote_average: 7,
  genre_ids: [],
  mood_keys: [],
});
const deck = [1, 2, 3].map(film);
const press = () => fireEvent.keyDown(window, { key: "ArrowRight" });
const votedIds = (onVote: ReturnType<typeof vi.fn>) => onVote.mock.calls.map(([id]) => id);

describe("SwipeDeck", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("votes the next card when a key lands after the vote's timer, before React re-binds the listener", () => {
    const onVote = vi.fn();
    render(<SwipeDeck deck={deck} votes={{}} onVote={onVote} disabled={false} />);

    act(() => press());
    // One act: the timer releases the lock, and the press reaches the listener
    // bound in the render before it.
    act(() => {
      vi.advanceTimersByTime(380);
      press();
    });
    act(() => vi.advanceTimersByTime(380));

    expect(votedIds(onVote)).toEqual([1, 2]);
    expect(screen.getByText("Title 3")).toBeInTheDocument();
  });

  it("never moves back when a poll from before the vote lands while its POST is in flight", () => {
    const onVote = vi.fn();
    const { rerender } = render(<SwipeDeck deck={deck} votes={{}} onVote={onVote} disabled={false} />);

    act(() => press());
    act(() => vi.advanceTimersByTime(380));
    expect(screen.getByText("Title 2")).toBeInTheDocument();

    // The poll's snapshot: a fresh deck array, still no vote on film 1.
    rerender(<SwipeDeck deck={[...deck]} votes={{}} onVote={onVote} disabled={false} />);
    expect(screen.getByText("Title 2")).toBeInTheDocument();
    expect(votedIds(onVote)).toEqual([1]);
  });
});

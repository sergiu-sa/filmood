/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultsError } from "@/components/results/ResultsStatus";

const push = vi.fn();
let search = "mood=laugh&seed=9";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const MESSAGE = "Add a feeling word — like 'funny', 'dark', or 'cozy'. Era or tempo alone isn't enough.";

describe("ResultsError", () => {
  beforeEach(() => {
    push.mockReset();
    search = "mood=laugh&seed=9";
  });

  it("retryable: says the database is unreachable and retries", async () => {
    const onRetry = vi.fn();
    render(<ResultsError message="Unexpected token '<'" retryable onRetry={onRetry} />);
    expect(screen.getByRole("heading", { level: 1, name: "Couldn't reach the film database." })).toBeInTheDocument();
    expect(screen.queryByText(/unexpected token/i)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("not retryable: the route's message and a way home, no retry", () => {
    render(<ResultsError message={MESSAGE} retryable={false} onRetry={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1, name: MESSAGE })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pick a mood" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("not retryable with text: offers the text to edit", async () => {
    search = "text=80s&era=any&seed=9";
    render(<ResultsError message={MESSAGE} retryable={false} onRetry={vi.fn()} />);
    const field = screen.getByRole("textbox", { name: "Describe your mood" });
    expect(field).toHaveValue("80s");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).not.toHaveBeenCalled();

    await userEvent.clear(field);
    await userEvent.type(field, "funny 80s{Enter}");
    expect(push).toHaveBeenCalledExactlyOnceWith("/results?text=funny+80s&seed=9&src=text");
  });
});

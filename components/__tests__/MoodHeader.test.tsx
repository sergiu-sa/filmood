/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MoodHeader, { withMoods } from "@/components/results/MoodHeader";
import { moodMap } from "@/lib/moodMap";
import type { AppliedFilters, DiscoverResponse } from "@/lib/types";

const push = vi.fn();
let search = "mood=laugh&seed=9";
let mobile = false;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => mobile }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

type Interpreted = NonNullable<DiscoverResponse["interpreted"]>;

const mood = (key: string) => ({ key, label: moodMap[key].tagLabel, accent: moodMap[key].accentColor });
const NONE: AppliedFilters = { time: null, era: null, where: "norway" };
const reading = (r: Partial<Interpreted> & { text: string }): Interpreted => ({
  moods: [],
  era: null,
  time: null,
  unmatched: [],
  ...r,
});

function renderHeader(
  props: {
    moods?: string[];
    interpreted?: Interpreted | null;
    droppedMoods?: string[];
    filters?: Partial<AppliedFilters>;
  } = {},
) {
  return render(
    <MoodHeader
      moods={(props.moods ?? ["laugh"]).map(mood)}
      interpreted={props.interpreted ?? null}
      droppedMoods={props.droppedMoods ?? []}
      filters={{ ...NONE, ...props.filters }}
    />,
  );
}

/** The params of the last URL pushed. */
const pushed = () => {
  const href: string = push.mock.calls.at(-1)![0];
  expect(href.startsWith("/results?")).toBe(true);
  return new URLSearchParams(href.split("?")[1]);
};

/** A paragraph by its whole text, nested spans included. */
const line = (text: string) =>
  screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === text && el.parentElement?.tagName === "P");

describe("MoodHeader", () => {
  beforeEach(() => {
    search = "mood=laugh&seed=9";
    mobile = false;
  });
  afterEach(() => vi.clearAllMocks());

  describe("title", () => {
    it("one mood: its title as the h1 and its one-liner under it", () => {
      renderHeader();
      expect(screen.getByRole("heading", { level: 1, name: "Need to laugh" })).toBeInTheDocument();
      expect(screen.getByText("What to watch")).toBeInTheDocument();
      expect(screen.getByText("Big laughs, zero homework.")).toBeInTheDocument();
    });

    it("two moods: both titles, blended, no one-liner", () => {
      search = "mood=laugh,dark&seed=9";
      renderHeader({ moods: ["laugh", "dark"] });
      expect(screen.getByRole("heading", { level: 1, name: "Need to laugh + Go dark" })).toBeInTheDocument();
      expect(screen.getByText("What to watch · blended")).toBeInTheDocument();
      expect(screen.queryByText(/big laughs/i)).toBeNull();
    });
  });

  describe("removing a mood", () => {
    it("keeps the seed and every filter and credits the change to the filter", async () => {
      search = "mood=laugh,dark&time=short&seed=9";
      renderHeader({ moods: ["laugh", "dark"] });
      await userEvent.click(screen.getByRole("button", { name: "Remove Go dark" }));
      expect(push).toHaveBeenCalledExactlyOnceWith("/results?mood=laugh&time=short&seed=9&src=filter");
    });

    it("goes home when the last mood goes and there's no text", async () => {
      renderHeader();
      await userEvent.click(screen.getByRole("button", { name: "Remove Need to laugh" }));
      expect(push).toHaveBeenCalledExactlyOnceWith("/");
    });

    it("keeps the text when the last tile mood goes", async () => {
      search = "mood=laugh&text=noir&seed=9";
      renderHeader({ moods: ["laugh", "dark"], interpreted: reading({ text: "noir", moods: ["dark"] }) });
      await userEvent.click(screen.getByRole("button", { name: "Remove Need to laugh" }));
      const url = pushed();
      expect(url.has("mood")).toBe(false);
      expect(url.get("text")).toBe("noir");
      expect(url.get("seed")).toBe("9");
    });

    // The text would bring it straight back (Q6).
    it("offers no remove on a mood read from the text", () => {
      search = "text=noir&seed=9";
      renderHeader({ moods: ["dark"], interpreted: reading({ text: "noir", moods: ["dark"] }) });
      expect(screen.getByText("Go dark", { selector: "li *" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove Go dark" })).toBeNull();
    });
  });

  describe("adding a mood", () => {
    it("lists the other eleven moods as links that keep the filters and seed", async () => {
      search = "mood=laugh&time=short&seed=9&src=direct";
      renderHeader();
      await userEvent.click(screen.getByRole("button", { name: "Add a mood" }));

      const dialog = screen.getByRole("dialog", { name: "Add a mood" });
      const links = Array.from(dialog.querySelectorAll("a"));
      expect(links).toHaveLength(11);

      const dark = new URLSearchParams(
        screen.getByRole("link", { name: /^Go dark —/ }).getAttribute("href")!.split("?")[1],
      );
      expect(dark.get("mood")).toBe("laugh,dark");
      expect(dark.get("time")).toBe("short");
      expect(dark.get("seed")).toBe("9");
      expect(dark.get("src")).toBe("tile");
    });

    it("closes on Escape and returns focus to the chip", async () => {
      renderHeader();
      const chip = screen.getByRole("button", { name: "Add a mood" });
      await userEvent.click(chip);
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: "Add a mood" })).toBeNull();
      expect(chip).toHaveFocus();
    });

    it("stops at two moods", () => {
      search = "mood=laugh,dark&seed=9";
      renderHeader({ moods: ["laugh", "dark"] });
      expect(screen.getByRole("button", { name: "2 of 2 moods" })).toBeDisabled();
      expect(screen.queryByRole("button", { name: "Add a mood" })).toBeNull();
    });

    // FilterBar already keeps a BottomSheet mounted; this one exists only while open.
    it("mobile: a sheet that's mounted only while open", async () => {
      mobile = true;
      renderHeader();
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);

      const chip = screen.getByRole("button", { name: "Add a mood" });
      await userEvent.click(chip);
      const sheet = screen.getByRole("dialog", { name: "Add a mood" });
      expect(sheet.querySelectorAll("a")).toHaveLength(11);

      await userEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0);
      expect(chip).toHaveFocus();
    });

    it("closes once a mood is picked", async () => {
      renderHeader();
      await userEvent.click(screen.getByRole("button", { name: "Add a mood" }));
      await userEvent.click(screen.getByRole("link", { name: /^Go dark —/ }));
      expect(screen.queryByRole("dialog", { name: "Add a mood" })).toBeNull();
    });
  });

  it("says which mood the two-mood cap left out", () => {
    search = "mood=laugh,cry,dark&seed=9";
    renderHeader({ moods: ["laugh", "cry"], droppedMoods: ["dark"] });
    expect(screen.getByText("Two moods at a time — left out Go dark.")).toBeInTheDocument();
  });

  describe("interpretation line", () => {
    it("names the moods and the filters the text set, and the words it didn't know", () => {
      search = "text=slow%20burn%20noir%20heist&seed=9";
      renderHeader({
        moods: ["dark"],
        interpreted: reading({ text: "slow burn noir heist", moods: ["dark"], time: "long", unmatched: ["heist"] }),
        filters: { time: "long" },
      });
      expect(line("We read “slow burn noir heist” as Go dark · Long & immersive.")).toBeInTheDocument();
      expect(screen.getByText("Didn't recognise: heist.")).toBeInTheDocument();
    });

    it("leaves out an Era the bar overrode", () => {
      search = "mood=laugh&text=cozy%2080s&era=any&seed=9";
      renderHeader({
        moods: ["laugh", "easy"],
        interpreted: reading({ text: "cozy 80s", moods: ["easy"], era: "classic" }),
      });
      expect(line("We read “cozy 80s” as Need a hug.")).toBeInTheDocument();
      expect(screen.queryByText(/before 1990/i)).toBeNull();
    });

    it("says when nothing it read applies", () => {
      search = "mood=laugh&text=80s&era=any&seed=9";
      renderHeader({ interpreted: reading({ text: "80s", era: "classic" }) });
      expect(line("Nothing from “80s” applies right now.")).toBeInTheDocument();
    });

    it("counts a text mood the cap left out as not applying", () => {
      search = "mood=laugh,cry&text=scary&seed=9";
      renderHeader({
        moods: ["laugh", "cry"],
        interpreted: reading({ text: "scary", moods: ["unsettled"] }),
        droppedMoods: ["unsettled"],
      });
      expect(line("Nothing from “scary” applies right now.")).toBeInTheDocument();
    });

    it("says when nothing matched", () => {
      search = "mood=laugh&text=xyz&seed=9";
      renderHeader({ interpreted: reading({ text: "xyz", unmatched: ["xyz"] }) });
      expect(line("Nothing in “xyz” matched a mood or filter.")).toBeInTheDocument();
      expect(screen.queryByText(/didn't recognise/i)).toBeNull();
    });

    it("isn't there without text", () => {
      renderHeader();
      expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    });
  });

  describe("editing the text", () => {
    const edit = async (text: string) => {
      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      const field = screen.getByRole("textbox", { name: "Describe your mood" });
      await userEvent.clear(field);
      if (text) await userEvent.type(field, text);
      await userEvent.keyboard("{Enter}");
    };

    it("pushes the new text with the moods, filters and seed kept, and drops time=any / era=any", async () => {
      search = "mood=laugh&text=noir&era=any&time=short&seed=9";
      renderHeader({ moods: ["laugh", "dark"], interpreted: reading({ text: "noir", moods: ["dark"] }) });
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Edit" }));
      const field = screen.getByRole("textbox", { name: "Describe your mood" });
      expect(field).toHaveValue("noir");
      expect(field).toHaveAttribute("maxLength", "120");
      await userEvent.clear(field);
      await userEvent.type(field, "funny{Enter}");

      const url = pushed();
      expect(url.get("text")).toBe("funny");
      expect(url.get("mood")).toBe("laugh");
      expect(url.get("time")).toBe("short");
      expect(url.get("seed")).toBe("9");
      expect(url.get("src")).toBe("text");
      expect(url.has("era")).toBe(false);
    });

    it("an empty text removes it and keeps the tile moods", async () => {
      search = "mood=laugh&text=noir&time=any&seed=9";
      renderHeader({ moods: ["laugh", "dark"], interpreted: reading({ text: "noir", moods: ["dark"] }) });
      await edit("");
      const url = pushed();
      expect(url.has("text")).toBe(false);
      expect(url.has("time")).toBe(false);
      expect(url.get("mood")).toBe("laugh");
    });

    it("an empty text with no tile moods goes home", async () => {
      search = "text=noir&seed=9";
      renderHeader({ moods: ["dark"], interpreted: reading({ text: "noir", moods: ["dark"] }) });
      await edit("");
      expect(push).toHaveBeenCalledExactlyOnceWith("/");
    });

    it("an unchanged text only closes the field", async () => {
      search = "mood=laugh&text=noir&seed=9";
      renderHeader({ moods: ["laugh", "dark"], interpreted: reading({ text: "noir", moods: ["dark"] }) });
      await edit("noir");
      expect(push).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).toBeNull();
    });
  });
});

describe("withMoods", () => {
  it("sets the moods and keeps everything else", () => {
    const next = withMoods(new URLSearchParams("mood=laugh&time=short&seed=9"), ["laugh", "dark"], "tile");
    expect(next.get("mood")).toBe("laugh,dark");
    expect(next.get("time")).toBe("short");
    expect(next.get("seed")).toBe("9");
    expect(next.get("src")).toBe("tile");
  });

  it("deletes mood when none are left", () => {
    const next = withMoods(new URLSearchParams("mood=laugh&text=noir"), [], "filter");
    expect(next.has("mood")).toBe(false);
    expect(next.get("text")).toBe("noir");
  });

  it("overwrites an old src", () => {
    const next = withMoods(new URLSearchParams("mood=laugh&src=shuffle"), ["dark"], "filter");
    expect(next.getAll("src")).toEqual(["filter"]);
  });
});

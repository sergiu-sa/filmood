/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterBar from "@/components/results/FilterBar";
import type { AppliedFilters } from "@/lib/types";
import type { Services } from "@/lib/useServices";

const replace = vi.fn();
let search = "mood=laugh&seed=9&tempo=slowburn";
let mobile = false;
let services: Services;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => mobile }));
vi.mock("@/lib/useServices", () => ({ useServices: () => services }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const NONE: AppliedFilters = { time: null, era: null, where: "norway" };

function renderBar(props: { filters?: Partial<AppliedFilters>; count?: number; busy?: boolean } = {}) {
  const el = (p: typeof props) => (
    <FilterBar filters={{ ...NONE, ...p.filters }} count={p.count ?? 20} busy={p.busy ?? false} />
  );
  const view = render(el(props));
  return { ...view, rerender: (p: typeof props) => view.rerender(el(p)) };
}

/** The params of the last URL the bar wrote. */
const lastUrl = () => {
  const href: string = replace.mock.calls.at(-1)![0];
  expect(href.startsWith("/results?")).toBe(true);
  expect(replace.mock.calls.at(-1)![1]).toEqual({ scroll: false });
  return new URLSearchParams(href.split("?")[1]);
};

const group = (name: string) => screen.getByRole("radiogroup", { name });
const radio = (name: string) => screen.getByRole("radio", { name });
const liveRegion = (container: HTMLElement) => container.querySelector('[aria-live="polite"]')!;

describe("FilterBar", () => {
  beforeEach(() => {
    search = "mood=laugh&seed=9&tempo=slowburn";
    mobile = false;
    services = { list: [], saved: false, signedIn: false, save: vi.fn().mockResolvedValue(undefined) };
  });
  afterEach(() => vi.clearAllMocks());

  describe("desktop", () => {
    it("shows three groups checked as the response applied them", () => {
      renderBar({ filters: { time: "long", era: null, where: "mine" } });
      for (const name of ["Time", "Era", "Where"]) expect(group(name)).toBeInTheDocument();
      expect(radio("Long")).toHaveAttribute("aria-checked", "true");
      expect(screen.getAllByRole("radio", { name: "Any" })[1]).toHaveAttribute("aria-checked", "true");
      expect(radio("My services")).toHaveAttribute("aria-checked", "true");
    });

    it("writes a Time over the legacy tempo, keeping the seed", async () => {
      renderBar();
      await userEvent.click(radio("Under 100 min"));
      const url = lastUrl();
      expect(url.get("time")).toBe("short");
      expect(url.get("seed")).toBe("9");
      expect(url.get("mood")).toBe("laugh");
      expect(url.get("src")).toBe("filter");
      expect(url.has("tempo")).toBe(false);
    });

    it("clears the Era with Any", async () => {
      search = "mood=laugh&era=classic&seed=9";
      renderBar({ filters: { era: "classic" } });
      const [, eraAny] = screen.getAllByRole("radio", { name: "Any" });
      await userEvent.click(eraAny);
      const url = lastUrl();
      expect(url.has("era")).toBe(false);
      expect(url.get("seed")).toBe("9");
    });

    it("clears an Era the text set with an explicit any", async () => {
      search = "text=cozy+80s+heist&seed=9";
      renderBar({ filters: { era: "classic" } });
      const [, eraAny] = screen.getAllByRole("radio", { name: "Any" });
      await userEvent.click(eraAny);
      expect(lastUrl().get("era")).toBe("any");
    });

    it("drops the services when Where leaves My services", async () => {
      search = "mood=laugh&where=mine&services=netflix&seed=9";
      services.list = ["netflix"];
      renderBar({ filters: { where: "mine" } });
      await userEvent.click(radio("Norway streaming"));
      const url = lastUrl();
      expect(url.get("where")).toBe("norway");
      expect(url.has("services")).toBe(false);
    });

    it("asks which services before My services when none are known", async () => {
      const user = userEvent.setup();
      renderBar();
      await user.click(radio("My services"));

      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Which services do you have?" })).toBeInTheDocument();
      expect(radio("My services")).toHaveAttribute("aria-controls", "services-picker");

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog", { name: "Which services do you have?" })).toBeNull();
      expect(radio("My services")).toHaveFocus();
      expect(radio("My services")).not.toHaveAttribute("aria-controls");
    });

    it("writes the known services with My services", async () => {
      services.list = ["netflix"];
      renderBar();
      await userEvent.click(radio("My services"));
      const url = lastUrl();
      expect(url.get("where")).toBe("mine");
      expect(url.get("services")).toBe("netflix");
      expect(url.get("seed")).toBe("9");
    });

    it("saves the picked services before writing the URL", async () => {
      const user = userEvent.setup();
      let resolve!: () => void;
      services.save = vi.fn(() => new Promise<void>((r) => (resolve = r)));
      renderBar();
      await user.click(radio("My services"));
      await user.click(screen.getByRole("checkbox", { name: "Netflix" }));
      await user.click(screen.getByRole("checkbox", { name: "Viaplay" }));
      await user.click(screen.getByRole("button", { name: "Show films on 2 services" }));

      expect(services.save).toHaveBeenCalledWith(["netflix", "viaplay"], false);
      expect(replace).not.toHaveBeenCalled();
      resolve();
      await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
      const url = lastUrl();
      expect(url.get("where")).toBe("mine");
      expect(url.get("services")).toBe("netflix,viaplay");
      expect(url.get("src")).toBe("filter");
      expect(screen.queryByRole("dialog", { name: "Which services do you have?" })).toBeNull();
    });

    it("writes nothing when saving fails", async () => {
      const user = userEvent.setup();
      services = { ...services, signedIn: true, save: vi.fn().mockRejectedValue(new Error("500")) };
      renderBar();
      await user.click(radio("My services"));
      await user.click(screen.getByRole("checkbox", { name: "Netflix" }));
      await user.click(screen.getByRole("button", { name: "Show films on 1 service" }));

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(services.save).toHaveBeenCalledWith(["netflix"], true);
      expect(replace).not.toHaveBeenCalled();
    });

    it("shuffles to a new seed and keeps everything else", async () => {
      renderBar();
      await userEvent.click(screen.getByRole("button", { name: "Shuffle" }));
      const url = lastUrl();
      expect(url.get("seed")).not.toBe("9");
      expect(url.get("seed")).toMatch(/^[1-9]\d*$/);
      expect(url.get("src")).toBe("shuffle");
      expect(url.get("mood")).toBe("laugh");
      expect(url.get("tempo")).toBe("slowburn");
    });

    it("counts the films and announces the count only once settled", () => {
      const { container, rerender } = renderBar({ count: 1 });
      expect(screen.getByRole("region", { name: "Filters" })).toHaveTextContent("1 film");
      expect(liveRegion(container)).toHaveTextContent(/^1 film$/);

      rerender({ count: 1, busy: true });
      expect(liveRegion(container)).toBeEmptyDOMElement();

      rerender({ count: 20 });
      expect(screen.getByRole("region", { name: "Filters" })).toHaveTextContent("20 films");
      expect(liveRegion(container)).toHaveTextContent(/^20 films$/);
    });

    it("shows the pick while busy, then what the response applied", async () => {
      const { rerender } = renderBar();
      await userEvent.click(radio("Under 100 min"));
      search = lastUrl().toString();

      rerender({ busy: true });
      expect(radio("Under 100 min")).toHaveAttribute("aria-checked", "true");

      rerender({ busy: false, filters: { time: "short" } });
      expect(radio("Under 100 min")).toHaveAttribute("aria-checked", "true");

      // A later search the bar didn't start (a suggestion) shows the response again.
      search = "mood=laugh&seed=9&src=suggestion";
      rerender({ busy: true, filters: { time: "short" } });
      expect(radio("Under 100 min")).toHaveAttribute("aria-checked", "true");
      rerender({ busy: false });
      expect(screen.getAllByRole("radio", { name: "Any" })[0]).toHaveAttribute("aria-checked", "true");
    });

    it("names the services it searched and edits them", async () => {
      services.list = ["netflix", "viaplay", "disney-plus"];
      renderBar({ filters: { where: "mine" } });
      expect(screen.getByText(/showing films on/i)).toHaveTextContent(
        "Showing films on Netflix, Viaplay and Disney+ in Norway",
      );

      await userEvent.click(screen.getByRole("button", { name: "Edit services" }));
      screen.getByRole("dialog", { name: "Which services do you have?" });
      for (const name of ["Netflix", "Viaplay", "Disney+"]) {
        expect(screen.getByRole("checkbox", { name })).toBeChecked();
      }
      expect(screen.getByRole("checkbox", { name: "HBO Max" })).not.toBeChecked();
    });

    // discoverQuery sends the URL's services over this device's, so the line names what was searched.
    it("names a shared link's services over this device's", async () => {
      search = "mood=laugh&where=mine&services=viaplay&seed=9";
      services.list = ["netflix"];
      renderBar({ filters: { where: "mine" } });
      expect(screen.getByText(/showing films on/i)).toHaveTextContent("Showing films on Viaplay in Norway");

      await userEvent.click(screen.getByRole("button", { name: "Edit services" }));
      expect(screen.getByRole("checkbox", { name: "Viaplay" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Netflix" })).not.toBeChecked();
    });

    // resolveWhere prefers saved services over the param.
    it("names a signed-in user's saved services over the URL's", () => {
      search = "mood=laugh&where=mine&services=viaplay&seed=9";
      services = { ...services, list: ["netflix"], saved: true, signedIn: true };
      renderBar({ filters: { where: "mine" } });
      expect(screen.getByText(/showing films on/i)).toHaveTextContent("Showing films on Netflix in Norway");
    });

    it("returns focus to Edit services when its picker closes", async () => {
      const user = userEvent.setup();
      services.list = ["netflix"];
      renderBar({ filters: { where: "mine" } });
      await user.click(screen.getByRole("button", { name: "Edit services" }));
      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Edit services" })).toHaveFocus();
    });

    it("closes the picker on a click outside", async () => {
      const user = userEvent.setup();
      renderBar();
      await user.click(radio("My services"));
      await user.click(screen.getByRole("button", { name: "Shuffle" }));
      expect(screen.queryByRole("dialog", { name: "Which services do you have?" })).toBeNull();
    });

    it("has no services line outside My services", () => {
      services.list = ["netflix"];
      renderBar({ filters: { where: "norway" } });
      expect(screen.queryByText(/showing films on/i)).toBeNull();
    });
  });

  describe("mobile", () => {
    beforeEach(() => {
      mobile = true;
    });

    it("opens a sheet per filter and applies a pick at once", async () => {
      const user = userEvent.setup();
      renderBar();
      const sheet = screen.getByRole("dialog", { name: "How much time?" });
      expect(sheet).toHaveAttribute("inert");

      await user.click(screen.getByRole("button", { name: "Time Any" }));
      expect(sheet).not.toHaveAttribute("inert");

      await user.click(screen.getByRole("radio", { name: /under 100 min/i }));
      const url = lastUrl();
      expect(url.get("time")).toBe("short");
      expect(url.get("src")).toBe("filter");

      await user.click(screen.getByRole("button", { name: "Show 20 films" }));
      expect(sheet).toHaveAttribute("inert");
    });

    it("says it's still searching while busy", async () => {
      const user = userEvent.setup();
      renderBar({ busy: true });
      await user.click(screen.getByRole("button", { name: "Era Any" }));
      expect(screen.getByRole("dialog", { name: "Which era?" })).not.toHaveAttribute("inert");
      expect(screen.getByRole("button", { name: "Finding films…" })).toBeInTheDocument();
    });

    it("opens the picker from the Where sheet when no services are known", async () => {
      const user = userEvent.setup();
      renderBar();
      await user.click(screen.getByRole("button", { name: "Where Norway streaming" }));
      await user.click(screen.getByRole("radio", { name: "My services" }));

      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole("dialog", { name: "Which services do you have?" })).not.toHaveAttribute("inert");
    });

    it("edits the services from the count line", async () => {
      const user = userEvent.setup();
      services.list = ["netflix", "viaplay"];
      renderBar({ filters: { where: "mine" } });
      const edit = screen.getByRole("button", { name: "Edit services" });
      expect(edit).toHaveStyle({ minHeight: "44px" });

      await user.click(edit);
      expect(screen.getByRole("dialog", { name: "Which services do you have?" })).not.toHaveAttribute("inert");
      expect(screen.getByRole("checkbox", { name: "Netflix" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Viaplay" })).toBeChecked();
    });

    it("opens a fresh picker each time", async () => {
      const user = userEvent.setup();
      services.list = ["netflix", "viaplay"];
      renderBar({ filters: { where: "mine" } });
      await user.click(screen.getByRole("button", { name: "Edit services" }));
      await user.click(screen.getByRole("checkbox", { name: "Viaplay" }));
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await user.click(screen.getByRole("button", { name: "Edit services" }));
      expect(screen.getByRole("checkbox", { name: "Viaplay" })).toBeChecked();
    });

    it("returns focus to what opened the sheet", async () => {
      const user = userEvent.setup();
      services.list = ["netflix"];
      renderBar({ filters: { where: "mine" } });
      const edit = screen.getByRole("button", { name: "Edit services" });
      await user.click(edit);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(edit).toHaveFocus();
    });

    // Outside an aria-modal sheet, a live region may not be read, so the sheet has its own.
    it("announces the count inside the open sheet", async () => {
      const user = userEvent.setup();
      const { container, rerender } = renderBar();
      await user.click(screen.getByRole("button", { name: "Time Any" }));
      const sheet = screen.getByRole("dialog", { name: "How much time?" });
      const inner = sheet.querySelector('[aria-live="polite"]');
      expect(inner).toHaveTextContent(/^20 films$/);
      const outer = [...container.querySelectorAll('[aria-live="polite"]')].find((el) => !sheet.contains(el));
      expect(outer).toBeEmptyDOMElement();

      rerender({ busy: true });
      expect(inner).toBeEmptyDOMElement();
    });

    it("has a 44px Shuffle and names the services in the count line", async () => {
      services.list = ["netflix", "viaplay"];
      renderBar({ filters: { where: "mine" } });
      const shuffle = screen.getByRole("button", { name: "Shuffle results" });
      expect(shuffle).toHaveStyle({ width: "44px", height: "44px" });
      expect(screen.getByText(/films on/)).toHaveTextContent("20 films on Netflix, Viaplay");

      await userEvent.click(shuffle);
      expect(lastUrl().get("src")).toBe("shuffle");
    });
  });
});

/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServicesPicker from "@/components/results/ServicesPicker";
import { PLATFORMS } from "@/lib/platforms";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function renderPicker(props: Partial<Parameters<typeof ServicesPicker>[0]> = {}) {
  const onConfirm = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <ServicesPicker initial={[]} signedIn={false} saved={false} onConfirm={onConfirm} onCancel={onCancel} {...props} />,
  );
  return { onConfirm, onCancel };
}

const submit = () => screen.getByRole("button", { name: /^(show films on|pick at least one)/i });

describe("ServicesPicker", () => {
  it("lists the six services with the known ones checked, focusing the first", () => {
    renderPicker({ initial: ["viaplay"] });
    const group = screen.getByRole("group", { name: "Streaming services" });
    for (const p of PLATFORMS) {
      const box = screen.getByRole("checkbox", { name: p.name });
      expect(group).toContainElement(box);
      expect(box).toHaveProperty("checked", p.slug === "viaplay");
    }
    expect(screen.getByRole("checkbox", { name: "Netflix" })).toHaveFocus();
  });

  it("counts the picked services on the button", async () => {
    const user = userEvent.setup();
    renderPicker();
    expect(submit()).toHaveTextContent("Pick at least one");
    expect(submit()).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Netflix" }));
    expect(submit()).toHaveTextContent("Show films on 1 service");
    expect(submit()).toBeEnabled();

    await user.click(screen.getByRole("checkbox", { name: "Viaplay" }));
    expect(submit()).toHaveTextContent("Show films on 2 services");
  });

  it("tells a guest the services stay on this device", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPicker({ initial: ["netflix"] });
    expect(screen.getByText(/remembered on this device/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign up to keep them everywhere/i })).toHaveAttribute("href", "/signup");
    expect(screen.queryByRole("checkbox", { name: /save to my profile/i })).toBeNull();

    await user.click(submit());
    expect(onConfirm).toHaveBeenCalledWith(["netflix"], false);
  });

  it("passes the services in the platforms' order", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPicker();
    await user.click(screen.getByRole("checkbox", { name: "Prime Video" }));
    await user.click(screen.getByRole("checkbox", { name: "Netflix" }));
    await user.click(submit());
    expect(onConfirm).toHaveBeenCalledWith(["netflix", "prime-video"], false);
  });

  it("saves a signed-in user's first pick to the profile unless unchecked", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPicker({ signedIn: true, initial: ["netflix"] });
    const toProfile = screen.getByRole("checkbox", { name: /save to my profile/i });
    expect(toProfile).toBeChecked();
    expect(screen.queryByText(/remembered on this device/i)).toBeNull();

    await user.click(toProfile);
    await user.click(submit());
    expect(onConfirm).toHaveBeenCalledWith(["netflix"], false);
  });

  // Saved services beat the param, so a device-only edit would change nothing.
  it("always saves to the profile once services are saved", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderPicker({ signedIn: true, saved: true, initial: ["netflix"] });
    expect(screen.queryByRole("checkbox", { name: /save to my profile/i })).toBeNull();
    expect(screen.getByText(/saved to your profile/i)).toBeInTheDocument();

    await user.click(submit());
    expect(onConfirm).toHaveBeenCalledWith(["netflix"], true);
  });

  it("stays open with an alert when saving fails", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderPicker({ signedIn: true, initial: ["netflix"] });
    onConfirm.mockRejectedValue(new Error("500"));

    await user.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save to your profile. Try again.");
    expect(onCancel).not.toHaveBeenCalled();
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it("cancels", async () => {
    const user = userEvent.setup();
    const { onCancel, onConfirm } = renderPicker();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

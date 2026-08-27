/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "@/app/forgot-password/page";

// ── Module mocks ───────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockReset = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockReset(...args),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

const submit = () =>
  fireEvent.submit(
    screen.getByRole("button", { name: /send reset link/i }).closest("form")!,
  );

beforeEach(() => {
  mockReset.mockResolvedValue({ error: null });
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ results: [] }),
  } as unknown as Response);
});

afterEach(() => vi.clearAllMocks());

describe("ForgotPasswordPage", () => {
  it("renders the email field and submit button", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send reset link/i }),
    ).toBeInTheDocument();
  });

  it("shows a validation error for a bad email format", async () => {
    render(<ForgotPasswordPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), "not-an-email");
    submit();
    await waitFor(() => {
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
    });
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("sends the reset email with a redirect back to /reset-password", async () => {
    render(<ForgotPasswordPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), "alice@test.com");
    submit();
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith("alice@test.com", {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    });
  });

  it("confirms without revealing whether the account exists", async () => {
    render(<ForgotPasswordPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), "ghost@test.com");
    submit();
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /if an account exists for/i,
      );
    });
  });

  it("surfaces a mapped message when the send is rate limited", async () => {
    mockReset.mockResolvedValue({
      error: { code: "over_email_send_rate_limit", message: "raw gotrue text" },
    });
    render(<ForgotPasswordPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email address/i), "alice@test.com");
    submit();
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/too many emails/i);
    });
  });
});

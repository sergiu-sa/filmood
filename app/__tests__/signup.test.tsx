/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "@/app/signup/page";
import { PASSWORD_HINT } from "@/lib/validations";

// ── Module mocks ───────────────────────────────────────────────────────────
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/signup",
  useSearchParams: () => new URLSearchParams(),
}));

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

// Auth: not logged in by default
vi.mock("@/components/AuthProvider", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    loading: false,
    session: null,
    signOut: vi.fn(),
  })),
}));

// Supabase mock
const mockSignUp = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────
async function fillSignupForm({
  name = "Alice Smith",
  email = "alice@example.com",
  password = "secret123",
  confirm = "secret123",
}: {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
} = {}) {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Your name"), name);
  await user.type(screen.getByPlaceholderText("you@example.com"), email);
  await user.type(screen.getByLabelText(/^password$/i), password);
  await user.type(screen.getByLabelText(/^confirm password$/i), confirm);
}

function submitForm() {
  fireEvent.submit(
    screen.getByRole("button", { name: /^sign up$/i }).closest("form")!,
  );
}

beforeEach(() => {
  // No session in the response = email confirmation is on → "check your email" path.
  // Tests that need the auto-signed-in path override this per-case.
  mockSignUp.mockResolvedValue({
    data: { user: { id: "new-user" }, session: null },
    error: null,
  });
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => ({ films: [] }),
  } as unknown as Response);
});

afterEach(() => vi.clearAllMocks());

describe("SignupPage", () => {
  // ── Rendering ─────────────────────────────────────────────────────────
  it("renders name, email, password, and confirm password fields", () => {
    render(<SignupPage />);
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/re-enter/i)).toBeInTheDocument();
  });

  // The rule stays on screen while typing, which a placeholder doesn't, and is read with the field.
  it("shows the password rule under the field", () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/^password$/i)).toHaveAccessibleDescription(PASSWORD_HINT);
  });

  // ── Validation errors ─────────────────────────────────────────────────
  it("shows name error when name is too short (< 3 chars)", async () => {
    render(<SignupPage />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Your name"), "Al");
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });

  it("shows email required error on empty email", async () => {
    render(<SignupPage />);
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it("replaces the rule with what a password without a number is missing", async () => {
    render(<SignupPage />);
    await fillSignupForm({ password: "abcdefgh", confirm: "abcdefgh" });
    submitForm();
    await waitFor(() => {
      expect(screen.getByText("Add a number.")).toHaveStyle({ color: "var(--rose)" });
    });
    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAccessibleDescription("Add a number.");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("shows 'Passwords do not match' when confirm password differs", async () => {
    render(<SignupPage />);
    await fillSignupForm({ confirm: "different" });
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  // ── Supabase interaction ──────────────────────────────────────────────
  it("calls supabase.auth.signUp with correct data on valid form", async () => {
    render(<SignupPage />);
    await fillSignupForm();
    submitForm();
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "secret123",
        options: { data: { name: "Alice Smith" } },
      });
    });
  });

  it("shows the success message after signup", async () => {
    render(<SignupPage />);
    await fillSignupForm();
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/account created/i)).toBeInTheDocument();
    });
  });

  it("skips the confirm message and enters the app when a session is returned", async () => {
    // Email confirmation off → signUp returns a session (user already signed in)
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: "new-user" }, session: { access_token: "t" } },
      error: null,
    });
    render(<SignupPage />);
    await fillSignupForm();
    submitForm();
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByText(/account created/i)).not.toBeInTheDocument();
  });

  it("shows Supabase error when signUp fails", async () => {
    mockSignUp.mockResolvedValueOnce({
      error: { message: "Email already registered" },
    });
    render(<SignupPage />);
    await fillSignupForm();
    submitForm();
    await waitFor(() => {
      expect(screen.getByText("Email already registered")).toBeInTheDocument();
    });
  });

  // ── Loading and disabled states ───────────────────────────────────────
  it("submit button is disabled and shows loading text while in-flight", async () => {
    mockSignUp.mockImplementationOnce(() => new Promise(() => {})); // never resolves
    render(<SignupPage />);
    await fillSignupForm();
    submitForm();
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /creating account/i });
      expect(btn).toBeDisabled();
    });
  });

  it("submit button is disabled after successful signup (prevents double-submit)", async () => {
    render(<SignupPage />);
    await fillSignupForm();
    submitForm();
    // After success, `success` state is true → button gets disabled
    await waitFor(() => {
      expect(screen.getByText(/account created/i)).toBeInTheDocument();
    });
    // The button now has disabled={loading || success} = disabled={false || true}
    const btn = screen.getByRole("button", { name: /sign up/i });
    expect(btn).toBeDisabled();
  });
});

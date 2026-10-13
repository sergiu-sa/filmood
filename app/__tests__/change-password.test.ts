import { NextRequest } from "next/server";
import { mockRequest, mockUser, readResponse } from "@/lib/__tests__/helpers/supabase-mock";

const mockUpdateUserById = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  getAuthUser: async () => mockUser,
  getSupabaseAdmin: () => ({ auth: { admin: { updateUserById: mockUpdateUserById } } }),
}));

// The current-password check signs in with a throwaway client: here it always succeeds.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithPassword: async () => ({ error: null }), signOut: async () => ({}) } }),
}));

import { POST } from "@/app/api/account/change-password/route";

const change = (newPassword: string) =>
  POST(mockRequest("POST", "/api/account/change-password", { currentPassword: "old-password1", newPassword }));

describe("POST /api/account/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["abcdefgh", "Add a number."],
    ["12345678", "Add a letter."],
    ["abcd123", "Use at least 8 characters."],
  ])("refuses %s before asking Supabase: %s", async (password, message) => {
    const { status, json } = await readResponse(await change(password));
    expect(status).toBe(400);
    expect(json.error).toBe(message);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("answers a body of null with a 400", async () => {
    const res = await POST(new NextRequest("http://localhost/api/account/change-password", { method: "POST", body: "null" }));
    expect(res.status).toBe(400);
  });

  // Supabase's own rule may be stricter than ours (symbols, leaked passwords): that's the user's input, not a 500.
  it("answers Supabase's weak_password with a 400 the form can show", async () => {
    mockUpdateUserById.mockResolvedValue({ error: { code: "weak_password", status: 422, message: "raw" } });
    const { status, json } = await readResponse(await change("abcd1234"));
    expect(status).toBe(400);
    expect(json.error).toBe("That password is too weak. Use a longer one with a mix of letters and numbers.");
  });

  it("updates a password that meets the rule", async () => {
    mockUpdateUserById.mockResolvedValue({ error: null });
    const { status } = await readResponse(await change("abcd1234"));
    expect(status).toBe(200);
    expect(mockUpdateUserById).toHaveBeenCalledWith(mockUser.id, { password: "abcd1234" });
  });
});

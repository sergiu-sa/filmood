/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  readDeviceServices,
  SERVICES_STORAGE_KEY,
  useServices,
  writeDeviceServices,
} from "@/lib/useServices";

let mockUser: { id: string } | null = null;

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/lib/getAuthToken", () => ({
  getAuthHeaders: async () => ({ "Content-Type": "application/json", Authorization: "Bearer token" }),
}));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("device services", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips through localStorage", () => {
    expect(writeDeviceServices(["netflix", "viaplay"])).toBe(true);
    expect(localStorage.getItem(SERVICES_STORAGE_KEY)).toBe("netflix,viaplay");
    expect(readDeviceServices()).toEqual(["netflix", "viaplay"]);
  });

  // Whatever is stored reaches a URL, so it passes the allow-list first.
  it("drops anything that isn't a known service", () => {
    localStorage.setItem(SERVICES_STORAGE_KEY, "netflix,hulu,__proto__");
    expect(readDeviceServices()).toEqual(["netflix"]);
  });

  it("reads nothing when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(readDeviceServices()).toEqual([]);
  });

  it("reports a blocked write instead of throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(writeDeviceServices(["netflix"])).toBe(false);
  });
});

describe("useServices", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    mockUser = null;
    localStorage.clear();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("gives a guest this device's services without a request", () => {
    localStorage.setItem(SERVICES_STORAGE_KEY, "viaplay");
    const { result } = renderHook(() => useServices());

    expect(result.current).toMatchObject({ list: ["viaplay"], saved: false, signedIn: false, loading: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // resolveWhere prefers saved services, so the bar must show those.
  it("prefers a signed-in user's saved services over the device's", async () => {
    mockUser = { id: "user-1" };
    localStorage.setItem(SERVICES_STORAGE_KEY, "viaplay");
    fetchMock.mockResolvedValue(json({ platforms: ["Netflix"] }));
    const { result } = renderHook(() => useServices());

    await waitFor(() => expect(result.current.saved).toBe(true));
    expect(result.current).toMatchObject({ list: ["netflix"], signedIn: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
  });

  it("treats a failed read as nothing saved", async () => {
    mockUser = { id: "user-1" };
    localStorage.setItem(SERVICES_STORAGE_KEY, "viaplay");
    fetchMock.mockResolvedValue(json({ error: "Failed to load preferences" }, 500));
    const { result } = renderHook(() => useServices());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ list: ["viaplay"], saved: false });
  });

  // Until the read answers, an unsaved-looking user may have saved services.
  it("is loading while a signed-in user's read is pending", async () => {
    mockUser = { id: "user-1" };
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));
    const { result } = renderHook(() => useServices());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(result.current).toMatchObject({ saved: false, signedIn: true, loading: true });
  });

  it("keeps a save's list when an older read answers after it", async () => {
    mockUser = { id: "user-1" };
    let answer!: (res: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (answer = r)));
    const { result } = renderHook(() => useServices());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockResolvedValueOnce(json({ platforms: ["Netflix"] }));
    await act(() => result.current.save(["netflix"], true));
    expect(result.current).toMatchObject({ list: ["netflix"], saved: true, loading: false });

    const late = json({ platforms: ["Viaplay"] });
    const read = vi.spyOn(late, "json");
    answer(late);
    await waitFor(() => expect(read).toHaveBeenCalled());
    // The hook awaits this same promise first, so its check has run once this resolves.
    await act(() => read.mock.results[0].value);
    expect(result.current.list).toEqual(["netflix"]);
  });

  it("lets a pending read answer when the save fails", async () => {
    mockUser = { id: "user-1" };
    let answer!: (res: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (answer = r)));
    const { result } = renderHook(() => useServices());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockResolvedValueOnce(json({ error: "Failed to save preferences" }, 500));
    await act(() => expect(result.current.save(["netflix"], true)).rejects.toThrow());

    answer(json({ platforms: ["Viaplay"] }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ list: ["viaplay"], saved: true });
  });

  it("saves to the profile as display names", async () => {
    mockUser = { id: "user-1" };
    fetchMock.mockResolvedValueOnce(json({ platforms: [] }));
    const { result } = renderHook(() => useServices());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockResolvedValueOnce(json({ platforms: ["Viaplay"] }));
    await act(() => result.current.save(["viaplay"], true));

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/streaming-preferences");
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(init.body)).toEqual({ platforms: ["Viaplay"] });
    expect(result.current).toMatchObject({ list: ["viaplay"], saved: true });
    expect(localStorage.getItem(SERVICES_STORAGE_KEY)).toBeNull();
  });

  it("rejects when the profile save fails", async () => {
    mockUser = { id: "user-1" };
    fetchMock.mockResolvedValueOnce(json({ platforms: [] }));
    const { result } = renderHook(() => useServices());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockResolvedValueOnce(json({ error: "Failed to save preferences" }, 500));
    await expect(result.current.save(["viaplay"], true)).rejects.toThrow();
    expect(result.current.saved).toBe(false);
  });

  it("saves to this device only, with no request", async () => {
    const { result } = renderHook(() => useServices());
    await act(() => result.current.save(["netflix", "viaplay"], false));

    expect(localStorage.getItem(SERVICES_STORAGE_KEY)).toBe("netflix,viaplay");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

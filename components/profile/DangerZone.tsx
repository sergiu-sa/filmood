"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { getAuthHeaders } from "@/lib/getAuthToken";
import Icon from "@/components/ui/Icon";

type Busy = "logout-all" | "delete" | null;

export default function DangerZone() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Busy>(null);

  async function handleLogOutAll() {
    setError(null);
    setBusy("logout-all");
    try {
      const res = await fetch("/api/account/logout-all", {
        method: "POST",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error("logout-all failed");
      // Sign out of the current device too — the server has already
      // revoked refresh tokens, but local cleanup is still needed.
      await signOut();
      router.push("/");
    } catch {
      setError("Couldn't sign out other devices. Try again.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  async function handleDeleteAccount() {
    setError(null);
    setBusy("delete");
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error("delete failed");
      await signOut();
      router.push("/");
    } catch {
      setError("Couldn't delete account. Contact support if it persists.");
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  const actions: Array<{
    key: Exclude<Busy, null>;
    icon: "logout" | "trash";
    title: string;
    sub: string;
    label: string;
    danger: boolean;
    confirmLabel: string;
    confirmSub: string;
    run: () => void;
  }> = [
    {
      key: "logout-all",
      icon: "logout",
      title: "Log out of all devices",
      sub: "Revokes refresh tokens on every signed-in device.",
      label: "Log out all",
      danger: false,
      confirmLabel: "Confirm sign-out",
      confirmSub:
        "You'll be returned to the sign-in screen. Active access tokens expire within an hour.",
      run: handleLogOutAll,
    },
    {
      key: "delete",
      icon: "trash",
      title: "Delete account",
      sub: "Removes your account, watchlist, mood history, preferences, and viewing log. Group sessions you joined remain visible to other participants but no longer linked to you.",
      label: "Delete",
      danger: true,
      confirmLabel: "Yes, delete my account",
      confirmSub: "This is permanent and cannot be undone.",
      run: handleDeleteAccount,
    },
  ];

  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--rose-border)",
      }}
    >
      <div
        className="mb-3.5 text-xs font-semibold uppercase tracking-[1px]"
        style={{ color: "var(--rose)" }}
      >
        Danger zone
      </div>

      {actions.map((row, i) => {
        const isConfirming = confirming === row.key;
        const isBusy = busy === row.key;
        return (
          <div
            key={row.title}
            className={`py-3 ${i < actions.length - 1 ? "border-b" : ""}`}
            style={{ borderColor: "var(--rose-border)" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span
                  className="shrink-0 mt-0.5"
                  style={{ color: row.danger ? "var(--rose)" : "var(--t2)" }}
                >
                  <Icon name={row.icon} size={14} />
                </span>
                <div className="min-w-0">
                  <p
                    className="mb-0.5"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--t1)",
                    }}
                  >
                    {row.title}
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--t3)",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {row.sub}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setConfirming(row.key)}
                disabled={isBusy || isConfirming}
                className="shrink-0 cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all disabled:opacity-60"
                style={
                  row.danger
                    ? {
                        background: "transparent",
                        color: "var(--rose)",
                        border: "1px solid var(--rose-border)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--t2)",
                        border: "1px solid var(--border)",
                      }
                }
              >
                {row.label}
              </button>
            </div>

            {isConfirming && (
              <div
                className="mt-3 rounded-lg p-3"
                style={{
                  background: row.danger
                    ? "var(--rose-soft)"
                    : "var(--gold-soft)",
                  border: `1px solid ${
                    row.danger ? "var(--rose-border)" : "var(--gold-border)"
                  }`,
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--t1)",
                    margin: "0 0 8px",
                    lineHeight: 1.5,
                  }}
                >
                  {row.confirmSub}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={row.run}
                    disabled={isBusy}
                    className="cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60"
                    style={
                      row.danger
                        ? {
                            background: "var(--rose)",
                            color: "var(--accent-paper)",
                            border: 0,
                          }
                        : {
                            background: "var(--gold)",
                            color: "var(--accent-ink)",
                            border: 0,
                          }
                    }
                  >
                    {isBusy ? "Working…" : row.confirmLabel}
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    disabled={isBusy}
                    className="cursor-pointer rounded-md border bg-transparent px-3 py-1.5 text-[11px] font-medium text-(--t2)"
                    style={{ borderColor: "var(--border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {error && (
        <p
          style={{
            marginTop: "10px",
            fontSize: "11px",
            color: "var(--rose)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getAuthHeaders } from "@/lib/getAuthToken";
import Icon from "@/components/ui/Icon";

interface Props {
  user: User;
}

type Toast = { tone: "saved" | "error"; message: string } | null;

export default function AccountSettings({ user }: Props) {
  const [name, setName] = useState(user.user_metadata?.full_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");

  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Change-password flow state
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  function flashToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast(null), 2400);
  }

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      ...(name !== user.user_metadata?.full_name
        ? { data: { full_name: name } }
        : {}),
      ...(email !== user.email ? { email } : {}),
    });
    setSaving(false);
    setEditingName(false);
    setEditingEmail(false);
    flashToast(
      error
        ? { tone: "error", message: "Couldn't save changes" }
        : { tone: "saved", message: "Changes saved" },
    );
  }

  async function submitPasswordChange() {
    setPwError(null);
    if (newPassword.length < 8) {
      setPwError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords don't match.");
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to update password");
      }
      setNewPassword("");
      setConfirmPassword("");
      setChangingPassword(false);
      flashToast({ tone: "saved", message: "Password updated" });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <>
      <div
        className="mb-4 rounded-2xl border p-5.5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 text-[10px] font-semibold uppercase tracking-[1.8px] text-(--t3)">
          Account
        </div>

        <span className="mb-2.5 block text-[11px] font-medium uppercase tracking-[1px] text-(--t3)">
          Personal
        </span>

        <Field
          icon="user"
          label="Full name"
          editing={editingName}
          value={name}
          onChange={setName}
          onToggle={() => setEditingName((e) => !e)}
        />

        <Field
          icon="mail"
          label="Email address"
          editing={editingEmail}
          value={email}
          onChange={setEmail}
          onToggle={() => setEditingEmail((e) => !e)}
        />

        <span className="mt-4 mb-2.5 block text-[11px] font-medium uppercase tracking-[1px] text-(--t3)">
          Security
        </span>

        {changingPassword ? (
          <div
            className="flex flex-col gap-2 rounded-[11px] border p-3.5"
            style={{
              background: "var(--surface2)",
              borderColor: "var(--gold-border)",
              boxShadow: "0 0 0 3px var(--gold-soft)",
            }}
          >
            <label
              htmlFor="profile-newpw"
              className="text-[10px] text-(--t3)"
            >
              New password
            </label>
            <input
              id="profile-newpw"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-transparent text-[13px] font-medium text-(--t1) outline-none"
              placeholder="At least 8 characters"
            />
            <label
              htmlFor="profile-confirmpw"
              className="mt-1 text-[10px] text-(--t3)"
            >
              Confirm
            </label>
            <input
              id="profile-confirmpw"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-transparent text-[13px] font-medium text-(--t1) outline-none"
              placeholder="Repeat the new password"
            />
            {pwError && (
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--rose)",
                  margin: "4px 0 0",
                }}
              >
                {pwError}
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={submitPasswordChange}
                disabled={pwSaving}
                className="cursor-pointer rounded-[8px] border-none px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
                style={{
                  background: "var(--gold)",
                  color: "var(--accent-ink)",
                }}
              >
                {pwSaving ? "Saving…" : "Update password"}
              </button>
              <button
                onClick={() => {
                  setChangingPassword(false);
                  setNewPassword("");
                  setConfirmPassword("");
                  setPwError(null);
                }}
                disabled={pwSaving}
                className="cursor-pointer rounded-[8px] border bg-transparent px-3 py-1.5 text-[12px] font-medium text-(--t2)"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-2.5 rounded-[11px] border bg-(--surface2) px-3.5 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <span style={{ color: "var(--t3)" }} className="shrink-0">
              <Icon name="lock" size={14} />
            </span>
            <div className="flex-1">
              <div className="mb-0.5 text-[10px] text-(--t3)">Password</div>
              <div
                className="text-[13px] font-medium text-(--t1)"
                style={{ letterSpacing: "2px" }}
              >
                ••••••••
              </div>
            </div>
            <button
              onClick={() => setChangingPassword(true)}
              className="shrink-0 cursor-pointer border-none bg-transparent text-[11px] font-medium text-(--t3) transition-colors hover:text-(--t1)"
            >
              Change
            </button>
          </div>
        )}

        <button
          onClick={saveProfile}
          disabled={saving}
          className="mt-5 flex w-full cursor-pointer items-center justify-center rounded-[10px] border-none bg-(--gold) px-5 py-2.5 text-[13px] font-semibold text-(--accent-ink) transition-all hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {toast && (
        <div
          className="fixed bottom-7 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-xl border px-5 py-3 text-[13px] font-medium"
          style={{
            background: "var(--surface)",
            borderColor:
              toast.tone === "saved" ? "var(--teal)" : "var(--rose)",
            color: "var(--t1)",
            boxShadow: "0 8px 32px var(--overlay-heavy)",
          }}
        >
          <span
            style={{
              color: toast.tone === "saved" ? "var(--teal)" : "var(--rose)",
            }}
          >
            <Icon
              name={toast.tone === "saved" ? "check" : "close"}
              size={14}
            />
          </span>
          {toast.message}
        </div>
      )}
    </>
  );
}

function Field({
  icon,
  label,
  editing,
  value,
  onChange,
  onToggle,
}: {
  icon: "user" | "mail";
  label: string;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  onToggle: () => void;
}) {
  return (
    <div
      className="mb-2 flex items-center gap-2.5 rounded-[11px] border bg-(--surface2) px-3.5 py-3 transition-all"
      style={{
        borderColor: editing ? "var(--gold)" : "var(--border)",
        boxShadow: editing ? "0 0 0 3px var(--gold-soft)" : undefined,
      }}
    >
      <span style={{ color: "var(--t3)" }} className="shrink-0">
        <Icon name={icon} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <label
          htmlFor={`profile-${icon}`}
          className="mb-0.5 block text-[10px] text-(--t3)"
        >
          {label}
        </label>
        <input
          id={`profile-${icon}`}
          value={value}
          readOnly={!editing}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[13px] font-medium text-(--t1) outline-none"
        />
      </div>
      <button
        onClick={onToggle}
        aria-label={editing ? `Save ${label}` : `Edit ${label}`}
        className="shrink-0 cursor-pointer border-none bg-transparent text-[11px] font-medium text-(--t3) transition-colors hover:text-(--t1)"
      >
        {editing ? "Done" : "Edit"}
      </button>
    </div>
  );
}

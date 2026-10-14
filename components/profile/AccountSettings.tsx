"use client";

import { useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { savedName } from "@/lib/displayName";
import Icon from "@/components/ui/Icon";
import { passwordProblem, PASSWORD_HINT } from "@/lib/validations";

interface Props {
  user: User;
}

type Toast = { tone: "saved" | "error"; message: string } | null;

export default function AccountSettings({ user }: Props) {
  const [name, setName] = useState(savedName(user));
  const [email, setEmail] = useState(user.email ?? "");

  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Change-password flow state
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  function flashToast(t: Toast) {
    // An earlier toast's timer would hide this one early, and the same text left in
    // place changes nothing a screen reader would announce, so it goes for a frame first.
    clearTimeout(toastTimer.current);
    setToast(null);
    requestAnimationFrame(() => setToast(t));
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      ...(name !== savedName(user) ? { data: { full_name: name } } : {}),
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
    // The same text set again changes nothing a screen reader would announce, so it goes for a frame first.
    const refuse = (problem: string) => requestAnimationFrame(() => setPwError(problem));
    if (currentPassword.length === 0) {
      refuse("Enter your current password.");
      return;
    }
    const problem = passwordProblem(newPassword);
    if (problem) {
      refuse(problem);
      return;
    }
    if (newPassword !== confirmPassword) {
      refuse("Passwords don't match.");
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to update password");
      }
      setCurrentPassword("");
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
              htmlFor="profile-currentpw"
              className="text-[10px] text-(--t3)"
            >
              Current password
            </label>
            <input
              id="profile-currentpw"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-transparent text-[13px] font-medium text-(--t1) outline-none"
              placeholder="Your current password"
            />
            <label
              htmlFor="profile-newpw"
              className="mt-1 text-[10px] text-(--t3)"
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
              aria-describedby="profile-newpw-hint"
            />
            <p id="profile-newpw-hint" className="m-0 text-[10px] text-(--t3)">
              {PASSWORD_HINT}
            </p>
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
            {/* Rose text is under 4.5:1 on --surface2, so the rose border marks the error. */}
            {pwError && (
              <p
                role="alert"
                style={{
                  fontSize: "11px",
                  color: "var(--t1)",
                  margin: "4px 0 0",
                  borderLeft: "2px solid var(--rose)",
                  paddingLeft: "8px",
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
                  color: "var(--gold-on)",
                }}
              >
                {pwSaving ? "Saving…" : "Update password"}
              </button>
              <button
                onClick={() => {
                  setChangingPassword(false);
                  setCurrentPassword("");
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
          className="mt-5 flex w-full cursor-pointer items-center justify-center rounded-[10px] border-none bg-(--gold) px-5 py-2.5 text-[13px] font-semibold text-(--gold-on) transition-all hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {/* Mounted before the toast, which a screen reader doesn't reliably hear when it arrives with its text. */}
      <div role="status">
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
      </div>
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

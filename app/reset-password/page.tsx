"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from "@/lib/validations";
import { authErrorMessage } from "@/lib/auth-errors";
import AuthCinemaPanel from "@/components/auth/AuthCinemaPanel";
import { authInputClass } from "@/components/auth/authInputClass";
import Icon from "@/components/ui/Icon";

export default function ResetPasswordPage() {
  const { session } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // The Supabase client consumes the recovery tokens out of the URL hash on load (detectSessionInUrl).
    // A rejected link is the one case where it leaves something behind for us; 
    //  an expired link has no tokens to trade.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const description = hash.get("error_description");
    // Reading location.hash during render would render nothing on the server and the error on the client; a hydration mismatch.
    // An effect is the only place this can be read, so the setState here is deliberate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (description) setLinkError(description);
  }, []);

  // Grace window so a slow PASSWORD_RECOVERY handshake (or AuthProvider's 5s safety-net flipping loading→false before the session lands) doesn't flash the "invalid link" message at someone who clicked a perfectly good link.
  // An explicit error_description in the URL still rejects immediately.
  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGraceElapsed(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const result = resetPasswordSchema.safeParse(formData);
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: result.data.password,
    });
    setLoading(false);

    if (error) {
      setGeneralError(authErrorMessage(error));
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/"), 2000);
  };


  const checkingLink = !linkError && !session && !graceElapsed;
  const linkRejected = !!linkError || (!session && graceElapsed);

  return (
    <main
      className="flex min-h-screen"
      style={{ background: "var(--bg)", color: "var(--t1)" }}
    >
      <AuthCinemaPanel />

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-12 lg:px-12">
        <div className="w-full max-w-100">
          <div className="mb-7">
            <h1
              className="font-serif mb-2 text-[28px] font-semibold leading-[1.2]"
              style={{ color: "var(--t1)" }}
            >
              Choose a new password
            </h1>
            <p className="text-sm" style={{ color: "var(--t2)" }}>
              You&rsquo;ll be signed in as soon as it&rsquo;s saved.
            </p>
          </div>

          <div role="alert" aria-live="assertive">
            {generalError && (
              <div
                className="mb-5 rounded-xl border px-4 py-3 text-sm"
                style={{
                  background: "var(--rose-soft)",
                  borderColor: "rgba(var(--rose-rgb), 0.2)",
                  color: "var(--rose)",
                }}
              >
                {generalError}
              </div>
            )}
          </div>

          {success && (
            <div
              className="mb-5 rounded-xl border px-4 py-3 text-sm text-center"
              style={{
                background: "var(--teal-soft)",
                borderColor: "rgba(var(--teal-rgb), 0.2)",
                color: "var(--teal)",
              }}
              role="status"
            >
              Password updated — taking you in…
            </div>
          )}

          {checkingLink && (
            <p className="text-sm" style={{ color: "var(--t2)" }}>
              Checking your link…
            </p>
          )}

          {linkRejected && (
            <div
              className="rounded-xl border px-4 py-4 text-sm leading-relaxed"
              style={{
                background: "var(--rose-soft)",
                borderColor: "rgba(var(--rose-rgb), 0.2)",
                color: "var(--rose)",
              }}
            >
              {linkError ??
                "This reset link is invalid or has already been used."}{" "}
              <Link
                href="/forgot-password"
                className="font-medium underline"
                style={{ color: "var(--rose)" }}
              >
                Request a new one
              </Link>
              .
            </div>
          )}

          {session && !linkError && !success && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reset-password"
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--t2)" }}
                >
                  New password
                </label>
                <div className="relative">
                  <input
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="At least 8 characters"
                    className={authInputClass(!!fieldErrors.password)}
                    style={{ background: "var(--surface)", color: "var(--t1)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-sm"
                    style={{ color: "var(--t3)" }}
                  >
                    <Icon name={showPassword ? "eye-off" : "eye"} size={16} />
                  </button>
                </div>
                {fieldErrors.password && (
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--rose)" }}
                  >
                    {fieldErrors.password[0]}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="reset-confirm"
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--t2)" }}
                >
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="reset-confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Type it again"
                    className={authInputClass(!!fieldErrors.confirmPassword)}
                    style={{ background: "var(--surface)", color: "var(--t1)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-sm"
                    style={{ color: "var(--t3)" }}
                  >
                    <Icon name={showConfirm ? "eye-off" : "eye"} size={16} />
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--rose)" }}
                  >
                    {fieldErrors.confirmPassword[0]}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer rounded-xl border-none py-3.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "var(--gold)",
                  color: "var(--accent-ink)",
                }}
              >
                {loading ? "Saving..." : "Save new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

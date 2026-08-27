"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { authErrorMessage } from "@/lib/auth-errors";
import AuthCinemaPanel from "@/components/auth/AuthCinemaPanel";
import { authInputClass } from "@/components/auth/authInputClass";
import Icon from "@/components/ui/Icon";

export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) router.push("/");
  }, [user, authLoading, router]);

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string[]>>
  >({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setGeneralError(null);

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    });
    setLoading(false);

    if (error) {
      setGeneralError(authErrorMessage(error));
      return;
    }

    router.push("/");
  };


  return (
    <main
      className="flex min-h-screen"
      style={{ background: "var(--bg)", color: "var(--t1)" }}
    >
      <AuthCinemaPanel />

      {/* ── Right: form panel — same structure as signup ── */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-12 lg:px-12">
        <div className="w-full max-w-100">
          {/* Header */}
          <div className="mb-7">
            <h1
              className="font-serif mb-2 text-[28px] font-semibold leading-[1.2]"
              style={{ color: "var(--t1)" }}
            >
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: "var(--t2)" }}>
              New to Filmood?{" "}
              <Link
                href="/signup"
                className="font-medium no-underline hover:underline"
                style={{ color: "var(--gold)" }}
              >
                Create an account
              </Link>
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="h-px flex-1"
              style={{ background: "var(--border-h)" }}
            />
            <span
              className="text-[11px] font-medium tracking-[1px] uppercase"
              style={{ color: "var(--t3)" }}
            >
              or continue with email
            </span>
            <div
              className="h-px flex-1"
              style={{ background: "var(--border-h)" }}
            />
          </div>

          {/* General error */}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--t2)" }}
              >
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="you@example.com"
                className={authInputClass(!!fieldErrors.email)}
                style={{ background: "var(--surface)", color: "var(--t1)" }}
              />
              {fieldErrors.email && (
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: "var(--rose)" }}
                >
                  {fieldErrors.email[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--t2)" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter your password"
                  className={authInputClass(!!fieldErrors.password)}
                  style={{ background: "var(--surface)", color: "var(--t1)" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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

            {/* Remember me + forgot password */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded cursor-pointer"
                  style={{ accentColor: "var(--gold)" }}
                />
                <span className="text-xs" style={{ color: "var(--t2)" }}>
                  Remember me
                </span>
              </label>
              <Link
                href="/forgot-password"
                className="text-xs no-underline hover:underline"
                style={{ color: "var(--t2)" }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer rounded-xl border-none py-3.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "var(--gold)", color: "var(--accent-ink)" }}
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p
            className="mt-4 text-center text-xs"
            style={{ color: "var(--t3)" }}
          >
            By logging in you agree to our{" "}
            <a
              href="#"
              className="hover:underline"
              style={{ color: "var(--gold)" }}
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="hover:underline"
              style={{ color: "var(--gold)" }}
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

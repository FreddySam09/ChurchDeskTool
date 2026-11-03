
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Church,
  LockKeyhole,
  Mail,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();

  const {
    user,
    loading: authLoading,
    signIn,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forgotMode, setForgotMode] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.message || "Unable to sign in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!email.trim()) {
      setError("Enter your registered email address.");
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim(),
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        );

      if (resetError) throw resetError;

      setNotice(
        "If an account exists for this email address, a password reset link will be sent.",
      );
    } catch (err) {
      setError(
        err.message || "Unable to send the reset email.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">
        <p className="text-sm text-gray-500">
          Checking your session...
        </p>
      </main>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-18 w-18 items-center justify-center rounded-[42px] bg-[#1e1e1e] text-white shadow-lg">
            <img
              src="/favicon.svg"
              alt="Church Desk logo"
              className="h-14 object-contain"
            />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-[#1e1e1e]">
            Church Desk
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            ECI St. Stephen's Church
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm sm:p-8">
          <div className="mb-6">
            {forgotMode ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setError("");
                    setNotice("");
                  }}
                  className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-900"
                >
                  <ArrowLeft size={14} />
                  Back to sign in
                </button>

                <h2 className="text-xl font-semibold text-gray-900">
                  Forgot your password?
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter your registered email address and we'll
                  send you a password reset link.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900">
                  Welcome back
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Sign in to access your church workspace.
                </p>
              </>
            )}
          </div>

          <form
            onSubmit={
              forgotMode
                ? handleForgotPassword
                : handleSubmit
            }
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Email address
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-gray-800 focus:ring-2 focus:ring-gray-200"
                />
              </div>
            </div>

            {!forgotMode && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 text-sm outline-none transition focus:border-gray-800 focus:ring-2 focus:ring-gray-200"
                  />
                </div>

                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setError("");
                      setNotice("");
                    }}
                    className="text-xs font-semibold text-[#3457d5] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {notice && (
              <p
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#1e1e1e] px-4 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Please wait..."
                : forgotMode
                  ? "Send reset link"
                  : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Authorised church personnel only
        </p>
      </section>
    </main>
  );
}

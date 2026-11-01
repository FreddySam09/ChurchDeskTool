
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, Church, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setValidSession(Boolean(session));
      setChecking(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY") {
        setValidSession(Boolean(session));
        setChecking(false);
      }
    });

    checkRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) throw updateError;

      setSuccess(true);

      // End the recovery session after changing the password.
      await supabase.auth.signOut();
    } catch (err) {
      setError(
        err.message || "Unable to update your password.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">
        <p className="text-sm text-gray-500">
          Verifying password reset link...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] px-4 py-10">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e1e1e] text-white">
            <Church size={27} />
          </div>

          <h1 className="text-2xl font-semibold text-[#1e1e1e]">
            Church Desk
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            ECI St. Stephen's Church
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm sm:p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle2
                size={38}
                className="mx-auto mb-4 text-emerald-600"
              />

              <h2 className="text-xl font-semibold text-gray-900">
                Password updated
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Your password has been changed successfully.
                You can now sign in using your new password.
              </p>

              <Link
                to="/login"
                className="mt-6 inline-flex w-full justify-center rounded-lg bg-[#1e1e1e] px-4 py-3 text-sm font-medium text-white hover:bg-black"
              >
                Return to sign in
              </Link>
            </div>
          ) : !validSession ? (
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900">
                Reset link unavailable
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                This password reset link is invalid or expired.
                Request a new one from the sign-in page.
              </p>

              <Link
                to="/login"
                className="mt-6 inline-flex w-full justify-center rounded-lg bg-[#1e1e1e] px-4 py-3 text-sm font-medium text-white"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Set a new password
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Choose a new password for your Church Desk account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    New password
                  </label>

                  <div className="relative">
                    <LockKeyhole
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      placeholder="Minimum 8 characters"
                      className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-3 text-sm outline-none focus:border-gray-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Confirm new password
                  </label>

                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Enter password again"
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none focus:border-gray-800"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#1e1e1e] px-4 py-3 text-sm font-medium text-white hover:bg-black disabled:opacity-60"
                >
                  {loading ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

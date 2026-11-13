
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // Keep the latest profile available to auth callbacks without
  // recreating the Supabase subscription on every render.
  const profileRef = useRef(null);

  // Prevent multiple simultaneous requests for the same profile.
  const profileRequestRef = useRef(null);

  const loadProfile = useCallback(async () => {
    // Reuse an existing request instead of making duplicate calls.
    if (profileRequestRef.current) {
      return profileRequestRef.current;
    }

    const request = (async () => {
      const { data, error } = await supabase.functions.invoke(
        "user-creation",
        {
          body: { action: "complete-login" },
        },
      );

      if (error) throw error;

      if (!data?.success || !data.profile) {
        throw new Error(
          data?.error || "Unable to load your user profile.",
        );
      }

      profileRef.current = data.profile;
      setProfile(data.profile);
      setAuthError("");

      return data.profile;
    })();

    profileRequestRef.current = request;

    try {
      return await request;
    } finally {
      if (profileRequestRef.current === request) {
        profileRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;
        if (!mounted) return;

        setSession(currentSession);

        if (currentSession) {
          await loadProfile();
        }
      } catch (error) {
        if (!mounted) return;

        setAuthError(
          error.message || "Unable to verify your account.",
        );

        profileRef.current = null;
        setProfile(null);

        await supabase.auth.signOut();
        setSession(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialise();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!mounted) return;

        // Always keep the session synchronised.
        setSession(nextSession);

        // Handle logout or an expired session.
        if (event === "SIGNED_OUT" || !nextSession) {
          profileRef.current = null;
          setProfile(null);
          setAuthError("");
          setLoading(false);
          return;
        }

        // These events are normal and should not reload the profile.
        // TOKEN_REFRESHED commonly happens when returning to a tab.
        if (
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED"
        ) {
          return;
        }

        // Only respond to meaningful authentication events.
        if (
          event !== "SIGNED_IN" &&
          event !== "USER_UPDATED" &&
          event !== "PASSWORD_RECOVERY"
        ) {
          return;
        }

        // SIGNED_IN can happen during the normal login process.
        // If the profile is already loaded, there is nothing to do.
        if (
          event === "SIGNED_IN" &&
          profileRef.current
        ) {
          return;
        }

        // Only display the full-screen loader when no profile exists.
        if (!profileRef.current) {
          setLoading(true);
        }

        // Defer the request until the auth callback completes.
        Promise.resolve().then(async () => {
          if (!mounted) return;

          try {
            await loadProfile();
          } catch (error) {
            if (!mounted) return;

            setAuthError(
              error.message || "Your account is not active.",
            );

            profileRef.current = null;
            setProfile(null);

            await supabase.auth.signOut();
          } finally {
            if (mounted) {
              setLoading(false);
            }
          }
        });
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signIn(email, password) {
    setAuthError("");
    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) throw error;

      setSession(data.session);

      const loadedProfile = await loadProfile();

      return {
        ...data,
        profile: loadedProfile,
      };
    } catch (error) {
      profileRef.current = null;
      setProfile(null);

      await supabase.auth.signOut();

      setSession(null);
      setAuthError(error.message);

      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    profileRef.current = null;
    setProfile(null);
    setSession(null);
    setAuthError("");
    setLoading(false);
  }

  const role = profile?.role?.name ?? null;

  const canManageUsers =
    role === "Super Admin" || role === "Admin";

  const isSuperAdmin = role === "Super Admin";

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        role,
        canManageUsers,
        isSuperAdmin,
        loading,
        authError,
        signIn,
        signOut,
        refreshProfile: loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}


import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const loadProfile = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke(
      "user-creation",
      {
        body: { action: "complete-login" },
      },
    );

    if (error) throw error;
    if (!data?.success || !data.profile) {
      throw new Error(data?.error || "Unable to load your user profile.");
    }

    setProfile(data.profile);
    setAuthError("");

    return data.profile;
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

        setAuthError(error.message || "Unable to verify your account.");
        setProfile(null);

        await supabase.auth.signOut();
        setSession(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialise();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setLoading(false);
        return;
      }

      // Defer the profile request until after the auth callback.
      Promise.resolve().then(async () => {
        if (!mounted) return;

        setLoading(true);

        try {
          await loadProfile();
        } catch (error) {
          if (!mounted) return;

          setAuthError(error.message || "Your account is not active.");
          setProfile(null);
          await supabase.auth.signOut();
        } finally {
          if (mounted) setLoading(false);
        }
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  async function signIn(email, password) {
    setAuthError("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) throw error;

    setSession(data.session);

    try {
      const loadedProfile = await loadProfile();
      return {
        ...data,
        profile: loadedProfile,
      };
    } catch (profileError) {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setAuthError(profileError.message);
      throw profileError;
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    setSession(null);
    setProfile(null);
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
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

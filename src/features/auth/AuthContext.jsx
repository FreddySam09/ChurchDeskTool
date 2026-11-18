
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../../lib/supabase";

import {
  canAccessWorkspace,
  canWriteWorkspace,
  isReadOnlyWorkspace,
  getWorkspaceAccess,
  canAccessAssignedGroups,
  canManageAssignedFellowshipMembers,
  canAddMemberToAssignedFellowship,
  canEditAssignedFellowshipMember,
  canDownloadWorkspace,
  canManageUsers as roleCanManageUsers,
  canCreateSuperAdmin,
  canManageCustomRoles,
  canManageOtherUsers,
} from "./permissions";

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

  // ---------------------------------------------------------
  // PROFILE LOADING
  // ---------------------------------------------------------

  const loadProfile = useCallback(async () => {
    // Reuse an existing request instead of making duplicate calls.
    if (profileRequestRef.current) {
      return profileRequestRef.current;
    }

    const request = (async () => {
      const { data, error } = await supabase.functions.invoke(
        "user-creation",
        {
          body: {
            action: "complete-login",
          },
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

  // ---------------------------------------------------------
  // AUTH INITIALIZATION AND SESSION LISTENER
  // ---------------------------------------------------------

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

  // ---------------------------------------------------------
  // SIGN IN
  // ---------------------------------------------------------

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

  // ---------------------------------------------------------
  // SIGN OUT
  // ---------------------------------------------------------

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    profileRef.current = null;
    setProfile(null);
    setSession(null);
    setAuthError("");
    setLoading(false);
  }

  // ---------------------------------------------------------
  // CURRENT USER AND ROLE
  // ---------------------------------------------------------

  const role = profile?.role?.name ?? null;

  const isSuperAdmin = role === "Super Admin";
  const isAdmin = role === "Admin";
  const isFellowshipLeader = role === "Fellowship Leader";

  const canManageUsers = roleCanManageUsers(role);

  // ---------------------------------------------------------
  // FELLOWSHIP ASSIGNMENTS
  // ---------------------------------------------------------

  /*
   * These IDs will be populated by the user-creation
   * complete-login response once the fellowship assignment
   * mechanism is implemented.
   *
   * Until then, the array remains empty.
   *
   * Supported profile property names:
   * - assigned_fellowship_ids
   * - fellowship_ids
   *
   * The backend should eventually return assigned_fellowship_ids.
   */

  const assignedFellowshipIds = Array.isArray(
    profile?.assigned_fellowship_ids,
  )
    ? profile.assigned_fellowship_ids
    : Array.isArray(profile?.fellowship_ids)
      ? profile.fellowship_ids
      : [];

  const hasAssignedFellowships =
    assignedFellowshipIds.length > 0;

  // ---------------------------------------------------------
  // CENTRAL PERMISSION INTERFACE
  // ---------------------------------------------------------

  const permissions = {
    // Returns:
    // full | read | assigned | restricted | none
    getAccess: (workspace) =>
      getWorkspaceAccess(role, workspace),

    // Whether the user can open a workspace.
    canAccess: (workspace) =>
      canAccessWorkspace(role, workspace),

    // Whether the user has general full write access.
    canWrite: (workspace) =>
      canWriteWorkspace(role, workspace),

    // Whether the workspace is read-only/restricted.
    isReadOnly: (workspace) =>
      isReadOnlyWorkspace(role, workspace),

    // Whether the user can download/export workspace data.
    canDownload: (workspace) =>
      canDownloadWorkspace(role, workspace),

    // Whether the workspace is limited to assigned groups.
    canAccessAssignedGroups: (workspace) =>
      canAccessAssignedGroups(role, workspace),

    // Fellowship Leader-specific permissions.
    canManageAssignedFellowshipMembers: (workspace) =>
      canManageAssignedFellowshipMembers(role, workspace),

    canAddMemberToAssignedFellowship: (workspace) =>
      canAddMemberToAssignedFellowship(role, workspace),

    canEditAssignedFellowshipMember: (workspace) =>
      canEditAssignedFellowshipMember(role, workspace),

    // User and role administration.
    canCreateSuperAdmin: () =>
      canCreateSuperAdmin(role),

    canManageCustomRoles: () =>
      canManageCustomRoles(role),

    canManageOtherUsers: (targetRole) =>
      canManageOtherUsers(role, targetRole),
  };

  // ---------------------------------------------------------
  // AUTH CONTEXT
  // ---------------------------------------------------------

  return (
    <AuthContext.Provider
      value={{
        // Authentication
        session,
        user: session?.user ?? null,
        profile,
        loading,
        authError,
        signIn,
        signOut,
        refreshProfile: loadProfile,

        // Current role
        role,
        isSuperAdmin,
        isAdmin,
        isFellowshipLeader,
        canManageUsers,

        // RBAC
        permissions,

        // Fellowship scope
        assignedFellowshipIds,
        hasAssignedFellowships,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// -----------------------------------------------------------
// AUTH HOOK
// -----------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider",
    );
  }

  return context;
}

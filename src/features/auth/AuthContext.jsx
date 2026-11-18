
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
  canManageOrganizations,
  canManageLeadership,
  canManageMembershipRecords,
  canManageAdministration,
} from "./permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const profileRef = useRef(null);
  const profileRequestRef = useRef(null);

  // ---------------------------------------------------------
  // LOAD PROFILE AND FELLOWSHIP ASSIGNMENTS
  // ---------------------------------------------------------

  const loadProfile = useCallback(async () => {
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

      let loadedProfile = data.profile;

      // Fellowship Leaders must receive their scope from
      // user_group_access, not leadership appointments.
      if (loadedProfile.role?.name === "Fellowship Leader") {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user?.id) {
          throw new Error("Unable to identify the signed-in user.");
        }

        const today = new Date().toISOString().slice(0, 10);

        const {
          data: assignments,
          error: assignmentError,
        } = await supabase
          .from("user_group_access")
          .select(`
            group_id,
            valid_from,
            valid_until,
            fellowship:church_groups!inner (
              id,
              name,
              group_type,
              group_status
            )
          `)
          .eq("auth_user_id", user.id)
          .lte("valid_from", today)
          .or(`valid_until.is.null,valid_until.gte.${today}`)
          .eq("fellowship.group_type", "fellowship")
          .eq("fellowship.group_status", "Active");

        if (assignmentError) {
          throw new Error(
            assignmentError.message ||
              "Unable to load your fellowship assignments.",
          );
        }

        const assignedFellowships = (assignments ?? [])
          .filter(
            (item) =>
              item.group_id &&
              item.fellowship?.group_type === "fellowship" &&
              item.fellowship?.group_status === "Active",
          )
          .map((item) => ({
            id: item.group_id,
            name: item.fellowship?.name ?? "",
          }));

        loadedProfile = {
          ...loadedProfile,
          assigned_fellowships: assignedFellowships,
          assigned_fellowship_ids: assignedFellowships.map(
            (item) => item.id,
          ),
        };
      } else {
        loadedProfile = {
          ...loadedProfile,
          assigned_fellowships: [],
          assigned_fellowship_ids: [],
        };
      }

      profileRef.current = loadedProfile;
      setProfile(loadedProfile);
      setAuthError("");

      return loadedProfile;
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

        setSession(nextSession);

        if (event === "SIGNED_OUT" || !nextSession) {
          profileRef.current = null;
          setProfile(null);
          setAuthError("");
          setLoading(false);
          return;
        }

        if (
          event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED"
        ) {
          return;
        }

        if (
          event !== "SIGNED_IN" &&
          event !== "USER_UPDATED" &&
          event !== "PASSWORD_RECOVERY"
        ) {
          return;
        }

        if (
          event === "SIGNED_IN" &&
          profileRef.current
        ) {
          return;
        }

        if (!profileRef.current) {
          setLoading(true);
        }

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
    profileRequestRef.current = null;

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

  const assignedFellowships = Array.isArray(
    profile?.assigned_fellowships,
  )
    ? profile.assigned_fellowships
    : [];

  const assignedFellowshipIds = assignedFellowships
    .map((item) => item.id)
    .filter(Boolean);

  const hasAssignedFellowships =
    assignedFellowshipIds.length > 0;

  // ---------------------------------------------------------
  // CENTRAL PERMISSION INTERFACE
  // ---------------------------------------------------------

  const permissions = {
    getAccess: (workspace) =>
      getWorkspaceAccess(role, workspace),

    canAccess: (workspace) =>
      canAccessWorkspace(role, workspace),

    canWrite: (workspace) =>
      canWriteWorkspace(role, workspace),

    isReadOnly: (workspace) =>
      isReadOnlyWorkspace(role, workspace),

    canDownload: (workspace) =>
      canDownloadWorkspace(role, workspace),

    canAccessAssignedGroups: (workspace) =>
      canAccessAssignedGroups(role, workspace),

    canManageAssignedFellowshipMembers: (workspace) =>
      canManageAssignedFellowshipMembers(role, workspace),

    canAddMemberToAssignedFellowship: (workspace) =>
      canAddMemberToAssignedFellowship(role, workspace),

    canEditAssignedFellowshipMember: (workspace) =>
      canEditAssignedFellowshipMember(role, workspace),

    // Always check the target group before allowing a
    // Fellowship Leader to manage its members.
    isAssignedFellowship: (groupId) =>
      isFellowshipLeader &&
      assignedFellowshipIds.includes(groupId),

    canManageMembersInGroup: (group) =>
      permissions.canWrite("groups") ||
      (
        isFellowshipLeader &&
        group?.group_type === "fellowship" &&
        assignedFellowshipIds.includes(group?.id)
      ),

    canCreateSuperAdmin: () =>
      canCreateSuperAdmin(role),

    canManageCustomRoles: () =>
      canManageCustomRoles(role),

    canManageOtherUsers: (targetRole) =>
      canManageOtherUsers(role, targetRole),

    canManageOrganizations: () =>
      canManageOrganizations(role),

    canManageLeadership: () =>
      canManageLeadership(role),

    canManageMembershipRecords: () =>
      canManageMembershipRecords(role),

    canManageAdministration: () =>
      canManageAdministration(role),
  };

  // ---------------------------------------------------------
  // AUTH CONTEXT
  // ---------------------------------------------------------

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        authError,
        signIn,
        signOut,
        refreshProfile: loadProfile,

        role,
        isSuperAdmin,
        isAdmin,
        isFellowshipLeader,
        canManageUsers,

        permissions,

        assignedFellowships,
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

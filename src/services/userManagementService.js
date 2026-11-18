
import { supabase } from "../lib/supabase";

async function unwrap({ data, error }) {
  if (error) {
    let message = error.message;

    if (error.context) {
      try {
        const details = await error.context.json();
        message = details.error || details.message || message;
      } catch {
        // Keep the original error message.
      }
    }

    console.error("Church Desk user management error:", {
      message,
      error,
      data,
    });

    throw new Error(message);
  }

  return data;
}

export async function getAvailableRoles() {
  return (
    unwrap(
      await supabase
        .from("roles")
        .select("id, name, is_system")
        .order("name"),
    ) ?? []
  );
}

export async function getAvailableFellowships() {
  return (
    unwrap(
      await supabase
        .from("church_groups")
        .select("id, name")
        .eq("group_type", "fellowship")
        .eq("group_status", "Active")
        .order("name"),
    ) ?? []
  );
}


export async function getManagedUsers() {
  const users =
    (await unwrap(
      await supabase
        .from("users")
        .select(`
          auth_user_id,
          email,
          full_name,
          is_active,
          created_at,
          role:roles (
            id,
            name,
            is_system
          )
        `)
        .order("created_at", { ascending: false }),
    )) ?? [];

  if (!Array.isArray(users) || users.length === 0) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);

  const userIds = users
    .map((user) => user.auth_user_id)
    .filter(Boolean);

  if (userIds.length === 0) {
    return users.map((user) => ({
      ...user,
      assigned_fellowships: [],
    }));
  }

  const assignments =
    (await unwrap(
      await supabase
        .from("user_group_access")
        .select(`
          auth_user_id,
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
        .lte("valid_from", today)
        .or(`valid_until.is.null,valid_until.gte.${today}`)
        .eq("fellowship.group_type", "fellowship")
        .eq("fellowship.group_status", "Active")
        .in("auth_user_id", userIds),
    )) ?? [];

  const assignmentMap = new Map();

  for (const assignment of assignments) {
    const current =
      assignmentMap.get(assignment.auth_user_id) ?? [];

    current.push({
      id: assignment.group_id,
      name: assignment.fellowship?.name,
    });

    assignmentMap.set(assignment.auth_user_id, current);
  }

  return users.map((user) => ({
    ...user,
    assigned_fellowships:
      assignmentMap.get(user.auth_user_id) ?? [],
  }));
}


export async function createManagedUser(values) {
  return unwrap(
    await supabase.functions.invoke("user-creation", {
      body: {
        action: "create-user",
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        roleId: values.roleId,
        passwordMode: values.passwordMode,
        fellowshipIds: values.fellowshipIds ?? [],
      },
    }),
  );
}

export async function updateManagedUserFellowships(
  authUserId,
  fellowshipIds,
) {
  return unwrap(
    await supabase.functions.invoke("user-creation", {
      body: {
        action: "update-user-fellowships",
        authUserId,
        fellowshipIds,
      },
    }),
  );
}

export async function createManagedRole(name) {
  return unwrap(
    await supabase.functions.invoke("user-creation", {
      body: {
        action: "create-role",
        name,
      },
    }),
  );
}

export async function sendManagedUserPasswordReset(email) {
  if (!email) {
    throw new Error("This user does not have a registered email.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: `${window.location.origin}/reset-password`,
    },
  );

  if (error) throw error;

  return {
    success: true,
    message: "Password reset email requested successfully.",
  };
}

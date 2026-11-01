
import { supabase } from "../lib/supabase";

function unwrap({ data, error }) {
  if (error) throw error;
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

export async function getManagedUsers() {
  return (
    unwrap(
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
    ) ?? []
  );
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

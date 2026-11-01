
import { useCallback, useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  X,
  Crown,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";

import {
  createManagedRole,
  createManagedUser,
  getAvailableRoles,
  getManagedUsers,
  sendManagedUserPasswordReset,
} from "../../services/userManagementService";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  roleId: "",
  passwordMode: "temporary",
};

function roleName(user) {
  return Array.isArray(user.role)
    ? user.role[0]?.name
    : user.role?.name;
}

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />
      {active ? "Active" : "Pending"}
    </span>
  );
}

export default function UsersPage() {
  const {
    role,
    isSuperAdmin,
  } = useAuth();

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);

  const [form, setForm] = useState(initialForm);
  const [newRoleName, setNewRoleName] = useState("");

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [userData, roleData] = await Promise.all([
        getManagedUsers(),
        getAvailableRoles(),
      ]);

      setUsers(userData);
      setRoles(roleData);
    } catch (err) {
      setError(err.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableRoles = roles.filter(
    (item) => isSuperAdmin || item.name !== "Super Admin",
  );

  const filteredUsers = users.filter((item) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return (
      item.full_name?.toLowerCase().includes(query) ||
      item.email?.toLowerCase().includes(query) ||
      roleName(item)?.toLowerCase().includes(query)
    );
  });

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function closeCreateUser() {
    setShowCreateUser(false);
    setForm(initialForm);
    setError("");
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
        // When using email setup, generate a random initial password.
        // The user will replace it using the recovery email.
        const initialPassword =
        form.passwordMode === "email"
            ? `${crypto.randomUUID()}Aa1!`
            : form.password;

        const result = await createManagedUser({
        ...form,
        password: initialPassword,
        });

        if (form.passwordMode === "email") {
        try {
            await sendManagedUserPasswordReset(form.email.trim());

            setSuccess(
            "User created successfully. A password setup email has been requested.",
            );
        } catch (emailError) {
            setSuccess(
            "User created, but the password email could not be sent. Use the reset action in the user list to try again.",
            );
        }
        } else {
        setSuccess(
            result.message || "User created successfully.",
        );
        }

        closeCreateUser();
        await loadData();
    } catch (err) {
        setError(err.message || "Unable to create user.");
    } finally {
        setSaving(false);
    }
    }

  async function handleCreateRole(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await createManagedRole(newRoleName);

      setRoles((current) =>
        [...current, result.role].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );

      setNewRoleName("");
      setShowCreateRole(false);
      setSuccess("Role created successfully.");
    } catch (err) {
      setError(err.message || "Unable to create role.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendPasswordReset(user) {
    setError("");
    setSuccess("");

    try {
      await sendManagedUserPasswordReset(user.email);

      setSuccess(`Password reset email requested for ${user.email}.`);
    } catch (err) {
      setError(err.message || "Unable to request a password reset.");
    }
  }

  const selectedRole = roles.find(
    (item) => item.id === form.roleId,
  );

  const isTransfer = selectedRole?.name === "Super Admin";

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6">
      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e9edfd] text-[#3457d5]">
              <Users size={19} />
            </span>

            <div>
              <h1 className="text-[25px] font-bold tracking-tight text-[#17181d]">
                User Management
              </h1>
              <p className="mt-1 text-[13px] text-[#777984]">
                Manage Church Desk accounts and role assignments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowCreateRole(true);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#e5e5e7] bg-white px-3.5 text-[12px] font-semibold text-[#34353b] transition hover:bg-[#f7f7f8]"
            >
              <Plus size={15} />
              Create role
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setError("");
              setSuccess("");
              setShowCreateUser(true);
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#191a1f] px-4 text-[12px] font-semibold text-white transition hover:bg-black"
          >
            <UserPlus size={15} />
            Add user
          </button>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-700"
        >
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#e9e9eb] bg-white p-4">
          <p className="text-[11px] font-medium text-[#858791]">
            Total accounts
          </p>
          <p className="mt-2 text-[25px] font-bold text-[#191a1f]">
            {users.length}
          </p>
        </div>

        <div className="rounded-xl border border-[#e9e9eb] bg-white p-4">
          <p className="text-[11px] font-medium text-[#858791]">
            Active accounts
          </p>
          <p className="mt-2 text-[25px] font-bold text-emerald-700">
            {users.filter((item) => item.is_active).length}
          </p>
        </div>

        <div className="rounded-xl border border-[#e9e9eb] bg-white p-4">
          <p className="text-[11px] font-medium text-[#858791]">
            Available roles
          </p>
          <p className="mt-2 text-[25px] font-bold text-[#191a1f]">
            {roles.length}
          </p>
        </div>
      </div>

      {/* USER DIRECTORY */}
      <section className="overflow-hidden rounded-xl border border-[#e9e9eb] bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-[#ededee] px-4 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-[14px] font-bold text-[#191a1f]">
              Created users
            </h2>
            <p className="mt-1 text-[11px] text-[#858791]">
              Accounts created through Church Desk.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-[260px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#999ba3]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users..."
                className="h-9 w-full rounded-lg border border-[#e5e5e7] pl-9 pr-3 text-[12px] outline-none focus:border-[#6681ff]"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              title="Refresh users"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e7] text-[#6c6e76] transition hover:bg-[#f7f7f8] disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={loading ? "animate-spin" : ""}
              />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[180px] items-center justify-center text-[12px] text-[#858791]">
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center px-4 text-center">
            <Users size={25} className="mb-2 text-[#b3b5bc]" />
            <p className="text-[13px] font-semibold text-[#44454c]">
              No users found
            </p>
            <p className="mt-1 text-[11px] text-[#858791]">
              Create a user or try a different search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-[#fafafa]">
                <tr className="border-b border-[#ededee] text-[10px] font-semibold uppercase tracking-wide text-[#858791]">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#f0f0f1]">
                {filteredUsers.map((item) => {
                  const itemRole = roleName(item);

                  return (
                    <tr
                      key={item.auth_user_id}
                      className="transition hover:bg-[#fafafa]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef0f7] text-[11px] font-bold text-[#454b60]">
                            {item.full_name
                              ?.split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0]?.toUpperCase())
                              .join("") || "U"}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-[#25262c]">
                              {item.full_name}
                            </p>
                            <p className="mt-0.5 truncate text-[11px] text-[#858791]">
                              {item.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#4c4e57]">
                          {itemRole === "Super Admin" && (
                            <Crown size={13} className="text-amber-500" />
                          )}
                          {itemRole}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-[11px] text-[#777984]">
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill active={item.is_active} />
                      </td>
                      <td className="px-4 py-3">
                        <button
                            type="button"
                            onClick={() => handleSendPasswordReset(item)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e5e7] px-3 py-2 text-[11px] font-semibold text-[#45464e] transition hover:bg-[#f7f7f8]"
                        >
                            <KeyRound size={13} />
                            Send reset link
                        </button>
                        </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* CREATE USER MODAL */}
      {showCreateUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
          <section className="max-h-[90vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ededee] px-5 py-4">
              <div>
                <h2 className="text-[16px] font-bold text-[#191a1f]">
                  Create user
                </h2>
                <p className="mt-1 text-[11px] text-[#858791]">
                  Create a Supabase Auth account and assign a role.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateUser}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e7e7e9] text-[#777984] hover:bg-[#f6f6f7]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#45464e]">
                  Full name *
                </label>
                <input
                  required
                  value={form.fullName}
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                  placeholder="Enter full name"
                  className="h-10 w-full rounded-lg border border-[#e5e5e7] px-3 text-[12px] outline-none focus:border-[#6681ff]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#45464e]">
                  Email address *
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateForm("email", event.target.value)
                  }
                  placeholder="name@example.com"
                  className="h-10 w-full rounded-lg border border-[#e5e5e7] px-3 text-[12px] outline-none focus:border-[#6681ff]"
                />
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-semibold text-[#45464e]">
                    Password setup *
                </label>

                <div className="grid grid-cols-2 gap-2">
                    <button
                    type="button"
                    onClick={() => updateForm("passwordMode", "temporary")}
                    className={`rounded-lg border px-3 py-2.5 text-[11px] font-semibold transition ${
                        form.passwordMode === "temporary"
                        ? "border-[#343b55] bg-[#f0f1f6] text-[#252b42]"
                        : "border-[#e5e5e7] bg-white text-[#777984]"
                    }`}
                    >
                    Temporary password
                    </button>

                    <button
                    type="button"
                    onClick={() => updateForm("passwordMode", "email")}
                    className={`rounded-lg border px-3 py-2.5 text-[11px] font-semibold transition ${
                        form.passwordMode === "email"
                        ? "border-[#343b55] bg-[#f0f1f6] text-[#252b42]"
                        : "border-[#e5e5e7] bg-white text-[#777984]"
                    }`}
                    >
                    Email setup link
                    </button>
                </div>

                {form.passwordMode === "temporary" ? (
                    <>
                    <input
                        required
                        type="password"
                        minLength={8}
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(event) =>
                        updateForm("password", event.target.value)
                        }
                        placeholder="Minimum 8 characters"
                        className="mt-3 h-10 w-full rounded-lg border border-[#e5e5e7] px-3 text-[12px] outline-none focus:border-[#6681ff]"
                    />

                    <p className="mt-1 text-[10px] text-[#92949c]">
                        Set a temporary password and share it securely with the user.
                    </p>
                    </>
                ) : (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <p className="text-[11px] leading-5 text-blue-800">
                        Church Desk will create the account and request a password
                        setup email. The user can choose their own password through
                        the link.
                    </p>
                    </div>
                )}
                </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#45464e]">
                  Assign role *
                </label>
                <select
                  required
                  value={form.roleId}
                  onChange={(event) =>
                    updateForm("roleId", event.target.value)
                  }
                  className="h-10 w-full rounded-lg border border-[#e5e5e7] bg-white px-3 text-[12px] outline-none focus:border-[#6681ff]"
                >
                  <option value="">Select a role</option>

                  {availableRoles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {isTransfer && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <Crown
                      size={17}
                      className="mt-0.5 shrink-0 text-amber-600"
                    />
                    <div>
                      <p className="text-[12px] font-bold text-amber-900">
                        Super Admin transfer
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-amber-800">
                        This account will be created as a pending
                        Super Admin. When the new user logs in
                        successfully, the current Super Admin will
                        automatically be deactivated.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-[#ededee] pt-4">
                <button
                  type="button"
                  onClick={closeCreateUser}
                  className="h-9 rounded-lg border border-[#e5e5e7] px-4 text-[12px] font-semibold text-[#555761] hover:bg-[#f7f7f8]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg bg-[#191a1f] px-4 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create user"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* CREATE ROLE MODAL */}
      {showCreateRole && isSuperAdmin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
          <section className="w-full max-w-[400px] rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#ededee] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-bold text-[#191a1f]">
                  Create new role
                </h2>
                <p className="mt-1 text-[11px] text-[#858791]">
                  Add a custom role to Church Desk.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateRole(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e7e7e9] text-[#777984]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-[#45464e]">
                  Role name *
                </label>
                <input
                  required
                  maxLength={60}
                  value={newRoleName}
                  onChange={(event) =>
                    setNewRoleName(event.target.value)
                  }
                  placeholder="e.g. Assistant Secretary"
                  className="h-10 w-full rounded-lg border border-[#e5e5e7] px-3 text-[12px] outline-none focus:border-[#6681ff]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#ededee] pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateRole(false)}
                  className="h-9 rounded-lg border border-[#e5e5e7] px-4 text-[12px] font-semibold text-[#555761]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 rounded-lg bg-[#191a1f] px-4 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create role"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

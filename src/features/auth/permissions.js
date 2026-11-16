
export const ROLES = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  ELDER: "Elder",
  PASTOR: "Pastor",
  TREASURER: "Treasurer",
  FELLOWSHIP_LEADER: "Fellowship Leader",
  OTHERS: "Others",
};

export const WORKSPACES = {
  MEMBERSHIP: "membership",
  GROUPS: "groups",
  LEADERSHIP: "leadership",
  EVENTS: "events",
  COMMUNICATIONS: "communications",
  REPORTS: "reports",
  FINANCE: "finance",
  ADMINISTRATION: "administration",
};

// "full" = read and write
// "read" = read-only
// "assigned" = access limited to assigned groups
// "restricted" = restricted directory access only
// "none" = no access
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    membership: "full",
    groups: "full",
    leadership: "full",
    events: "full",
    communications: "full",
    reports: "full",
    finance: "full",
    administration: "full",
  },

  [ROLES.ADMIN]: {
    membership: "full",
    groups: "full",
    leadership: "full",
    events: "full",
    communications: "full",
    reports: "full",
    finance: "full",
    administration: "full",
  },

  [ROLES.ELDER]: {
    membership: "read",
    groups: "read",
    leadership: "read",
    events: "read",
    communications: "none",
    reports: "none",
    finance: "none",
    administration: "none",
  },

  [ROLES.PASTOR]: {
    membership: "read",
    groups: "read",
    leadership: "read",
    events: "read",
    communications: "read",
    reports: "read",
    finance: "read",
    administration: "none",
  },

  [ROLES.TREASURER]: {
    membership: "full",
    groups: "read",
    leadership: "read",
    events: "read",
    communications: "none",
    reports: "read",
    finance: "full",
    administration: "none",
  },

  [ROLES.FELLOWSHIP_LEADER]: {
    membership: "none",
    groups: "assigned",
    leadership: "assigned",
    events: "none",
    communications: "none",
    reports: "none",
    finance: "none",
    administration: "none",
  },

  [ROLES.OTHERS]: {
    membership: "restricted",
    groups: "read",
    leadership: "read",
    events: "read",
    communications: "read",
    reports: "read",
    finance: "none",
    administration: "none",
  },
};

export function getWorkspaceAccess(role, workspace) {
  return ROLE_PERMISSIONS[role]?.[workspace] ?? "none";
}

export function canAccessWorkspace(role, workspace) {
  return getWorkspaceAccess(role, workspace) !== "none";
}

export function canWriteWorkspace(role, workspace) {
  return getWorkspaceAccess(role, workspace) === "full";
}

export function isReadOnlyWorkspace(role, workspace) {
  const access = getWorkspaceAccess(role, workspace);
  return access === "read" || access === "restricted";
}

export function canAccessAssignedGroups(role, workspace) {
  return getWorkspaceAccess(role, workspace) === "assigned";
}

export function canManageUsers(role) {
  return role === ROLES.SUPER_ADMIN || role === ROLES.ADMIN;
}

export function canCreateSuperAdmin(role) {
  return role === ROLES.SUPER_ADMIN;
}

export function canManageCustomRoles(role) {
  return role === ROLES.SUPER_ADMIN;
}

export function canManageOtherUsers(role, targetRole) {
  if (role === ROLES.SUPER_ADMIN) return true;

  if (role === ROLES.ADMIN) {
    return targetRole !== ROLES.SUPER_ADMIN;
  }

  return false;
}

import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export default function ProtectedRoute({
  allowedRoles,
  workspace,
  requireWrite = false,
  allowRestricted = false,
}) {
  const {
    user,
    profile,
    loading,
    role,
    permissions,
    hasAssignedFellowships,
  } = useAuth();

  const parentContext = useOutletContext();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f6f8]">
        <p className="text-sm text-gray-500">
          Checking your session...
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile || !profile.is_active) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/access-denied" replace />;
  }

  if (workspace) {
    const access = permissions.getAccess(workspace);

    if (access === "none") {
      return <Navigate to="/access-denied" replace />;
    }

    if (access === "restricted" && !allowRestricted) {
      return <Navigate to="/access-denied" replace />;
    }

    if (
      access === "assigned" &&
      !hasAssignedFellowships
    ) {
      return <Navigate to="/access-denied" replace />;
    }

    if (
      requireWrite &&
      !permissions.canWrite(workspace)
    ) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return <Outlet context={parentContext} />;
}
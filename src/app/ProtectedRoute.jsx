
import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export default function ProtectedRoute({
  allowedRoles,
  workspace,
  requireWrite = false,
}) {
  const { user, profile, loading, role, permissions } = useAuth();

  // Preserve context provided by a parent route, such as AppLayout.
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

    // Restricted access requires a separate restricted interface.
    if (access === "none" || access === "restricted") {
      return <Navigate to="/access-denied" replace />;
    }

    if (requireWrite && !permissions.canWrite(workspace)) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  // Forward the parent's outlet context to nested routes.
  return <Outlet context={parentContext} />;
}

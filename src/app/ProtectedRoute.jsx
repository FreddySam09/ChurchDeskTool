
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export default function ProtectedRoute({ allowedRoles }) {
  const {
    user,
    profile,
    loading,
  } = useAuth();

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

  if (
    allowedRoles &&
    !allowedRoles.includes(profile.role?.name)
  ) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <p className="p-6 text-center text-sm text-gray-500" role="status">
        Verifying session...
      </p>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // User is logged in but doesn't have permission
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const workspaceByRole = {
      citizen: "/citizen-dashboard",
      ward_official: "/ward-official",
      superadmin: "/superadmin",
    };

    return (
      <Navigate to={workspaceByRole[user.role] || "/login"} replace />
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
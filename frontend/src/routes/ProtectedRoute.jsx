import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ allowedRoles }) => {
  const { user } = useAuth();
  const location = useLocation();

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
    if (user.role === "superadmin") {
      return <Navigate to="/superadmin" replace />;
    }

    if (user.role === "ward_official") {
      return <Navigate to="/ward-official" replace />;
    }

    return <Navigate to="/citizen-dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
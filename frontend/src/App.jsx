import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";
import { socket, socketUrl } from "./socket/socket.js";
// Public Pages
import PublicLayout from "./components/layouts/PublicLayout";
import DashboardLayout from "./components/layouts/DashboardLayout";
import PublicLandingPage from "./pages/public/PublicLandingPage";
import ExploreMap from "./components/common/ExploreMap";
import AboutUs from "./pages/public/AboutUs";
import ContactUs from "./pages/public/ContactUs";
// Auth Pages
import Register from "./pages/auth/Register";
import AccountType from "./pages/auth/AccountType";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import VerifyOtp from "./pages/auth/verifyOtp";
import SetNewPassword from "./pages/auth/SetNewPassword";
// citizen pages
import CitizenDashboard from "./pages/citizen/CitizenDashboard";
import { HeroProvider } from "./context/useContextHook";
import { SettingsProvider } from "./context/settingsContext.jsx";
import { CitizenProfile } from "./pages/citizen/CitizenProfile";
import { TrendingReports } from "./pages/reports/TrendingReports";
import { Setting } from "./components/common/Setting";
import { Notification } from "./components/notifications/Notification.jsx";
import ProtectedRoute from "./routes/ProtectedRoute";
import WhatsAppButton from "./components/common/WhatsAppButton.jsx";
// help page
import { Help } from "./components/help/Help.jsx";

// Superadmin Routes

import { SuperAdminLayout } from "./components/layouts/SuperAdminLayout";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import { WardManagement } from "./pages/superadmin/WardManagement";
import { UserManagement } from "./pages/superadmin/UserManagement";
import { ReportManagement } from "./pages/superadmin/ReportManagement";
import { ReportBin } from "./pages/superadmin/ReportBin";
import { Verification } from "./pages/superadmin/Verification";
import { AuditLog } from "./pages/superadmin/AuditLog";
import AnalyticsAndStatics from "./pages/superadmin/AnalyticsAndStatics";
import SettingPage from "./pages/superadmin/Setting";
import {
  SiteSettingsProvider,
  useSiteSettings,
} from "./context/SiteSettingsContext.jsx";

import { WardOfficialLayout } from "./pages/wardOfficials/wardOfficialLayout";
import { WardOfficialDashboard } from "./pages/wardOfficials/wardOfficialDashboard";
import WardReportManagement from "./pages/wardOfficials/wardReportmanagement";
import WardOfficialMap from "./pages/wardOfficials/WardOfficialMap";
import WardOfficialAnalytics from "./pages/wardOfficials/WardOfficialAnalytics";
const RegistrationRoute = () => {
  const { settings, loading } = useSiteSettings();
  if (loading) {
    return <p className="p-6 text-center text-sm text-gray-500">Loading...</p>;
  }
  return settings.allowRegistration ? (
    <Register />
  ) : (
    <Navigate to="/" replace />
  );
};

const SocketConnection = () => {
  const { user } = useAuth();

  useEffect(() => {
    console.info(`[Socket] Connecting to ${socketUrl}`);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  return null;
};

function App() {
  return (
    <SiteSettingsProvider>
      <HeroProvider>
        <AuthProvider>
          <SocketConnection />
          <Routes>
            {/* Public routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<PublicLandingPage />} />
              <Route path="/map" element={<ExploreMap />} />
              <Route path="/about-us" element={<AboutUs />} />
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/select-account-type" element={<AccountType />} />
            </Route>

            {/* Authentication routes */}
            <Route path="/signup" element={<RegistrationRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/set-new-password" element={<SetNewPassword />} />

            {/* Citizen dashboard routes */}
            <Route element={<ProtectedRoute />}>
              <Route
                path="/citizen-dashboard"
                element={
                  <SettingsProvider>
                    <DashboardLayout />
                  </SettingsProvider>
                }
              >
                <Route index element={<CitizenDashboard />} />
                <Route path="trending" element={<TrendingReports />} />
                <Route path="settings" element={<Setting />} />
                <Route path="notification" element={<Notification />} />
                <Route path="citizen-profile" element={<CitizenProfile />} />
                <Route path="help" element={<Help />} />
              </Route>
            </Route>
            {/* Superadmin routes */}
            <Route element={<ProtectedRoute allowedRoles={["superadmin"]} />}>
              <Route path="/superadmin" element={<SuperAdminLayout />}>
                <Route index element={<SuperAdminDashboard />} />
                <Route path="wards" element={<WardManagement />} />
                <Route path="users" element={<UserManagement />}></Route>
                <Route path="verification" element={<Verification />}></Route>

                <Route path="reports" element={<ReportManagement />} />
                <Route path="bin" element={<ReportBin />} />
                <Route path="auditlog" element={<AuditLog />} />
                <Route path="analytics" element={<AnalyticsAndStatics />} />
                <Route path="settings" element={<SettingPage />} />
                <Route path="notification" element={<Notification />} />
                <Route path="profile" element={<CitizenProfile />} />
                <Route
                  path="exploremap"
                  element={
                    <ExploreMap
                      title="Live Reports Map"
                      description="View report locations and real-time status updates."
                    />
                  }
                />
              </Route>
            </Route>
            <Route
              element={<ProtectedRoute allowedRoles={["ward_official"]} />}
            >
              <Route
                path="/ward-dashboard"
                element={<Navigate to="/ward-official" replace />}
              />
              <Route path="/ward-official" element={<WardOfficialLayout />}>
                <Route index element={<WardOfficialDashboard />} />
                <Route path="reports" element={<WardReportManagement />} />
                <Route path="profile" element={<CitizenProfile />} />
                <Route path="map" element={<WardOfficialMap />} />
                <Route path="analytics" element={<WardOfficialAnalytics />} />
                <Route path="notifications" element={<Notification />} />
              </Route>
            </Route>
          </Routes>
          <WhatsAppButton />
        </AuthProvider>
      </HeroProvider>
    </SiteSettingsProvider>
  );
}

export default App;

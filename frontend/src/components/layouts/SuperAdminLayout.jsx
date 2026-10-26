import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";
import { siteAssetUrl } from "../../utils/siteAssetUrl.js";

import {
  ArchiveRestore,
  Map,
  LogOut,
  Bell,
  File,
  Users,
  Settings,
  LayoutDashboard,
  ShieldCheck,
  FileText,
  ChartColumnBig,
  Menu,
  X,
  UserRound,
} from "lucide-react";

const navItems = [
  {
    label: "Dashboard / Overview",
    path: "/superadmin",
    end: true,
    icon: LayoutDashboard,
  },
  {
    label: "Manage Users",
    path: "/superadmin/users",
    icon: Users,
  },
  {
    label: "Ward Management",
    path: "/superadmin/wards",
    icon: Users,
  },
  {
    label: "Reports",
    path: "/superadmin/reports",
    icon: FileText,
  },
  {
    label: "Bin",
    path: "/superadmin/bin",
    icon: ArchiveRestore,
  },
  {
    label: "Verification",
    path: "/superadmin/verification",
    icon: ShieldCheck,
  },
  {
    label: "Audit Log",
    path: "/superadmin/auditlog",
    icon: File,
  },
  {
    label: "Live Reports Map",
    path: "/superadmin/exploremap",
    icon: Map,
  },
  {
    label: "Analytics & Statistics",
    path: "/superadmin/analytics",
    icon: ChartColumnBig,
  },
  {
    label: "Notification",
    path: "/superadmin/notification",
    icon: Bell,
  },
  {
    label: "My Profile",
    path: "/superadmin/profile",
    icon: UserRound,
  },
  {
    label: "Settings",
    path: "/superadmin/settings",
    icon: Settings,
  },
];

export const SuperAdminLayout = () => {
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleNavClick = () => {
    // Mobile par link click hone ke baad sidebar close
    setIsSidebarOpen(false);
  };

  const handleActiveState = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200
    ${
      isActive
        ? "bg-green-800 text-white shadow-sm"
        : "text-green-100 hover:bg-green-800 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ================= HEADER ================= */}
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:px-6">
        {/* Left Side */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>

          {/* Logo */}
          {(settings.logoSvg || settings.logoUrl) ? (
            <img
              src={
                settings.logoSvg
                  ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(settings.logoSvg)}`
                  : siteAssetUrl(settings.logoUrl)
              }
              alt=""
              className="h-10 w-10 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white"
              style={{ backgroundColor: settings.primaryColor }}
            >
              {settings.siteName?.charAt(0) || "C"}
            </div>
          )}

          <div className="hidden sm:block">
            <h1 className="font-bold text-green-600">{settings.siteName}</h1>
            <p className="text-xs text-gray-500">SuperAdmin Portal</p>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3 sm:gap-5">
          <p className="hidden text-sm font-medium text-gray-700 sm:block">
            {user?.first_name || user?.username || "SuperAdmin"}
          </p>

          <button
            type="button"
            onClick={handleLogout}
            className="hidden rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 sm:block"
          >
            Logout
          </button>

          {/* Mobile Logout Icon */}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 sm:hidden"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* ================= MOBILE BACKDROP ================= */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`
          fixed bottom-0 left-0 top-16 z-50
          flex w-64 flex-col
          overflow-y-auto
          border-r border-green-800
          bg-green-900
          transition-transform duration-300 ease-in-out

          ${
            isSidebarOpen
              ? "translate-x-0"
              : "-translate-x-full md:translate-x-0"
          }
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-green-300">
              Administration
            </p>
          </div>

          {/* Close Button - Mobile Only */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-2 text-green-100 hover:bg-green-800 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={22} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 px-3 pb-4">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={handleNavClick}
                className={handleActiveState}
              >
                <Icon size={20} className="shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Logout */}
        <div className="border-t border-green-800 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-green-100 transition hover:bg-green-800 hover:text-white"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="pt-16 md:ml-64">
        <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default SuperAdminLayout;

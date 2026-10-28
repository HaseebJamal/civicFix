import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChartColumnBig,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Map,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";
// import { siteAssetUrl } from "../../utils/siteAssetUrl.js";

const navigation = [
  {
    label: "Dashboard",
    path: "/ward-official",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Ward reports",
    path: "/ward-official/reports",
    icon: ClipboardList,
  },
  { label: "Ward map", path: "/ward-official/map", icon: Map },
  {
    label: "Analytics & Statistics",
    path: "/ward-official/analytics",
    icon: ChartColumnBig,
  },
  { label: "Notifications", path: "/ward-official/notifications", icon: Bell },
  { label: "Profile", path: "/ward-official/profile", icon: UserRound },
];

export const WardOfficialLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { settings } = useSiteSettings();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hideSidebar = pathname === "/ward-official/profile";

  const closeSidebar = () => setSidebarOpen(false);
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  const name =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "Ward official";
  const logoUrl = settings.logoSvg?.trim()
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
        settings.logoSvg.trim(),
      )}`
    : settings.logoUrl?.trim() || "";

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200 ${
      isActive
        ? "bg-green-800 text-white shadow-sm"
        : "text-green-100 hover:bg-green-800 hover:text-white"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:px-6">
        <div className="flex items-center gap-3">
          {!hideSidebar && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
              aria-label="Open sidebar"
            >
              <Menu size={24} />
            </button>
          )}

          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${settings.siteName || "CivicFix"} logo`}
              className="h-10 w-10 shrink-0 rounded-xl object-contain"
              onError={(event) => {
                console.error("Ward official logo failed to load:", {
                  src: event.currentTarget.src,
                  logoUrl,
                });

                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-white"
              style={{
                backgroundColor: settings.primaryColor || "#15803d",
              }}
            >
              {settings.siteName?.charAt(0) || "C"}
            </div>
          )}

          <div className="hidden sm:block">
            <h1 className="font-bold text-green-700">
              {settings.siteName || "CivicFix"}
            </h1>
            <p className="text-xs text-gray-500">Ward Official Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <p className="hidden text-sm font-medium text-gray-700 sm:block">
            {name}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="hidden rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 sm:block"
          >
            Logout
          </button>
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

      {!hideSidebar && sidebarOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      {!hideSidebar && (
        <aside
          className={`fixed bottom-0 left-0 top-16 z-50 flex w-64 flex-col overflow-y-auto border-r border-green-800 bg-green-900 transition-transform duration-300 ease-in-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="flex items-center justify-between p-4">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider text-green-300">
              Ward Operations
            </p>
            <button
              type="button"
              onClick={closeSidebar}
              aria-label="Close sidebar"
              className="rounded-lg p-2 text-green-100 hover:bg-green-800 md:hidden"
            >
              <X size={22} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 pb-4">
            {navigation.map(({ label, path, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                onClick={closeSidebar}
                className={navLinkClass}
              >
                <Icon size={20} className="shrink-0" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

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
      )}

      <main className={`pt-16 ${hideSidebar ? "" : "md:ml-64"}`}>
        <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6">
          <Outlet context={{ name }} />
        </div>
      </main>
    </div>
  );
};

export default WardOfficialLayout;

import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X, Bell, CircleHelp, UserRound } from "lucide-react";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";
import { siteAssetUrl } from "../../utils/siteAssetUrl.js";

const DashboardNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // const [searchQuery, setSearchQuery] = useState("");

  const { settings } = useSiteSettings();

  const navlink = ({ isActive }) =>
    `transition-colors duration-200 ${
      isActive
        ? "font-semibold gradient-text"
        : "text-gray-600 hover:text-blue-600"
    }`;

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <nav className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <NavLink
          to="/citizen-dashboard"
          onClick={closeMenu}
          aria-label={`${settings.siteName} Home`}
          className="flex shrink-0 items-center gap-2.5"
        >
          <div className="leading-tight">
            <span
              className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: settings.primaryColor }}
            >
              {(settings.logoSvg || settings.logoUrl) && (
                <img
                  src={
                    settings.logoSvg
                      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(settings.logoSvg)}`
                      : siteAssetUrl(settings.logoUrl)
                  }
                  alt=""
                  className="h-10 max-w-32 object-contain"
                />
              )}
              {settings.siteName}
            </span>

            {settings.tagline && (
              <span className="mt-1 hidden text-xs text-gray-500 sm:block">
                {settings.tagline}
              </span>
            )}
          </div>
        </NavLink>

        {/* Desktop Navigation */}
        <div className="ml-auto hidden items-center gap-5 md:flex">
          {/* Search */}

          {/* Trending */}
          <NavLink to="/citizen-dashboard/trending" className={navlink}>
            Trending
          </NavLink>

          {/* Notifications */}
          <NavLink
            to="/citizen-dashboard/notification"
            aria-label="Notifications"
            className="relative rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-700"
          >
            <Bell size={22} strokeWidth={1.8} />

            {/* <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /> */}
          </NavLink>

          {/* Help */}
          <NavLink
            to="/citizen-dashboard/help"
            className="flex items-center gap-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-700"
          >
            <CircleHelp size={22} strokeWidth={1.8} />
            <span>Help</span>
          </NavLink>

          {/* Profile */}
          <NavLink
            to="/citizen-dashboard/citizen-profile"
            className="flex items-center gap-2 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-700"
          >
            <UserRound size={22} strokeWidth={1.8} />
            <span>Profile</span>
          </NavLink>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMenuOpen}
          className="rounded-lg p-2 text-gray-700 transition hover:bg-gray-100 md:hidden"
        >
          {isMenuOpen ? <X size={25} /> : <Menu size={25} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="border-t border-gray-200 bg-white shadow-md md:hidden">
          <div className="space-y-1 px-4 py-4">
            {/* Mobile Search */}
            

            {/* Trending */}
            <NavLink
              to="/citizen-dashboard/trending"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive
                    ? "gradient-text text-600 font-semibold"
                    : "text-gray-600 hover:gradient-text"
                }`
              }
            >
              <span>📈</span>
              Trending
            </NavLink>

            {/* Notifications */}
            <NavLink
              to="/citizen-dashboard/notification"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`
              }
            >
              <Bell size={19} />

              <span className="flex-1">Notifications</span>

              <span className="h-2 w-2 rounded-full bg-red-500" />
            </NavLink>

            {/* Help */}
            <NavLink
              to="/citizen-dashboard/help"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`
              }
            >
              <CircleHelp size={19} />
              Help
            </NavLink>

            {/* Profile */}
            <NavLink
              to="/citizen-dashboard/citizen-profile"
              onClick={closeMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-50"
                }`
              }
            >
              <UserRound size={19} />
              Profile
            </NavLink>
          </div>
        </div>
      )}
    </header>
  );
};

export default DashboardNavbar;

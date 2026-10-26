import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";
import { siteAssetUrl } from "../../utils/siteAssetUrl.js";

const PublicNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { settings } = useSiteSettings();

  const navLink = ({ isActive }) => {
    return `transition-colors duration-200 ${
      isActive
        ? "gradient-text text-600 font-semibold"
        : "text-gray-600 hover:text-blue-600"
    }`;
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NavLink
          to="/"
          onClick={closeMenu}
          className="flex shrink-0 items-center gap-2.5"
          aria-label={`${settings.siteName} Home`}
        >
          <div className="leading-tight">
            <span className="flex items-center gap-2 font-bold tracking-tight text-3xl">
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
              <span style={{ color: settings.primaryColor }}>
                {settings.siteName}
              </span>
            </span>

            {settings.tagline && (
              <span className="mt-1 hidden text-xs text-gray-500 sm:block">
                {settings.tagline}
              </span>
            )}
          </div>
        </NavLink>
        {/* Desktop Navigations */}
        <div className="hidden items-center gap-8 md:flex">
          <NavLink to="/" end className={navLink}>
            Home
          </NavLink>
          <NavLink to="/map" className={navLink}>
            Explore Map
          </NavLink>

          <NavLink to="/about-us" className={navLink}>
            About Us
          </NavLink>
          <NavLink to="/contact-us" className={navLink}>
            Contact Us
          </NavLink>
          {/* Desktop Action button */}
          <div className=" md:flex gap-3 items-center ">
            <NavLink
              to="/login"
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 hover:text-blue-700"
            >
              Login
            </NavLink>
            {settings.allowRegistration && (
              <NavLink
                to="/signup"
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-blue-600 hover:text-blue-700"
              >
                Sign Up
              </NavLink>
            )}
          </div>
        </div>
        {/* Mobile Navigation */}
        <button
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label={isMenuOpen ? "close navigation" : "open navigation"}
          aria-expanded={isMenuOpen}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 md:hidden"
        >
          {isMenuOpen ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m6 6 12 12M18 6 6 18"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </nav>
      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 pb-5 pt-3 shadow-lg md:hidden">
          <div className="flex flex-col gap-1">
            <NavLink
              to="/"
              end
              onClick={closeMenu}
              className={({ isActive }) =>
                `rounded-lg px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-50 gradient-text "
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                }`
              }
            >
              Home
            </NavLink>

            <NavLink
              to="/map"
              onClick={closeMenu}
              className={({ isActive }) =>
                `rounded-lg px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-50 gradient-text "
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                }`
              }
            >
              Explore Map
            </NavLink>

            <NavLink
              to="/about"
              onClick={closeMenu}
              className={({ isActive }) =>
                `rounded-lg px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-50 gradient-text "
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-700"
                }`
              }
            >
              About Us
            </NavLink>

            <div className="my-2 border-t border-gray-200" />

            <NavLink
              to="/login"
              onClick={closeMenu}
              className="rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Log In
            </NavLink>

            {settings.allowRegistration && (
              <NavLink
                to="/signup"
                onClick={closeMenu}
                className="rounded-lg border border-gray-300 px-4 py-3 text-center text-sm max-w-auto font-semibold gradient-text text-white transition hover:border-blue-600 hover:text-blue-700"
              >
                Register Now
              </NavLink>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default PublicNavbar;

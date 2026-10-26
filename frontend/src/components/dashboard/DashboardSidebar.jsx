import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  Bell,
  Users,
  FileText,
  MapIcon,
  LogOut,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

const getImageUrl = (imagePath) => {
  if (typeof imagePath !== "string" || !imagePath.trim()) {
    return "";
  }

  const image = imagePath.trim();

  if (/^(?:https?:|data:|blob:)/i.test(image)) {
    return image;
  }

  try {
    const apiOrigin = new URL(
      api.defaults.baseURL || window.location.origin,
      window.location.origin,
    ).origin;

    return new URL(
      image.startsWith("/") ? image : `/${image}`,
      apiOrigin,
    ).toString();
  } catch {
    return "";
  }
};

const DashboardSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [failedImageUrl, setFailedImageUrl] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  /*
   * Prevent background page scroclient:935 [vite] connecting...
client:1048 [vite] connected.
SuperAdminLayout.jsx:5 Uncaught SyntaxError: The requested module '/node_modules/.vite/deps/lucide-react.js?t=1792659074573&v=66739b63' does not provide an export named 'Logout' (at SuperAdminLayout.jsx:5:3)
lling
   * while mobile sidebar is open.
   */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  /*
   * Close mobile sidebar when screen becomes desktop size.
   */
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  /*
   * User display name
   */
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    user?.username ||
    user?.user_name ||
    "User";

  /*
   * User profile image
   */
  const profileImage =
    user?.profileImage ||
    user?.profile_image ||
    user?.avatar_url ||
    user?.avatar ||
    "";

  const profileImageUrl = getImageUrl(profileImage);

  /*
   * Close mobile sidebar
   */
  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  /*
   * Logout
   */
  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "Do you want to logout from CivicFix?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, logout",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#38684e",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      logout();

      setMobileOpen(false);

      navigate("/login", {
        replace: true,
      });

      await Swal.fire({
        title: "Logged Out!",
        text: "You have been logged out successfully.",
        icon: "success",
        confirmButtonColor: "#38684e",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Logout error:", error);

      await Swal.fire({
        title: "Logout Error",
        text: "Unable to complete logout. Please try again.",
        icon: "error",
        confirmButtonColor: "#38684e",
      });
    }
  };

  /*
   * Navigation link styling
   */
  const navLinkClass = ({ isActive }) =>
     `flex items-center gap-3 rounded-lg px-4 py-3 transition ${
      isActive ? "bg-green-800 text-white" : "text-green-100 hover:bg-green-800"
    }`;
    

  /*
   * CSS hamburger icon.
   *
   * No SVG / Lucide icon is used here.
   * This prevents the SVG from affecting responsive layout.
   */
  const HamburgerIcon = () => (
    <span className="relative block h-5 w-5 shrink-0" aria-hidden="true">
      <span
        className={`absolute left-0 top-1/2 block h-[2px] w-5 rounded-full bg-current transition-transform duration-200 ${
          mobileOpen ? "rotate-45" : "-translate-y-[6px]"
        }`}
      />

      <span
        className={`absolute left-0 top-1/2 block h-[2px] w-5 rounded-full bg-current transition-opacity duration-200 ${
          mobileOpen ? "opacity-0" : "opacity-100"
        }`}
      />

      <span
        className={`absolute left-0 top-1/2 block h-[2px] w-5 rounded-full bg-current transition-transform duration-200 ${
          mobileOpen ? "-rotate-45" : "translate-y-[6px]"
        }`}
      />
    </span>
  );

  /*
   * Profile section
   */
  const renderProfile = () => (
    <NavLink
      to="/citizen-dashboard/citizen-profile"
      onClick={closeMobileMenu}
      className="mb-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/10 p-3 transition hover:bg-white/15"
    >
      {profileImageUrl && failedImageUrl !== profileImageUrl ? (
        <img
          src={profileImageUrl}
          alt={`${displayName}'s profile`}
          onError={() => setFailedImageUrl(profileImageUrl)}
          className="h-11 w-11 shrink-0 rounded-full border-2 border-white/70 object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-[#38684e]">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">
          {displayName}
        </span>

        <span className="text-xs text-green-100">View Profile</span>
      </div>
    </NavLink>
  );

  /*
   * Navigation
   */
  const renderNavigation = () => (
    <nav className="space-y-5">
      {/* =========================
          FEED
          ========================= */}
      <div>
        <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-green-100/70">
          Feed
        </h3>

        <div className="mb-2 border-t border-white/20" />

        <NavLink
          to="/citizen-dashboard"
          end
          onClick={closeMobileMenu}
          className={navLinkClass}
        >
          <LayoutDashboard /> My Feed
        </NavLink>
      </div>

      {/* =========================
          DISCOVER MORE
          ========================= */}
      <div>
        <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-green-100/70">
          Discover More
        </h3>

        <div className="mb-2 border-t border-white/20" />

        <NavLink
          to="/citizen-dashboard/trending"
          onClick={closeMobileMenu}
          className={navLinkClass}
        >
          <FileText />
          Trending Reports
        </NavLink>

        <NavLink to="/map" onClick={closeMobileMenu} className={navLinkClass}>
          <span className="w-5 text-center" aria-hidden="true">
            <MapIcon />
          </span>
          Explore Map
        </NavLink>
      </div>

      {/* =========================
          MY ACTIVITY
          ========================= */}
      <div>
        <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-green-100/70">
          My Activity
        </h3>

        <div className="mb-2 border-t border-white/20" />

        <NavLink
          to="/citizen-dashboard/citizen-profile#my-posts"
          onClick={closeMobileMenu}
          className={navLinkClass}
        >
          <FileText />
          My Reports
        </NavLink>
      </div>

      {/* =========================
          ACCOUNT
          ========================= */}
      <div>
        <h3 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-green-100/70">
          Account
        </h3>

        <div className="mb-2 border-t border-white/20" />

        <NavLink
          to="/citizen-dashboard/citizen-profile"
          onClick={closeMobileMenu}
          className={navLinkClass}
        >
          <Users />
          My Profile
        </NavLink>

        <NavLink
          to="/citizen-dashboard/notification"
          onClick={closeMobileMenu}
          className={navLinkClass}
        >
          <Bell /> Notifications
        </NavLink>

        <NavLink
          to="/citizen-dashboard/settings"
          onClick={closeMobileMenu}
          className={navLinkClass}
        >
          <Settings />
          Settings
        </NavLink>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/90 transition-colors duration-200 hover:bg-red-600 hover:text-white active:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-green-900"
        >
          <LogOut /> Logout
        </button>
      </div>
    </nav>
  );

  return (
    <>
      {/* =========================================================
          MOBILE MENU BUTTON
          ========================================================= */}

      <button
        type="button"
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((previous) => !previous)}
        className="
    fixed
    left-4
    top-24
    z-[100]
    flex
    h-10
    w-10
    items-center
    justify-center
    rounded-lg
    bg-[#38684e]
    text-white
    transition-colors
    duration-200
    hover:bg-[#2d553e]
    active:scale-95
    md:hidden
  "
      >
        <HamburgerIcon />
      </button>

      {/* =========================================================
          MOBILE OVERLAY
          ========================================================= */}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={closeMobileMenu}
          className="
            fixed
            inset-0
            z-40
            bg-black/50
            backdrop-blur-[1px]
            md:hidden
          "
        />
      )}

      {/* =========================================================
          DESKTOP SIDEBAR
          ========================================================= */}

      <aside
        className="
          fixed
          left-0
          top-20
          z-30
          hidden
          h-[calc(100vh-5rem)]
          w-64
          overflow-y-auto
        border-gray-200 bg-green-900 transition-transform duration-200
          p-4
          md:block
        "
      >
        {renderProfile()}
        {renderNavigation()}
      </aside>

      {/* =========================================================
          MOBILE SIDEBAR
          ========================================================= */}

      <aside
        aria-label="Citizen navigation"
        className={`
          fixed
          bottom-0
          left-0
          top-0
          z-[70]
          w-[min(18rem,85vw)]
          overflow-y-auto
          bg-[#38684e]
          p-4
          pt-6
          shadow-2xl
          transition-transform
          duration-300
          ease-in-out
          md:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Mobile sidebar header */}
        <div className="mb-5 flex items-center justify-between">
          <span className="text-lg font-bold text-white">CivicFix</span>

          <button
            type="button"
            onClick={closeMobileMenu}
            aria-label="Close navigation"
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              text-white
              transition
              hover:bg-white/10
              active:scale-95
            "
          >
            <span className="relative block h-5 w-5" aria-hidden="true">
              <span className="absolute left-0 top-1/2 block h-[2px] w-5 rotate-45 rounded-full bg-current" />
              <span className="absolute left-0 top-1/2 block h-[2px] w-5 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
        </div>

        {renderProfile()}
        {renderNavigation()}
      </aside>
    </>
  );
};

export default DashboardSidebar;

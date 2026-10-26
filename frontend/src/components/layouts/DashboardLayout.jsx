
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import DashboardNavbar from "../../components/dashboard/DashboardNavbar";
import DashboardSidebar from "../dashboard/DashboardSidebar";

const DashboardLayout = () => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isProfilePage =
    location.pathname === "/citizen-dashboard/citizen-profile";

  const isHelpPage =
    location.pathname === "/citizen-dashboard/help";

  const hideSidebar = isProfilePage || isHelpPage;

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-gray-50">
      {/* Navbar */}
      <DashboardNavbar />

      <div className="relative w-full">
        {/* Sidebar */}
        {!hideSidebar && (
          <DashboardSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
          />
        )}

        {/* Main Content */}
        <main
          className={`
            min-h-[calc(100vh-4rem)]
            min-w-0
            w-full
            ${hideSidebar
              ? "px-3 py-4 sm:px-5 sm:py-6 lg:px-8"
              : `px-3 py-4 sm:px-5 sm:py-6 md:px-6 lg:px-8 ${
                  sidebarCollapsed
                    ? "md:ml-20 md:w-[calc(100%-5rem)]"
                    : "md:ml-64 md:w-[calc(100%-16rem)]"
                }`
            }
          `}
        >
          <div className="mx-auto w-full min-w-0 max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

import { Outlet } from "react-router-dom";
import PublicNavbar from "../common/PublicNavbar";
import Footer from "../common/PublicFooter";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";

const PublicLayout = () => {
  const { settings } = useSiteSettings();
  return (
    <>
      <PublicNavbar />
      {settings.maintenanceMode && (
        <div
          role="status"
          className="bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900"
        >
          {settings.maintenanceMessage}
        </div>
      )}
      <Outlet />
      <Footer />
    </>
  );
};

export default PublicLayout;

import { FaWhatsapp } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";

const WhatsAppButton = () => {
  const { settings } = useSiteSettings();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const whatsappNumber = String(settings.whatsappNumber || "").replace(
    /\D/g,
    "",
  );

  const isPublicPage = [
    "/",
    "/map",
    "/about-us",
    "/contact-us",
    "/select-account-type",
  ].includes(pathname);
  const isCitizenDashboard =
    user?.role === "citizen" && pathname.startsWith("/citizen-dashboard");
  const isWardOfficialDashboard =
    user?.role === "ward_official" && pathname.startsWith("/ward-official");

  if (!(isPublicPage || isCitizenDashboard || isWardOfficialDashboard)) {
    return null;
  }

  const message = encodeURIComponent("Hello CivicFix, I need assistance.");
  const className =
    "fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#20BA5A] focus:outline-none focus:ring-4 focus:ring-green-300 sm:bottom-6 sm:right-6";

  if (!whatsappNumber) {
    return (
      <button
        type="button"
        disabled
        aria-label="WhatsApp support number is not configured"
        title="WhatsApp support number is not configured"
        className={`${className} cursor-not-allowed`}
      >
        <FaWhatsapp size={32} aria-hidden="true" />
      </button>
    );
  }

  return (
    <a
      href={`https://wa.me/${whatsappNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with CivicFix on WhatsApp"
      title="Chat with us on WhatsApp"
      className={className}
    >
      <FaWhatsapp size={32} aria-hidden="true" />
    </a>
  );
};

export default WhatsAppButton;

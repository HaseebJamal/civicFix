import { NavLink } from "react-router-dom";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";
import { siteAssetUrl } from "../../utils/siteAssetUrl.js";

const Footer = () => {
  const { settings } = useSiteSettings();
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <NavLink
              to="/"
              className="inline-block text-2xl font-bold tracking-tight text-gray-900"
              aria-label={`${settings.siteName} Home`}
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
                  className="mr-2 inline-block h-8 max-w-28 object-contain align-middle"
                />
              )}
              {settings.siteName}
            </NavLink>

            <p className="mt-3 max-w-xs text-sm leading-6 text-gray-600">
              {settings.tagline} Helping citizens report civic issues and build
              stronger communities.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-gray-900">Quick Links</h3>

            <ul className="mt-4 space-y-3 text-sm text-gray-600">
              <li>
                <NavLink to="/" className="transition hover:text-green-700">
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/map" className="transition hover:text-green-700">
                  Explore Map
                </NavLink>
              </li>
              <li>
                <NavLink to="/about-us" className="transition hover:text-green-700">
                  About Us
                </NavLink>
              </li>
              <li>
                <NavLink to="/contact-us" className="transition hover:text-green-700">
                  Contact Us
                </NavLink>
              </li>
              
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold text-gray-900">Your Account</h3>

            <ul className="mt-4 space-y-3 text-sm text-gray-600">
              <li>
                <NavLink
                  to="/login"
                  className="transition hover:text-green-700"
                >
                  Login
                </NavLink>
              </li>
              {settings.allowRegistration && (
                <li>
                  <NavLink
                    to="/signup"
                    className="transition hover:text-green-700"
                  >
                    Sign Up
                  </NavLink>
                </li>
              )}
            </ul>
          </div>

          {/* Mission */}
          <div>
            <h3 className="font-semibold text-gray-900">Our Mission</h3>

            <p className="mt-4 text-sm leading-6 text-gray-600">
              Connecting citizens and local authorities to make civic
              problem-solving more transparent and effective.
            </p>
            {(settings.supportEmail ||
              settings.supportPhone ||
              settings.whatsappNumber ||
              settings.location ||
              settings.workingHours) && (
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                {settings.location && <p>{settings.location}</p>}
                {settings.workingHours && <p>{settings.workingHours}</p>}
                {settings.supportEmail && (
                  <a
                    href={`mailto:${settings.supportEmail}`}
                    className="block transition hover:text-green-700"
                  >
                    {settings.supportEmail}
                  </a>
                )}
                {settings.supportPhone && (
                  <a
                    href={`tel:${settings.supportPhone}`}
                    className="block transition hover:text-green-700"
                  >
                    {settings.supportPhone}
                  </a>
                )}
                {settings.whatsappNumber && (
                  <a
                    href={`https://wa.me/${settings.whatsappNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block transition hover:text-green-700"
                  >
                    WhatsApp support
                  </a>
                )}
              </div>
            )}
            {(settings.facebookUrl ||
              settings.instagramUrl ||
              settings.xUrl) && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {[
                  ["Facebook", settings.facebookUrl],
                  ["Instagram", settings.instagramUrl],
                  ["X", settings.xUrl],
                ]
                  .filter(([, href]) => href)
                  .map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="transition hover:opacity-75"
                      style={{ color: settings.primaryColor }}
                    >
                      {label}
                    </a>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-gray-200 pt-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settings.siteName}. All rights
            reserved.
          </p>

          <p>Built for better communities.</p>
        </div>
        {(settings.privacyPolicyUrl || settings.termsUrl) && (
          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            {settings.privacyPolicyUrl && (
              <a href={settings.privacyPolicyUrl} className="hover:underline">
                Privacy
              </a>
            )}
            {settings.termsUrl && (
              <a href={settings.termsUrl} className="hover:underline">
                Terms
              </a>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};

export default Footer;
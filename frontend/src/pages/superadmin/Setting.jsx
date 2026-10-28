import { useEffect, useState } from "react";
import {
  Globe2,
  Image,
  LoaderCircle,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import api from "../../api/axios.js";
import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";
import { defaultSiteSettings } from "../../context/siteSettingsDefaults.js";
// import { siteAssetUrl } from "../../utils/siteAssetUrl.js";

const Toggle = ({ checked, description, label, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-4">
    <div>
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-green-600" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  </div>
);

const Field = ({
  hint,
  label,
  name,
  onChange,
  placeholder,
  required = false,
  type = "text",
  value,
}) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-gray-700">
      {label}
    </span>
    <input
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
    />
    {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
  </label>
);

const Setting = () => {
  const { setSettings: setPublicSettings } = useSiteSettings();
  const [settings, setSettings] = useState(defaultSiteSettings);
  const [loading, setLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/site-settings", { signal: controller.signal })
      .then((response) => {
        const savedSettings = response.data?.data?.settings;
        if (!savedSettings) {
          throw new Error("The settings response has an unexpected format.");
        }
        setSettings({ ...defaultSiteSettings, ...savedSettings });
        setSettingsLoaded(true);
      })
      .catch((requestError) => {
        if (requestError.name === "CanceledError") return;
        console.error("Superadmin site settings load failed:", requestError);
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load website settings.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [loadAttempt]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSettings((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handleAssetUpload = async (event, assetType) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("assetType", assetType);
    setUploadingAsset(assetType);
    setError("");
    setSuccess("");

    try {
      const response = await api.post("/site-settings/assets", formData);
      const uploadedSettings = response.data?.data?.settings;
      if (!uploadedSettings) {
        throw new Error("The uploaded asset response has an unexpected format.");
      }

      setSettings((current) => ({ ...current, ...uploadedSettings }));
      setSuccess(
        `${assetType === "logo" ? "Logo" : "Favicon"} uploaded. Save settings to publish it.`,
      );
    } catch (uploadError) {
      console.error(`Website ${assetType} upload failed:`, uploadError);
      setError(
        uploadError.response?.data?.message ||
          uploadError.message ||
          `Unable to upload the ${assetType}.`,
      );
    } finally {
      setUploadingAsset("");
    }
  };

  const toggleSetting = (name) => {
    setSettings((current) => ({ ...current, [name]: !current[name] }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.put("/site-settings", { settings });
      const savedSettings = response.data?.data?.settings;
      if (!savedSettings) {
        throw new Error("The saved settings response has an unexpected format.");
      }
      const nextSettings = { ...defaultSiteSettings, ...savedSettings };
      setSettings(nextSettings);
      setPublicSettings((current) => ({ ...current, ...nextSettings }));
      setSuccess(response.data?.message || "Website settings saved.");
    } catch (saveError) {
      console.error("Superadmin site settings save failed:", saveError);
      setError(
        saveError.response?.data?.message ||
          saveError.message ||
          "Unable to save website settings.",
      );
    } finally {
      setSaving(false);
    }
  };

 const logoPreview = settings.logoSvg?.trim()
  ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      settings.logoSvg
    )}`
  : settings.logoUrl?.trim() || "";

const faviconPreview = settings.faviconUrl?.trim() || "";

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Website Settings
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage global branding, preferences, contact details, and site
            availability.
          </p>
        </div>
        <button
          type="submit"
          form="site-settings-form"
          disabled={loading || saving || Boolean(uploadingAsset) || !settingsLoaded}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <Save size={17} />
          )}
          {saving ? "Saving..." : "Save settings"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
          {!settingsLoaded && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setLoading(true);
                setLoadAttempt((attempt) => attempt + 1);
              }}
              className="font-semibold underline underline-offset-2"
            >
              Retry loading
            </button>
          )}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle size={16} className="animate-spin" />
          Loading saved settings...
        </div>
      )}

      <form
        id="site-settings-form"
        onSubmit={handleSubmit}
      >
        <fieldset
          disabled={loading || saving || Boolean(uploadingAsset) || !settingsLoaded}
          className="space-y-6 disabled:opacity-70"
        >
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Image size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">Branding</h2>
              <p className="text-sm text-gray-500">
                Set the name, logo, favicon, and primary brand color.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Website name"
              name="siteName"
              required
              value={settings.siteName}
              onChange={handleChange}
              placeholder="CivicFix"
            />
            <Field
              label="Tagline"
              name="tagline"
              value={settings.tagline}
              onChange={handleChange}
              placeholder="Better cities, together."
            />
            <Field
              label="Logo image URL"
              name="logoUrl"
              value={settings.logoUrl}
              onChange={handleChange}
              placeholder="https://example.com/logo.png"
              hint="Use an HTTPS URL or a path on this website. SVG logos can be pasted below."
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Upload logo file
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
                disabled={Boolean(uploadingAsset)}
                onChange={(event) => handleAssetUpload(event, "logo")}
                className="block w-full rounded-lg border border-gray-300 bg-white text-sm text-gray-700 file:mr-3 file:border-0 file:bg-gray-100 file:px-3 file:py-2.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-60"
              />
              <span className="mt-1 block text-xs text-gray-500">
                PNG, JPEG, WEBP, or SVG; maximum 5 MB.
                {uploadingAsset === "logo" && " Uploading..."}
              </span>
            </label>
            <Field
              label="Favicon URL"
              name="faviconUrl"
              value={settings.faviconUrl}
              onChange={handleChange}
              placeholder="/favicon.ico"
              hint="Use an HTTPS URL or a path on this website."
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Upload favicon file
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/x-icon,.ico,.svg"
                disabled={Boolean(uploadingAsset)}
                onChange={(event) => handleAssetUpload(event, "favicon")}
                className="block w-full rounded-lg border border-gray-300 bg-white text-sm text-gray-700 file:mr-3 file:border-0 file:bg-gray-100 file:px-3 file:py-2.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-60"
              />
              <span className="mt-1 block text-xs text-gray-500">
                PNG, JPEG, ICO, or SVG; maximum 5 MB.
                {uploadingAsset === "favicon" && " Uploading..."}
              </span>
            </label>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              {faviconPreview ? (
                <img
                  src={faviconPreview}
                  alt="Favicon preview"
                  className="h-8 w-8 object-contain"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded bg-gray-200 text-xs text-gray-500">
                  F
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">
                  Favicon preview
                </p>
                <p className="truncate text-xs text-gray-500">
                  {faviconPreview || "Default website icon"}
                </p>
              </div>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Primary color
              </span>
              <span className="flex gap-3">
                <input
                  type="color"
                  name="primaryColor"
                  value={settings.primaryColor}
                  onChange={handleChange}
                  aria-label="Primary brand color"
                  className="h-11 w-14 cursor-pointer rounded border border-gray-300 bg-white p-1"
                />
                <input
                  name="primaryColor"
                  value={settings.primaryColor}
                  onChange={handleChange}
                  pattern="#[0-9a-fA-F]{6}"
                  aria-label="Primary color hex value"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
              </span>
            </label>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Website logo preview"
                    className="max-h-12 max-w-[4.5rem] object-contain"
                  />
                ) : (
                  <span className="text-xs text-gray-400">No logo</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-700">
                  Live preview
                </p>
                <p className="truncate text-xs text-gray-500">
                  {settings.siteName || "Website name"}
                </p>
              </div>
            </div>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                SVG logo markup
              </span>
              <textarea
                name="logoSvg"
                value={settings.logoSvg}
                onChange={handleChange}
                rows={5}
                maxLength={20000}
                placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>'
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Basic SVG shapes and paths are supported. Scripts, links, and
                event handlers are rejected. When supplied, this SVG is used
                instead of the logo URL.
              </span>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-2 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
              <Settings2 size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">Site preferences</h2>
              <p className="text-sm text-gray-500">
                Configure registration, maintenance, language, and email
                notifications.
              </p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            <Toggle
              checked={settings.allowRegistration}
              label="Allow new registrations"
              description="Show public sign-up links and allow new account registrations."
              onChange={() => toggleSetting("allowRegistration")}
            />
            <Toggle
              checked={settings.maintenanceMode}
              label="Maintenance notice"
              description="Display a maintenance notice across public pages."
              onChange={() => toggleSetting("maintenanceMode")}
            />
            <Toggle
              checked={settings.emailNotifications}
              label="Site email notifications"
            description="Send non-essential report status emails to citizens."
              onChange={() => toggleSetting("emailNotifications")}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Maintenance message"
              name="maintenanceMessage"
              value={settings.maintenanceMessage}
              onChange={handleChange}
              placeholder="We will be back soon."
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                Default language
              </span>
              <select
                name="defaultLanguage"
                value={settings.defaultLanguage}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
              >
                <option value="en">English</option>
                <option value="ur">Urdu</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <Globe2 size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">Contact &amp; links</h2>
              <p className="text-sm text-gray-500">
                Update support channels, policy pages, and social links.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Support email"
              name="supportEmail"
              type="email"
              value={settings.supportEmail}
              onChange={handleChange}
              placeholder="support@example.com"
            />
            <Field
              label="Support phone"
              name="supportPhone"
              type="tel"
              value={settings.supportPhone}
              onChange={handleChange}
              placeholder="+92 300 1234567"
            />
            <Field
              label="WhatsApp number"
              name="whatsappNumber"
              value={settings.whatsappNumber}
              onChange={handleChange}
              placeholder="923001234567"
              hint="Include country code; digits only, no plus sign or spaces."
            />
            <Field
              label="Our location"
              name="location"
              value={settings.location}
              onChange={handleChange}
              placeholder="Faisalabad, Pakistan"
            />
            <Field
              label="Working hours"
              name="workingHours"
              value={settings.workingHours}
              onChange={handleChange}
              placeholder="Monday - Friday, 9 AM - 5 PM"
            />
            <Field
              label="Privacy policy URL"
              name="privacyPolicyUrl"
              value={settings.privacyPolicyUrl}
              onChange={handleChange}
              placeholder="/privacy"
            />
            <Field
              label="Terms of service URL"
              name="termsUrl"
              value={settings.termsUrl}
              onChange={handleChange}
              placeholder="/terms"
            />
            <Field
              label="Facebook URL"
              name="facebookUrl"
              value={settings.facebookUrl}
              onChange={handleChange}
              placeholder="https://facebook.com/..."
            />
            <Field
              label="Instagram URL"
              name="instagramUrl"
              value={settings.instagramUrl}
              onChange={handleChange}
              placeholder="https://instagram.com/..."
            />
            <Field
              label="X URL"
              name="xUrl"
              value={settings.xUrl}
              onChange={handleChange}
              placeholder="https://x.com/..."
            />
          </div>
        </section>

        <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            Website settings are stored centrally. Only superadmins can change
            them; public pages receive only the settings needed for branding
            and site availability.
          </p>
        </div>
        </fieldset>
      </form>
    </section>
  );
};

export default Setting;
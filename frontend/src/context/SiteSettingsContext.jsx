import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/axios.js";
import { defaultSiteSettings } from "./siteSettingsDefaults.js";
// import { siteAssetUrl } from "../utils/siteAssetUrl.js";

const SiteSettingsContext = createContext(null);

export const SiteSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSiteSettings);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/site-settings/public", { signal: controller.signal })
      .then((response) => {
        const savedSettings = response.data?.data?.settings;
        console.log("Public site settings:", savedSettings);

        if (savedSettings && !controller.signal.aborted) {
          setSettings((current) => ({ ...current, ...savedSettings }));
        }
      })
      .catch((error) => {
        if (error.name === "CanceledError") return;
        console.error("Public site settings load failed:", error);
        if (!controller.signal.aborted) {
          setLoadError(
            error.response?.data?.message ||
              "Website settings could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.title = settings.siteName || defaultSiteSettings.siteName;
    document.documentElement.lang =
      settings.defaultLanguage || defaultSiteSettings.defaultLanguage;

    const faviconUrl = settings.faviconUrl?.trim() || "";
    let favicon = document.querySelector('link[rel="icon"]');
    if (faviconUrl) {
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.href = faviconUrl;
    } else {
      favicon?.remove();
    }

    document.documentElement.style.setProperty(
      "--site-primary-color",
      settings.primaryColor || defaultSiteSettings.primaryColor,
    );
  }, [settings]);

  return (
    <SiteSettingsContext.Provider
      value={{ settings, setSettings, loading, loadError }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSiteSettings = () => {
  const context = useContext(SiteSettingsContext);
  return (
    context || {
      settings: defaultSiteSettings,
      setSettings: () => {},
      loading: false,
      loadError: "",
    }
  );
};

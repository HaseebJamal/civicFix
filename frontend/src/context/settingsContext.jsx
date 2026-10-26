import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../api/axios.js";

const STORAGE_KEY = "civicfix:settings";

const defaultSettings = {
  notification: true,
  emailNotification: false,
  location: true,
  nearbyIssues: true,
  theme: false,
};

// Backend snake_case -> local camelCase
const fromApi = (saved = {}) => ({
  notification:
    typeof saved.notification === "boolean"
      ? saved.notification
      : defaultSettings.notification,
  emailNotification:
    typeof saved.email_notification === "boolean"
      ? saved.email_notification
      : defaultSettings.emailNotification,
  location:
    typeof saved.location_access === "boolean"
      ? saved.location_access
      : defaultSettings.location,
  nearbyIssues:
    typeof saved.nearby_issues === "boolean"
      ? saved.nearby_issues
      : defaultSettings.nearbyIssues,
  theme:
    typeof saved.dark_theme === "boolean"
      ? saved.dark_theme
      : defaultSettings.theme,
});

// Local camelCase -> backend snake_case
const toApi = (s) => ({
  notification: s.notification,
  email_notification: s.emailNotification,
  location_access: s.location,
  nearby_issues: s.nearbyIssues,
  dark_theme: s.theme,
});

// Extract settings from any common response shape
const extract = (resp) =>
  resp?.data?.data ?? resp?.data?.settings ?? resp?.data ?? null;

const readCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return null;
  }
};

const writeCache = (s) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota errors */
  }
};

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  // Initialize from localStorage so first paint is correct (no flash)
  const [settings, setSettings] = useState(() => readCache() ?? defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Apply theme globally on every change
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme);
    writeCache(settings);
  }, [settings]);

  // Load from backend once
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await api.get("/users/settings");
        const saved = extract(resp);
        if (saved && mounted) {
          setSettings((prev) => ({ ...prev, ...fromApi(saved) }));
        }
      } catch (err) {
        console.error("Settings load failed:", err.response?.data ?? err);
        // keep localStorage cache — app still works
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggle = useCallback((key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const save = useCallback(async (snapshot = settings) => {
    setSaving(true);
    try {
      const resp = await api.put("/users/settings", toApi(snapshot));
      const saved = extract(resp);
      if (saved) {
        setSettings((prev) => ({ ...prev, ...fromApi(saved) }));
      }
      return { ok: true };
    } catch (err) {
      // Roll back to last persisted snapshot? We keep the optimistic state
      // but return error so UI can inform the user.
      return {
        ok: false,
        message:
          err.response?.data?.message ||
          "Unable to save settings. Please try again.",
      };
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const reset = useCallback(() => setSettings(defaultSettings), []);

  return (
    <SettingsContext.Provider
      value={{ settings, loading, saving, toggle, updateSettings, save, reset }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// Keep the context hook alongside its provider so both share one context instance.
// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
};
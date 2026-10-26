import { useState } from "react";
import api from "../../api/axios.js";
import { useSettings } from "../../context/settingsContext.jsx";

const Toggle = ({ checked, disabled, label, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
      checked ? "bg-green-600" : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

const PasswordField = ({
  autoComplete,
  hint,
  label,
  minLength,
  name,
  onChange,
  required = true,
  value,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </span>
      <span className="relative block">
        <input
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          value={value}
          onChange={onChange}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-11 text-sm text-gray-900 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-600"
        >
          {visible ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
              <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.3 4.5 9 7-.3 1.1-1 2.2-2 3.2" />
              <path d="M6.6 6.6C4.6 7.8 3.4 9.6 3 12c.7 2.5 4 7 9 7 1.2 0 2.3-.3 3.3-.7" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
};

export const Setting = () => {
  const { settings, loading, saving, updateSettings, save } = useSettings();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const handleToggle = async (key) => {
    setSettingsError("");
    const previousSettings = settings;
    const nextSettings = { ...settings, [key]: !settings[key] };

    updateSettings({ [key]: nextSettings[key] });
    const result = await save(nextSettings);

    if (!result.ok) {
      updateSettings({ [key]: previousSettings[key] });
      setSettingsError(result.message);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8) {
      setPasswordError("Your new password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError(
        "Choose a new password different from your current one.",
      );
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await api.patch("/users/updatepassword", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(
        response.data?.message || "Your password was changed successfully.",
      );
    } catch (error) {
      setPasswordError(
        error.response?.data?.message ||
          "Unable to change your password. Please try again.",
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your appearance, notifications, and account security.
        </p>
      </header>
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>
          <p className="mt-1 text-sm text-gray-600">
            Changes are saved automatically.
          </p>
        </div>

        {settingsError && (
          <p
            className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {settingsError}
          </p>
        )}

        <div className="divide-y divide-gray-100">
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Dark mode</h3>
              <p className="mt-1 text-sm text-gray-600">
                Use a darker appearance across the app.
              </p>
            </div>
            <Toggle
              checked={settings.theme}
              disabled={loading || saving}
              label="Dark mode"
              onChange={() => handleToggle("theme")}
            />
          </div>

          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Notifications
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                Turn CivicFix notifications on or off.
              </p>
            </div>
            <Toggle
              checked={settings.notification}
              disabled={loading || saving}
              label="Notifications"
              onChange={() => handleToggle("notification")}
            />
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Change password
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Enter your current password and choose a new password.
          </p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="w-full max-w-[280px]">
            <PasswordField
              label="Current password"
              name="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>

          <div className="w-full max-w-[280px]">
            <PasswordField
              label="New password"
              name="newPassword"
              autoComplete="new-password"
              minLength={8}
              hint="Use at least 8 characters."
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>

          <div className="w-full max-w-[280px]">
            <PasswordField
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>

          {passwordError && (
            <p className="text-sm text-red-600" role="alert">
              {passwordError}
            </p>
          )}

          {passwordSuccess && (
            <p className="text-sm text-green-700" role="status">
              {passwordSuccess}
            </p>
          )}

          <button
            type="submit"
            disabled={passwordLoading}
            className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {passwordLoading ? "Updating password..." : "Update password"}
          </button>
        </form>
      </section>
    </section>
  );
};

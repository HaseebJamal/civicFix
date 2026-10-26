import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Swal from "sweetalert2";

const SetNewPassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const location = useLocation();
  const navigate = useNavigate();

  const resetToken = location.state?.resetToken;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!resetToken) {
      setErrorMessage(
        "Your reset session has expired. Please request a new OTP."
      );
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await api.post(
        "/users/resetpassword",
        {
          resetToken,
          newPassword,
        },
        { timeout: 15000 }
      );

      await Swal.fire({
        icon: "success",
        title: "Password Updated",
        text: response.data.message || "Your password has been reset successfully.",
        confirmButtonColor: "#16a34a",
      });

      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Password reset error:", error);

      setErrorMessage(
        error.response?.data?.message ||
          (error.code === "ECONNABORTED"
            ? "The password reset request timed out. Please try again."
            : error.response
              ? "Unable to reset your password. Please try again."
              : "Could not reach the server. Check your connection and try again.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!resetToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#dffded] p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-[#1c3026]">
            Reset Session Expired
          </h1>

          <p role="alert" className="mt-3 text-sm text-red-700">
            Please request a new OTP to reset your password.
          </p>

          <Link
            to="/forgot-password"
            className="mt-5 inline-block font-semibold text-green-700 hover:text-green-800"
          >
            Request a new OTP
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#dffded] p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-[#1c3026]">
          Set a New Password
        </h1>

        <p className="mt-3 text-sm text-gray-500">
          Choose a new password with at least 8 characters.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {errorMessage && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {errorMessage}
            </p>
          )}

          <div>
            <label
              htmlFor="new-password"
              className="mb-2 block font-semibold text-gray-700"
            >
              New Password
            </label>

            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setErrorMessage("");
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-2 block font-semibold text-gray-700"
            >
              Confirm New Password
            </label>

            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrorMessage("");
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              placeholder="Confirm new password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </section>
    </main>
  );
};

export default SetNewPassword;

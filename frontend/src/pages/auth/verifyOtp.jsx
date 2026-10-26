import { useNavigate } from "react-router-dom";
import { useState } from "react";
import api from "../../api/axios";
import Swal from "sweetalert2";
const VerifyOtp = () => {
  const navigate = useNavigate();

  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await api.post(
        "/users/verifyotp",
        {
          otp: otp.trim(),
        },
        { timeout: 15000 }
      );

      const resetToken = response.data.data?.resetToken;

      if (!resetToken) {
        throw new Error(
          "The server did not return a password reset token."
        );
      }

      await Swal.fire({
        icon: "success",
        title: "OTP Verified",
        text: response.data.message || "OTP verified successfully.",
        confirmButtonColor: "#16a34a",
      });

      navigate("/set-new-password", {
        state: { resetToken },
      });
    } catch (error) {
      console.error("OTP verification error:", error);

      setErrorMessage(
        error.response?.data?.message ||
          (error.message ===
          "The server did not return a password reset token."
            ? error.message
            : error.code === "ECONNABORTED"
              ? "The verification request timed out. Please try again."
              : error.response
                ? "Unable to verify OTP. Please try again."
                : "Could not reach the server. Check your connection and try again.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#dffded] p-4 md:p-8">
      <div className="grid min-h-[600px] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-2">

        {/* Left panel */}
        <div className="relative min-h-[250px] md:min-h-full">
          <img
            src="/streetview2.jpg"
            alt="CivicFix community"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-green-950/60">
            <div className="relative z-10 flex h-full flex-col justify-end p-8 md:p-12">
              <h2 className="text-3xl font-bold leading-tight text-white md:text-4xl">
                Let's Build
                <br />
                A New World
                <br />
                With You
              </h2>

              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 md:text-base">
                Together, we can build a better world by connecting
                communities, reporting local issues, and taking action
                to create cleaner, safer, and happier neighborhoods
                for everyone.
              </p>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex items-center justify-center p-6 md:p-8 lg:p-10">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-bold text-[#1c3026]">
              Verify OTP
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Enter the verification code sent to your registered
              email address.
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
                  htmlFor="verify_otp"
                  className="mb-2 block font-semibold text-gray-700"
                >
                  Verification Code{" "}
                  <span className="text-red-500">*</span>
                </label>

                <input
                  id="verify_otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value);
                    setErrorMessage("");
                  }}
                  placeholder="Enter OTP"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !otp.trim()}
                className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Verifying..." : "Verify OTP"}
              </button>
            </form>
          </div>
        </div>

      </div>
    </section>
  );
};

export default VerifyOtp;

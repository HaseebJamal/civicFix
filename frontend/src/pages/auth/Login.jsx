import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const { setUser, setLocationPermission } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const response = await api.post("/users/login", {
        email: email.trim(),
        password,
      });
      const userData = response.data.data?.user;
      setUser(userData);

      await Swal.fire({
        icon: "success",
        title: "Login Successful",
        text: response.data.message || "Welcome to civifix",
        confirmButtonColor: "#16a34a",
      });

      setLocationPermission({ status: "pending", coordinates: null });
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            setLocationPermission({
              status: "granted",
              coordinates: {
                lat: coords.latitude,
                lng: coords.longitude,
              },
            });
          },
          () => {
            setLocationPermission({ status: "denied", coordinates: null });
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        );
      } else {
        setLocationPermission({ status: "denied", coordinates: null });
      }

      const role = userData?.role;
      if (role === "citizen") {
        navigate("/citizen-dashboard");
      } else if (role === "ward_official") {
        navigate("/ward-official");
      } else if (role === "superadmin") {
        navigate("/superadmin");
      } else {
        navigate("/page-not-found");
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: error.response?.data?.message || "Please try again",
        confirmButtonColor: "#16a34a",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  return (
    <section className="min-h-screen bg-[#dffded] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl min-h-[600px] grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-white rounded-2xl shadow-xl">
        {/* Left Side */}
        <div className="relative min-h-[200px] md:min-h-full">
          <img
            src="/streetview3.jpg"
            alt="CivicFix community"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-green-950/60" />

          <div className="relative z-10 flex h-full flex-col justify-end p-8 text-white md:p-12">
            <h2 className="text-3xl font-bold leading-tight md:text-4xl">
              Build Better
              <br />
              Communities
            </h2>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 md:text-base">
              Join CivicFix, report local issues, and help make your community a
              better place for everyone.
            </p>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex p-4 md:p-8 lg:p-10">
          <div className="w-full max-w-md">
            <div className="flex justify-end">
              <button
                onClick={() => navigate("/")}
                className="py-2 px-3 shadow-sm border bg-gray-100 rounded-md"
              >
                Back
              </button>{" "}
            </div>
            <h1 className="text-3xl font-bold text-[#1c3026]">Sign In</h1>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="block p-2 font-semibold">
                    Email <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter Email"
                    required
                    value={email}
                    onChange={handleEmailChange}
                    autoComplete="email"
                    className="max-w-sm w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block p-2 font-semibold">
                    Password <span className="text-red-500">*</span>
                  </label>

                  <div className="relative w-full max-w-sm">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter Your Password"
                      required
                      minLength={8}
                      value={password}
                      onChange={handlePasswordChange}
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-green-500"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-3 flex items-center text-xs font-medium text-gray-500"
                    >
                      {showPassword ? (
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
                        >
                          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex ">
                    <NavLink
                      to="/forgot-password"
                      className="text-sm font-medium text-green-700 hover:text-green-900 hover:underline"
                    >
                      Forgot Password?
                    </NavLink>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full max-w-sm rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                {isSubmitting ? "Login ..." : "Sign In"}
              </button>
            </form>
            <p className="mt-5 text-sm text-gray-500">
              Don't have an account?{" "}
              <NavLink
                to="/select-account-type"
                className="font-semibold text-green-700 hover:underline"
              >
                Sign up
              </NavLink>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Login;

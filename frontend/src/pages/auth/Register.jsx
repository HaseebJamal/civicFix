import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../../api/axios.js";
import { useAuth } from "../../context/AuthContext.jsx";
const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [validatePhoneNumber, setValidatePhoneNumber] = useState("");
  const [validateCnicNumber, setValidateCnicNumber] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [cnicNumber, setCnicNumber] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const selectedRole = location.state?.role;

  useEffect(() => {
    if (!["citizen", "ward_official"].includes(selectedRole)) {
      navigate("/select-account-type", { replace: true });
    }
  }, [selectedRole, navigate]);

  if (!["citizen", "ward_official"].includes(selectedRole)) {
    return null;
  }

  if (!selectedRole || !["citizen", "ward_official"].includes(selectedRole)) {
    navigate("/select-account-type", { replace: true });
    return null;
  }
  const handlePhoneNumber = (e) => {
    const value = e.target.value;
    const filteredValue = value.replace(/\D/g, "").slice(0, 15);
    if (/\D/.test(value)) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Character",
        text: "Only numbers are allowed in the phone number.",
        confirmButtonColor: "#16a34a",
      });
    }
    setValidatePhoneNumber(filteredValue);
    setPhoneNumber(filteredValue);
  };

  const handleCnicNumber = (e) => {
    const value = e.target.value;

    if (/[^0-9-]/.test(value)) {
      Swal.fire({
        icon: "warning",
        title: "Invalid Character",
        text: "Only numbers are allowed in CNIC.",
        confirmButtonColor: "#16a34a",
      });
    }

    const digits = value.replace(/\D/g, "").slice(0, 13);

    let formattedValue = digits;

    if (digits.length > 5) {
      formattedValue = digits.slice(0, 5) + "-" + digits.slice(5);
    }

    if (digits.length > 12) {
      formattedValue =
        digits.slice(0, 5) + "-" + digits.slice(5, 12) + "-" + digits.slice(12);
    }

    setValidateCnicNumber(formattedValue);
    setCnicNumber(formattedValue);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    const registrationData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: userName.trim(),
      email: email.trim(),
      password,
      role: selectedRole,
      cnic_number: cnicNumber,
      phone_number: phoneNumber || null,
      address: address.trim() || null,
    };

    try {
      setIsSubmitting(true);

      const response = await api.post("/users/register", registrationData);

      if (selectedRole === "citizen") {
        const registeredUser = response.data?.data?.user;

        if (!registeredUser) {
          throw new Error("Registration response did not include user data.");
        }

        setUser(registeredUser);

        await Swal.fire({
          icon: "success",
          title: "Registration Successful",
          text: "Your account has been created successfully.",
          confirmButtonColor: "#16a34a",
        });

        navigate("/citizen-dashboard", { replace: true });
      } else if (selectedRole === "ward_official") {
        await Swal.fire({
          icon: "success",
          title: "Registration Submitted",
          text:
            response.data?.message ||
            "Your account is awaiting admin approval.",
          confirmButtonColor: "#16a34a",
        });

        navigate("/", { replace: true });
      }
    } catch (error) {
      console.error("Registration failed:", error);
      console.error("Server response:", error.response?.data);

      await Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text:
          error.response?.data?.message || error.message || "Please try again.",
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-[#dffded] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-6xl min-h-[600px] grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Left Side */}
        <div className="relative min-h-[260px] md:min-h-full">
          <img
            src="/herosectionimg.jpg"
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

        {/* Right Side - Form */}
        <div className="flex p-4 md:p-8 lg:p-10">
          <div className="w-full max-w-md">
            <div className="flex justify-end">
              <button
                onClick={() => navigate("/login")}
                className="py-2 px-3 shadow-sm border bg-gray-100 rounded-md"
              >
                Back
              </button>{" "}
            </div>
            <h1 className="text-3xl font-bold text-[#1c3026]">
              Create Account
            </h1>

            <p className="mt-2 mb-8 text-sm text-gray-500">
              Register as{" "}
              <span className="font-semibold text-green-700">
                {selectedRole === "ward_official" ? "Ward Official" : "Citizen"}
              </span>
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="first_name" className="block p-2 font-semibold">
                  Name <span className="text-red-500">*</span>
                </label>

                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  placeholder="Enter Your Name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="first_name"
                  className="max-w-sm w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="block p-2 font-semibold">
                  Last Name <span className="text-red-500">*</span>
                </label>

                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  placeholder="Enter Your Last Name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="last_name"
                  className="max-w-sm w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label htmlFor="username" className="block p-2 font-semibold">
                  User Name <span className="text-red-500">*</span>
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Enter Username"
                  required
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  autoComplete="username"
                  className="max-w-sm w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>

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
                  onChange={(e) => setEmail(e.target.value)}
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
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm outline-none focus:border-green-500"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-green-600"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
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
              </div>

              <div>
                <label
                  htmlFor="cnic_number"
                  className="block p-2 font-semibold"
                >
                  CNIC Number <span className="text-red-500">*</span>
                </label>

                <input
                  id="cnic_number"
                  name="cnic_number"
                  type="text"
                  placeholder="12345-1234567-1"
                  pattern="[0-9]{5}-[0-9]{7}-[0-9]{1}"
                  title="Enter CNIC in 12345-1234567-1 format"
                  required
                  value={validateCnicNumber}
                  onChange={handleCnicNumber}
                  className="max-w-sm w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label
                  htmlFor="phone_number"
                  className="block p-2 font-semibold"
                >
                  Phone Number <span className="text-gray-500">(optional)</span>
                </label>

                <input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  placeholder="03XXXXXXXXX"
                  value={validatePhoneNumber}
                  onChange={handlePhoneNumber}
                  autoComplete="tel"
                  className="max-w-sm w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label htmlFor="address" className="block p-2 font-semibold">
                  Address <span className="text-gray-500">(optional)</span>
                </label>

                <input
                  id="address"
                  name="address"
                  type="text"
                  placeholder="Enter Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="text"
                  className="max-w-sm w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="max-w-sm w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                {isSubmitting ? " Creating account...." : "Signup"}
              </button>
            </form>

            <p className="mt-5 text-sm text-gray-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-semibold text-green-700 hover:underline"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
export default Register;

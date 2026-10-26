import { useState, useEffect } from "react";
import api from "../../api/axios";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [coolDown, setCoolDown] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate=useNavigate()
  useEffect(() => {
    if (coolDown <= 0) return;
    const timer = setTimeout(() => {
      setCoolDown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [coolDown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        setIsSubmitting(true)
        const response= await api.post("/users/forgot-password",{
            email:email.trim()
        })
        await Swal.fire({
            icon:"success",
            title:"Otp Sent Successfully",
            text:response.data.message||"A reset Otp is sent to your email",
            confirmButtonColor:"#16a34a"
        })

        navigate("/verify-otp", {
          state: { email: response.data.data?.email || email.trim() },
        })
        // TODO: call your API here to send reset instructions
        console.log("Reset link sent to:", email);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Invalid Email",
        text:
          error.response?.data?.message ||
          "Invalid Email or Email not registered",
        confirmButtonColor: "#16a34a",
      });
    }
    finally{
        setIsSubmitting(false)
    }
  };

  return (
    <section className="min-h-screen bg-[#dffded] flex items-center justify-center p-4 md:p-8">
      <div className="min-h-[600px] w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-white rounded-2xl shadow-xl">
        {/* Left panel */}
        <div className="relative min-h-[200px] md:min-h-full">
          <img
            src="/streetview2.jpg"
            alt="CivicFix community"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="bg-green-950/60 absolute inset-0">
            <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12">
              <h2 className="text-3xl font-bold leading-tight md:text-4xl text-white">
                Let's Build
                <br /> A New World <br />
                With You
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/90 md:text-base">
                Together, we can build a better world by connecting communities,
                reporting local issues, and taking action to create cleaner,
                safer, and happier neighborhoods for everyone.
              </p>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-col  p-4 md:p-8 lg:p-10">
            <div className="flex justify-end">
              <button
                onClick={() => navigate("/login")}
                className="py-2 px-3 shadow-sm border bg-gray-100 rounded-md"
              >
                Back
              </button>{" "}
            </div>
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-bold text-[#1c3026]">
              Forgot Password
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              Forgot your password? Enter your registered email address and
              we'll send you instructions to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="block p-2 font-semibold">
                  Email <span className="text-red-500">*</span>
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter Email"
                  required
                  autoComplete="email"
                  className="max-w-sm w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full max-w-sm rounded-lg bg-green-700 px-4 py-2 font-semibold text-white transition hover:bg-green-800"
              >
                {coolDown > 0 ? `Resend Otp in ${coolDown}` : `Send Otp`}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ForgotPassword;

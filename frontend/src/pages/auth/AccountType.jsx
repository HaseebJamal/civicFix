import { useNavigate } from "react-router-dom";
import { useState } from "react";
const AccountType = () => {
  const [selectedRole, setSelectedRole] = useState("citizen");
  const navigate = useNavigate();
  const handleContinue = () => {
    navigate("/signup", {
      state: { role: selectedRole },
    });
  };
  
  return (
    <section className="min-h-screen bg-[#dffded] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl md:p-10">
          <div className="flex justify-end">
              <button
                onClick={() => navigate("/")}
                className="py-2 px-3 shadow-sm border bg-gray-100 rounded-md"
              >
                Back
              </button>{" "}
            </div>
        <h1 className="text-center text-3xl font-bold text-[#1c3026]">
          Choose Account Type
        </h1>

        <p className="mt-3 text-center text-gray-500">
          Select the type of account you want to create.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setSelectedRole("citizen")}
            className={`rounded-xl border-2 p-6 text-left transition ${
              selectedRole === "citizen"
                ? "border-green-600 bg-[#dffded]"
                : "border-gray-200 hover:border-green-400"
            }`}
          >
            <h2 className="text-xl font-bold text-[#1c3026]">Citizen</h2>

            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Report local problems, upload photos, and track community issues.
            </p>

            <p className="mt-5 font-semibold text-green-700">
              {selectedRole === "citizen" ? "✓ Selected" : "Select Citizen"}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedRole("ward_official")}
            className={`rounded-xl border-2 p-6 text-left transition ${
              selectedRole === "ward_official"
                ? "border-green-600 bg-[#dffded]"
                : "border-gray-200 hover:border-green-400"
            }`}
          >
            <h2 className="text-xl font-bold text-[#1c3026]">Ward Official</h2>

            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Manage reports and update the status of issues in your assigned
              ward.
            </p>

            <p className="mt-5 font-semibold text-green-700">
              {selectedRole === "ward_official"
                ? "✓ Selected"
                : "Select Ward Official"}
            </p>
          </button>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          className="mt-8 w-full rounded-lg bg-[#1c3026] px-5 py-3 font-semibold text-white transition hover:bg-green-800"
        >
          Continue to Registration
        </button>

        <p className="mt-5 text-center text-sm text-gray-500">
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
    </section>
  );
};

export default AccountType;

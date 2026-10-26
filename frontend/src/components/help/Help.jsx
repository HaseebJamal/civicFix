import { useState } from "react";
import { NavLink } from "react-router-dom";
const howItWorks = {
  title: "How CivicFix Works",
  step: [
    {
      id: 1,
      title: "Report an Issue",
      description:
        "Spot a pothole, broken streetlight, or other civic problem? Submit a report with its location and details.",
      icon: "📝",
    },
    {
      id: 2,
      title: "Track Your Report",
      description:
        "View your submitted reports and check their current status and progress.",
      icon: "📍",
    },
    {
      id: 3,
      title: "See It Resolved",
      description:
        "Check status updates and see when your reported issue has been resolved.",
      icon: "✓",
    },
  ],
};

const faqs = [
  {
    id: 1,
    question: "How do I report a civic issue?",
    answer:
      "Open the Report page, select the appropriate category, provide the issue details, add its location, and submit your report.",
  },
  {
    id: 2,
    question: "How can I track my report?",
    answer:
      "Open your Reports section to view your submitted reports and their current statuses.",
  },
  {
    id: 3,
    question: "Why is the location important?",
    answer:
      "An accurate location helps identify where the issue occurred and makes it easier for the responsible team to find it.",
  },
  {
    id: 4,
    question: "How will I know when my report changes?",
    answer:
      "Check the Notifications section for updates about your report, when available.",
  },
];

const categories = [
  {
    id: 1,
    title: "Road & Potholes",
    description: "Report road damage and potholes.",
    color: "bg-[#FEE2E2]",
    icon: "🚧",
  },
  {
    id: 2,
    title: "Water Leakage & Drainage",
    description: "Report water leaks and drainage issues.",
    color: "bg-[#DBEAFE]",
    icon: "💧",
  },
  {
    id: 3,
    title: "Waste Management",
    description: "Report waste disposal and cleanliness issues.",
    color: "bg-[#D1FAE5]",
    icon: "🗑️",
  },
  {
    id: 4,
    title: "Streetlights",
    description: "Report broken or non-functional streetlights.",
    color: "bg-[#FEF3C7]",
    icon: "💡",
  },
];

export const Help = () => {
  const [isSearch, setIsSearch] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

  const searchTerm = isSearch.trim().toLowerCase();

  const filteredCategories = categories.filter((category) =>
    `${category.title} ${category.description}`
      .toLowerCase()
      .includes(searchTerm),
  );

  const filteredFaqs = faqs.filter((faq) =>
    `${faq.question} ${faq.answer}`.toLowerCase().includes(searchTerm),
  );

  const handleSearchChange = (e) => {
    setIsSearch(e.target.value);
    setOpenFaq(null);
  };

  const clearSearch = () => {
    setIsSearch("");
    setOpenFaq(null);
  };

  return (
    <>
      {/* Hero / Search Section */}
      <section className="w-full border-b border-gray-300 bg-[#dffded] px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-6 flex justify-center">
            <span className="rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white">
              Help Center
            </span>
          </div>

          <div className="flex flex-col items-center justify-center px-2 text-center">
            <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
              How Can We Help?
            </h1>

            <p className="mt-4 text-sm text-gray-600 md:text-base">
              Find answers to your questions about CivicFix.
            </p>

            <div className="mt-6 w-full max-w-2xl">
              <label htmlFor="help-search" className="sr-only">
                Search help topics
              </label>

              <input
                id="help-search"
                type="search"
                value={isSearch}
                onChange={handleSearchChange}
                placeholder="Search reports, categories, FAQs..."
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              />

              {searchTerm && (
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <p className="text-gray-600">
                    {filteredCategories.length + filteredFaqs.length} matching
                    result(s)
                  </p>

                  <button
                    type="button"
                    onClick={clearSearch}
                    className="font-semibold text-green-700 hover:text-green-900"
                  >
                    Clear search ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* How CivicFix Works */}
      <section className="w-full bg-white px-4 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-9 flex flex-col items-center gap-2 text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
              New to CivicFix?
            </span>

            <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
              {howItWorks.title}
            </h2>

            <p className="max-w-xl text-sm leading-6 text-gray-500 md:text-base">
              Learn how to report civic issues, track your reports, and
              contribute to a better community.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {howItWorks.step.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 text-4xl" aria-hidden="true">
                  {item.icon}
                </div>

                <h3 className="mb-3 text-xl font-bold text-[#1c3026]">
                  {item.title}
                </h3>

                <p className="leading-relaxed text-gray-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Report Categories */}
      <section className="w-full bg-gray-50 px-4 py-10 md:px-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              What Can You Report?
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Explore the types of civic issues you can report.
            </p>
          </div>

          {filteredCategories.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filteredCategories.map((category) => (
                <div
                  key={category.id}
                  className={`${category.color} rounded-xl border border-black/5 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg`}
                >
                  <div className="mb-4 text-3xl" aria-hidden="true">
                    {category.icon}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900">
                    {category.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {category.description}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
              No matching categories found for "{isSearch}".
            </p>
          )}
        </div>
      </section>
      {/* Contact Help */}
      <section className="w-full bg-white px-4 py-12 md:px-8 md:py-16 ">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl bg-green-800 px-6 py-10 md:px-12 md:py-14">
          <div className="flex flex-col items-center justify-between gap-8 text-center md:flex-row md:text-left">
            {/* Content */}
            <div className="max-w-xl">
              <span className="mb-4 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-green-100">
                Need Assistance?
              </span>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7 text-green-100 md:text-base break-words text-wrap">
            Have questions or facing an issue with CivicFix? We're here to help
            you report civic problems and make your community a better place.
          </p>
          <div className="flex justify-center">
            <h3 className="mb-4  mt-4 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-green-100">
              Contact Information
            </h3>
          </div>
          <div className=" flex justify-center gap-4">
            <NavLink
              to="/contact-us"
              className="py-2 px-2 bg-gray-300 rounded-lg"
            >
              {" "}
              Contact Us
            </NavLink>
            <NavLink
              to="/"
              className="py-2 px-2 bg-green-500 text-white  rounded-lg"
            >
              {" "}
              Explore CivicFix
            </NavLink>
          </div>
        </div>
      </section>
      {/* Frequently Asked Questions */}
      <section className="w-full bg-white px-4 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">
              Frequently Asked Questions
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Quick answers to common CivicFix questions.
            </p>
          </div>

          <div className="space-y-3">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((faq) => (
                <div
                  key={faq.id}
                  className="overflow-hidden rounded-xl border border-gray-200"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaq(openFaq === faq.id ? null : faq.id)
                    }
                    aria-expanded={openFaq === faq.id}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-gray-900 transition hover:bg-gray-50"
                  >
                    <span>{faq.question}</span>

                    <span
                      className="text-xl text-emerald-700"
                      aria-hidden="true"
                    >
                      {openFaq === faq.id ? "−" : "+"}
                    </span>
                  </button>

                  {openFaq === faq.id && (
                    <div className="border-t border-gray-100 px-5 py-4 text-sm leading-6 text-gray-600">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
                No matching FAQs found for "{isSearch}".
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

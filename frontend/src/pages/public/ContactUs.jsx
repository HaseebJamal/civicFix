import { useSiteSettings } from "../../context/SiteSettingsContext.jsx";

const ContactUs = () => {
  const { settings } = useSiteSettings();
  const contactDetails = [
    ...(settings.supportEmail
      ? [
          {
            id: "email",
            icon: "✉",
            title: "Email Us",
            value: settings.supportEmail,
            href: `mailto:${settings.supportEmail}`,
          },
        ]
      : []),
    ...(settings.supportPhone
      ? [
          {
            id: "phone",
            icon: "☎",
            title: "Call Us",
            value: settings.supportPhone,
            href: `tel:${settings.supportPhone}`,
          },
        ]
      : []),
    ...(settings.whatsappNumber
      ? [
          {
            id: "whatsapp",
            icon: "✆",
            title: "WhatsApp",
            value: settings.whatsappNumber,
            href: `https://wa.me/${settings.whatsappNumber}`,
          },
        ]
      : []),
    {
      id: "location",
      icon: "📍",
      title: "Our Location",
      value: settings.location,
    },
    {
      id: "hours",
      icon: "🕒",
      title: "Working Hours",
      value: settings.workingHours,
    },
  ].filter((detail) => detail.value);

  return (
    <section className="w-full bg-[#dffded] text-[#1c3026]">
      <div className="text-center py-16 px-6">
        <h1 className="font-bold text-3xl md:text-4xl leading-tight">
          Get In Touch
        </h1>

        <p className="mt-4 text-[#1c3026]">
          Have a question or suggestion? We're here to help build better
          communities.
        </p>
      </div>

      <div className="max-w-7xl mx-auto py-14 px-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left side */}
        <div className="bg-white p-8 md:p-10 shadow-md rounded-2xl">
          <span className="inline-block bg-[#dffded] text-[#1c3026] text-sm font-semibold px-4 py-2 rounded-full">
            Contact Information
          </span>

          <h2 className="mt-5 font-bold text-2xl md:text-3xl leading-tight">
            Let's Start a Conversation
          </h2>

          <p className="mt-4 text-gray-600 leading-7">
            Have questions or suggestions? Reach out to us. We'd love to hear
            from you and help make our communities better.
          </p>

          <div className="mt-8 space-y-6">
            {contactDetails.map((detail) => (
              <div
                key={detail.id}
                className="flex items-start gap-4 p-4 rounded-xl hover:bg-[#f0fdf4] transition-colors duration-300"
              >
                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[#dffded] rounded-xl text-2xl">
                  {detail.icon}
                </div>

                <div className="min-w-0">
                  <h3 className="font-semibold text-lg">{detail.title}</h3>

                  {detail.href ? (
                    <a
                      href={detail.href}
                      target={detail.id === "whatsapp" ? "_blank" : undefined}
                      rel={detail.id === "whatsapp" ? "noreferrer" : undefined}
                      className="mt-1 block text-gray-600 hover:text-[#1c3026] break-all transition-colors"
                    >
                      {detail.value}
                    </a>
                  ) : (
                    <p className="mt-1 text-gray-600 leading-6">
                      {detail.value}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <p className="font-semibold text-lg">
              Together, we can make a difference.
            </p>
            <p className="mt-2 text-gray-600 leading-6">
              Your voice matters. Thank you for being part of CivicFix.
            </p>
          </div>
        </div>
        {/* Right side */}
        <div className="bg-white p-8 md:p-10 shadow-md rounded-2xl">
          <span className="inline-block bg-[#dffded] text-[#1c3026] text-sm font-semibold px-4 py-2 rounded-full">
            Send Message
          </span>
          <h2 className="mt-5 font-bold text-2xl md:text-3xl leading-tight">
            Contact Now
          </h2>
          <div>
            <form action="">
              <div>
                <label htmlFor="name" className="block p-2 font-semibold">
                  Name
                  <span className="text-red-600"> *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter Your Name"
                  className=" max-w-sm w-full px-3 border border-gray-300 py-2 rounded-lg text-sm outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label htmlFor="email" className="block p-2 font-semibold">
                  Email
                  <span className="text-red-600"> *</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="Enter Your Email"
                  className=" max-w-sm w-full px-3 border border-gray-300 py-2 rounded-lg text-sm outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label htmlFor="subject" className="block p-2 font-semibold">
                  Subject
                  <span className="text-red-600"> *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter Subject"
                  className=" max-w-sm w-full px-3 border border-gray-300 py-2 rounded-lg text-sm outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label htmlFor="inquiry" className="block p-2 font-semibold">
                  Inquiry
                  <span className="text-red-600"> *</span>
                </label>
                <textarea
                  name="inquiry"
                  id="inquiry"
                  cols={4}
                  required
                  className=" max-w-sm w-full px-3 border border-gray-300 py-2 rounded-lg text-sm outline-none focus:border-green-500"
                >
                  Write what Type of Inquiry you want to know??
                </textarea>
              </div>
            </form>
                <button type="submit" className="bg-green-400 py-2 px-2 rounded-lg text-gray-700 hover:bg-green-600 mt-2"> Send Now</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactUs;


const AboutUs = () => {
  const aboutData = {
    title: ["Building Better", " Communities,", " Together"],
    description: [
      "We connect citizens with local authorities to report civic issues and track their resolution.",
      "Together, we are building cleaner, safer, and better communities.",
    ],
    image: "/herosectionimg.jpg",
    button1: "Our Mission",
    button2: "Contact Us",
    stats: [
      { value: "10K+", label: "Issues Resolved" },
      { value: "50K+", label: "Citizens Reached" },
      { value: "50+", label: "Communities" },
      { value: "90%", label: "Resolution Rate" },
    ],
  };

  const howItWorks = {
    title: "How CivicFix Helps",
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
        description: "See your report status and progress",
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

  const values = [
    {
      id: 1,
      title: "Transparency",
      description:
        "Help citizens stay informed about their reports and the progress of civic issues.",
      icon: "🔎",
    },
    {
      id: 2,
      title: "Accountability",
      description:
        "Encourage responsible action and help authorities address community concerns.",
      icon: "🤝",
    },
    {
      id: 3,
      title: "Collaboration",
      description:
        "Connect citizens and local authorities to work toward better communities.",
      icon: "🌍",
    },
    {
      id: 4,
      title: "Accessibility",
      description:
        "Make reporting civic problems simple and accessible for everyone.",
      icon: "💚",
    },
  ];

  return (
    <>
      {/* Hero Section */}
      <section className="w-full bg-[#dffded] text-[#1c3026]">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Text */}
          <div className="flex flex-col">
            <h1 className="font-bold text-4xl md:text-6xl lg:text-7xl text-black leading-tight tracking-normal">
              {aboutData.title[0]}
              <br />
              {aboutData.title[1]}
              <br />
              <span className="gradient-text">
                {aboutData.title[2]}
              </span>
            </h1>

            <p className="mt-6 text-gray-500 text-base md:text-lg leading-relaxed max-w-lg">
              {aboutData.description[0]}
              <br className="hidden md:block" />
              {aboutData.description[1]}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#mission"
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition shadow-md"
              >
                {aboutData.button1}
              </a>

              <a
                href="#contact"
                className="bg-white text-black hover:bg-green-600 hover:text-white px-6 py-3 rounded-lg font-semibold transition shadow-md"
              >
                {aboutData.button2}
              </a>
            </div>
          </div>

          {/* Right Side - Image */}
          <div className="flex justify-center md:justify-end">
            <img
              src={aboutData.image}
              alt="CivicFix community"
              className="w-full max-w-lg rounded-2xl shadow-2xl object-cover"
            />
          </div>
        </div>

        {/* Stats Banner */}
        <div className="w-full bg-green-600 py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {aboutData.stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center justify-center text-center"
              >
                <h2 className="text-white text-3xl">
                  {stat.value}
                </h2>
                <p className="text-white font-semibold p-2">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section
        id="mission"
        className="mx-auto max-w-7xl px-6 py-10"
      >
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Our Mission
          </h2>

          <h3 className="mt-4 text-gray-900 text-xl font-bold">
            Empowering Citizens, Improving Communities
          </h3>

          <p className="mt-2 text-gray-500">
            Our mission is to empower citizens to take an active role in
            improving
            <br />
            the places they live. CivicFix provides a simple and accessible
            platform where people
            <br />
            can report civic issues, share their concerns, and stay informed
            about the progress of their reports.
            <br />
            By connecting citizens with local authorities, we aim to encourage
            transparency,
            <br />
            accountability, and effective communication while helping
            <br />
            communities address everyday civic challenges.
          </p>
        </div>
      </section>

      {/* How CivicFix Helps */}
      <section className="bg-[#dffeea] px-6 rounded-2xl">
        <div className="py-16 px-6 max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#1c3026] mb-12">
            {howItWorks.title}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.step.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-8 shadow-md text-center"
              >
                <div className="text-4xl mb-4">
                  {item.icon}
                </div>

                <h3 className="text-xl font-bold text-[#1c3026] mb-3">
                  {item.title}
                </h3>

                <p className="text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Believe */}
      <section className="mx-auto max-w-7xl px-6 py-10 w-full">
        <div className="mb-8 text-center">
          <h2 className="font-bold text-3xl text-gray-900 md:text-4xl">
            What We Believe
          </h2>

          <p className="mt-4 text-gray-600 max-w-2xl leading-tight mx-auto">
            Our values guide how we connect citizens with local authorities
            and work toward stronger communities.
          </p>
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {values.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-8 shadow-md text-center"
              >
                <div className="text-4xl mb-4">
                  {item.icon}
                </div>

                <h3 className="text-xl font-bold text-[#1c3026] mb-3">
                  {item.title}
                </h3>

                <p className="text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Vision */}
      <section className="mx-auto max-w-7xl px-6 py-10 bg-[#72f8a1] rounded-2xl md:px-12 md:py-16 ">
        <div className="mb-8 text-center">
          <h2 className="font-bold text-3xl leading-tight md:text-4xl text-[#2f4f3f]">
            Our Vision
          </h2>

          <h3 className="mt-4 text-gray-600 font-semibold text-xl">
            A Better Community Starts With You
          </h3>

          <p className="mt-4 mx-auto max-w-2xl text-gray-600">
            We envision communities where citizens have a voice, civic
            problems are visible, authorities can respond effectively, and
            everyone can contribute to creating cleaner, safer, and better
            places to live.
          </p>
        </div>
      </section>

      {/* Contact Us */}
      <section id="contact" className="py-16 md:py-20 px-6">
        <div className="mx-auto max-w-7xl  bg-[#1c3026] rounded-2xl px-6 py-12 md:px-12 md:py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white">
            Make a Difference in Your Community
          </h2>

          <p className="mt-5 text-gray-200 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Every small action can contribute to a better community.
            Report civic issues, follow their progress, and help make your
            surroundings cleaner and safer.
          </p>

          <a
            href="/map"
            className="inline-block mt-8 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition shadow-md"
          >
            Explore CivicFix
          </a>
        </div>
      </section>
    </>
  );
};

export default AboutUs;

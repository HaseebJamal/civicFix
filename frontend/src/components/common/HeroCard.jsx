
const HeroCard = () => {
  const categories = [
    {
      id: 1,
      title: "Road & Pothole",
      description: "Report road damage and photholes",
      color: "bg-[#FEE2E2]",
      icon: "🚧",
    },
    {
      id: 2,
      title: "Water Leakage & Drainage",
      description: "Report water and drainage issue",
      color: "bg-[#DBEAFE]",
      icon: "💧",
    },
    {
      id: 3,
      title: "Waste Management",
      description: "Report issue about waste management",

      icon: "🗑️",
      color: "bg-[#D1FAE5]",
    },
    {
      id: 4,
      title: "Streetlights",
      description: "Report broken streetlights.",
      color: "bg-[#FEF3C7]",
      icon: "💡",
    },
  ];
  return (
    <>
      {/* Hero section cards */}
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className=" mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 md:text-4xl">
            Explore Categories
          </h2>
          <p className="mt-2 text-gray-600">
            Choose a category to help improve your community.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
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
      </section>
    </>
  );
};

export default HeroCard;

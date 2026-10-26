import { useContextHook } from "../../context/useContextHook";

const HeroSection = ({ pageData }) => {
  const useHeroContext = useContextHook();
  const hero = pageData || useHeroContext;
  return (
    <>
      <section className="w-full bg-[#dffded] text-[#1c3026]">
        {/* Main Container - Grid Layout */}
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* LEFT SIDE - Text */}
          <div className="flex flex-col">
            <h1 className="font-bold text-4xl md:text-6xl lg:text-7xl text-black leading-tight tracking-normal">
              {useHeroContext.heroData.title[0]}
              <br />
              {useHeroContext.heroData.title[1]}
              <br />
              <span className="gradient-text">{useHeroContext.heroData.title[2]}</span>
              <br />
              <span className="gradient-text">{useHeroContext.heroData.title[3]}</span>
            </h1>

            <p className="mt-6 text-gray-500 text-base md:text-lg leading-relaxed max-w-lg">
              {useHeroContext.heroData.description[0]}
              <br className="hidden md:block" />
              {useHeroContext.heroData.description[1]}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition shadow-md">
                {useHeroContext.heroData.button1}
              </button>

              <button className="bg-white text-black hover:bg-green-600 hover:text-white px-6 py-3 rounded-lg font-semibold transition shadow-md">
                {useHeroContext.heroData.button2}
              </button>
            </div>
          </div>

          {/* RIGHT SIDE - Image */}
          <div className="flex justify-center md:justify-end">
            <img
              src={useHeroContext.heroData.image}
              alt="Street View"
              className="w-full max-w-lg rounded-2xl shadow-2xl object-cover"
            />
          </div>
        </div>

        {/* Hero Section Stats Banner */}
        <div className="w-full bg-green-600 py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {useHeroContext.heroData.stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center justify-center text-center"
              >
                <h1 className="text-white text-3xl">{stat.value}</h1>

                <p className="text-white font-semibold p-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;

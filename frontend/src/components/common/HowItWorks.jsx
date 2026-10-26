import { useContextHook } from "../../context/useContextHook";

const HowItWorks = () => {
  const useHeroContext = useContextHook();
  const { howItWorks } = useHeroContext;

  return (
    <section className="py-5">
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-[#1c3026] mb-12">
            {howItWorks.title}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.step.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-8 shadow-md text-center"
              >
                <div className="text-4xl mb-4">{item.icon}</div>

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
    </section>
  );
};

export default HowItWorks;

import { NavLink } from "react-router-dom";

const CallToAction = () => {
  return (
    <section className="px-6 py-16 md:py-20">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-green-700 px-6 py-14 text-center text-white shadow-xl md:px-16 md:py-20">
        {/* Decorative circles */}
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10"
        />

        <div
          aria-hidden="true"
          className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-white/10"
        />

        <div className="relative mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-green-100">
            Your Community Needs You
          </p>

          <h2 className="text-3xl font-bold leading-tight md:text-5xl">
            Make a Difference in Your Community
          </h2>

          <p className="mx-auto mt-5 max-w-2xl leading-7 text-green-50 md:text-lg">
            Every report is a step toward cleaner streets, safer neighborhoods,
            and a better city. Start making a difference today.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
            <NavLink
              to="/report/new"
              className="rounded-xl bg-white px-7 py-3.5 font-semibold text-green-800 transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-green-700"
            >
              Report an Issue →
            </NavLink>

            <NavLink
              to="/map"
              className="rounded-xl border border-white/40 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Explore City Map
            </NavLink>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
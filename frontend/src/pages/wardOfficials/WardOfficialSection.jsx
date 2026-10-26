const WardOfficialSection = ({ title, description }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
    <p className="text-sm font-medium text-green-700">Ward workspace</p>
    <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
      {title}
    </h1>
    <p className="mt-2 text-sm text-gray-600">{description}</p>
  </section>
);

export default WardOfficialSection;

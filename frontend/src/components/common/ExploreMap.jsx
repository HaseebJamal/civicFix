import MapView from "../../components/common/MapView";
const ExploreMap = ({
  title = "Explore CivicFix Issues",
  description = "Discover reported issues in your community.",
}) => {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">{title}</h1>

      <p className="mb-6 text-gray-600">{description}</p>

      <MapView />
    </main>
  );
};

export default ExploreMap;

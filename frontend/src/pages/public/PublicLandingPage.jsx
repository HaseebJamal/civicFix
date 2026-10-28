import HeroSection from "../../components/common/HeroSection";
import HeroCard from "../../components/common/HeroCard";
import HowItWorks from "../../components/common/HowItWorks";
import CallToAction from "../../components/common/CallToAction";
import ExploreMap from "../../components/common/ExploreMap";

const PublicLandingPage = () => {
  return (
    <>
      <HeroSection />

      <HeroCard />

      <HowItWorks />

      <ExploreMap
        title="Explore Community Reports"
        description="See civic issues reported in your community and track their status."
      />

      <CallToAction />
    </>
  );
};

export default PublicLandingPage;

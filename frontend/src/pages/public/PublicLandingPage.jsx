import HeroSection from "../../components/common/HeroSection";
import HeroCard from "../../components/common/HeroCard";
import HowItWorks from "../../components/common/HowItWorks";
import CallToAction from "../../components/common/CallToAction";

// import MapView from "../../components/common/MapView";

const PublicLandingPage = () => {
  return (
    <>
      <HeroSection />

      <HeroCard />

      <HowItWorks />

      {/* Explore Map Section */}

      <CallToAction />
    </>
  );
};

export default PublicLandingPage;

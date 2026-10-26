import { createContext, useContext } from "react";

const HeroContext = createContext();

export const HeroProvider = ({ children }) => {
  const heroData = {
    title: ["Empowering ", "Citizens", " to Build", " Better ", "Communities"],
    description: [
      "Report civic issues instantly and track their resolution in real-time.",
      " Join thousands of citizens making a difference.",
    ],
    image: "/herosectionimg.jpg",
    button1: "Report an Issue",
    button2: "View Map",
    stats: [
      { value: "10K+", label: "Issues Resolved" },
      { value: "50K+", label: "Active Users" },
      { value: "50+", label: "Cities Covered" },
      { value: "90%", label: "Success Rate" },
    ],
  };
  const howItWorks = {
    title: "How CivicFix Works",
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

  return (
    <HeroContext.Provider value={{heroData,howItWorks}}>{children}</HeroContext.Provider>
  );
};

export const useContextHook = () => useContext(HeroContext);

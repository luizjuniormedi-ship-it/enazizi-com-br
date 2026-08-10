import { useEffect } from "react";
import Landing from "./Landing";

const Index = () => {
  useEffect(() => {
    // WAR ROOM — PRODUCTION OBSERVATION & GO-LIVE GUARD
    console.debug("[PRODUCTION_OBSERVATION_ACTIVE] Mode: READ-ONLY");
  }, []);

  return <Landing />;
};

export default Index;

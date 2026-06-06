
import React, { useEffect } from 'react';
import { CampanhaNacionalDashboard } from '@/components/marketing/CampanhaNacional';

const CampaignDashboardPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Campanha Nacional | ENAZIZI Marketing';
  }, []);

  return (
    <div className="min-h-screen bg-[#050508]">
      <CampanhaNacionalDashboard />
    </div>
  );
};

export default CampaignDashboardPage;

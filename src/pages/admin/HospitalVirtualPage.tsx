import React, { useEffect } from 'react';
import { HospitalVirtualV5 } from '@/components/admin/HospitalVirtualV5';

const HospitalVirtualPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Hospital Virtual V5 | ENAZIZI Admin';
  }, []);

  return (
    <div className="min-h-screen bg-[#050508]">
      <HospitalVirtualV5 />
    </div>
  );
};

export default HospitalVirtualPage;

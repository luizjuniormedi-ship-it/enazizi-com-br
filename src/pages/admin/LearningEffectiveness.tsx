import React, { useEffect } from 'react';
import { LearningEffectivenessWarRoom } from '@/components/admin/LearningEffectivenessWarRoom';

const LearningEffectiveness: React.FC = () => {
  useEffect(() => {
    document.title = 'War Room: Learning Effectiveness | ENAZIZI Admin';
  }, []);

  return (
    <div className="min-h-screen bg-[#050508]">
      <LearningEffectivenessWarRoom />
    </div>
  );
};

export default LearningEffectiveness;


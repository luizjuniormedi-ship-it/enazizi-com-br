import React from 'react';
import { LearningEffectivenessWarRoom } from '@/components/admin/LearningEffectivenessWarRoom';
import { Helmet } from 'react-helmet-async';

const LearningEffectiveness: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#050508]">
      <Helmet>
        <title>War Room: Learning Effectiveness | ENAZIZI Admin</title>
      </Helmet>
      <LearningEffectivenessWarRoom />
    </div>
  );
};

export default LearningEffectiveness;

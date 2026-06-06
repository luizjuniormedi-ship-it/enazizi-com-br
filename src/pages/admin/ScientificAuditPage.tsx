import React, { useEffect } from 'react';
import { ScientificAuditDashboard } from '@/components/admin/audit/ScientificAuditDashboard';

const ScientificAuditPage: React.FC = () => {
  useEffect(() => {
    document.title = 'Auditoria Científica | ENAZIZI Admin';
  }, []);

  return (
    <div className="min-h-screen bg-[#050508]">
      <ScientificAuditDashboard />
    </div>
  );
};

export default ScientificAuditPage;

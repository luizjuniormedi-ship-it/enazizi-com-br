import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingDown, 
  Stethoscope, 
  Building2, 
  AlertCircle,
  Activity,
  DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface HospitalManagementDashboardProps {
  sessionId: string;
}

export const HospitalManagementDashboard = ({ sessionId }: HospitalManagementDashboardProps) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [resources, setResources] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: metricsData } = await supabase
        .from('hospital_economic_metrics')
        .select('*')
        .eq('hospital_session_id', sessionId)
        .single();
      
      if (metricsData) setMetrics(metricsData);

      const { data: resourcesData } = await supabase
        .from('hospital_resources')
        .select('*');
      
      if (resourcesData) setResources(resourcesData);
    };

    fetchData();
  }, [sessionId]);

  const overusePercentage = metrics?.overuse_score ? Math.min(metrics.overuse_score * 10, 100) : 0;

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Economic Impact */}
        <Card className="bg-white">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-bold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              ECONOMIA HOSPITALAR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] text-slate-500 font-medium">Custo Estimado</span>
                <span className="text-sm font-bold text-slate-900">
                  R$ {metrics?.total_cost?.toLocaleString() || '0,00'}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] text-slate-500 font-medium">Overuse de Recursos</span>
                <Badge variant={overusePercentage > 30 ? "destructive" : "secondary"} className="text-[9px]">
                  {overusePercentage}%
                </Badge>
              </div>
              <Progress value={overusePercentage} className="h-1.5 mt-2" />
            </div>
          </CardContent>
        </Card>

        {/* Resource Management */}
        <Card className="bg-white">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-bold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              GESTÃO DE LEITOS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {resources.map(res => (
              <div key={res.id}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-slate-500">{res.resource_type.toUpperCase().replace('_', ' ')}</span>
                  <span className="text-[10px] font-medium">{res.current_occupancy}/{res.total_capacity}</span>
                </div>
                <Progress 
                  value={(res.current_occupancy / res.total_capacity) * 100} 
                  className="h-1" 
                />
              </div>
            ))}
            {resources.length === 0 && (
              <p className="text-[10px] text-slate-400 italic">Buscando disponibilidade de rede...</p>
            )}
          </CardContent>
        </Card>

        {/* Patient Safety */}
        <Card className="bg-white">
          <CardHeader className="py-3">
            <CardTitle className="text-xs font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              SEGURANÇA DO PACIENTE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 text-center">
                <p className="text-[20px] font-bold text-slate-900">0</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-wider">Eventos Adversos</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div className="flex-1 text-center">
                <p className="text-[20px] font-bold text-emerald-600">100%</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-wider">Identificação Correta</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ShieldCheck = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default HospitalManagementDashboard;

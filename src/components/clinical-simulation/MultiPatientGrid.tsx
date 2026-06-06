import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { HeartPulse, Activity, AlertTriangle, Clock } from 'lucide-react';

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  main_complaint: string;
  sector: string;
  current_status: string;
  vitals: any;
  hidden_diagnosis?: string;
}

interface MultiPatientGridProps {
  patients: Patient[];
  activePatientId: string | null;
  onSelectPatient: (id: string) => void;
}

export const MultiPatientGrid: React.FC<MultiPatientGridProps> = ({ 
  patients, 
  activePatientId, 
  onSelectPatient 
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
      {patients.map((p) => {
        const isCritical = p.current_status === 'critico' || p.current_status === 'grave';
        const isActive = activePatientId === p.id;
        
        return (
          <Card 
            key={p.id} 
            className={`cursor-pointer transition-all hover:scale-[1.02] border-2 ${
              isActive ? 'border-primary shadow-lg shadow-primary/20' : 
              isCritical ? 'border-red-500/30' : 'border-white/5'
            } bg-black/40 backdrop-blur-xl relative overflow-hidden group`}
            onClick={() => onSelectPatient(p.id)}
          >
            {isCritical && (
              <div className="absolute top-0 right-0 p-1">
                <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />
              </div>
            )}
            
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="text-[10px] font-black uppercase truncate">{p.name}</span>
                <Badge className="ml-auto text-[8px] px-1 h-3 font-mono opacity-50">
                  {p.age}a
                </Badge>
              </div>
              
              <div className="text-[9px] text-white/40 leading-tight h-6 overflow-hidden italic">
                "{p.main_complaint}"
              </div>
              
              <div className="flex justify-between items-center text-[8px] font-mono">
                <div className="flex items-center gap-1 text-red-400">
                  <HeartPulse className="h-2 w-2" /> {p.vitals?.FC || '--'}
                </div>
                <div className="flex items-center gap-1 text-blue-400">
                  <Activity className="h-2 w-2" /> {p.vitals?.PA || '--'}
                </div>
              </div>
              
              <Progress 
                value={isCritical ? 85 : 30} 
                className="h-1 bg-white/5" 
                indicatorClassName={isCritical ? 'bg-red-500' : 'bg-emerald-500'} 
              />
              
              <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest text-center group-hover:text-primary transition-colors">
                {p.sector.replace('_', ' ')}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

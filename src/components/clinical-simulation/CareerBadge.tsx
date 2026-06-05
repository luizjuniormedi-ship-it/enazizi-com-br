import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Shield, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const TITLE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  interno: { label: "Interno", icon: Briefcase, color: "bg-blue-500" },
  residente_r1: { label: "Residente R1", icon: Star, color: "bg-orange-500" },
  residente_r3: { label: "Residente R3", icon: Star, color: "bg-purple-500" },
  preceptor: { label: "Preceptor", icon: Trophy, color: "bg-emerald-500" },
  chefe_plantao: { label: "Chefe de Plantão", icon: Shield, color: "bg-red-600" },
};

export const CareerBadge = () => {
  const { user } = useAuth();
  const [career, setCareer] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const fetchCareer = async () => {
      const { data } = await supabase
        .from('hospital_career_path')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setCareer(data);
      } else {
        // Create initial career if not exists
        const { data: newData } = await supabase
          .from('hospital_career_path')
          .insert({ user_id: user.id, current_title: 'interno' })
          .select()
          .single();
        if (newData) setCareer(newData);
      }
    };

    fetchCareer();
  }, [user]);

  if (!career) return null;

  const config = TITLE_CONFIG[career.current_title] || TITLE_CONFIG.interno;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge className={`${config.color} text-white hover:${config.color} flex items-center gap-1.5 px-3 py-1`}>
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-tight">{config.label}</span>
      </Badge>
      <div className="hidden md:flex flex-col">
        <span className="text-[9px] text-slate-500 font-bold uppercase leading-none">Experiência Simulação</span>
        <span className="text-[11px] font-bold text-slate-900 leading-tight">{career.xp_points} XP</span>
      </div>
    </div>
  );
};

export default CareerBadge;

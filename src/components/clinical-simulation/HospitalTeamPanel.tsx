import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, AlertTriangle, MessageSquare, ShieldCheck, HeartPulse, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface StaffMember {
  id: string;
  name: string;
  role: 'nurse' | 'technician' | 'resident_r1' | 'family' | 'regulation' | 'preceptor';
  competence_level: number;
}

interface Interaction {
  id: string;
  staff_name: string;
  role: string;
  message: string;
  interaction_type: string;
  created_at: string;
}

interface HospitalTeamPanelProps {
  sessionId: string;
  patientId?: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  nurse: { label: "Enfermeira", color: "bg-blue-100 text-blue-800" },
  technician: { label: "Téc. Enfermagem", color: "bg-slate-100 text-slate-800" },
  resident_r1: { label: "Residente R1", color: "bg-orange-100 text-orange-800" },
  family: { label: "Familiar", color: "bg-purple-100 text-purple-800" },
  regulation: { label: "Regulação", color: "bg-red-100 text-red-800" },
  preceptor: { label: "Preceptor", color: "bg-green-100 text-green-800" },
};

export const HospitalTeamPanel = ({ sessionId, patientId }: HospitalTeamPanelProps) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase.from('hospital_staff').select('*').eq('is_active', true);
      if (data) setStaff(data as StaffMember[]);
    };

    const fetchInteractions = async () => {
      const { data } = await supabase
        .from('hospital_staff_interactions')
        .select(`
          id,
          message,
          interaction_type,
          created_at,
          hospital_staff (name, role)
        `)
        .eq('hospital_session_id', sessionId)
        .order('created_at', { ascending: false });

      if (data) {
        setInteractions(data.map((i: any) => ({
          id: i.id,
          message: i.message,
          interaction_type: i.interaction_type,
          created_at: i.created_at,
          staff_name: i.hospital_staff?.name || 'Sistema',
          role: i.hospital_staff?.role || 'system'
        })));
      }
    };

    fetchStaff();
    fetchInteractions();

    // Realtime subscription for team alerts
    const channel = supabase
      .channel('hospital_team_alerts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'hospital_staff_interactions',
        filter: `hospital_session_id=eq.${sessionId}`
      }, (payload) => {
        fetchInteractions();
        toast({
          title: "Novo Alerta da Equipe",
          description: payload.new.message,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, toast]);

  return (
    <Card className="h-full border-l rounded-none bg-slate-50/50">
      <CardHeader className="py-4 px-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            EQUIPE ASSISTENCIAL
          </CardTitle>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
            VIVA V5.5
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex flex-col h-[calc(100%-60px)]">
        <div className="p-4 border-b bg-white/50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Membros Ativos</h4>
            <div title="Esta é a sua equipe de suporte. Eles executam suas ordens, monitoram o paciente e trazem alertas críticos do hospital." className="cursor-help">
              <Badge variant="outline" className="text-[8px] h-4 opacity-50">?</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {staff.length > 0 ? staff.map((s) => (
              <Badge key={s.id} variant="secondary" className={`text-[9px] ${ROLE_LABELS[s.role]?.color || ''}`}>
                {s.name} ({ROLE_LABELS[s.role]?.label || s.role})
              </Badge>
            )) : (
              <span className="text-[9px] text-muted-foreground italic">Aguardando escalonamento...</span>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {interactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center space-y-3 opacity-60">
                <MessageSquare className="w-8 h-8 text-slate-300" />
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase">Central de Comunicação</p>
                  <p className="text-[10px] text-slate-400 max-w-[180px] leading-tight">
                    Aqui você receberá alertas de sinais vitais, status de exames, pedidos da enfermagem e atualizações da regulação.
                  </p>
                </div>
              </div>
            ) : (
              interactions.map((i) => (
                <div key={i.id} className="bg-white p-3 rounded-lg border shadow-sm border-slate-200 animate-in fade-in slide-in-from-right-2 duration-300">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-slate-700">{i.staff_name}</span>
                    <Badge variant="outline" className="text-[8px] h-4">
                      {ROLE_LABELS[i.role]?.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    "{i.message}"
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[8px] text-slate-400">
                      {new Date(i.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {i.interaction_type === 'alert' && (
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-white">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-2 tracking-widest text-center">Protocolos de Comunicação</p>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-[10px] h-8 gap-1"
              title="SBAR: Situation, Background, Assessment, Recommendation. Use para passar o caso para outro médico ou preceptor."
            >
              <MessageSquare className="w-3 h-3" /> SBAR
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-[10px] h-8 gap-1"
              title="SPIKES: Protocolo para comunicação de más notícias."
            >
              <ShieldCheck className="w-3 h-3" /> SPIKES
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HospitalTeamPanel;

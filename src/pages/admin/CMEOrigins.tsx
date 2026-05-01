import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { LineChart, History, Film, ArrowRight, Brain, Clock, Activity } from "lucide-react";

export default function CMEOrigins() {
  const [origins, setOrigins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrigins = async () => {
      const { data, error } = await supabase
        .from("cme_tutor_origins")
        .select(`
          *,
          project:cme_video_projects(*)
        `)
        .order('created_at', { ascending: false });

      if (data) setOrigins(data);
      setLoading(false);
    };

    fetchOrigins();
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LineChart className="h-6 w-6 text-amber-500" />
            Linhagem e Origens Multimodais
          </h1>
          <p className="text-muted-foreground text-sm">
            Rastreabilidade completa do fluxo Tutor IA → CME → ENAFLIX.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/admin/cinematic-engine')}>
          Cinematic Engine
        </Button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Activity className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : origins.length === 0 ? (
          <Card className="bg-secondary/20 border-dashed">
            <CardContent className="flex flex-col items-center py-10">
              <History className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma origem vinculada encontrada.</p>
            </CardContent>
          </Card>
        ) : (
          origins.map((origin) => (
            <Card key={origin.id} className="hover:border-amber-500/30 transition-colors">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-amber-500/5 text-amber-500 border-amber-500/20">
                        TUTOR IA
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20">
                        CME PROJECT
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold">{origin.project?.title || 'Projeto sem título'}</h3>
                    <div className="flex gap-4 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Brain className="h-3 w-3" /> SESSION: {origin.tutor_session_id?.slice(0, 8)}...
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(origin.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => navigate(`/admin/cinematic-engine/${origin.cme_video_project_id}`)}
                    >
                      <Film className="h-4 w-4" /> Abrir no CME
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(`/dashboard/mentor?session=${origin.tutor_session_id}`)}
                    >
                      Ver Aula Original
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

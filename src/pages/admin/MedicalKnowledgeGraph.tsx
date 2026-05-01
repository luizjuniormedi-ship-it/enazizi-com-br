import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  GitBranch, 
  Search, 
  Filter, 
  Plus, 
  Network, 
  Database,
  ArrowRight,
  Stethoscope,
  Activity,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const MedicalKnowledgeGraph = () => {
  const { data: nodes, isLoading } = useQuery({
    queryKey: ["medical-knowledge-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_nodes")
        .select("*")
        .order("category", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: edges } = useQuery({
    queryKey: ["medical-knowledge-edges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_edges")
        .select("*, source:source_node_id(name), target:target_node_id(name)");
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Medical Knowledge Graph</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            <Network className="h-4 w-4" /> Ontologia Médica e Conexões Semânticas do ENAZIZI
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Database className="h-4 w-4" /> Importar MeSH/SNOMED
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Novo Nó
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Estatísticas do Grafo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total de Nós</span>
              <span className="font-mono font-bold text-primary">{nodes?.length || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Conexões Ativas</span>
              <span className="font-mono font-bold text-primary">{edges?.length || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Especialidades</span>
              <span className="font-mono font-bold text-primary">
                {new Set(nodes?.map(n => n.specialty)).size}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Explorador de Ontologia</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar conceito..." className="pl-8 h-9 text-xs" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {isLoading ? (
                  <div className="flex justify-center py-10">Carregando ontologia...</div>
                ) : nodes?.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground italic">
                    Nenhum nó de conhecimento cadastrado. Inicie o mapeamento.
                  </div>
                ) : (
                  nodes?.map((node: any) => (
                    <div key={node.id} className="p-3 border rounded-lg hover:bg-muted/30 transition-colors group">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-primary" />
                          <span className="font-bold text-sm">{node.name}</span>
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold px-1.5 h-4">
                            {node.category}
                          </Badge>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{node.code}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{node.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        {edges?.filter((e: any) => e.source_node_id === node.id || e.target_node_id === node.id).map((edge: any) => (
                          <div key={edge.id} className="flex items-center gap-1 text-[10px] bg-background border rounded px-1.5 py-0.5">
                            <Zap className="h-2.5 w-2.5 text-amber-500" />
                            <span className="text-muted-foreground">
                              {edge.source_node_id === node.id ? `→ ${edge.target?.name}` : `← ${edge.source?.name}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      
      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Network className="h-12 w-12 text-primary/30 mb-4" />
          <h3 className="text-lg font-bold">Visualização do Grafo de Conhecimento</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            O motor de visualização D3.js será injetado aqui para permitir a navegação espacial entre conceitos médicos.
          </p>
          <Button variant="outline" className="mt-4 gap-2" disabled>
            <Activity className="h-4 w-4" /> Renderizar Workspace (EM BREVE)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicalKnowledgeGraph;

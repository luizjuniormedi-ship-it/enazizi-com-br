import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertOctagon, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  Filter, 
  Search, 
  RefreshCcw,
  LifeBuoy,
  MessageSquare,
  ShieldAlert,
  Calendar,
  User,
  MoreVertical,
  ArrowUpRight,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CMEIncidentsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data: incidents, isLoading, refetch } = useQuery({
    queryKey: ["cme-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cme_incidents")
        .select(`
          *,
          ai_video_lessons(title, specialty)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from("cme_incidents")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status do incidente atualizado.");
      queryClient.invalidateQueries({ queryKey: ["cme-incidents"] });
    }
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive" className="bg-red-600 animate-pulse">Crítico</Badge>;
      case 'high': return <Badge variant="destructive">Alta</Badge>;
      case 'medium': return <Badge className="bg-amber-500">Média</Badge>;
      default: return <Badge variant="secondary">Baixa</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved': return <Badge className="bg-emerald-500 gap-1"><CheckCircle2 className="h-3 w-3" /> Resolvido</Badge>;
      case 'investigating': return <Badge variant="outline" className="text-blue-500 border-blue-500">Investigando</Badge>;
      case 'reprocessing': return <Badge variant="outline" className="text-purple-500 border-purple-500 animate-pulse">Reprocessando</Badge>;
      case 'closed': return <Badge variant="secondary">Fechado</Badge>;
      default: return <Badge variant="outline" className="text-red-500 border-red-500">Aberto</Badge>;
    }
  };

  const filteredIncidents = incidents?.filter(incident => {
    const matchesSearch = incident.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         incident.ai_video_lessons?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    open: incidents?.filter(i => i.status === 'open').length || 0,
    critical: incidents?.filter(i => i.severity === 'critical' && i.status !== 'resolved').length || 0,
    resolved24h: incidents?.filter(i => i.status === 'resolved' && new Date(i.resolved_at!).getTime() > Date.now() - 86400000).length || 0
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-red-500" />
            Central de Incidentes CME
          </h1>
          <p className="text-muted-foreground">Gestão de falhas de mídia, CDN e erros de playback em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4" /> Atualizar
          </Button>
          <Button className="gap-2 bg-red-600 hover:bg-red-700">
            <AlertOctagon className="h-4 w-4" /> Reportar Incidente Manual
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Incidentes em Aberto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{stats.open}</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">Alertas Críticos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{stats.critical}</div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">Resolvidos (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{stats.resolved24h}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative w-80">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título ou aula..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abertos</SelectItem>
                  <SelectItem value="investigating">Investigando</SelectItem>
                  <SelectItem value="resolved">Resolvidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incidente / Mídia Afetada</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Carregando incidentes...</TableCell>
                </TableRow>
              ) : filteredIncidents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                    Nenhum incidente registrado no momento.
                  </TableCell>
                </TableRow>
              ) : (
                filteredIncidents?.map((incident) => (
                  <TableRow key={incident.id} className="group hover:bg-muted/30">
                    <TableCell>
                      <div className="font-bold flex items-center gap-2">
                        {incident.title}
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-primary flex items-center gap-1 mt-1">
                        <LifeBuoy className="h-3 w-3" /> {incident.ai_video_lessons?.title || 'Infraestrutura Global'}
                      </div>
                    </TableCell>
                    <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                    <TableCell>{getStatusBadge(incident.status)}</TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {new Date(incident.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3" /> {new Date(incident.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-xs font-medium">Auto-Reprocessor</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2" onClick={() => updateStatusMutation.mutate({ id: incident.id, status: 'investigating' })}>
                            <Search className="h-4 w-4" /> Investigar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => updateStatusMutation.mutate({ id: incident.id, status: 'resolved' })}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Marcar como Resolvido
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <RefreshCcw className="h-4 w-4 text-purple-500" /> Forçar Reprocessamento
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CMEIncidentsPage;

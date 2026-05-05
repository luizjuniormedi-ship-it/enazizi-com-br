import { useState, useEffect, useCallback } from "react";
import { Video, VideoOff, Loader2, Plus, Search, Users, CheckSquare, Square, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { FACULDADES } from "@/constants/faculdades";

interface StudentProfile {
  user_id: string;
  display_name: string;
  email: string;
  faculdade: string | null;
  periodo: number | null;
}

const VideoRoom = ({ callAPI: externalCallAPI }: { callAPI?: (body: Record<string, unknown>) => Promise<any> }) => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("Sala de Aula");
  const [meetLink, setMeetLink] = useState("");
  const [faculdade, setFaculdade] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [activeRoom, setActiveRoom] = useState<any>(null);

  // Global Telegram config
  const [telegramConfig, setTelegramConfig] = useState<{ telegram_chat_id: string | null; telegram_group_link: string | null } | null>(null);

  // Student selection state
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/professor-simulado`;
  const TELEGRAM_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-classroom`;

  const callAPI = useCallback(async (body: Record<string, unknown>) => {
    if (externalCallAPI) return externalCallAPI(body);
    const resp = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Erro");
    return data;
  }, [session, API_URL, externalCallAPI]);

  // Load global telegram config
  useEffect(() => {
    supabase
      .from("platform_config" as any)
      .select("telegram_chat_id, telegram_group_link")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setTelegramConfig(data as any);
      });
  }, []);

  const loadRooms = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("video_rooms")
      .select("*")
      .eq("professor_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setRooms(data || []);
    const active = (data || []).find((r: any) => r.status === "active");
    setActiveRoom(active || null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const loadStudents = useCallback(async () => {
    if (!session) return;
    setLoadingStudents(true);
    try {
      const res = await callAPI({
        action: "get_students",
        faculdade: faculdade && faculdade !== "all" ? faculdade : undefined,
        periodo: periodo && periodo !== "all" ? parseInt(periodo) : undefined,
      });
      setStudents(res.students || []);
    } catch (e) {
      toast({ title: "Erro ao carregar alunos", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    } finally {
      setLoadingStudents(false);
    }
  }, [session, callAPI, faculdade, periodo, toast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const toggleStudent = (userId: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAll = () => setSelectedStudentIds(new Set(filteredStudents.map(s => s.user_id)));
  const deselectAll = () => setSelectedStudentIds(new Set());

  const filteredStudents = students.filter(s =>
    !searchTerm || (s.display_name || s.email || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const notifyTelegram = async (action: "start" | "end", roomTitle: string) => {
    const chatId = telegramConfig?.telegram_chat_id;
    if (!chatId) return;
    try {
      const resp = await fetch(TELEGRAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action, chat_id: chatId, title: roomTitle, group_link: telegramConfig?.telegram_group_link, meet_link: meetLink.trim() || undefined }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro Telegram");
      toast({ title: action === "start" ? "Notificação enviada no Telegram!" : "Aviso de encerramento enviado!" });
    } catch (e) {
      console.error("Telegram notification error:", e);
      toast({ title: "Erro ao notificar Telegram", description: e instanceof Error ? e.message : "Erro", variant: "destructive" });
    }
  };

  const createRoom = async () => {
    if (!user) return;
    setCreating(true);
    const roomCode = `enazizi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const { data, error } = await supabase.from("video_rooms").insert({
        professor_id: user.id,
        room_code: roomCode,
        title: title.trim() || "Sala de Aula",
        faculdade_filter: faculdade && faculdade !== "all" ? faculdade : null,
        periodo_filter: periodo && periodo !== "all" ? parseInt(periodo) : null,
        invited_students: Array.from(selectedStudentIds),
        telegram_chat_id: telegramConfig?.telegram_chat_id || null,
        telegram_group_link: telegramConfig?.telegram_group_link || null,
        meet_link: meetLink.trim() || null,
      } as any).select().single();
      if (error) throw error;
      setActiveRoom(data);
      toast({ title: "Sala criada!", description: `${selectedStudentIds.size} aluno(s) convidado(s).` });
      await notifyTelegram("start", title.trim() || "Sala de Aula");
      loadRooms();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const endRoom = async (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    await supabase
      .from("video_rooms")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", roomId);
    if (room) await notifyTelegram("end", room.title);
    setActiveRoom(null);
    toast({ title: "Sala encerrada" });
    loadRooms();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasTelegramConfig = !!telegramConfig?.telegram_chat_id;

  return (
    <div className="space-y-4">
      {!hasTelegramConfig && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-700 dark:text-yellow-400">
          ⚠️ O Telegram ainda não está configurado. Peça a um administrador para definir o Chat ID e Link do grupo nas configurações da plataforma.
        </div>
      )}

      {activeRoom ? (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-destructive text-destructive-foreground animate-pulse">● AO VIVO</Badge>
              <h3 className="font-semibold">{activeRoom.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              {(activeRoom as any).meet_link && (
                <Button variant="outline" size="sm" onClick={() => window.open((activeRoom as any).meet_link, "_blank")} className="gap-1">
                  <Video className="h-3.5 w-3.5" /> Abrir Meet
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => endRoom(activeRoom.id)} className="gap-1">
                <VideoOff className="h-3.5 w-3.5" /> Encerrar
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Aula ao vivo no Google Meet</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Os alunos receberão um popup com o link do Google Meet no dashboard. A notificação também foi enviada no Telegram.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="h-5 w-5 text-primary" />
                Criar Nova Sala de Aula
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Nome da Sala</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Revisão de Cardiologia" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Link do Google Meet</Label>
                  <Input value={meetLink} onChange={(e) => setMeetLink(e.target.value)} placeholder="Ex: https://meet.google.com/abc-defg-hij" />
                  <p className="text-xs text-muted-foreground">Crie a sala no Google Meet e cole o link aqui. Os alunos receberão esse link automaticamente.</p>
                </div>
                <div className="space-y-2">
                  <Label>Faculdade (filtro)</Label>
                  <Select value={faculdade} onValueChange={setFaculdade}>
                    <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {FACULDADES.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Período (filtro)</Label>
                  <Select value={periodo} onValueChange={setPeriodo}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
                        <SelectItem key={p} value={String(p)}>{p}º período</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Student Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Selecionar Alunos ({selectedStudentIds.size} selecionado{selectedStudentIds.size !== 1 ? "s" : ""})
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll} className="gap-1 text-xs">
                      <CheckSquare className="h-3.5 w-3.5" /> Todos
                    </Button>
                    <Button variant="outline" size="sm" onClick={deselectAll} className="gap-1 text-xs">
                      <Square className="h-3.5 w-3.5" /> Nenhum
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar aluno por nome..."
                    className="pl-9"
                  />
                </div>

                {loadingStudents ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum aluno encontrado.</p>
                ) : (
                  <ScrollArea className="h-[240px] rounded-md border border-border">
                    <div className="divide-y divide-border">
                      {filteredStudents.map((s) => (
                        <label
                          key={s.user_id}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => toggleStudent(s.user_id)}
                        >
                          <Checkbox
                            checked={selectedStudentIds.has(s.user_id)}
                            onCheckedChange={() => toggleStudent(s.user_id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{s.display_name || s.email}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {s.faculdade || "—"} · {s.periodo ? `${s.periodo}º período` : "—"}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <Button onClick={createRoom} disabled={creating || selectedStudentIds.size === 0 || !meetLink.trim()} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar Sala ({selectedStudentIds.size} aluno{selectedStudentIds.size !== 1 ? "s" : ""})
              </Button>
            </CardContent>
          </Card>

          {rooms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Histórico de Salas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {rooms.slice(0, 10).map((room) => (
                    <div key={room.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{room.title}</span>
                        <Badge variant={room.status === "active" ? "default" : "secondary"} className="text-[10px]">
                          {room.status === "active" ? "Ativa" : "Encerrada"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(room.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default VideoRoom;

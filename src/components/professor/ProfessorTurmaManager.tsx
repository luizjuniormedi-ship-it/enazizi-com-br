import { useState, useEffect, useCallback, useMemo } from "react";
import { Users, Plus, Search, Trash2, Edit2, UserPlus, UserMinus, Loader2, GraduationCap, X, CheckSquare, Square, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FACULDADES } from "@/constants/faculdades";

interface Student {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  faculdade?: string | null;
  periodo?: number | null;
}

interface Turma {
  id: string;
  name: string;
  description: string;
  created_at: string;
  student_details: Student[];
}

const ProfessorTurmaManager = ({ callAPI }: { callAPI: (body: Record<string, unknown>) => Promise<any> }) => {
  const { toast } = useToast();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTurma, setEditingTurma] = useState<Turma | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  
  // Student search/filter state
  const [studentSearch, setStudentSearch] = useState("");
  const [faculdadeFilter, setFaculdadeFilter] = useState<string>("all");
  const [periodoFilter, setPeriodoFilter] = useState<string>("all");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  const loadTurmas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callAPI({ action: "list_turmas" });
      setTurmas(res.turmas || []);
    } catch (e) {
      toast({ title: "Erro ao carregar turmas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [callAPI, toast]);

  useEffect(() => {
    loadTurmas();
  }, [loadTurmas]);

  const handleSearchStudents = useCallback(async () => {
    // We allow searching with just filters too, not only query string
    setSearchingStudents(true);
    try {
      const res = await callAPI({ 
        action: "get_students", 
        query: studentSearch,
        faculdades: faculdadeFilter === "all" ? [] : [faculdadeFilter],
        periodos: periodoFilter === "all" ? [] : [parseInt(periodoFilter)],
        limit: 100 // Load more for easier multi-selection
      });
      setSearchResults(res.students || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao buscar alunos", variant: "destructive" });
    } finally {
      setSearchingStudents(false);
    }
  }, [callAPI, studentSearch, faculdadeFilter, periodoFilter, toast]);

  // Trigger search when filters change or search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (studentSearch.length >= 3 || faculdadeFilter !== "all" || periodoFilter !== "all") {
        handleSearchStudents();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [studentSearch, faculdadeFilter, periodoFilter, handleSearchStudents]);

  const handleSaveTurma = async () => {
    if (!formData.name.trim()) {
      toast({ title: "Dê um nome à turma", variant: "destructive" });
      return;
    }

    try {
      if (editingTurma) {
        await callAPI({
          action: "update_turma",
          id: editingTurma.id,
          name: formData.name,
          description: formData.description,
          student_ids: selectedStudents.map(s => s.id)
        });
        toast({ title: "Turma atualizada com sucesso" });
      } else {
        await callAPI({
          action: "create_turma",
          name: formData.name,
          description: formData.description,
          student_ids: selectedStudents.map(s => s.id)
        });
        toast({ title: "Turma criada com sucesso" });
      }
      setIsDialogOpen(false);
      setEditingTurma(null);
      setFormData({ name: "", description: "" });
      setSelectedStudents([]);
      loadTurmas();
    } catch (e) {
      toast({ title: "Erro ao salvar turma", variant: "destructive" });
    }
  };

  const handleDeleteTurma = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta turma?")) return;
    try {
      await callAPI({ action: "delete_turma", id });
      toast({ title: "Turma excluída" });
      loadTurmas();
    } catch (e) {
      toast({ title: "Erro ao excluir turma", variant: "destructive" });
    }
  };

  const openEditDialog = (turma: Turma) => {
    setEditingTurma(turma);
    setFormData({ name: turma.name, description: turma.description });
    setSelectedStudents(turma.student_details?.map(s => ({ ...s, id: s.user_id || s.id })) || []);
    setIsDialogOpen(true);
  };

  const addStudent = (student: Student) => {
    if (!selectedStudents.find(s => s.id === student.id)) {
      setSelectedStudents([...selectedStudents, student]);
    }
    setStudentSearch("");
    setSearchResults([]);
  };

  const addAllStudents = () => {
    const newStudents = searchResults.filter(s => !selectedStudents.some(sel => sel.id === s.id));
    if (newStudents.length > 0) {
      setSelectedStudents([...selectedStudents, ...newStudents]);
      toast({ title: `${newStudents.length} alunos adicionados` });
    }
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(selectedStudents.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-widest">Minhas Turmas</h2>
          <p className="text-sm text-muted-foreground">Gerencie seus grupos de alunos para atribuições rápidas.</p>
        </div>
        <Button 
          onClick={() => {
            setEditingTurma(null);
            setFormData({ name: "", description: "" });
            setSelectedStudents([]);
            setIsDialogOpen(true);
          }}
          className="rounded-2xl gap-2 font-black uppercase tracking-widest text-[11px] shadow-glow-sm"
        >
          <Plus className="h-4 w-4" /> Nova Turma
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : turmas.length === 0 ? (
        <Card className="bg-card/20 border-white/5 backdrop-blur-md">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma turma cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-6">Crie turmas para agilizar a publicação de simulados e planos.</p>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>CRIAR MINHA PRIMEIRA TURMA</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {turmas.map((turma) => (
            <Card key={turma.id} className="bg-card/20 border-white/5 backdrop-blur-md hover:border-primary/20 transition-all group overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-primary">{turma.name}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs">{turma.description || "Sem descrição"}</CardDescription>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditDialog(turma)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTurma(turma.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{turma.student_details?.length || 0} alunos vinculados</span>
                </div>
                {turma.student_details?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {turma.student_details.slice(0, 3).map(s => (
                      <Badge key={s.id} variant="secondary" className="bg-white/5 text-[10px] font-normal">
                        {s.display_name.split(" ")[0]}
                      </Badge>
                    ))}
                    {turma.student_details.length > 3 && (
                      <Badge variant="secondary" className="bg-white/5 text-[10px] font-normal">
                        +{turma.student_details.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0 border-white/5 bg-[#0A0A0B] backdrop-blur-xl rounded-[32px]">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-primary">
              {editingTurma ? "Editar Turma" : "Nova Turma"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs uppercase tracking-wider font-bold">
              Defina o nome, descrição e selecione os alunos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nome da Turma</Label>
                <Input 
                  id="name" 
                  placeholder="Ex: Internato 2026 - Grupo A" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-white/5 border-white/10 h-10 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Descrição (Opcional)</Label>
                <Textarea 
                  id="description" 
                  placeholder="Descreva o propósito desta turma..." 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white/5 border-white/10 min-h-[80px] rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Alunos Selecionados ({selectedStudents.length})</Label>
                {selectedStudents.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedStudents([])} className="text-[10px] h-7 text-muted-foreground hover:text-destructive">
                    Remover Todos
                  </Button>
                )}
              </div>

              {selectedStudents.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {selectedStudents.map(student => (
                    <Badge key={student.id} className="bg-primary/20 text-primary border-primary/20 px-2 py-1 flex items-center gap-1.5 rounded-lg group">
                      <span className="text-xs">{student.display_name}</span>
                      <button onClick={() => removeStudent(student.id)} className="hover:bg-primary/30 rounded-full p-0.5 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="bg-white/5 border border-dashed border-white/10 rounded-2xl p-6 text-center">
                  <GraduationCap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum aluno selecionado ainda.</p>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Filter className="h-3 w-3" /> Filtrar e Adicionar Alunos
                  </Label>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Faculdade</Label>
                    <Select value={faculdadeFilter} onValueChange={setFaculdadeFilter}>
                      <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl text-xs">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0A0A0B] border-white/10">
                        <SelectItem value="all">Todas</SelectItem>
                        {FACULDADES.map((f) => (
                          <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Período</Label>
                    <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
                      <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl text-xs">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0A0A0B] border-white/10">
                        <SelectItem value="all">Todos</SelectItem>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
                          <SelectItem key={p} value={String(p)} className="text-xs">{p}º período</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome ou e-mail..." 
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10 h-10 rounded-xl"
                  />
                  {searchingStudents && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                </div>

                {searchResults.length > 0 && (
                  <Card className="bg-[#121214] border-white/10 shadow-2xl overflow-hidden">
                    <div className="p-2 border-b border-white/5 flex justify-between items-center bg-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {searchResults.length} resultados encontrados
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={addAllStudents}
                        className="h-7 text-[10px] gap-1.5 hover:bg-primary/20 hover:text-primary font-bold uppercase"
                      >
                        <CheckSquare className="h-3 w-3" /> Adicionar Todos
                      </Button>
                    </div>
                    <ScrollArea className="h-48">
                      <div className="p-2 space-y-1">
                        {searchResults.map((s) => {
                          const isAlreadySelected = selectedStudents.some(sel => sel.id === s.id);
                          return (
                            <button
                              key={s.user_id || s.id}
                              onClick={() => !isAlreadySelected && addStudent(s)}
                              disabled={isAlreadySelected}
                              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50 text-left group"
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{s.display_name}</span>
                                <span className="text-[10px] text-white/40">{s.email} • {s.faculdade || "Sem faculdade"} {s.periodo ? `• ${s.periodo}º` : ""}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{s.display_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <p className="text-[10px] text-muted-foreground truncate">{s.email}</p>
                                  {s.periodo && (
                                    <Badge variant="outline" className="h-4 px-1 text-[8px] border-white/10 text-muted-foreground">
                                      {s.periodo}º
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {isAlreadySelected ? (
                                <Badge variant="secondary" className="h-6 bg-green-500/10 text-green-500 border-green-500/20 text-[9px]">
                                  Adicionado
                                </Badge>
                              ) : (
                                <UserPlus className="h-4 w-4 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </Card>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-0">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl text-xs uppercase font-bold tracking-widest">Cancelar</Button>
            <Button onClick={handleSaveTurma} className="rounded-xl px-8 shadow-glow-sm text-xs uppercase font-bold tracking-widest">
              {editingTurma ? "Salvar Alterações" : "Criar Turma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfessorTurmaManager;

import { memo, useState, useEffect } from "react";
import { Loader2, Plus, Users, CheckSquare, Square, Building2, UserPlus, Globe, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { FACULDADES } from "@/constants/faculdades";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  assignmentMode: "filter" | "classes" | "manual" | "all";
  onAssignmentModeChange: (v: "filter" | "classes" | "manual" | "all") => void;
  faculdadeFilter: string;
  periodoFilter: string;
  onFaculdadeChange: (v: string) => void;
  onPeriodoChange: (v: string) => void;
  previewStudents: any[];
  previewLoading: boolean;
  selectedStudentIds: string[];
  selectedClassIds: string[];
  onSelectedClassIdsChange: (ids: string[]) => void;
  studentSearch: string;
  searchResults: any[];
  searchingStudents: boolean;
  onStudentSearchChange: (v: string) => void;
  onPreviewMatchingStudents: () => void;
  onSearchStudentGlobal: () => void;
  onAddSearchedStudent: (student: any) => void;
  onToggleStudent: (id: string) => void;
  onToggleAllStudents: () => void;
}

const SimuladoAssignmentManager = memo(function SimuladoAssignmentManager({
  assignmentMode, onAssignmentModeChange,
  faculdadeFilter, periodoFilter, onFaculdadeChange, onPeriodoChange,
  previewStudents, previewLoading, selectedStudentIds,
  selectedClassIds, onSelectedClassIdsChange,
  studentSearch, searchResults, searchingStudents, onStudentSearchChange,
  onPreviewMatchingStudents, onSearchStudentGlobal, onAddSearchedStudent,
  onToggleStudent, onToggleAllStudents,
}: Props) {
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    if (assignmentMode === "classes" && classes.length === 0) {
      loadClasses();
    }
  }, [assignmentMode]);

  async function loadClasses() {
    setLoadingClasses(true);
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, period")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setClasses(data || []);
    } catch (e) {
      console.error("Erro ao carregar turmas:", e);
    } finally {
      setLoadingClasses(false);
    }
  }

  const toggleClass = (id: string) => {
    onSelectedClassIdsChange(
      selectedClassIds.includes(id)
        ? selectedClassIds.filter(cid => cid !== id)
        : [...selectedClassIds, id]
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-base font-semibold">Atribuição do Simulado</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Button
            type="button"
            variant={assignmentMode === "filter" ? "default" : "outline"}
            size="sm"
            onClick={() => onAssignmentModeChange("filter")}
            className="text-[10px] font-bold uppercase tracking-wider h-9"
          >
            <Building2 className="mr-1.5 h-3.5 w-3.5" /> FILTROS
          </Button>
          <Button
            type="button"
            variant={assignmentMode === "classes" ? "default" : "outline"}
            size="sm"
            onClick={() => onAssignmentModeChange("classes")}
            className="text-[10px] font-bold uppercase tracking-wider h-9"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" /> TURMAS
          </Button>
          <Button
            type="button"
            variant={assignmentMode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => onAssignmentModeChange("manual")}
            className="text-[10px] font-bold uppercase tracking-wider h-9"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> SELEÇÃO
          </Button>
          <Button
            type="button"
            variant={assignmentMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => onAssignmentModeChange("all")}
            className="text-[10px] font-bold uppercase tracking-wider h-9"
          >
            <Globe className="mr-1.5 h-3.5 w-3.5" /> TODOS
          </Button>
        </div>
      </div>

      {assignmentMode === "filter" && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Faculdade</Label>
              <Select value={faculdadeFilter} onValueChange={onFaculdadeChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {FACULDADES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Período</Label>
              <Select value={periodoFilter} onValueChange={onPeriodoChange}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((p) => (
                    <SelectItem key={p} value={String(p)}>{p}º período</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            O simulado será atribuído automaticamente a todos os alunos que atenderem a estes critérios.
          </p>
        </div>
      )}

      {assignmentMode === "classes" && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
          {loadingClasses ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : classes.length === 0 ? (
            <p className="text-xs text-center py-4 text-muted-foreground">Nenhuma turma ativa encontrada.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {classes.map((c) => {
                if (!c?.id) return null;
                const isSelected = selectedClassIds?.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClass(c.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all group ${
                      isSelected 
                        ? "bg-primary/10 border-primary/40 shadow-glow-sm" 
                        : "bg-background/40 border-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg transition-colors ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-muted-foreground group-hover:text-white'}`}>
                       {isSelected ? <CheckSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate uppercase tracking-tight">{c.name || "Turma sem nome"}</p>
                      {c.period && <p className="text-[10px] text-muted-foreground">{c.period}º período</p>}
                    </div>
                    {!isSelected && <Plus className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {assignmentMode === "manual" && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar aluno por nome ou e-mail..."
              value={studentSearch}
              onChange={(e) => onStudentSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearchStudentGlobal()}
              className="h-9 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSearchStudentGlobal}
              disabled={searchingStudents}
              className="shrink-0 h-9 px-4"
            >
              {searchingStudents ? <Loader2 className="h-3 w-3 animate-spin" /> : "BUSCAR"}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1 bg-secondary/20 rounded-xl p-2 border border-white/5">
              {searchResults.map((s: any) => (
                <button
                  type="button"
                  key={s.user_id}
                  onClick={() => onAddSearchedStudent(s)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs bg-background/50 border border-border hover:border-primary/30 transition-all group"
                >
                  <Plus className="h-3.5 w-3.5 text-primary shrink-0 group-hover:scale-125 transition-transform" />
                  <span className="truncate font-medium">{s.display_name || s.email}</span>
                  {s.faculdade && <Badge variant="outline" className="text-[9px] ml-auto uppercase">{s.faculdade}</Badge>}
                </button>
              ))}
            </div>
          )}

          {previewStudents.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {selectedStudentIds.length}/{previewStudents.length} SELECIONADOS
                </p>
                <button
                  type="button"
                  onClick={onToggleAllStudents}
                  className="text-[10px] text-primary hover:underline font-bold uppercase tracking-widest"
                >
                  {selectedStudentIds.length === previewStudents.length ? "LIMPAR" : "TODOS"}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {previewStudents.map((s: any) => {
                  if (!s?.user_id) return null;
                  const isSelected = selectedStudentIds?.includes(s.user_id);
                  return (
                    <button
                      type="button"
                      key={s.user_id}
                      onClick={() => onToggleStudent(s.user_id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left text-xs transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary/40 shadow-glow-sm"
                          : "bg-background/40 border-white/5 hover:border-white/10"
                      }`}
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-bold uppercase tracking-tight">{s.display_name || s.email || "Aluno sem identificação"}</p>
                        {s.faculdade && <p className="text-[9px] text-muted-foreground uppercase">{s.faculdade}</p>}
                      </div>
                      {s.periodo && <span className="text-muted-foreground text-[10px] font-bold shrink-0">{s.periodo}º</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : !searchingStudents && (
            <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-40">
              <Search className="h-8 w-8 mx-auto mb-2" />
              <p className="text-[10px] font-bold uppercase tracking-widest">Busque alunos para começar</p>
            </div>
          )}
        </div>
      )}

      {assignmentMode === "all" && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-1">
          <p className="text-xs font-medium text-center">
            🌍 Este simulado será visível para <strong>TODOS</strong> os alunos cadastrados na plataforma.
          </p>
        </div>
      )}
    </div>
  );
});

export default SimuladoAssignmentManager;
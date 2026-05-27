import { memo, useState, useEffect } from "react";
import { Loader2, Plus, Users, CheckSquare, Square, Building2, UserPlus, Globe, Search, ChevronDown, X, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { FACULDADES } from "@/constants/faculdades";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  assignmentMode: "filter" | "classes" | "professor_turmas" | "manual" | "all";
  onAssignmentModeChange: (v: "filter" | "classes" | "professor_turmas" | "manual" | "all") => void;
  faculdadeFilters: string[];
  periodoFilters: string[];
  onFaculdadeChange: (v: string[]) => void;
  onPeriodoChange: (v: string[]) => void;
  previewStudents: any[];
  previewLoading: boolean;
  selectedStudentIds: string[];
  selectedClassIds: string[];
  onSelectedClassIdsChange: (ids: string[]) => void;
  selectedProfessorTurmaIds: string[];
  onSelectedProfessorTurmaIdsChange: (ids: string[]) => void;
  studentSearch: string;
  searchResults: any[];
  searchingStudents: boolean;
  onStudentSearchChange: (v: string) => void;
  onPreviewMatchingStudents: (isLoadMore?: boolean) => void;
  onSearchStudentGlobal: (isLoadMore?: boolean) => void;
  onAddSearchedStudent: (student: any) => void;
  onToggleStudent: (student: any) => void;
  onToggleAllStudents: () => void;
  onClearStudentSelection: () => void;
  onRemoveSelectedStudent: (userId: string) => void;
  studentPagination: { offset: number; total: number; hasMore: boolean };
  selectedStudentsData: any[];
}

const MultiSelectPopover = ({ 
  label, 
  options, 
  selected, 
  onSelectedChange,
  placeholder = "Selecionar..."
}: { 
  label: string; 
  options: string[]; 
  selected: string[]; 
  onSelectedChange: (v: string[]) => void;
  placeholder?: string;
}) => {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-widest font-black opacity-60">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            role="combobox" 
            className="w-full justify-between h-10 border-white/10 bg-white/5 hover:bg-white/10 text-xs text-left px-3 font-medium"
          >
            <div className="flex flex-wrap gap-1 max-w-[90%] overflow-hidden truncate">
              {selected.length === 0 ? (
                <span className="opacity-50">{placeholder}</span>
              ) : selected.length === 1 ? (
                <span>{selected[0]}</span>
              ) : (
                <span>{selected.length} selecionados</span>
              )}
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-background/95 backdrop-blur-xl border-white/10" align="start">
          <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
            {options.map((option) => (
              <div 
                key={option} 
                className="flex items-center space-x-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                onClick={() => {
                  const next = selected.includes(option)
                    ? selected.filter(s => s !== option)
                    : [...selected, option];
                  onSelectedChange(next);
                }}
              >
                <Checkbox 
                  id={`opt-${option}`} 
                  checked={selected.includes(option)}
                  onCheckedChange={() => {}} // handled by onClick on div
                />
                <label className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 py-1">
                  {option}
                </label>
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-white/10 p-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-[10px] font-black uppercase"
                onClick={() => onSelectedChange([])}
              >
                LIMPAR SELEÇÃO
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

const SimuladoAssignmentManager = memo(function SimuladoAssignmentManager({
  assignmentMode, onAssignmentModeChange,
  faculdadeFilters, periodoFilters, onFaculdadeChange, onPeriodoChange,
  previewStudents, previewLoading, selectedStudentIds,
  selectedClassIds, onSelectedClassIdsChange,
  selectedProfessorTurmaIds, onSelectedProfessorTurmaIdsChange,
  studentSearch, searchResults, searchingStudents, onStudentSearchChange,
  onPreviewMatchingStudents, onSearchStudentGlobal, onAddSearchedStudent,
  onToggleStudent, onToggleAllStudents, onClearStudentSelection, onRemoveSelectedStudent,
  studentPagination, selectedStudentsData,
}: Props) {
  const [classes, setClasses] = useState<any[]>([]);
  const [professorTurmas, setProfessorTurmas] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (assignmentMode === "classes" && classes.length === 0) {
      loadClasses();
    } else if (assignmentMode === "professor_turmas" && professorTurmas.length === 0) {
      loadProfessorTurmas();
    }
  }, [assignmentMode]);

  async function loadClasses() {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("classes")
        .select("id, name, period")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setClasses(data || []);
    } catch (e) {
      console.error("Erro ao carregar turmas institucionais:", e);
    } finally {
      setLoadingItems(false);
    }
  }

  async function loadProfessorTurmas() {
    setLoadingItems(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profProfile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      if (!profProfile) return;

      const { data, error } = await supabase
        .from("professor_turmas")
        .select("id, name, description")
        .eq("professor_id", profProfile.id)
        .order("name");
      if (error) throw error;
      setProfessorTurmas(data || []);
    } catch (e) {
      console.error("Erro ao carregar minhas turmas:", e);
    } finally {
      setLoadingItems(false);
    }
  }

  const toggleClass = (id: string) => {
    onSelectedClassIdsChange(
      selectedClassIds.includes(id)
        ? selectedClassIds.filter(cid => cid !== id)
        : [...selectedClassIds, id]
    );
  };

  const toggleProfessorTurma = (id: string) => {
    onSelectedProfessorTurmaIdsChange(
      selectedProfessorTurmaIds.includes(id)
        ? selectedProfessorTurmaIds.filter(tid => tid !== id)
        : [...selectedProfessorTurmaIds, id]
    );
  };

  const periodOptions = Array.from({ length: 12 }, (_, i) => String(i + 1));

  // Painel reutilizável de seleção nominal/individual de alunos do filtro atual.
  // Aparece em todos os modos para o professor desmarcar quem não vai participar.
  const NominalStudentList = () => {
    if (previewLoading && previewStudents.length === 0) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }
    if (previewStudents.length === 0) {
      return (
        <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-40 flex flex-col items-center">
          <Users className="h-8 w-8 mb-3" />
          <p className="text-[11px] font-black uppercase tracking-widest">Nenhum aluno no filtro selecionado</p>
        </div>
      );
    }
    return (
      <div className="space-y-4 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between px-2">
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Alunos do filtro: {studentPagination.total}
            </h4>
            <p className="text-[9px] font-bold text-primary/60 uppercase">
              {selectedStudentIds.length} participarão · desmarque para excluir
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleAllStudents()}
            className="text-[10px] text-primary hover:text-primary/80 font-black uppercase tracking-widest transition-colors"
          >
            {selectedStudentIds.length >= previewStudents.length && previewStudents.length > 0 ? "DESMARCAR PÁGINA" : "MARCAR PÁGINA"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
          {previewStudents.map((s: any) => {
            const isSelected = selectedStudentIds.includes(s.user_id);
            return (
              <button
                key={s.user_id}
                type="button"
                onClick={() => onToggleStudent(s)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border text-left transition-all group",
                  isSelected
                    ? "bg-primary/10 border-primary/40 shadow-glow-sm"
                    : "bg-background/40 border-white/5 hover:border-white/10"
                )}
              >
                <div className={cn(
                  "h-5 w-5 rounded flex items-center justify-center border transition-colors",
                  isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-white/5 border-white/10 group-hover:border-primary/50"
                )}>
                  {isSelected && <CheckSquare className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-tight truncate">{s.display_name || s.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[8px] h-4 px-1 opacity-60 uppercase">{s.faculdade || "N/A"}</Badge>
                    <span className="text-[10px] font-bold text-white/30">{s.periodo}º PERÍODO</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {studentPagination.hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreviewMatchingStudents(true)}
              disabled={previewLoading}
              className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
            >
              {previewLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
              CARREGAR MAIS ({studentPagination.total - previewStudents.length} RESTANTES)
            </Button>
          </div>
        )}
      </div>
    );
  };

    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Atribuição do Simulado</Label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { id: "filter", label: "FILTROS", icon: Building2 },
            { id: "professor_turmas", label: "MINHAS", icon: Heart },
            { id: "classes", label: "INSTITUC.", icon: Users },
            { id: "manual", label: "SELEÇÃO", icon: UserPlus },
            { id: "all", label: "TODOS", icon: Globe },
          ].map((mode) => {
            const Icon = mode.icon;
            const active = assignmentMode === mode.id;
            return (
              <Button
                key={mode.id}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => onAssignmentModeChange(mode.id as any)}
                className={cn(
                  "text-[9px] font-black uppercase tracking-widest h-10 gap-1.5 border-white/5",
                  active ? "bg-primary text-primary-foreground shadow-glow-sm" : "hover:bg-white/5 text-white/60 hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{mode.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {(assignmentMode === "filter" || assignmentMode === "manual") && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="p-5 rounded-2xl border border-white/5 bg-white/5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <MultiSelectPopover 
                label="Universidades" 
                options={FACULDADES} 
                selected={faculdadeFilters} 
                onSelectedChange={onFaculdadeChange}
                placeholder="Todas as universidades"
              />
              <MultiSelectPopover 
                label="Períodos" 
                options={periodOptions.map(p => `${p}º período`)} 
                selected={periodoFilters.map(p => `${p}º período`)} 
                onSelectedChange={(v) => onPeriodoChange(v.map(p => p.replace("º período", "")))}
                placeholder="Todos os períodos"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Filtrar por nome ou e-mail..."
                  value={studentSearch}
                  onChange={(e) => onStudentSearchChange(e.target.value)}
                  className="h-11 pl-10 border-white/10 bg-background/50 text-xs font-medium"
                />
              </div>
              <Button
                type="button"
                onClick={() => onPreviewMatchingStudents(false)}
                disabled={previewLoading}
                className="h-11 px-8 bg-primary hover:bg-primary/90 font-black uppercase tracking-widest text-[11px] shadow-glow-sm"
              >
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                BUSCAR ALUNOS
              </Button>
            </div>
          </div>

          {assignmentMode === "filter" && (
            <Alert className="bg-primary/5 border-primary/20">
              <Building2 className="h-4 w-4 text-primary" />
              <AlertDescription className="text-[11px] font-bold uppercase tracking-widest opacity-70">
                Modo Automático: O simulado será atribuído a todos os alunos que atenderem aos critérios acima agora e no futuro.
              </AlertDescription>
            </Alert>
          )}

          {previewStudents.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="space-y-0.5">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Encontrados: {studentPagination.total} alunos
                  </h4>
                  <p className="text-[9px] font-bold text-primary/60 uppercase">
                    {selectedStudentIds.length} SELECIONADOS MANUALMENTE
                  </p>
                </div>
                <div className="flex gap-4">
                   <button
                    type="button"
                    onClick={() => onToggleAllStudents()}
                    className="text-[10px] text-primary hover:text-primary/80 font-black uppercase tracking-widest transition-colors"
                  >
                    {selectedStudentIds.length >= previewStudents.length && previewStudents.length > 0 ? "DESELECIONAR PÁGINA" : "SELECIONAR PÁGINA"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                {previewStudents.map((s: any) => {
                  const isSelected = selectedStudentIds.includes(s.user_id);
                  return (
                    <button
                      key={s.user_id}
                      type="button"
                      onClick={() => onToggleStudent(s)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border text-left transition-all group",
                        isSelected 
                          ? "bg-primary/10 border-primary/40 shadow-glow-sm" 
                          : "bg-background/40 border-white/5 hover:border-white/10"
                      )}
                    >
                      <div className={cn(
                        "h-5 w-5 rounded flex items-center justify-center border transition-colors",
                        isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-white/5 border-white/10 group-hover:border-primary/50"
                      )}>
                        {isSelected && <CheckSquare className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-tight truncate">{s.display_name || s.email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[8px] h-4 px-1 opacity-60 uppercase">{s.faculdade || "N/A"}</Badge>
                          <span className="text-[10px] font-bold text-white/30">{s.periodo}º PERÍODO</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {studentPagination.hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPreviewMatchingStudents(true)}
                    disabled={previewLoading}
                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
                  >
                    {previewLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Plus className="h-3 w-3 mr-2" />}
                    CARREGAR MAIS ({studentPagination.total - previewStudents.length} RESTANTES)
                  </Button>
                </div>
              )}
            </div>
          ) : !previewLoading && (
            <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30 flex flex-col items-center">
              <Users className="h-10 w-10 mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">Nenhum aluno encontrado</p>
              <p className="text-[11px] font-medium opacity-60 mt-1">Ajuste os filtros ou digite um nome para buscar</p>
            </div>
          )}

          {selectedStudentIds.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  {selectedStudentIds.length} ALUNOS SELECIONADOS
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClearStudentSelection}
                  className="h-6 text-[9px] font-black uppercase text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                >
                  LIMPAR TUDO
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-1 custom-scrollbar">
                {selectedStudentsData.map((s: any) => (
                  <Badge 
                    key={s.user_id} 
                    variant="secondary" 
                    className="pl-2 pr-1 py-1 gap-1 border-white/10 bg-white/5 text-[10px] font-bold uppercase"
                  >
                    <span className="truncate max-w-[150px]">{s.display_name || s.email}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSelectedStudent(s.user_id);
                      }}
                      className="p-0.5 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {assignmentMode === "classes" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {loadingItems ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : classes.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30 flex flex-col items-center">
              <Users className="h-10 w-10 mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">Nenhuma turma ativa</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {classes.map((c) => {
                const isSelected = selectedClassIds?.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClass(c.id)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border text-left transition-all group",
                      isSelected 
                        ? "bg-primary/10 border-primary/40 shadow-glow-sm" 
                        : "bg-background/40 border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl transition-colors",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/40 group-hover:text-white"
                    )}>
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase tracking-tight truncate">{c.name}</p>
                      {c.period && <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{c.period}º PERÍODO</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {assignmentMode === "professor_turmas" && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          {loadingItems ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : professorTurmas.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-white/5 rounded-3xl opacity-30 flex flex-col items-center">
              <Heart className="h-10 w-10 mb-4" />
              <p className="text-sm font-black uppercase tracking-widest">Minhas turmas vazias</p>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-2">Crie suas turmas personalizadas no painel principal</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {professorTurmas.map((t) => {
                const isSelected = selectedProfessorTurmaIds?.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleProfessorTurma(t.id)}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border text-left transition-all group",
                      isSelected 
                        ? "bg-primary/10 border-primary/40 shadow-glow-sm" 
                        : "bg-background/40 border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-xl transition-colors",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-white/5 text-white/40 group-hover:text-white"
                    )}>
                      <Heart className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black uppercase tracking-tight truncate">{t.name}</p>
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest truncate">{t.description || "Personalizada"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {assignmentMode === "all" && (
        <div className="py-16 text-center border-2 border-dashed border-primary/20 bg-primary/5 rounded-3xl flex flex-col items-center animate-in fade-in slide-in-from-top-2">
          <Globe className="h-10 w-10 text-primary mb-4" />
          <p className="text-sm font-black uppercase tracking-widest">Visibilidade Global</p>
          <p className="text-[11px] font-medium opacity-60 mt-1 max-w-[280px]">Este simulado ficará disponível para todos os alunos ativos da plataforma.</p>
        </div>
      )}
    </div>
  );
});

export default SimuladoAssignmentManager;

import { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, X, Users, Filter, CheckCircle2 } from "lucide-react";
import {
  useInstitutionStudents,
  useInstitutionStudentFacets,
  type InstitutionStudent,
} from "@/hooks/useInstitutionStudents";

interface SelectedStudent {
  id: string;
  name: string;
}

interface Props {
  selected: SelectedStudent[];
  onChange: (next: SelectedStudent[]) => void;
  /** Optional callback to get filter metadata like selected classId */
  onFilterChange?: (filters: { classId: string | null; faculdade: string | null; periodo: number | null }) => void;
}

const ANY = "__any__";

const StudentDistributionSelector = ({ selected, onChange, onFilterChange }: Props) => {
  const [search, setSearch] = useState("");
  const [faculdade, setFaculdade] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<number | null>(null);
  const [classId, setClassId] = useState<string | null>(null);

  const { data: facets } = useInstitutionStudentFacets();
  const { data: students, isLoading } = useInstitutionStudents({
    search,
    faculdade,
    periodo,
    classId,
  });

  const selectedSet = useMemo(
    () => new Set(selected.map((s) => s.id)),
    [selected]
  );

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({ classId, faculdade, periodo });
    }
  }, [classId, faculdade, periodo, onFilterChange]);

  const toggle = (s: InstitutionStudent) => {
    const name = s.display_name || s.email || "Aluno";
    if (selectedSet.has(s.user_id)) {
      onChange(selected.filter((x) => x.id !== s.user_id));
    } else {
      onChange([...selected, { id: s.user_id, name }]);
    }
  };

  const addAllVisible = () => {
    const merged = new Map(selected.map((s) => [s.id, s]));
    (students || []).forEach((s) => {
      if (!merged.has(s.user_id)) {
        merged.set(s.user_id, {
          id: s.user_id,
          name: s.display_name || s.email || "Aluno",
        });
      }
    });
    onChange(Array.from(merged.values()));
  };

  const clearAll = () => onChange([]);

  const visibleCount = students?.length || 0;
  const allVisibleSelected =
    visibleCount > 0 && (students || []).every((s) => selectedSet.has(s.user_id));

  return (
    <div className="space-y-4">
      {/* Filters Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-xl border border-border/50">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Search className="h-3 w-3" /> Busca Direta
          </Label>
          <div className="relative">
            <Input
              className="h-9 pl-8 text-xs bg-background"
              placeholder="Nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Turma
          </Label>
          <Select
            value={classId ?? ANY}
            onValueChange={(v) => setClassId(v === ANY ? null : v)}
          >
            <SelectTrigger className="h-9 text-xs bg-background">
              <SelectValue placeholder="Todas as Turmas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas as Turmas</SelectItem>
              {(facets?.classes || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3 w-3" /> Faculdade
          </Label>
          <Select
            value={faculdade ?? ANY}
            onValueChange={(v) => setFaculdade(v === ANY ? null : v)}
          >
            <SelectTrigger className="h-9 text-xs bg-background">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todas</SelectItem>
              {(facets?.faculdades || []).map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3 w-3" /> Período
          </Label>
          <Select
            value={periodo === null ? ANY : String(periodo)}
            onValueChange={(v) => setPeriodo(v === ANY ? null : Number(v))}
          >
            <SelectTrigger className="h-9 text-xs bg-background">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {(facets?.periodos || []).map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p}º período
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="text-[10px] h-5 gap-1.5 px-2 font-medium">
             <Users className="h-3 w-3" />
             {isLoading ? "..." : visibleCount} disponíveis
           </Badge>
           <Badge variant="secondary" className="text-[10px] h-5 gap-1.5 px-2 font-medium bg-primary/10 text-primary border-primary/20">
             <CheckCircle2 className="h-3 w-3" />
             {selected.length} selecionados
           </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-[10px] h-7 font-bold uppercase tracking-wider"
            disabled={visibleCount === 0 || allVisibleSelected || isLoading}
            onClick={addAllVisible}
          >
            Selecionar Visíveis
          </Button>
          {selected.length > 0 && (
            <Button 
              type="button" 
              size="sm" 
              variant="ghost" 
              className="text-[10px] h-7 font-bold uppercase tracking-wider text-destructive hover:text-destructive hover:bg-destructive/10" 
              onClick={clearAll}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Student List */}
      <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden shadow-inner">
        <ScrollArea className="h-56">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs">Sincronizando base de alunos...</span>
            </div>
          ) : visibleCount === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Nenhum aluno encontrado para estes filtros.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {(students || []).map((s) => {
                const checked = selectedSet.has(s.user_id);
                return (
                  <label
                    key={s.user_id}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 cursor-pointer transition-colors ${checked ? 'bg-primary/5' : ''}`}
                  >
                    <Checkbox 
                      checked={checked} 
                      onCheckedChange={() => toggle(s)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground/90 truncate">
                          {s.display_name || "(sem nome)"}
                        </span>
                        {checked && <Badge className="h-4 text-[8px] bg-primary/20 text-primary border-0">Selecionado</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate uppercase tracking-tight flex items-center gap-2">
                        <span>{s.email}</span>
                        {s.faculdade && (
                          <>
                            <span className="opacity-30">|</span>
                            <span>{s.faculdade}</span>
                          </>
                        )}
                        {s.periodo && (
                          <>
                            <span className="opacity-30">|</span>
                            <span>{s.periodo}º Período</span>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Final Preview Area */}
      {selected.length > 0 && (
        <div className="pt-2">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
            Resumo da Distribuição ({selected.length})
          </Label>
          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-muted/20 border border-dashed border-border/60 max-h-24 overflow-y-auto">
            {selected.map((s) => (
              <Badge key={s.id} variant="outline" className="text-[10px] py-0.5 pl-2 pr-1 gap-1 border-primary/20 bg-background/50 hover:bg-background transition-colors group">
                <span className="truncate max-w-[120px]">{s.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
                  className="p-0.5 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDistributionSelector;

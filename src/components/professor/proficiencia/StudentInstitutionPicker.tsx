import { useMemo, useState } from "react";
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
import { Loader2, Search, X, Users } from "lucide-react";
import {
  useInstitutionStudents,
  useInstitutionStudentFacets,
  type InstitutionStudent,
} from "@/hooks/useInstitutionStudents";

interface Props {
  selected: { id: string; name: string }[];
  onChange: (next: { id: string; name: string }[]) => void;
}

const ANY = "__any__";

const StudentInstitutionPicker = ({ selected, onChange }: Props) => {
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px] space-y-1">
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Nome ou email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Universidade</Label>
          <Select
            value={faculdade ?? ANY}
            onValueChange={(v) => setFaculdade(v === ANY ? null : v)}
          >
            <SelectTrigger className="w-[200px]">
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
        <div className="space-y-1">
          <Label className="text-xs">Período</Label>
          <Select
            value={periodo === null ? ANY : String(periodo)}
            onValueChange={(v) => setPeriodo(v === ANY ? null : Number(v))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Todos</SelectItem>
              {(facets?.periodos || []).map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p}º
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Turma</Label>
          <Select
            value={classId ?? ANY}
            onValueChange={(v) => setClassId(v === ANY ? null : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas" />
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
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {isLoading
            ? "Carregando..."
            : `${visibleCount} aluno${visibleCount === 1 ? "" : "s"} visível${
                visibleCount === 1 ? "" : "is"
              } · ${selected.length} selecionado${selected.length === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={visibleCount === 0 || allVisibleSelected}
            onClick={addAllVisible}
          >
            Selecionar todos visíveis
          </Button>
          {selected.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
              Limpar
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="h-56 rounded-lg border border-border">
        {isLoading ? (
          <div className="flex items-center justify-center h-full p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleCount === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Nenhum aluno visível com os filtros atuais.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(students || []).map((s) => {
              const checked = selectedSet.has(s.user_id);
              return (
                <label
                  key={s.user_id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggle(s)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {s.display_name || "(sem nome)"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.email}
                      {s.faculdade ? ` · ${s.faculdade}` : ""}
                      {s.periodo ? ` · ${s.periodo}º período` : ""}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1">
              {s.name}
              <button
                type="button"
                onClick={() => onChange(selected.filter((x) => x.id !== s.id))}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentInstitutionPicker;

import { memo } from "react";
import { Loader2, Plus, Users, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FACULDADES } from "@/constants/faculdades";

interface Props {
  faculdadeFilter: string;
  periodoFilter: string;
  onFaculdadeChange: (v: string) => void;
  onPeriodoChange: (v: string) => void;
  previewStudents: any[];
  previewLoading: boolean;
  selectedStudentIds: string[];
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

/**
 * Bloco de filtros + lista de alunos selecionados + busca global.
 * Isolado para que digitar na busca ou marcar/desmarcar não rerenderize
 * temas, dificuldade ou questões.
 */
const SimuladoStudentPicker = memo(function SimuladoStudentPicker({
  faculdadeFilter, periodoFilter, onFaculdadeChange, onPeriodoChange,
  previewStudents, previewLoading, selectedStudentIds,
  studentSearch, searchResults, searchingStudents, onStudentSearchChange,
  onPreviewMatchingStudents, onSearchStudentGlobal, onAddSearchedStudent,
  onToggleStudent, onToggleAllStudents,
}: Props) {
  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Filtrar Alunos</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Faculdade</Label>
          <Select value={faculdadeFilter} onValueChange={onFaculdadeChange}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {FACULDADES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Período</Label>
          <Select value={periodoFilter} onValueChange={onPeriodoChange}>
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onPreviewMatchingStudents}
        disabled={previewLoading}
        className="gap-1.5"
      >
        <Users className="h-3.5 w-3.5" />{" "}
        {previewLoading ? "Buscando..." : "Ver alunos que receberão"}
      </Button>
      {previewStudents.length > 0 && (
        <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">
              {selectedStudentIds.length}/{previewStudents.length} aluno(s) selecionado(s)
            </p>
            <button
              type="button"
              onClick={onToggleAllStudents}
              className="text-[11px] text-primary hover:underline font-medium"
            >
              {selectedStudentIds.length === previewStudents.length
                ? "Desmarcar todos"
                : "Selecionar todos"}
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {previewStudents.map((s: any) => {
              const isSelected = selectedStudentIds.includes(s.user_id);
              return (
                <button
                  type="button"
                  key={s.user_id}
                  onClick={() => onToggleStudent(s.user_id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-background/50 border border-border hover:border-primary/20"
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate font-medium">{s.display_name || s.email}</span>
                  {s.periodo && (
                    <span className="text-muted-foreground ml-auto shrink-0">{s.periodo}º</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* Global student search */}
      <div className="border-t border-border pt-3 mt-2 space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          Ou buscar aluno específico
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={studentSearch}
            onChange={(e) => onStudentSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchStudentGlobal()}
            className="h-8 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSearchStudentGlobal}
            disabled={searchingStudents}
            className="shrink-0 h-8 text-xs"
          >
            {searchingStudents ? <Loader2 className="h-3 w-3 animate-spin" /> : "Buscar"}
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="max-h-32 overflow-y-auto space-y-1">
            {searchResults.map((s: any) => (
              <button
                type="button"
                key={s.user_id}
                onClick={() => onAddSearchedStudent(s)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs bg-background/50 border border-border hover:border-primary/30 transition-colors"
              >
                <Plus className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate font-medium">{s.display_name || s.email}</span>
                {s.faculdade && (
                  <span className="text-muted-foreground text-[10px] ml-auto shrink-0">
                    {s.faculdade}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default SimuladoStudentPicker;

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Search } from "lucide-react";

export interface RiskRow {
  student_id: string;
  display_name: string;
  faculdade: string | null;
  periodo: number | null;
  performance_score: number;
  consistency_score: number;
  evolution_score: number;
  practical_score: number;
  performance_rank: number | null;
  performance_rank_delta: number | null;
  percentile: number | null;
  risk_score: number;
  faixa: "baixo" | "medio" | "alto" | "critico";
  has_snapshot: boolean;
}

interface Props {
  ranking: RiskRow[];
  loading?: boolean;
  onOpenStudent: (studentId: string) => void;
}

const faixaCls = (f: RiskRow["faixa"]) => {
  switch (f) {
    case "critico": return "bg-destructive/15 text-destructive border-destructive/30";
    case "alto": return "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400";
    case "medio": return "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-300";
    case "baixo": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";
  }
};

const faixaLabel = (f: RiskRow["faixa"]) =>
  f === "critico" ? "Crítico" : f === "alto" ? "Alto" : f === "medio" ? "Médio" : "Baixo";

const RiskRankingPanel = ({ ranking, loading, onOpenStudent }: Props) => {
  const [filter, setFilter] = useState<"all" | RiskRow["faixa"]>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return ranking.filter((r) => {
      if (filter !== "all" && r.faixa !== filter) return false;
      if (search && !r.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [ranking, filter, search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span>Ranking de Risco</span>
          <span className="text-xs font-normal text-muted-foreground">
            {filtered.length} de {ranking.length} aluno(s)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Faixa de risco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as faixas</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="medio">Médio</SelectItem>
              <SelectItem value="baixo">Baixo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="h-48 animate-pulse rounded-md bg-muted/30" />
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</div>
        ) : (
          <div className="rounded-md border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Aluno</TableHead>
                  <TableHead className="text-right">Risco</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Perf.</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Consist.</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Evol.</TableHead>
                  <TableHead className="text-right">Faixa</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.student_id}>
                    <TableCell className="font-medium">
                      <div className="truncate">{r.display_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.has_snapshot
                          ? `Rank ${r.performance_rank ?? "—"}${r.percentile != null ? ` · P${r.percentile}` : ""}`
                          : "Sem snapshot"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{r.risk_score}</TableCell>
                    <TableCell className="text-right hidden sm:table-cell">{r.performance_score}</TableCell>
                    <TableCell className="text-right hidden md:table-cell">{r.consistency_score}</TableCell>
                    <TableCell className="text-right hidden md:table-cell">{r.evolution_score}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={faixaCls(r.faixa)}>{faixaLabel(r.faixa)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => onOpenStudent(r.student_id)} aria-label="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RiskRankingPanel;

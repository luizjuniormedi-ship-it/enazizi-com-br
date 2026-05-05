import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ProfessorPracticalExams({ callAPI }: { callAPI?: (body: Record<string, unknown>) => Promise<any> }) {
  const { data, isLoading } = useQuery({
    queryKey: ["professor-practical-results"],
    queryFn: async () => {
      // Get all practical exam results (admin/professor RLS)
      const { data: results } = await supabase
        .from("practical_exam_results")
        .select("user_id, final_score, specialty, scores_json, created_at, feedback_json")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!results || results.length === 0) return { students: [], summary: null };

      // Group by student
      const byStudent = new Map<string, any[]>();
      for (const r of results) {
        const arr = byStudent.get(r.user_id) || [];
        arr.push(r);
        byStudent.set(r.user_id, arr);
      }

      // Get profiles
      const userIds = [...byStudent.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const students = userIds.map(uid => {
        const exams = byStudent.get(uid)!;
        const avg = exams.reduce((s, e) => s + (e.final_score || 0), 0) / exams.length;
        const latest = exams[0];
        const profile = profileMap.get(uid);

        // Count errors
        const totalErrors = exams.reduce((s, e) => {
          const fb = e.feedback_json as any;
          return s + (fb?.feedback?.filter((f: any) => !f.correct)?.length || 0);
        }, 0);

        return {
          userId: uid,
          name: profile?.display_name || profile?.email || uid.slice(0, 8),
          examCount: exams.length,
          avgScore: avg,
          latestScore: latest.final_score || 0,
          latestSpecialty: latest.specialty || "—",
          totalErrors,
          latestDate: latest.created_at,
        };
      });

      students.sort((a, b) => b.examCount - a.examCount);

      const globalAvg = students.reduce((s, st) => s + st.avgScore, 0) / (students.length || 1);

      return {
        students,
        summary: {
          totalStudents: students.length,
          totalExams: results.length,
          globalAvg,
        },
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.summary) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Nenhum aluno realizou prova prática ainda.
        </CardContent>
      </Card>
    );
  }

  const { students, summary } = data;

  const gradeColor = (score: number) => {
    if (score >= 9) return "bg-emerald-500/10 text-emerald-600";
    if (score >= 7) return "bg-blue-500/10 text-blue-600";
    if (score >= 5) return "bg-yellow-500/10 text-yellow-700";
    return "bg-red-500/10 text-red-600";
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{summary.totalStudents}</p>
            <p className="text-xs text-muted-foreground">Alunos avaliados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{summary.totalExams}</p>
            <p className="text-xs text-muted-foreground">Provas realizadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{summary.globalAvg.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Média geral</p>
          </CardContent>
        </Card>
      </div>

      {/* Student table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4 text-violet-500" />
            Desempenho por Aluno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead className="text-center">Provas</TableHead>
                <TableHead className="text-center">Média</TableHead>
                <TableHead className="text-center">Última</TableHead>
                <TableHead className="text-center">Erros</TableHead>
                <TableHead>Especialidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((st) => (
                <TableRow key={st.userId}>
                  <TableCell className="font-medium text-xs">{st.name}</TableCell>
                  <TableCell className="text-center text-xs">{st.examCount}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={gradeColor(st.avgScore)} variant="outline">
                      {st.avgScore.toFixed(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={gradeColor(st.latestScore)} variant="outline">
                      {st.latestScore.toFixed(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-xs text-red-500">{st.totalErrors}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{st.latestSpecialty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

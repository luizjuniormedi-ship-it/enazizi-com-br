import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, UserPlus, Camera } from "lucide-react";

// ============================================================
// EVNP Fase 1 — Alpha Cohort Admin
// GUARD-RAILS: sem correlação, sem effect size, sem ranking,
// sem dashboard nacional, sem export, sem aprovação agregada.
// ============================================================

interface CohortRow {
  id: string;
  name: string;
  description: string | null;
  metadata: any;
  start_date: string | null;
}

interface MemberRow {
  user_id: string;
  joined_at: string;
  profile?: { email?: string; full_name?: string | null };
  snapshots?: { checkpoint: string }[];
}

export default function AlphaCohort() {
  const [cohort, setCohort] = useState<CohortRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase
      .from("academic_cohorts")
      .select("*")
      .eq("name", "ALPHA_2026")
      .maybeSingle();

    if (!c) { setLoading(false); return; }
    setCohort(c as CohortRow);

    const { data: m } = await supabase
      .from("academic_cohort_members")
      .select("user_id, joined_at")
      .eq("cohort_id", c.id)
      .order("joined_at", { ascending: false });

    if (!m?.length) { setMembers([]); setLoading(false); return; }

    const userIds = m.map((x: any) => x.user_id);
    const [profilesRes, snapsRes] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").in("id", userIds),
      supabase.from("alpha_cohort_snapshots").select("user_id, checkpoint").in("user_id", userIds).eq("cohort_id", c.id),
    ]);

    const profMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const snapMap = new Map<string, string[]>();
    for (const s of (snapsRes.data ?? []) as any[]) {
      const arr = snapMap.get(s.user_id) ?? [];
      arr.push(s.checkpoint);
      snapMap.set(s.user_id, arr);
    }

    setMembers(
      m.map((x: any) => ({
        ...x,
        profile: profMap.get(x.user_id) as any,
        snapshots: (snapMap.get(x.user_id) ?? []).map((checkpoint) => ({ checkpoint })),
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addMember = async () => {
    if (!email || !cohort) return;
    setAdding(true);
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();

      if (!prof?.id) { toast.error("Aluno não encontrado por email"); return; }

      const { error } = await supabase
        .from("academic_cohort_members")
        .insert({ cohort_id: cohort.id, user_id: prof.id });

      if (error) throw error;
      toast.success("Aluno adicionado à coorte");
      setEmail("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  const runSnapshot = async () => {
    setSnapshotting(true);
    try {
      const { data, error } = await supabase.functions.invoke("alpha-cohort-snapshot");
      if (error) throw error;
      toast.success(`Snapshot rodado: ${data?.created ?? 0} criados, ${data?.skipped ?? 0} já existiam`);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro no snapshot");
    } finally {
      setSnapshotting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  if (!cohort) {
    return <div className="p-6">Coorte ALPHA_2026 não encontrada.</div>;
  }

  const target = cohort.metadata?.target_size ?? 50;
  const pct = Math.round((members.length / target) * 100);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Alpha Cohort — {cohort.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Programa EVNP Fase 1. Tracking observacional D0/D30/D60/D90.
        </p>
        <p className="text-xs text-muted-foreground mt-2 italic">
          Sem correlação · sem effect size · sem ranking · sem export · sem aprovação agregada.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progresso da meta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{members.length} / {target}</div>
          <div className="text-sm text-muted-foreground">{pct}% da meta inicial</div>
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adicionar aluno</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="email@aluno.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button onClick={addMember} disabled={adding || !email}>
              {adding ? <Loader2 className="animate-spin h-4 w-4" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Membros ({members.length})</CardTitle>
          <Button size="sm" variant="outline" onClick={runSnapshot} disabled={snapshotting}>
            {snapshotting ? <Loader2 className="animate-spin h-4 w-4" /> : <Camera className="h-4 w-4 mr-2" />}
            Rodar snapshot agora
          </Button>
        </CardHeader>
        <CardContent>
          {!members.length && <p className="text-sm text-muted-foreground">Nenhum aluno ainda.</p>}
          <div className="space-y-2">
            {members.map((m) => {
              const done = new Set((m.snapshots ?? []).map((s) => s.checkpoint));
              return (
                <div key={m.user_id} className="flex items-center justify-between border rounded p-3">
                  <div>
                    <div className="font-medium">{m.profile?.full_name ?? m.profile?.email ?? m.user_id}</div>
                    <div className="text-xs text-muted-foreground">
                      Entrou em {new Date(m.joined_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {["d0", "d30", "d60", "d90"].map((cp) => (
                      <Badge key={cp} variant={done.has(cp) ? "default" : "outline"}>
                        {cp.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

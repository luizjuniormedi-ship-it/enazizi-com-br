import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

// ============================================================
// EVNP Fase 1 — Official Outcomes (Admin)
// GUARD-RAILS: sem ranking, sem aprovação agregada, sem dashboard nacional,
// sem export. Apenas listagem + promoção de tier de evidência.
// ============================================================

type Tier = "student_reported" | "document_verified" | "institution_verified";

const TIER_LABEL: Record<Tier, string> = {
  student_reported: "Não verificado",
  document_verified: "Documento verificado",
  institution_verified: "Instituição verificada",
};

const TIER_VARIANT: Record<Tier, "outline" | "secondary" | "default"> = {
  student_reported: "outline",
  document_verified: "secondary",
  institution_verified: "default",
};

interface Outcome {
  id: string;
  user_id: string;
  exam: string;
  exam_year: number | null;
  score: number | null;
  approval: boolean | null;
  institution: string | null;
  evidence_tier: Tier;
  evidence_url: string | null;
  validated: boolean;
  created_at: string;
  profile?: { email?: string; full_name?: string | null };
}

export default function OfficialOutcomes() {
  const [items, setItems] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("official_exam_outcomes")
      .select("*")
      .order("created_at", { ascending: false });

    const userIds = Array.from(new Set((data ?? []).map((o: any) => o.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("id, email, full_name").in("id", userIds)
      : { data: [] };

    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setItems((data ?? []).map((o: any) => ({ ...o, profile: map.get(o.user_id) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateTier = async (id: string, tier: Tier) => {
    const { error } = await supabase
      .from("official_exam_outcomes")
      .update({
        evidence_tier: tier,
        validated: tier !== "student_reported",
        validated_at: tier !== "student_reported" ? new Date().toISOString() : null,
      })
      .eq("id", id);

    if (error) { toast.error(error.message); return; }
    toast.success("Tier atualizado");
    load();
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Resultados Oficiais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro manual de provas oficiais reportadas pelos alunos. Promova o tier após validar a evidência.
        </p>
        <p className="text-xs text-muted-foreground mt-2 italic">
          Sem ranking · sem aprovação agregada · sem dashboard nacional · sem export.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resultados reportados ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {!items.length && <p className="text-sm text-muted-foreground">Nenhum resultado reportado ainda.</p>}
          <div className="space-y-3">
            {items.map((o) => (
              <div key={o.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {o.exam} {o.exam_year ?? ""} —{" "}
                    {o.profile?.full_name ?? o.profile?.email ?? o.user_id.slice(0, 8)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {o.score != null && <>Nota: <strong>{o.score}</strong> · </>}
                    {o.approval != null && <>{o.approval ? "Aprovado" : "Não aprovado"} · </>}
                    {o.institution && <>{o.institution}</>}
                  </div>
                  {o.evidence_url && (
                    <a href={o.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                      Ver evidência
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={TIER_VARIANT[o.evidence_tier]}>
                    {o.evidence_tier !== "student_reported" && <ShieldCheck className="h-3 w-3 mr-1" />}
                    {TIER_LABEL[o.evidence_tier]}
                  </Badge>
                  <Select value={o.evidence_tier} onValueChange={(v) => updateTier(o.id, v as Tier)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student_reported">Não verificado</SelectItem>
                      <SelectItem value="document_verified">Documento verificado</SelectItem>
                      <SelectItem value="institution_verified">Instituição verificada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

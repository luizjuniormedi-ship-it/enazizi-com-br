import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Plus } from "lucide-react";

// ============================================================
// EVNP Fase 1 — Página do aluno para registrar resultados oficiais
// GUARD-RAILS: sem ranking, sem aprovação agregada, sem export,
// sem dashboard nacional. Resultado nasce sempre "não verificado".
// ============================================================

const EXAMS = ["ENAMED", "ENARE", "USP", "UNICAMP", "Residência", "Outro"];

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
  exam: string;
  exam_year: number | null;
  score: number | null;
  approval: boolean | null;
  institution: string | null;
  evidence_tier: Tier;
  evidence_url: string | null;
  validated: boolean;
  created_at: string;
}

export default function ResultadosOficiais() {
  const [items, setItems] = useState<Outcome[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    exam: "ENAMED",
    exam_year: new Date().getFullYear(),
    score: "",
    approval: "",
    institution: "",
    evidence_url: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("official_exam_outcomes")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Outcome[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Não autenticado"); return; }

      const { error } = await supabase.from("official_exam_outcomes").insert({
        user_id: user.id,
        exam: form.exam,
        exam_year: Number(form.exam_year) || null,
        score: form.score ? Number(form.score) : null,
        approval: form.approval === "" ? null : form.approval === "yes",
        institution: form.institution || null,
        evidence_url: form.evidence_url || null,
        // tier e validated sempre default (RLS força)
      });

      if (error) throw error;
      toast.success("Resultado registrado. Status: não verificado.");
      setForm({ exam: "ENAMED", exam_year: new Date().getFullYear(), score: "", approval: "", institution: "", evidence_url: "" });
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Meus resultados oficiais</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre resultados de provas oficiais. Todos os resultados começam como{" "}
          <strong>não verificados</strong> e só são promovidos após validação pela equipe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Novo resultado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prova</Label>
              <Select value={form.exam} onValueChange={(v) => setForm({ ...form, exam: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXAMS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Input type="number" value={form.exam_year} onChange={(e) => setForm({ ...form, exam_year: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Input type="number" step="0.01" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
            </div>
            <div>
              <Label>Aprovação</Label>
              <Select value={form.approval} onValueChange={(v) => setForm({ ...form, approval: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Aprovado</SelectItem>
                  <SelectItem value="no">Não aprovado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Instituição (opcional)</Label>
              <Input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Link da evidência (opcional)</Label>
              <Input
                placeholder="URL do boletim, foto, etc."
                value={form.evidence_url}
                onChange={(e) => setForm({ ...form, evidence_url: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            Registrar resultado
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resultados registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : !items.length ? (
            <p className="text-sm text-muted-foreground">Nenhum resultado registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {items.map((o) => (
                <div key={o.id} className="border rounded p-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{o.exam} {o.exam_year ?? ""}</div>
                    <div className="text-sm text-muted-foreground">
                      {o.score != null && <>Nota: <strong>{o.score}</strong> · </>}
                      {o.approval != null && <>{o.approval ? "Aprovado" : "Não aprovado"} · </>}
                      {o.institution}
                    </div>
                  </div>
                  <Badge variant={TIER_VARIANT[o.evidence_tier]}>
                    {o.evidence_tier !== "student_reported" && <ShieldCheck className="h-3 w-3 mr-1" />}
                    {TIER_LABEL[o.evidence_tier]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { User } from "lucide-react";
import type { CockpitData } from "@/hooks/useCockpitData";

interface Props {
  profile: CockpitData["cognitiveProfile"];
}

const MOD_LABEL: Record<string, string> = {
  mnemonicos: "Mnemônicos",
  quizVisual: "Quiz visual",
  questoes: "Questões",
  revisaoFsrs: "Revisão FSRS",
  simulados: "Simulados",
  tutorIa: "Tutor IA",
};

export default function CockpitProfile({ profile }: Props) {
  const empty = !profile.bestMnemonicTema && !profile.strongestModality && profile.mnemonicsCreated === 0;
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">🧬 Seu perfil cognitivo</h2>
      </div>
      {empty ? (
        <p className="text-sm text-muted-foreground">
          Use a plataforma por alguns dias para o sistema mapear como você aprende melhor.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Row label="Modalidade mais forte" value={profile.strongestModality ? MOD_LABEL[profile.strongestModality] ?? profile.strongestModality : "—"} tone="success" />
          <Row label="Modalidade mais fraca" value={profile.weakestModality ? MOD_LABEL[profile.weakestModality] ?? profile.weakestModality : "—"} tone="warning" />
          <Row label="Tema mais dominado" value={profile.bestMnemonicTema ?? "—"} tone="success" />
          <Row label="Tema mais frágil" value={profile.worstMnemonicTema ?? "—"} tone="warning" />
          <Row label="Mnemônicos criados" value={String(profile.mnemonicsCreated)} tone="primary" />
          <Row label="Score médio" value={`${profile.avgMnemonicScore}/100`} tone="primary" />
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "primary" }) {
  const cls = {
    success: "text-success",
    warning: "text-warning",
    primary: "text-primary",
  }[tone];
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold mt-1 truncate ${cls}`}>{value}</div>
    </div>
  );
}

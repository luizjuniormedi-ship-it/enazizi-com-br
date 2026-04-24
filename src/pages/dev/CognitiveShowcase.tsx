/**
 * Showcase /dev/cognitive
 *
 * Página interna de validação visual dos blocos cognitivos do Tutor IA.
 * Renderiza mocks dos 3 casos clínicos + payloads inválidos (para checar
 * fallback) e oferece um viewer de JSON colapsável por bloco.
 *
 * NÃO chama IA, NÃO toca em telemetria, NÃO depende de auth.
 * Acesso: /dev/cognitive (rota pública, gated pelo path obscuro).
 */

import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Code, Eye, EyeOff, Smartphone, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TutorBlockRenderer } from "@/components/tutor/blocks/TutorBlockRenderer";
import type { TutorBlock } from "@/types/tutor";

// ============= MOCK PAYLOADS =============

/** Caso 1 — Dor torácica: clinical_flow + DDx + summary + timeline implícita */
const CASE_CHEST_PAIN: TutorBlock[] = [
  {
    type: "summary",
    payload: {
      title: "Dor torácica aguda — abordagem inicial",
      bullets: [
        "ABC + monitorização imediata",
        "ECG em até 10 min",
        "Acesso venoso, oxigênio se SatO2 < 94%",
        "Triagem de causas potencialmente fatais (5 KILLERS)",
      ],
    },
  },
  {
    type: "clinical_flow",
    payload: {
      title: "Fluxograma — Dor torácica aguda",
      nodes: [
        { id: "n1", label: "Dor torácica aguda", kind: "decision" },
        { id: "n2", label: "ECG + troponina", kind: "action" },
        { id: "n3", label: "Supra de ST?", kind: "decision" },
        { id: "n4", label: "SCA com supra → reperfusão", kind: "outcome" },
        { id: "n5", label: "Estável + sem supra", kind: "decision" },
        { id: "n6", label: "Suspeita de TEP → angio-TC", kind: "action" },
        { id: "n7", label: "Suspeita de dissecção → angio-TC aorta", kind: "action" },
        { id: "n8", label: "Observação + seriar troponina", kind: "outcome" },
      ],
      edges: [
        { from: "n1", to: "n2" },
        { from: "n2", to: "n3" },
        { from: "n3", to: "n4", label: "sim" },
        { from: "n3", to: "n5", label: "não" },
        { from: "n5", to: "n6" },
        { from: "n5", to: "n7" },
        { from: "n5", to: "n8" },
      ],
    },
  },
  {
    type: "differential_diagnosis",
    payload: {
      title: "Diagnóstico diferencial — Dor torácica",
      chief_complaint: "Dor torácica aguda em homem 58 anos, tabagista",
      items: [
        {
          name: "SCA (IAM/AI)",
          probability: 0.45,
          severity: "critica",
          urgency: "emergencia",
          doNotMiss: true,
          pros: ["Fator de risco cardiovascular", "Dor opressiva irradiada"],
          cons: ["ECG inicial sem alterações"],
        },
        {
          name: "TEP",
          probability: 0.2,
          severity: "alta",
          urgency: "alta",
          doNotMiss: true,
          pros: ["Dispneia súbita", "Taquicardia"],
          cons: ["Sem fator de risco trombótico claro"],
        },
        {
          name: "Dissecção de aorta",
          probability: 0.1,
          severity: "critica",
          urgency: "emergencia",
          doNotMiss: true,
          pros: ["Dor lancinante irradiada para dorso"],
          cons: ["Pulsos simétricos"],
        },
        {
          name: "Pneumonia",
          probability: 0.15,
          severity: "moderada",
          urgency: "moderada",
          pros: ["Tosse produtiva", "Febre baixa"],
          cons: ["Dor não-pleurítica"],
        },
        {
          name: "Ansiedade",
          probability: 0.1,
          severity: "baixa",
          urgency: "baixa",
          pros: ["Histórico psiquiátrico"],
          cons: ["Diagnóstico de exclusão — descartar orgânico antes"],
        },
      ],
    },
  },
];

/** Caso 2 — Hipertensão: pharmacology_compare */
const CASE_HYPERTENSION: TutorBlock[] = [
  {
    type: "summary",
    payload: {
      title: "Hipertensão arterial — escolha terapêutica",
      bullets: [
        "Metas: < 140/90 (geral), < 130/80 (DM, DRC)",
        "Início com monoterapia ou combinação dependendo do estágio",
        "Considerar comorbidades para seleção de classe",
      ],
    },
  },
  {
    type: "pharmacology_compare",
    payload: {
      title: "Anti-hipertensivos de primeira linha",
      indication: "HAS estágio 1-2, adulto sem complicações graves",
      drugs: [
        {
          name: "Enalapril (IECA)",
          class: "Inibidor da ECA",
          mechanism: "Bloqueia conversão de angiotensina I → II; reduz aldosterona",
          adverse: ["Tosse seca", "Hipercalemia", "Angioedema (raro)"],
          contraindications: ["Gestação", "Estenose bilateral de a. renal"],
          interactions: ["AINEs ↓ efeito", "Espironolactona ↑ K+"],
          potency: "Moderada-alta",
          half_life: "11h",
          clinical_advantage: "Cardio + nefroprotetor (DM, ICFEr)",
          preferred: true,
        },
        {
          name: "Losartana (BRA)",
          class: "Bloqueador do receptor AT1",
          mechanism: "Antagoniza receptor AT1 da angiotensina II",
          adverse: ["Hipercalemia", "Tontura"],
          contraindications: ["Gestação", "Estenose bilateral de a. renal"],
          interactions: ["AINEs ↓ efeito"],
          potency: "Moderada",
          half_life: "6-9h",
          clinical_advantage: "Alternativa ao IECA quando há tosse",
        },
        {
          name: "Hidroclorotiazida",
          class: "Tiazídico",
          mechanism: "Inibe cotransporte Na+/Cl- no túbulo distal",
          adverse: ["Hipocalemia", "Hiperuricemia", "Hiperglicemia leve"],
          contraindications: ["Gota", "Hiponatremia grave"],
          interactions: ["Lítio ↑ toxicidade"],
          potency: "Moderada",
          half_life: "6-15h",
          clinical_advantage: "Boa em idosos e afrodescendentes",
        },
        {
          name: "Anlodipino",
          class: "BCC dihidropiridínico",
          mechanism: "Bloqueia canais de Ca2+ tipo L vasculares",
          adverse: ["Edema maleolar", "Cefaleia", "Rubor"],
          contraindications: ["ICFEr descompensada (relativa)"],
          interactions: ["Sinvastatina (↓ dose)"],
          potency: "Alta",
          half_life: "30-50h",
          clinical_advantage: "Excelente em afrodescendentes e idosos",
        },
        {
          name: "Atenolol",
          class: "Betabloqueador",
          mechanism: "Bloqueio β1 cardíaco → ↓ FC e DC",
          adverse: ["Bradicardia", "Broncoespasmo", "Fadiga"],
          contraindications: ["Asma", "BAV 2-3º grau"],
          interactions: ["Verapamil → bradicardia grave"],
          potency: "Moderada",
          half_life: "6-9h",
          clinical_advantage: "Reservado para indicação compelativa (ICFEr, pós-IAM)",
        },
      ],
    },
  },
];

/** Caso 3 — Dor abdominal: semiology + clinical_flow */
const CASE_ABDOMINAL: TutorBlock[] = [
  {
    type: "summary",
    payload: {
      title: "Dor abdominal aguda — abordagem semiológica",
      bullets: [
        "Localização guia o diferencial topográfico",
        "Sinais semiológicos clássicos têm alta especificidade",
        "Reavaliação seriada é mandatória",
      ],
    },
  },
  {
    type: "semiology_insight",
    payload: {
      title: "Manobras semiológicas — abdome agudo",
      region: "Abdome",
      maneuvers: [
        {
          name: "Sinal de Murphy",
          technique: "Pressão subcostal direita durante inspiração profunda",
          finding: "Interrupção da inspiração por dor",
          interpretation: "Colecistite aguda (S 65%, E 87%)",
          pathophysiology: "Inflamação da vesícula contacta a mão do examinador",
          region: "HCD",
        },
        {
          name: "Sinal de Blumberg",
          technique: "Descompressão brusca em qualquer quadrante",
          finding: "Dor à descompressão (rebote)",
          interpretation: "Irritação peritoneal (peritonite)",
          pathophysiology: "Estiramento do peritônio inflamado",
          region: "Difuso",
        },
        {
          name: "Ponto de McBurney",
          technique: "Pressão sobre 1/3 lateral da linha umbigo-EIAS direita",
          finding: "Dor localizada à pressão",
          interpretation: "Apendicite aguda",
          pathophysiology: "Projeção anatômica do apêndice cecal",
          region: "FID",
        },
        {
          name: "Sinal de Giordano",
          technique: "Punho-percussão da loja renal",
          finding: "Dor à percussão",
          interpretation: "Pielonefrite, litíase obstrutiva",
          pathophysiology: "Inflamação/distensão da cápsula renal",
          region: "Flanco",
        },
      ],
    },
  },
  {
    type: "clinical_flow",
    payload: {
      title: "Fluxograma — Dor em FID",
      nodes: [
        { id: "a", label: "Dor em FID", kind: "decision" },
        { id: "b", label: "McBurney + / Blumberg +", kind: "decision" },
        { id: "c", label: "Apendicite provável → cirurgia", kind: "outcome" },
        { id: "d", label: "Sem irritação peritoneal", kind: "decision" },
        { id: "e", label: "Mulher em idade fértil → β-hCG + USG", kind: "action" },
        { id: "f", label: "Considerar ITU, litíase, GECA", kind: "outcome" },
      ],
      edges: [
        { from: "a", to: "b" },
        { from: "b", to: "c", label: "sim" },
        { from: "b", to: "d", label: "não" },
        { from: "d", to: "e" },
        { from: "d", to: "f" },
      ],
    },
  },
];

/** Payloads INVÁLIDOS — devem acionar fallback visual sem crashar */
const CASE_BROKEN: TutorBlock[] = [
  {
    type: "clinical_flow",
    payload: {
      title: "Fluxograma vazio",
      nodes: [],
      edges: [],
    },
  },
  {
    type: "differential_diagnosis",
    payload: {
      title: "DDx vazio",
      items: [],
    },
  },
  {
    type: "pharmacology_compare",
    payload: {
      title: "Comparação vazia",
      drugs: [],
    },
  },
  {
    type: "semiology_insight",
    payload: {
      title: "Manobras vazias",
      maneuvers: [],
    },
  },
  {
    type: "clinical_flow",
    payload: {
      title: "Edges órfãs (apontam para nodes inexistentes)",
      nodes: [
        { id: "x", label: "Único nó válido" },
      ],
      edges: [
        { from: "x", to: "y" },
        { from: "z", to: "w" },
      ],
    },
  },
  {
    type: "differential_diagnosis",
    payload: {
      title: "Probabilidades fora de 0-1",
      items: [
        { name: "Item A", probability: 1.5, severity: "critica" },
        { name: "Item B", probability: -0.2 },
        // @ts-expect-error mock intencionalmente inválido
        { name: "", probability: 0.3 },
      ],
    },
  },
];

// ============= CASES META =============

const CASES = [
  {
    id: "chest",
    label: "Caso 1 — Dor torácica",
    description: "summary + clinical_flow + DDx (5 hipóteses)",
    blocks: CASE_CHEST_PAIN,
  },
  {
    id: "htn",
    label: "Caso 2 — Hipertensão",
    description: "pharmacology_compare (5 classes)",
    blocks: CASE_HYPERTENSION,
  },
  {
    id: "abd",
    label: "Caso 3 — Dor abdominal",
    description: "semiology_insight (Murphy, Blumberg, McBurney, Giordano) + flow",
    blocks: CASE_ABDOMINAL,
  },
  {
    id: "broken",
    label: "Edge cases — payloads inválidos",
    description: "valida fallbacks: vazios, edges órfãs, probabilidades fora do range",
    blocks: CASE_BROKEN,
  },
] as const;

// ============= COMPONENT =============

export default function CognitiveShowcase() {
  const [active, setActive] = useState<string>("chest");
  const [showJson, setShowJson] = useState(false);
  const [forcedNarrow, setForcedNarrow] = useState(false);
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );

  const toggleDark = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  };

  const activeCase = useMemo(
    () => CASES.find((c) => c.id === active) ?? CASES[0],
    [active],
  );

  return (
    <>
      <Helmet>
        <title>Tutor Cognitive UI — Showcase | ENAZIZI</title>
        <meta
          name="description"
          content="Preview interno dos blocos cognitivos do Tutor IA: clinical_flow, DDx, pharmacology, semiology e timeline."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-semibold tracking-tight sm:text-lg">
                Tutor Cognitive UI · Showcase
              </h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                /dev/cognitive
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant={showJson ? "default" : "outline"}
                onClick={() => setShowJson((v) => !v)}
                className="gap-1.5"
              >
                {showJson ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">JSON</span>
              </Button>
              <Button
                size="sm"
                variant={forcedNarrow ? "default" : "outline"}
                onClick={() => setForcedNarrow((v) => !v)}
                className="gap-1.5"
                title="Forçar largura mobile (430px)"
              >
                {forcedNarrow ? (
                  <Smartphone className="h-3.5 w-3.5" />
                ) : (
                  <Monitor className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {forcedNarrow ? "Mobile" : "Auto"}
                </span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={toggleDark}
                className="gap-1.5"
                title="Alternar dark mode"
              >
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">
          <Tabs value={active} onValueChange={setActive} className="space-y-6">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
              {CASES.map((c) => (
                <TabsTrigger
                  key={c.id}
                  value={c.id}
                  className="text-xs sm:text-sm"
                >
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {CASES.map((c) => (
              <TabsContent key={c.id} value={c.id} className="space-y-4">
                <Card>
                  <CardHeader className="space-y-1.5">
                    <CardTitle className="text-base">{c.label}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {c.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Array.from(new Set(c.blocks.map((b) => b.type))).map(
                        (t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ),
                      )}
                    </div>
                  </CardHeader>
                </Card>

                <div
                  className={
                    forcedNarrow
                      ? "mx-auto w-full max-w-[430px] rounded-xl border border-dashed border-border/60 bg-card/40 p-3"
                      : ""
                  }
                >
                  <TutorBlockRenderer blocks={activeCase.blocks} />
                </div>

                {showJson && (
                  <Card className="border-dashed">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Code className="h-4 w-4" /> Payload bruto
                      </CardTitle>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.blocks.length} blocos
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground/90">
                        {JSON.stringify(c.blocks, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </main>
      </div>
    </>
  );
}

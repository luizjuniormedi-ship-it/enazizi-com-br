import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Brain, RefreshCw, BookOpen, AlertTriangle, ChevronDown, ChevronRight, GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mapTopicToSpecialty } from "@/lib/mapTopicToSpecialty";

const SPECIALTIES_WITH_TOPICS: Record<string, string[]> = {
  "Cardiologia": [
    "Insuficiência Cardíaca", "Síndromes Coronarianas Agudas", "Arritmias Cardíacas",
    "Síncope e PCR", "Valvopatias", "Hipertensão Arterial Sistêmica", "Endocardite Infecciosa",
    "Pericardite e Tamponamento", "Cardiopatias Congênitas", "Miocardiopatias",
    "Tromboembolismo Venoso", "Bradiarritmias", "Taquiarritmias Supraventriculares",
    "Fibrilação Atrial", "Doença Arterial Coronariana Crônica", "Choque Cardiogênico",
    "Febre Reumática", "Dissecção de Aorta", "Eletrocardiograma (Interpretação)",
  ],
  "Pneumologia": [
    "DPOC", "Asma", "Pneumonias Comunitárias", "Pneumonias Hospitalares",
    "Tuberculose", "Embolia Pulmonar", "Derrame Pleural", "Fibrose Pulmonar",
    "Câncer de Pulmão", "Distúrbios Obstrutivos", "Insuficiência Respiratória",
    "Pneumotórax", "Sarcoidose", "Bronquiectasias", "Nódulo Pulmonar Solitário",
  ],
  "Neurologia": [
    "AVC Isquêmico", "AVC Hemorrágico", "Epilepsia e Crises Convulsivas",
    "Cefaleias Primárias e Secundárias", "Meningites", "Esclerose Múltipla",
    "Doença de Parkinson", "Doença de Alzheimer e Demências", "Neuropatias Periféricas",
    "Neurointensivismo", "Hipertensão Intracraniana", "Síndrome de Guillain-Barré",
    "Miastenia Gravis", "Tumores do SNC", "Distúrbios do Movimento",
  ],
  "Endocrinologia": [
    "Diabetes Mellitus Tipo 1", "Diabetes Mellitus Tipo 2", "Complicações Agudas do Diabetes",
    "Insulinoterapia", "Hipotireoidismo", "Hipertireoidismo", "Nódulos Tireoidianos",
    "Câncer de Tireoide", "Insuficiência Adrenal", "Síndrome de Cushing",
    "Feocromocitoma", "Hipopituitarismo", "Obesidade e Síndrome Metabólica",
    "Dislipidemias", "Distúrbios do Cálcio e Paratireoide", "Incidentaloma Adrenal",
  ],
  "Gastroenterologia": [
    "Doença do Refluxo Gastroesofágico", "Úlcera Péptica e H. pylori",
    "Hepatites Virais", "Hepatite Autoimune", "Cirrose e Complicações",
    "Doença de Crohn", "Retocolite Ulcerativa", "Pancreatite Aguda e Crônica",
    "Câncer Colorretal", "Tumores do Aparelho Digestivo", "Polipose Intestinal",
    "Doença Celíaca", "Hemorragia Digestiva Alta e Baixa", "Síndrome do Intestino Irritável",
    "Hepatologia e Doença Hepática Gordurosa",
  ],
  "Nefrologia": [
    "Insuficiência Renal Aguda", "Doença Renal Crônica", "Glomerulonefrites",
    "Síndrome Nefrótica", "Síndrome Nefrítica", "Distúrbios Eletrolíticos",
    "Distúrbios do Sódio", "Distúrbios do Potássio", "Infecção do Trato Urinário",
    "Litíase Renal", "Diálise e Terapia Renal Substitutiva", "Nefropatia Diabética",
    "Acidose Tubular Renal",
  ],
  "Infectologia": [
    "HIV/AIDS e Infecções Oportunistas", "Tuberculose (Diagnóstico e Tratamento)",
    "ISTs (Sífilis, Gonorreia, Clamídia)", "Sepse e Choque Séptico",
    "Dengue", "Malária", "Raiva", "Hanseníase",
    "Antibioticoterapia Racional", "Parasitoses Intestinais", "Infecções Hospitalares",
    "Meningites Infecciosas", "Endocardite Infecciosa", "Hepatites Virais (B e C)",
    "Infecções Fúngicas Sistêmicas", "Arboviroses (Zika, Chikungunya)",
  ],
  "Hematologia": [
    "Anemias Carenciais", "Anemia Falciforme e Hemoglobinopatias", "Leucemias Agudas",
    "Leucemias Crônicas", "Linfomas Hodgkin e Não-Hodgkin", "Mieloma Múltiplo",
    "Distúrbios de Coagulação", "Trombocitopenia e PTI", "CIVD",
    "Hemoterapia e Reações Transfusionais", "Onco-Hematologia Pediátrica",
    "Pancitopenia e Aplasia Medular", "Policitemia e Trombocitemia",
  ],
  "Reumatologia": [
    "Lúpus Eritematoso Sistêmico", "Artrite Reumatoide", "Vasculites Sistêmicas",
    "Espondiloartrites", "Esclerose Sistêmica", "Fibromialgia e Síndromes Dolorosas",
    "Gota e Artropatias por Cristais", "Síndrome de Sjögren",
    "Artrites e Diagnósticos Diferenciais", "Dermatomiosite e Polimiosite",
    "Febre Reumática", "Síndrome Antifosfolípide",
  ],
  "Pediatria": [
    "Puericultura e Crescimento", "Desenvolvimento Neuropsicomotor", "Imunização e Calendário Vacinal",
    "Aleitamento Materno e Nutrição Infantil", "Doenças Exantemáticas",
    "Infecções Respiratórias na Infância", "Pneumonia Comunitária Infantil",
    "Diarreias e Desidratação", "Sepse Neonatal e Infantil",
    "Neonatologia (Icterícia, Distúrbios Respiratórios)", "Cardiopatias Congênitas",
    "Onco-Hematologia Pediátrica", "TDAH e Transtornos do Neurodesenvolvimento",
    "Transtorno Opositor Desafiador (TOD)", "Tuberculose Pediátrica",
    "Ortopedia Pediátrica", "Parasitoses na Infância", "Alergia Alimentar",
    "Distúrbios Obstrutivos na Infância",
  ],
  "Ginecologia e Obstetrícia": [
    "Assistência Pré-Natal", "Trabalho de Parto e Assistência ao Parto",
    "Síndromes Hipertensivas da Gestação", "Diabetes Gestacional",
    "Doenças Clínicas na Gestação", "Hemorragias da 1ª Metade (Ectópica, Aborto)",
    "Hemorragias da 2ª Metade (DPP, Placenta Prévia)", "Intercorrências Obstétricas",
    "Planejamento Familiar e Contracepção", "Vulvovaginites (Candidíase, Vaginose, Tricomoníase)",
    "HPV e Câncer de Colo Uterino", "Oncologia Ginecológica",
    "Ginecologia Endócrina (SOP, Amenorreia)", "Endometriose",
    "Incontinência Urinária e Prolapsos", "Climatério e Menopausa",
    "Massas Anexiais e Patologias Ovarianas", "Infecções em Ginecologia",
  ],
  "Cirurgia": [
    "Abdome Agudo Inflamatório", "Abdome Agudo Obstrutivo", "Abdome Agudo Perfurativo",
    "Apendicite Aguda", "Colecistite e Colelitíase", "Doenças da Via Biliar",
    "Hérnias da Parede Abdominal", "Trauma (ATLS)", "Trauma Torácico",
    "Trauma Cranioencefálico", "Queimaduras (Classificação e Manejo)",
    "Cuidados Pré-Operatórios", "Cuidados Pós-Operatórios",
    "Tumores do Aparelho Digestivo", "Polipose Intestinal e Câncer Colorretal",
    "Cirurgia Vascular (Úlceras e Obstrução Arterial)", "Cirurgia da Tireoide",
    "Afecções Urológicas Benignas", "Litíase Urinária e Urgências Urológicas",
    "Diverticulite", "Cirurgia Plástica (Feridas e Retalhos)",
  ],
  "Psiquiatria": [
    "Depressão Maior", "Transtorno Bipolar", "Esquizofrenia e Psicoses",
    "Transtornos de Ansiedade (TAG, Pânico, Fobias)", "TOC",
    "TDAH", "Dependência Química e Transtornos por Uso de Substâncias",
    "Psicofarmacologia", "Emergências Psiquiátricas", "Transtornos Alimentares",
    "Transtornos de Personalidade", "Saúde Mental na Atenção Primária",
  ],
  "Dermatologia": [
    "Dermatites (Atópica, de Contato, Seborreica)", "Psoríase",
    "Infecções Cutâneas (Bacterianas, Fúngicas, Virais)", "Melanoma e Câncer de Pele",
    "Hanseníase", "Parasitoses de Pele (Escabiose, Pediculose)",
    "Urticária e Angioedema", "Acne", "Lesões Pré-Malignas",
    "Farmacodermias", "Doenças Bolhosas",
  ],
  "Oftalmologia": [
    "Glaucoma", "Catarata", "Retinopatia Diabética", "Descolamento de Retina",
    "Conjuntivite (Infecciosa e Alérgica)", "Uveíte", "Erros de Refração",
    "Trauma Ocular", "Olho Vermelho (Diagnóstico Diferencial)",
  ],
  "Otorrinolaringologia": [
    "Otite Média Aguda e Crônica", "Sinusite Aguda e Crônica",
    "Amigdalite e Faringite", "Rinite Alérgica", "Surdez e Perda Auditiva",
    "Vertigem e Labirintite", "Apneia Obstrutiva do Sono",
    "Tumores de Cabeça e Pescoço", "Epistaxe", "Corpo Estranho em Vias Aéreas",
  ],
  "Medicina Preventiva": [
    "Sistema Único de Saúde (Princípios e Organização)", "Leis Orgânicas da Saúde (8080/8142)",
    "Atenção Primária à Saúde e Estratégia Saúde da Família",
    "Medicina de Família e Comunidade (Método Clínico Centrado na Pessoa)",
    "Vigilância em Saúde e Vigilância Epidemiológica", "Vigilância em Saúde do Trabalhador",
    "Notificação Compulsória de Agravos", "Epidemiologia (Estudos e Classificação)",
    "Estatística e Testes Diagnósticos (Sensibilidade, Especificidade)",
    "Vacinação e Programa Nacional de Imunizações",
    "Indicadores de Saúde (Mortalidade, Morbidade)", "Política Nacional de Saúde",
    "Populações Vulneráveis e Equidade em Saúde",
    "Ética Médica, Bioética e Documentação Médica",
    "Financiamento e Gestão do SUS", "Saúde da Mulher na APS",
    "Rastreamento de Doenças e Prevenção",
  ],
  "Medicina de Emergência": [
    "PCR e Reanimação Cardiopulmonar", "Choque (Classificação e Manejo)",
    "Politrauma e Atendimento Inicial (ATLS)", "Emergências Respiratórias",
    "Intoxicações Exógenas", "Queimaduras (Atendimento Inicial)",
    "Emergências Obstétricas", "Via Aérea Difícil", "Anafilaxia",
    "Emergências Hipertensivas", "Cetoacidose e Estado Hiperosmolar",
    "Sedação e Analgesia em Emergência",
  ],
  "Terapia Intensiva": [
    "Ventilação Mecânica (Modos e Ajustes)", "Sedação e Analgesia em UTI",
    "Choque Séptico e Sepse (Protocolo)", "Monitorização Hemodinâmica",
    "Nutrição em UTI", "Distúrbios Ácido-Base (Gasometria)",
    "SDRA (Síndrome do Desconforto Respiratório)", "Morte Encefálica",
    "Neurointensivismo", "Desmame Ventilatório", "Insuficiência Orgânica Múltipla",
  ],
  "Farmacologia": [
    "Farmacocinética (Absorção, Distribuição, Metabolismo, Excreção)",
    "Farmacodinâmica e Receptores",
    "Antibioticoterapia e Mecanismos de Resistência",
    "Anti-hipertensivos e Vasodilatadores",
    "Antiarrítmicos",
    "Anticoagulantes e Antiplaquetários",
    "AINEs e Corticoides",
    "Analgésicos e Opioides",
    "Psicofarmacologia (Antidepressivos, Antipsicóticos, Ansiolíticos)",
    "Quimioterápicos e Imunossupressores",
    "Farmacologia do Sistema Nervoso Autônomo",
    "Interações Medicamentosas e Reações Adversas",
    "Anti-diabéticos Orais e Insulinoterapia",
    "Broncodilatadores e Anti-asmáticos",
  ],
  "Oncologia": [
    "Câncer de Mama (Rastreamento, Diagnóstico e Tratamento)",
    "Câncer de Pulmão (CPNPC e CPPC)",
    "Câncer Colorretal (Rastreamento e Estadiamento)",
    "Câncer de Próstata",
    "Câncer Gástrico e Esofágico",
    "Câncer de Colo Uterino (HPV e Prevenção)",
    "Câncer de Pâncreas e Via Biliar",
    "Câncer de Tireoide",
    "Câncer de Bexiga e Rim",
    "Melanoma e Câncer de Pele",
    "Tumores do Sistema Nervoso Central",
    "Síndromes Paraneoplásicas",
    "Estadiamento TNM e Classificação",
    "Marcadores Tumorais (CEA, CA-125, PSA, AFP)",
    "Quimioterapia (Princípios e Toxicidade)",
    "Imunoterapia e Terapia-Alvo",
    "Radioterapia (Indicações e Efeitos)",
    "Cuidados Paliativos e Controle de Dor",
    "Emergências Oncológicas (Neutropenia Febril, Compressão Medular, Lise Tumoral)",
    "Rastreamento Oncológico (Diretrizes MS e INCA)",
  ],
};

const SPECIALTIES = Object.keys(SPECIALTIES_WITH_TOPICS);

interface DomainEntry {
  specialty: string;
  domain_score: number;
  questions_answered: number;
  correct_answers: number;
  clinical_cases_score: number;
  errors_count: number;
  reviews_count: number;
  avg_difficulty: number;
  last_studied_at: string | null;
}

const getScoreColor = (score: number) => {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
};

const getProgressColor = (score: number) => {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
};

const getBadge = (score: number) => {
  if (score >= 75) return { label: "Dominado", variant: "default" as const, className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  if (score >= 50) return { label: "Em progresso", variant: "secondary" as const, className: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
  if (score > 0) return { label: "Precisa revisar", variant: "destructive" as const, className: "bg-red-500/20 text-red-400 border-red-500/30" };
  return { label: "Não estudado", variant: "outline" as const, className: "bg-muted/30 text-muted-foreground border-border" };
};

const MedicalDomainMap = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (specialty: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(specialty)) next.delete(specialty);
      else next.add(specialty);
      return next;
    });
  };

  const handleStudyTopic = (specialty: string, subtopic?: string) => {
    const topic = subtopic ? `${subtopic} (${specialty})` : specialty;
    navigate("/dashboard/mentor", {
      state: {
        initialMessage: `Quero estudar o tópico "${topic}". Me dê uma aula completa seguindo o protocolo ENAZIZI.`,
        fromErrorBank: true,
      },
    });
  };

  const fetchDomains = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("medical_domain_map")
      .select("*")
      .eq("user_id", user.id)
      .order("domain_score", { ascending: true });

    if (error) console.error("Error fetching domains:", error);

    const existingMap = new Map((data || []).map((d: any) => [d.specialty, d]));
    const merged = SPECIALTIES.map((s) => existingMap.get(s) || {
      specialty: s, domain_score: 0, questions_answered: 0, correct_answers: 0,
      clinical_cases_score: 0, errors_count: 0, reviews_count: 0, avg_difficulty: 3,
      last_studied_at: null,
    });
    setDomains(merged as DomainEntry[]);
    setLoading(false);
  };

  const recalculateFromErrors = async () => {
    if (!user) return;
    setRecalculating(true);
    try {
      const { data: errors } = await supabase
        .from("error_bank")
        .select("tema, subtema, vezes_errado, dificuldade")
        .eq("user_id", user.id);

      const { data: attempts } = await supabase
        .from("practice_attempts")
        .select("correct, question_id, questions_bank(topic)")
        .eq("user_id", user.id);

      const perfMap: Record<string, { answered: number; correct: number; errors: number; totalDiff: number }> = {};

      (attempts || []).forEach((a: any) => {
        const topic = a.questions_bank?.topic;
        if (!topic) return;
        const specialty = mapTopicToSpecialty(topic);
        if (!specialty) return;
        if (!perfMap[specialty]) perfMap[specialty] = { answered: 0, correct: 0, errors: 0, totalDiff: 0 };
        perfMap[specialty].answered++;
        if (a.correct) perfMap[specialty].correct++;
      });

      (errors || []).forEach((e: any) => {
        const specialty = mapTopicToSpecialty(e.tema);
        if (!specialty) return;
        if (!perfMap[specialty]) perfMap[specialty] = { answered: 0, correct: 0, errors: 0, totalDiff: 0 };
        perfMap[specialty].errors += e.vezes_errado || 1;
        perfMap[specialty].totalDiff += e.dificuldade || 3;
      });

      for (const [specialty, perf] of Object.entries(perfMap)) {
        const accuracy = perf.answered > 0 ? (perf.correct / perf.answered) * 100 : 0;
        const errorPenalty = Math.min(perf.errors * 3, 30);
        const score = Math.max(0, Math.min(100, Math.round(accuracy - errorPenalty)));

        await supabase.from("medical_domain_map").upsert({
          user_id: user.id,
          specialty,
          domain_score: score,
          questions_answered: perf.answered,
          correct_answers: perf.correct,
          errors_count: perf.errors,
          avg_difficulty: perf.totalDiff > 0 ? perf.totalDiff / (perf.errors || 1) : 3,
          last_studied_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,specialty" });
      }

      toast({ title: "Mapa recalculado", description: "Domínio atualizado com base nos seus dados." });
      await fetchDomains();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro", description: "Falha ao recalcular domínio.", variant: "destructive" });
    }
    setRecalculating(false);
  };

  useEffect(() => { fetchDomains(); }, [user]);

  const sorted = [...domains].sort((a, b) => b.domain_score - a.domain_score);
  const weakSpecialties = domains.filter((d) => d.domain_score < 50 && d.questions_answered > 0);
  const avgScore = domains.length > 0
    ? Math.round(domains.reduce((s, d) => s + d.domain_score, 0) / domains.length)
    : 0;
  const studiedCount = domains.filter((d) => d.questions_answered > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Mapa de Evolução
          </h1>
          <p className="text-muted-foreground mt-1">
            Seu nível de domínio em cada especialidade médica — clique para ver os assuntos
          </p>
        </div>
        <Button onClick={recalculateFromErrors} disabled={recalculating} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? "animate-spin" : ""}`} />
          {recalculating ? "Recalculando..." : "Recalcular"}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-3xl font-bold text-primary">{avgScore}%</p>
            <p className="text-xs text-muted-foreground mt-1">Domínio Médio</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-3xl font-bold text-foreground">{studiedCount}/{SPECIALTIES.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Especialidades Estudadas</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-3xl font-bold text-red-400">{weakSpecialties.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Precisam Revisar (&lt;50%)</p>
          </CardContent>
        </Card>
      </div>

      {/* Weak specialties recommendation */}
      {weakSpecialties.length > 0 && (
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Recomendação de Revisão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {weakSpecialties.slice(0, 3).map((d) => (
              <div key={d.specialty} className="flex items-center justify-between">
                <span className="text-sm text-foreground">
                  Você apresenta menor domínio em <strong>{d.specialty}</strong> ({d.domain_score}%).
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary text-xs"
                  onClick={() => handleStudyTopic(d.specialty)}
                >
                  <BookOpen className="h-3 w-3 mr-1" /> Estudar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Full domain list */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Todas as Especialidades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {sorted.map((d) => {
            const badge = getBadge(d.domain_score);
            const isExpanded = expanded.has(d.specialty);
            const subtopics = SPECIALTIES_WITH_TOPICS[d.specialty] || [];

            return (
              <div key={d.specialty} className="border border-border/50 rounded-lg overflow-hidden">
                {/* Specialty header row */}
                <button
                  onClick={() => toggleExpand(d.specialty)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium text-foreground">{d.specialty}</span>
                    <Badge variant={badge.variant} className={`text-[10px] px-1.5 py-0 ${badge.className}`}>
                      {badge.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {subtopics.length} assuntos
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {d.questions_answered > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        ({d.correct_answers}/{d.questions_answered} questões)
                      </span>
                    )}
                    <span className={`text-sm font-bold ${getScoreColor(d.domain_score)}`}>
                      {d.domain_score}%
                    </span>
                  </div>
                </button>

                {/* Progress bar */}
                <div className="px-4 pb-2">
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getProgressColor(d.domain_score)}`}
                      style={{ width: `${d.domain_score}%` }}
                    />
                  </div>
                </div>

                {/* Subtopics panel */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-border/30">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2">
                      {subtopics.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => handleStudyTopic(d.specialty, sub)}
                          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left hover:bg-primary/10 transition-colors group"
                        >
                          <GraduationCap className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                          <span className="text-foreground group-hover:text-primary transition-colors">{sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default MedicalDomainMap;

export type Msg = { 
  role: "user" | "assistant"; 
  content: string;
  metrics?: {
    latency_ms?: number;
    memory_hit?: boolean;
    tokens_saved?: number;
    tokens_used?: number;
  };
};

export interface Conversation { id: string; title: string; created_at: string; }
export interface Upload { id: string; filename: string; category: string | null; extracted_text: string | null; }

export interface StudyPerformance {
  tema_atual: string | null;
  questoes_respondidas: number;
  taxa_acerto: number;
  pontuacao_discursiva: number | null;
  temas_fracos: string[];
  historico_estudo: Array<{ tema: string; data: string; questoes: number; acerto: number; discursiva: number | null }>;
}

export interface EnaziziProgress {
  estado_atual: number;
  tema_atual: string | null;
  questoes_respondidas: number;
  taxa_acerto: number;
  pontuacao_discursiva: number | null;
  temas_fracos: string[];
  historico_estudo: string[];
}

export const MEDSTUDY_STEPS = [
  { num: 1, label: "Painel", icon: "📊", desc: "Visão geral do seu desempenho" },
  { num: 2, label: "Tema", icon: "📚", desc: "Escolha do tema de estudo" },
  { num: 3, label: "Técnico 1", icon: "🔬", desc: "Conceito e definição técnica" },
  { num: 4, label: "Leigo 1", icon: "💡", desc: "Tradução para linguagem simples" },
  { num: 5, label: "Técnico 2", icon: "🔬", desc: "Fisiopatologia profunda" },
  { num: 6, label: "Leigo 2", icon: "💡", desc: "Simplificação da fisiopatologia" },
  { num: 7, label: "Técnico 3", icon: "🏥", desc: "Clínica, diagnóstico e tratamento" },
  { num: 8, label: "Leigo 3", icon: "💡", desc: "Simplificação da clínica" },
  { num: 9, label: "Questão", icon: "❓", desc: "Questão objetiva com caso clínico" },
  { num: 10, label: "Discussão", icon: "💬", desc: "Análise detalhada da questão" },
  { num: 11, label: "Discursivo", icon: "✍️", desc: "Caso clínico discursivo" },
  { num: 12, label: "Correção", icon: "✅", desc: "Correção com nota 0-5" },
  { num: 13, label: "Atualizar", icon: "📈", desc: "Atualização do desempenho" },
  { num: 14, label: "Consolidação", icon: "🔁", desc: "5 questões de consolidação" },
];

export const QUICK_TOPICS = [
  { label: "Sepse", emoji: "🩸", color: "from-red-500/20 to-red-600/10 border-red-500/30" },
  { label: "IAM", emoji: "🫀", color: "from-rose-500/20 to-rose-600/10 border-rose-500/30" },
  { label: "Pneumonia", emoji: "🫁", color: "from-blue-500/20 to-blue-600/10 border-blue-500/30" },
  { label: "AVC", emoji: "🧠", color: "from-purple-500/20 to-purple-600/10 border-purple-500/30" },
  { label: "Diabetes", emoji: "💉", color: "from-amber-500/20 to-amber-600/10 border-amber-500/30" },
  { label: "Insuficiência Renal", emoji: "🫘", color: "from-orange-500/20 to-orange-600/10 border-orange-500/30" },
  { label: "Fraturas", emoji: "🦴", color: "from-slate-500/20 to-slate-600/10 border-slate-500/30" },
  { label: "Glaucoma", emoji: "👁", color: "from-teal-500/20 to-teal-600/10 border-teal-500/30" },
  { label: "Asma", emoji: "💨", color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30" },
  { label: "Hipertensão", emoji: "❤️‍🔥", color: "from-red-400/20 to-red-500/10 border-red-400/30" },
  { label: "Anemia", emoji: "🔴", color: "from-pink-500/20 to-pink-600/10 border-pink-500/30" },
  { label: "Meningite", emoji: "🧬", color: "from-violet-500/20 to-violet-600/10 border-violet-500/30" },
];

export const FUNCTION_NAME = "tutor-v3-premium";

export const MEDSTUDY_SEQUENTIAL_APPENDIX = "IMPORTANTE: para não cortar a explicação, divida em tópicos e entregue em blocos atômicos sequenciais (2 a 3 seções por resposta), finalize cada bloco sem truncar frases e pergunte se pode continuar antes do próximo bloco.";

export const NON_MEDICAL_KEYWORDS = /\b(direito|jurídic|advocacia|contabil|engenharia|arquitetura|economia|finanças|marketing|administração de empresas|programação|software|TI\b|informática|matemática pura|filosofia|sociologia|letras|pedagogia)\b/i;

export const ensureSequentialInitialMessage = (message: string) => {
  if (/blocos? curtos?|bloco at[oô]mico|2\s*a\s*3\s*se[cç][oõ]es/i.test(message)) return message;
  return `${message}\n\n${MEDSTUDY_SEQUENTIAL_APPENDIX}`;
};

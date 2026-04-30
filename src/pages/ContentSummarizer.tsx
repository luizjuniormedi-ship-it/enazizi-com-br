import { BookOpen, Sparkles } from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const quickActions = [
  { label: "📋 Resumo completo", prompt: "Faça um resumo completo e estruturado de todo o meu material, com pontos de prova, mnemônicos e tabelas comparativas.", icon: "📋" },
  { label: "🧠 Mnemônicos", prompt: "Crie mnemônicos e técnicas de memorização para os temas mais importantes do meu material.", icon: "🧠" },
  { label: "⚠️ Pegadinhas de prova", prompt: "Liste as principais pegadinhas de prova e pontos de atenção baseados no meu material.", icon: "⚠️" },
  { label: "📊 Tabela comparativa", prompt: "Crie tabelas comparativas dos diagnósticos diferenciais presentes no meu material.", icon: "📊" },
  { label: "🔬 Artigos PubMed", prompt: "Busque artigos científicos do PubMed/NLM sobre os temas do meu material e inclua referências com links.", icon: "🔬" },
];

const ContentSummarizer = () => (
  <AgentChat
    title="Resumidor de Conteúdo"
    subtitle="Resumos estruturados com mnemônicos e pontos de prova."
    icon={<BookOpen className="h-6 w-6 text-primary" />}
    welcomeMessage="Olá! Sou o Resumidor especializado em Residência Médica. Crio resumos com tabelas comparativas, mnemônicos 🧠, pegadinhas de prova ⚠️, condutas 💊 e pontos de alta incidência 📌. Cole um texto ou me diga o tema! 📚"
    welcomeMessageWithUploads="📚 Encontrei {count} material(is): {materiais}. Posso resumir tudo! Escolha o tipo de resumo que deseja abaixo. 👇"
    placeholder="Ex: Resuma Insuficiência Cardíaca com diagnóstico diferencial..."
    functionName="content-summarizer"
    quickActions={quickActions}
    showUploadButton
    autoPromptAfterUpload="Faça um resumo completo e estruturado do material '{filename}' com pontos de prova, mnemônicos e tabelas comparativas."
    linkToAgent={{
      label: "Pedir explicação ao Tutor",
      path: "/dashboard/chatgpt",
      stateKey: "fromSummary",
    }}
  />
);

export default ContentSummarizer;

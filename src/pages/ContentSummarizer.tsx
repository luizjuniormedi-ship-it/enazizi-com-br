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

const ContentSummarizer = () => {
  const { data: libraryContent } = useQuery({
    queryKey: ["master-content-library-published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_content_library")
        .select("*")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      <div className="lg:col-span-2 flex flex-col h-full">
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
      </div>
      
      <div className="hidden lg:block space-y-4 h-full overflow-hidden">
        <Card className="h-full border-primary/5 bg-card/30 flex flex-col">
          <CardHeader className="pb-2 border-b border-primary/5">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Biblioteca de Resumos Oficiais
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Conteúdo gerado por IA e revisado pela equipe pedagógica.</p>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full p-4">
              {libraryContent?.length === 0 ? (
                <div className="text-center py-10 opacity-30">
                  <BookOpen className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-xs">Nenhum resumo oficial publicado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {libraryContent?.map((item) => (
                    <div key={item.id} className="p-3 rounded-lg bg-background/50 border border-primary/5 hover:border-primary/20 transition-all cursor-pointer group">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{item.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-[9px] uppercase tracking-widest h-4 px-1">OFICIAL</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ContentSummarizer;

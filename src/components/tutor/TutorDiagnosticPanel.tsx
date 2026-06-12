import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { callTutorV3 } from "@/lib/tutor/tutorClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, Zap, AlertTriangle, CheckCircle, Search } from "lucide-react";
import { toast } from "sonner";

export function TutorDiagnosticPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testBypassRAG = async () => {
    setLoading(true);
    setResults(null);
    setError(null);
    try {
      const response = await callTutorV3({
        messages: [{ role: "user", content: "Responda apenas: API OK" }],
        bypassRAG: true,
        conversationId: "debug-test-" + Date.now()
      }, { 
        functionName: "tutor-v3-premium",
        stream: false 
      });

      const data = await response.json();
      setResults({ type: 'bypassRAG', data });
      toast.success("Teste bypassRAG concluído");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      toast.error("Falha no teste bypassRAG");
    } finally {
      setLoading(false);
    }
  };

  const testDebugOnlyRAG = async () => {
    setLoading(true);
    setResults(null);
    setError(null);
    try {
      const response = await callTutorV3({
        messages: [{ role: "user", content: "O que é TEP?" }],
        debugOnlyRAG: true,
        conversationId: "debug-rag-" + Date.now()
      }, { 
        functionName: "tutor-v3-premium",
        stream: false 
      });

      const data = await response.json();
      setResults({ type: 'debugOnlyRAG', data });
      toast.success("Teste debugOnlyRAG concluído");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      toast.error("Falha no teste debugOnlyRAG");
    } finally {
      setLoading(false);
    }
  };

  const checkKnowledgeBase = async () => {
    setLoading(true);
    setResults(null);
    setError(null);
    try {
      const { data: docs, error: docErr } = await supabase.from('rag_documents').select('count', { count: 'exact', head: true });
      const { data: chunks, error: chunkErr } = await supabase.from('rag_chunks').select('count', { count: 'exact', head: true });
      const { data: embs, error: embErr } = await supabase.from('rag_embeddings').select('count', { count: 'exact', head: true });

      if (docErr || chunkErr || embErr) throw new Error("Erro ao consultar tabelas");

      setResults({
        type: 'knowledgeBase',
        data: {
          documents: docs || 0,
          chunks: chunks || 0,
          embeddings: embs || 0
        }
      });
      toast.success("Status da base verificado");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      toast.error("Falha ao verificar base");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full bg-black/80 border-white/10 text-white backdrop-blur-xl overflow-hidden shadow-2xl">
      <CardHeader className="border-b border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Activity className="h-5 w-5" />
              Painel de Diagnóstico Real
            </CardTitle>
            <CardDescription className="text-white/40">
              Identifique se a falha está na API, no RAG ou no Frontend.
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">ADMIN ONLY</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            onClick={testBypassRAG} 
            disabled={loading}
            variant="outline"
            className="h-24 flex flex-col gap-2 bg-white/5 border-white/10 hover:bg-white/10"
          >
            <Zap className="h-6 w-6 text-yellow-500" />
            <div className="flex flex-col">
              <span className="font-bold">Testar API (Bypass)</span>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-black">Isola Provedor IA</span>
            </div>
          </Button>

          <Button 
            onClick={testDebugOnlyRAG} 
            disabled={loading}
            variant="outline"
            className="h-24 flex flex-col gap-2 bg-white/5 border-white/10 hover:bg-white/10"
          >
            <Database className="h-6 w-6 text-blue-500" />
            <div className="flex flex-col">
              <span className="font-bold">Testar RAG (Debug)</span>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-black">Isola Base Conhecimento</span>
            </div>
          </Button>

          <Button 
            onClick={checkKnowledgeBase} 
            disabled={loading}
            variant="outline"
            className="h-24 flex flex-col gap-2 bg-white/5 border-white/10 hover:bg-white/10"
          >
            <Search className="h-6 w-6 text-purple-500" />
            <div className="flex flex-col">
              <span className="font-bold">Verificar Tabelas</span>
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-black">Checar Integridade DB</span>
            </div>
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-red-500 uppercase tracking-widest">Erro Detectado</span>
              <p className="text-sm text-red-200/60 leading-relaxed font-mono">{error}</p>
            </div>
          </div>
        )}

        {results && (
          <ScrollArea className="h-64 rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-xs font-bold uppercase tracking-widest text-white/40">Resultado do Diagnóstico</span>
              </div>
              
              {results.type === 'bypassRAG' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Resposta:</span>
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/20">{results.data.ok ? "SUCESSO" : "FALHA"}</Badge>
                  </div>
                  <pre className="text-[10px] font-mono p-3 rounded-lg bg-white/5 text-white/80 overflow-auto">
                    {JSON.stringify(results.data, null, 2)}
                  </pre>
                  {results.data.ok && (
                    <p className="text-xs text-green-400 font-medium">✅ O provedor de IA está respondendo corretamente. O problema não é na chave de API ou no modelo.</p>
                  )}
                </div>
              )}

              {results.type === 'debugOnlyRAG' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Chunks Encontrados:</span>
                    <Badge className={results.data.chunksFound > 0 ? "bg-green-500/20 text-green-500 border-green-500/20" : "bg-red-500/20 text-red-500 border-red-500/20"}>
                      {results.data.chunksFound} chunks
                    </Badge>
                  </div>
                  <pre className="text-[10px] font-mono p-3 rounded-lg bg-white/5 text-white/80 overflow-auto">
                    {JSON.stringify(results.data, null, 2)}
                  </pre>
                  {results.data.chunksFound === 0 && (
                    <p className="text-xs text-red-400 font-medium">❌ A base de conhecimento retornou 0 resultados. Verifique se os documentos estão publicados e se os embeddings foram gerados.</p>
                  )}
                  {results.data.chunksFound > 0 && (
                    <p className="text-xs text-green-400 font-medium">✅ O sistema de RAG está funcionando. A busca vetorial encontrou conteúdo relevante.</p>
                  )}
                </div>
              )}

              {results.type === 'knowledgeBase' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <span className="text-[10px] text-white/40 block mb-1">DOCUMENTOS</span>
                      <span className="text-lg font-black">{results.data.documents.count}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <span className="text-[10px] text-white/40 block mb-1">CHUNKS</span>
                      <span className="text-lg font-black">{results.data.chunks.count}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                      <span className="text-[10px] text-white/40 block mb-1">EMBEDDINGS</span>
                      <span className="text-lg font-black">{results.data.embeddings.count}</span>
                    </div>
                  </div>
                  {results.data.embeddings.count < results.data.chunks.count && (
                    <p className="text-xs text-yellow-400 font-medium">⚠️ Alguns chunks estão sem embeddings. Isso pode afetar a qualidade das respostas.</p>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

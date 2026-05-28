import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Upload } from "@/components/tutor/TutorConstants";

interface MnemonicContextItem {
  topic: string;
  mnemonic: string;
  phrase: string;
  items: string[];
}

export function useChatContext(userId: string | undefined, currentTopic: string) {
  const [availableUploads, setAvailableUploads] = useState<Upload[]>([]);
  const [selectedUploadIds, setSelectedUploadIds] = useState<Set<string>>(new Set());
  const [showUploads, setShowUploads] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<Array<{ statement: string; options: any; correct_index: number | null; explanation: string | null; topic: string | null }>>([]);
  const [errorBankData, setErrorBankData] = useState<Array<{ tema: string; subtema: string | null; tipo_questao: string; categoria_erro: string | null; vezes_errado: number }>>([]);
  const [activeMnemonics, setActiveMnemonics] = useState<MnemonicContextItem[]>([]);

  // Load uploads
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      // SECURITY: restrict to user's own uploads. Global/org RAG content
      // is served exclusively via Edge Functions with service_role.
      const { data } = await supabase
        .from("uploads")
        .select("id, filename, extracted_text, category")
        .eq("user_id", userId)
        .eq("status", "processed")
        .not("extracted_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data && data.length > 0) {
        setAvailableUploads(data);
        setSelectedUploadIds(new Set(data.map((u) => u.id)));
      }
    };
    load();
  }, [userId]);

  // Load bank questions for current topic
  useEffect(() => {
    if (!userId || !currentTopic) { setBankQuestions([]); return; }
    const loadQuestions = async () => {
      const { data } = await supabase
        .from("questions_bank")
        .select("statement, options, correct_index, explanation, topic")
        .or(`user_id.eq.${userId},is_global.eq.true`)
        .ilike("topic", `%${currentTopic}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      setBankQuestions(data || []);
    };
    loadQuestions();
  }, [userId, currentTopic]);

  // Load error bank
  useEffect(() => {
    if (!userId) return;
    const loadErrorBank = async () => {
      const { data } = await supabase
        .from("error_bank")
        .select("tema, subtema, tipo_questao, categoria_erro, vezes_errado")
        .eq("user_id", userId)
        .order("vezes_errado", { ascending: false })
        .limit(20);
      setErrorBankData((data as any[]) || []);
    };
    loadErrorBank();
  }, [userId]);

  // Load active mnemonics for context
  useEffect(() => {
    if (!userId) return;
    const loadMnemonics = async () => {
      const { data: links } = await supabase
        .from("user_mnemonic_links")
        .select("mnemonic_asset_id, topic")
        .eq("user_id", userId)
        .eq("mnemonic_not_helping", false)
        .order("last_seen_at", { ascending: false })
        .limit(10);
      if (!links || links.length === 0) { setActiveMnemonics([]); return; }
      const assetIds = links.map(l => l.mnemonic_asset_id);
      const { data: assets } = await supabase
        .from("mnemonic_assets")
        .select("id, topic, mnemonic, phrase, items_map_json")
        .in("id", assetIds);
      if (!assets) { setActiveMnemonics([]); return; }
      const items: MnemonicContextItem[] = assets.map(a => ({
        topic: a.topic,
        mnemonic: a.mnemonic,
        phrase: a.phrase,
        items: Array.isArray(a.items_map_json)
          ? (a.items_map_json as Array<{ original_item?: string }>).map(i => i.original_item || "").filter(Boolean)
          : [],
      }));
      setActiveMnemonics(items);
    };
    loadMnemonics();
  }, [userId]);

  const toggleUpload = useCallback((id: string) => {
    setSelectedUploadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const buildUserContext = useCallback(() => {
    let ctx = "";
    for (const upload of availableUploads) {
      if (!selectedUploadIds.has(upload.id)) continue;
      const snippet = upload.extracted_text?.slice(0, 2000) || "";
      if (ctx.length + snippet.length > 6000) break;
      ctx += `\n\n📄 ${upload.filename} (${upload.category || "material"}):\n${snippet}`;
    }
    if (bankQuestions.length > 0) {
      ctx += `\n\n📋 BANCO DE QUESTÕES DO ALUNO (${bankQuestions.length} questões sobre "${currentTopic}"):\n`;
      bankQuestions.slice(0, 5).forEach((q, i) => {
        ctx += `\nQ${i + 1}: ${q.statement.slice(0, 300)}`;
        if (q.options && Array.isArray(q.options)) {
          (q.options as string[]).forEach((opt: string, j: number) => {
            ctx += `\n  ${String.fromCharCode(65 + j)}) ${opt}`;
          });
        }
        if (q.correct_index != null) ctx += `\n  Gabarito: ${String.fromCharCode(65 + q.correct_index)}`;
        if (q.explanation) ctx += `\n  Explicação: ${q.explanation.slice(0, 200)}`;
      });
      ctx += `\n\nUSE estas questões como referência para o estilo, dificuldade e temas. Priorize CASOS CLÍNICOS.`;
    }
    // Inject active mnemonics as study aids
    const topicMnemonics = currentTopic
      ? activeMnemonics.filter(m => m.topic.toLowerCase().includes(currentTopic.toLowerCase()))
      : [];
    const mnemonicsToShow = topicMnemonics.length > 0 ? topicMnemonics : activeMnemonics.slice(0, 3);
    if (mnemonicsToShow.length > 0) {
      ctx += `\n\n🧠 MNEMÔNICOS ATIVOS DO ALUNO (use como reforço quando relevante):\n`;
      mnemonicsToShow.forEach((m) => {
        ctx += `\n- "${m.mnemonic}" (${m.topic}): "${m.phrase}"`;
        if (m.items.length > 0) ctx += ` → ${m.items.join(", ")}`;
      });
      ctx += `\n\nQuando o aluno errar algo coberto por um mnemônico acima, LEMBRE-O do mnemônico para reforçar a memorização. Se não houver mnemônico para o tema do erro, SUGIRA que ele gere um no módulo de Mnemônicos.`;
    }
    return ctx.trim();
  }, [availableUploads, selectedUploadIds, bankQuestions, currentTopic, activeMnemonics]);

  return {
    availableUploads, selectedUploadIds, setSelectedUploadIds,
    showUploads, setShowUploads,
    bankQuestions, errorBankData, activeMnemonics,
    toggleUpload, buildUserContext,
  };
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useExperimentGroup } from "./useExperimentGroup";


// All available module keys matching sidebar routes
export const ALL_MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "enaflix", label: "🎬 ENAFLIX" },
  { key: "chatgpt", label: "Tutor" },
  { key: "plano-dia", label: "⚡ Plano do Dia" },
  { key: "diagnostico", label: "🩺 Nivelamento" },
  { key: "planner", label: "🧠 Planner IA" },
  { key: "flashcards", label: "🃏 Flashcards" },
  { key: "gerar-flashcards", label: "🃏 Gerador Flashcards" },
  { key: "resumos", label: "📖 Resumidor" },
  { key: "apostilas", label: "📚 Apostilas & Resumos" },
  { key: "cronicas", label: "📖 Crônicas Médicas" },
  { key: "discursivas", label: "✍️ Discursivas" },
  { key: "entrevista", label: "🎤 Entrevista" },
  { key: "simulados", label: "📝 Simulados" },
  { key: "questoes", label: "❓ Gerador Questões" },
  { key: "banco-questoes", label: "🗃️ Banco de Questões" },
  { key: "anamnese", label: "🩺 Anamnese" },
  { key: "prova-pratica", label: "🩺 Prova Prática" },
  { key: "plantao", label: "🚨 Modo Plantão" },
  { key: "simulacao-clinica", label: "🚨 Simulação Clínica" },
  { key: "predictor", label: "📈 Previsão" },
  { key: "banco-erros", label: "🚨 Banco de Erros" },
  { key: "mapa-dominio", label: "🗺️ Mapa Evolução" },
  { key: "proficiencia", label: "🎓 Proficiência" },
  { key: "coach", label: "💪 Coach" },
  { key: "conquistas", label: "🏆 Conquistas" },
  { key: "analytics", label: "📊 Analytics" },
  { key: "rankings", label: "👑 Rankings" },
  { key: "mentor", label: "🤖 Mentor IA" },
  { key: "missao", label: "🎯 Modo Missão" },
  { key: "image-quiz", label: "🖼️ Quiz de Imagens" },
  { key: "revisor", label: "📋 Revisor Médico" },
  { key: "sessao-estudo", label: "📖 Sessão de Estudo" },
  { key: "mnemonico", label: "🧠 Mnemônico" },
  { key: "mapas-mentais", label: "🧠 Mapas Mentais" },
] as const;

export type ModuleKey = typeof ALL_MODULES[number]["key"];

export const useModuleAccess = () => {
  const { user } = useAuth();
  const [enabledModules, setEnabledModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // No user = no access (except dashboard via route guard)
      setEnabledModules(new Set());
      setLoading(false);
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from("user_module_access")
        .select("module_key, enabled")
        .eq("user_id", user.id);

      if (error || !data || data.length === 0) {
        // No records = all modules enabled (default for existing users)
        setEnabledModules(new Set(ALL_MODULES.map(m => m.key)));
      } else {
        const enabled = new Set<string>(ALL_MODULES.map(m => m.key));

        data.forEach((record) => {
          if (record.enabled) {
            enabled.add(record.module_key);
            return;
          }

          enabled.delete(record.module_key);
        });

        // Always keep dashboard enabled
        enabled.add("dashboard");
        setEnabledModules(enabled);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const isModuleEnabled = (key: string) => {
    if (!user) return false;
    return enabledModules.has(key);
  };

  return { enabledModules, isModuleEnabled, loading };
};

import { simulateHighStudyActivity } from "@/lib/enaflixSimulation";
import { toast } from "sonner";

/**
 * Script de Geração em Lote ENAFLIX - P2 Clínica Médica e Pediatria
 * Este script automatiza o disparo da engine para todos os temas solicitados.
 */

const TEMAS_P2_CLINICA = [
  "Câncer de pâncreas", "Dissecção aórtica", "Doença arterial obstrutiva periférica", 
  "Pericardite e Endocardite", "Doenças Sexualmente Transmissíveis (DST)", "Malária e Dengue", 
  "Pancreatite aguda/crônica e Litíase biliar", "Pneumonias bacterianas", "Micoses pulmonares", 
  "Câncer gástrico", "Linfangites", "Insuficiência arterial crônica", 
  "Introdução às arritmias cardíacas", "Colagenoses (Lupus, Artrite)", "Pneumonias atípicas", 
  "Doenças supurativas pulmonares", "Esquistossomose mansoni", "Hepatites agudas", 
  "Câncer hepatobiliar", "Erisipela e Celulite", "Doença linfática", 
  "Fibrilação atrial", "Tumores cutâneos (Melanoma e não-melanoma)", "DPOC", 
  "Tromboembolismo Pulmonar (TEP)", "Câncer de pulmão", "Isquemia cerebral extra-craniana", 
  "Estenose e insuficiência mitral", "Psoríase", "Leishmaniose visceral (Calazar)", 
  "Hepatites crônicas", "Broncoscopia e Espirometria"
];

const TEMAS_P2_PEDIATRIA = [
  "Interpretação de Hemograma e Gasometria Pediátrica", "Doenças Exantemáticas I", 
  "Doenças Exantemáticas II", "Síndrome Nefrótica na infância", "Convulsões febris e Epilepsia", 
  "Artrite Reumatoide Juvenil", "Febre Reumática", 
  "Aspectos Éticos do Atendimento ao Adolescente", "Imunização no Adolescente"
];

export const generateP2LessonBatch = async (userId: string) => {
  if (!userId) {
    toast.error("Usuário não identificado para geração em lote.");
    return;
  }

  const allThemes = [...TEMAS_P2_CLINICA, ...TEMAS_P2_PEDIATRIA];
  toast.info(`Processando 41 temas: Gerando roteiros e prompts 1 a 1...`);

  let successCount = 0;
  
  for (const topic of allThemes) {
    try {
      // Agora a geração é SÍNCRONA: o script espera a IA terminar de estruturar para passar para a próxima
      const lessonId = await simulateHighStudyActivity(userId, topic);
      if (lessonId) {
        successCount++;
        console.log(`[Batch] Aula de "${topic}" estruturada com sucesso.`);
      }
      
      // Delay de respiro para o Gateway de IA
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      console.error(`Erro ao gerar aula para ${topic}:`, err);
    }
  }

  toast.success(`Pipeline finalizado! ${successCount} aulas estão PRONTAS com prompts na Central de Produção.`);
};

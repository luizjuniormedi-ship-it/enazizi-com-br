import { supabase } from "@/integrations/supabase/client";

export interface RecommendedVideo {
  found: boolean;
  lessonId?: string;
  title?: string;
  subtitle?: string;
  subject?: string;
  topic?: string;
  reason?: string;
  confidence: number;
  source?: 'ai_video_lessons' | 'tutor_lesson_memory' | 'cme_video_projects';
  watchUrl?: string;
  thumbnailUrl?: string;
  status?: string;
}

/**
 * Normaliza termos médicos para busca semântica simples
 */
function normalizeMedicalTerm(term: string): string[] {
  const t = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  // Mapeamento de sinônimos e siglas
  const synonyms: Record<string, string[]> = {
    "ira": ["insuficiencia renal aguda", "injuria renal aguda", "rim", "funcao renal"],
    "insuficiencia renal": ["ira", "injuria renal", "rim", "funcao renal", "sindrome uremica"],
    "has": ["hipertensao arterial", "pressao alta"],
    "fa": ["fibrilacao atrial", "arritmia supraventricular"],
    "tep": ["tromboembolismo pulmonar", "embolia"],
    "iam": ["infarto agudo do miocardio", "ataque cardiaco"],
    "ic": ["insuficiencia cardiaca", "coracao"],
    "icc": ["insuficiencia cardiaca congestiva", "coracao"],
    "pericardite": ["pericardio", "inflamacao cardiaca", "tamponamento"],
    "pneumonia": ["infeccao pulmonar", "broncopneumonia", "pulmao"],
  };

  const results = new Set<string>([t]);
  
  // Adiciona sinônimos se existirem
  Object.keys(synonyms).forEach(key => {
    if (t.includes(key) || synonyms[key].some(s => t.includes(s))) {
      results.add(key);
      synonyms[key].forEach(s => results.add(s));
    }
  });

  return Array.from(results);
}

export async function findRecommendedVideoForTutorContext(
  topic: string,
  userId?: string
): Promise<RecommendedVideo> {
  const terms = normalizeMedicalTerm(topic);
  console.log("[TutorVideoService] Buscando por termos:", terms);

  const results: RecommendedVideo[] = [];

  // 1. Buscar em ai_video_lessons (Prioridade 1)
  try {
    const { data: aiLessons } = await supabase
      .from("ai_video_lessons")
      .select("*, project:cme_video_projects(aggregation_id)")
      .eq('status', 'published')
      .order('is_gold_content', { ascending: false });

    if (aiLessons) {
      aiLessons.forEach(lesson => {
        let score = 0;
        const lTitle = lesson.title?.toLowerCase() || "";
        const lTopic = lesson.topic?.toLowerCase() || "";

        terms.forEach(term => {
          if (lTitle.includes(term)) score += 40;
          if (lTopic.includes(term)) score += 30;
        });

        if (score >= 40) {
          results.push({
            found: true,
            lessonId: lesson.id,
            title: lesson.title,
            topic: lesson.topic,
            confidence: score,
            source: 'ai_video_lessons',
            watchUrl: lesson.playback_url || lesson.video_url,
            thumbnailUrl: lesson.thumbnail_url,
            status: lesson.status
          });
        }
      });
    }
  } catch (e) {
    console.error("[TutorVideoService] Erro em ai_video_lessons:", e);
  }

  // 2. Buscar em tutor_lesson_memory (Prioridade 2)
  try {
    const { data: memoryLessons } = await supabase
      .from("tutor_lesson_memory")
      .select("*")
      .eq('status', 'published')
      .is('deleted_at', null);

    if (memoryLessons) {
      memoryLessons.forEach(lesson => {
        let score = 0;
        const lTopic = lesson.topic?.toLowerCase() || "";
        
        terms.forEach(term => {
          if (lTopic.includes(term)) score += 50; // Match direto no tópico da memória de aula
        });

        if (score >= 40) {
          results.push({
            found: true,
            lessonId: lesson.id,
            title: lesson.topic,
            topic: lesson.topic,
            confidence: score,
            source: 'tutor_lesson_memory',
            watchUrl: lesson.video_url,
            thumbnailUrl: (lesson as any).thumbnail_url,
            status: lesson.status
          });
        }
      });
    }
  } catch (e) {
    console.error("[TutorVideoService] Erro em tutor_lesson_memory:", e);
  }

  if (results.length === 0) {
    return { found: false, confidence: 0 };
  }

  // Ordenar por confiança e retornar o melhor
  const bestMatch = results.sort((a, b) => b.confidence - a.confidence)[0];
  console.log("[TutorVideoService] Melhor match encontrado:", bestMatch);
  
  return bestMatch;
}

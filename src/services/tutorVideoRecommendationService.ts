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

type LogEvent =
  | 'search_started'
  | 'found'
  | 'not_found'
  | 'shown'
  | 'clicked'
  | 'skipped_unpublished'
  | 'skipped_no_video';

export function logVideoRecommendationEvent(
  event: LogEvent,
  payload: Record<string, unknown> = {},
) {
  // Logger leve — front e back compatível.
  // Mantém um único ponto para futura ingestão em telemetry_events.
  // eslint-disable-next-line no-console
  console.log(`[TutorVideoRec] ${event}`, payload);
}

/**
 * Normaliza termos médicos para busca semântica simples
 */
function normalizeMedicalTerm(term: string): string[] {
  const t = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const synonyms: Record<string, string[]> = {
    "ira": ["insuficiencia renal aguda", "injuria renal aguda", "rim", "funcao renal"],
    "insuficiencia renal": ["ira", "injuria renal", "rim", "funcao renal", "sindrome uremica"],
    "has": ["hipertensao arterial", "pressao alta"],
    "fa": ["fibrilacao atrial", "arritmia supraventricular"],
    "tep": ["tromboembolismo pulmonar", "embolia"],
    "iam": ["infarto agudo do miocardio", "ataque cardiaco"],
    "ic": ["insuficiencia cardiaca", "coracao"],
    "icc": ["insuficiencia cardiaca congestiva", "coracao"],
    "pericardite": ["pericardio", "inflamacao cardiaca", "tamponamento", "cardiologia"],
    "endocardite": ["cardiologia", "valvula", "vegetacao"],
    "cardiologia": ["coracao", "cardiaco", "pericardite", "endocardite", "fa", "iam"],
    "pneumonia": ["infeccao pulmonar", "broncopneumonia", "pulmao"],
  };

  const results = new Set<string>([t]);
  Object.keys(synonyms).forEach(key => {
    if (t.includes(key) || synonyms[key].some(s => t.includes(s))) {
      results.add(key);
      synonyms[key].forEach(s => results.add(s));
    }
  });

  return Array.from(results);
}

function hasValidVideo(url?: string | null): boolean {
  return !!url && typeof url === 'string' && url.trim().length > 5;
}

export async function findRecommendedVideoForTutorContext(
  topic: string,
  userId?: string
): Promise<RecommendedVideo> {
  const terms = normalizeMedicalTerm(topic);
  logVideoRecommendationEvent('search_started', { topic, terms, userId });

  const results: RecommendedVideo[] = [];

  // 1) ai_video_lessons (publicadas)
  try {
    const { data: aiLessons } = await supabase
      .from("ai_video_lessons")
      .select("*, project:cme_video_projects(aggregation_id)")
      .eq('status', 'published')
      .order('is_gold_content', { ascending: false });

    if (aiLessons) {
      aiLessons.forEach((lesson: any) => {
        let score = 0;
        const lTitle = (lesson.title || "").toLowerCase();
        const lTopic = (lesson.topic || "").toLowerCase();

        terms.forEach(term => {
          if (lTitle.includes(term)) score += 40;
          if (lTopic.includes(term)) score += 30;
        });

        if (score < 40) return;

        const watchUrl = lesson.playback_url || lesson.video_url;
        if (!hasValidVideo(watchUrl)) {
          logVideoRecommendationEvent('skipped_no_video', { source: 'ai_video_lessons', id: lesson.id });
          return;
        }

        results.push({
          found: true,
          lessonId: lesson.id,
          title: lesson.title,
          topic: lesson.topic,
          confidence: score,
          source: 'ai_video_lessons',
          watchUrl,
          thumbnailUrl: lesson.thumbnail_url,
          status: lesson.status,
        });
      });
    }
  } catch (e) {
    console.error("[TutorVideoService] Erro em ai_video_lessons:", e);
  }

  // 2) tutor_lesson_memory (publicadas, não excluídas)
  try {
    const { data: memoryLessons } = await supabase
      .from("tutor_lesson_memory")
      .select("*")
      .eq('status', 'published')
      .is('deleted_at', null);

    if (memoryLessons) {
      memoryLessons.forEach((lesson: any) => {
        // Defesa-em-profundidade: se por algum motivo vier não publicada, ignora
        if (lesson.status !== 'published') {
          logVideoRecommendationEvent('skipped_unpublished', { id: lesson.id, status: lesson.status });
          return;
        }
        if (!hasValidVideo(lesson.video_url)) {
          logVideoRecommendationEvent('skipped_no_video', { source: 'tutor_lesson_memory', id: lesson.id });
          return;
        }

        let score = 0;
        const lTitle = (lesson.title || "").toLowerCase();
        const lTopic = (lesson.topic || "").toLowerCase();
        const lSubject = (lesson.subject || "").toLowerCase();
        const lSubtopic = (lesson.subtopic || "").toLowerCase();
        const videoUrl = (lesson.video_url || "").toLowerCase();

        terms.forEach(term => {
          if (!term) return;
          if (lTopic === term) score += 100;
          else if (lTopic.includes(term)) score += 50;
          if (lTitle.includes(term)) score += 40;
          if (lSubject.includes(term)) score += 25;
          if (lSubtopic.includes(term)) score += 25;
          if (videoUrl.includes(term)) score += 60;
        });

        if (score >= 50) {
          results.push({
            found: true,
            lessonId: lesson.id,
            title: lesson.title || lesson.topic,
            topic: lesson.topic,
            subject: lesson.subject,
            confidence: score,
            source: 'tutor_lesson_memory',
            watchUrl: lesson.video_url,
            thumbnailUrl: lesson.thumbnail_url,
            status: lesson.status,
          });
        }
      });
    }
  } catch (e) {
    console.error("[TutorVideoService] Erro em tutor_lesson_memory:", e);
  }

  if (results.length === 0) {
    logVideoRecommendationEvent('not_found', { topic, terms });
    return { found: false, confidence: 0 };
  }

  const bestMatch = results.sort((a, b) => b.confidence - a.confidence)[0];
  logVideoRecommendationEvent('found', {
    topic,
    lessonId: bestMatch.lessonId,
    confidence: bestMatch.confidence,
    source: bestMatch.source,
  });

  return bestMatch;
}

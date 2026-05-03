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
 * Normaliza termos médicos para busca semântica simples.
 * Retorna a query principal + sinônimos diretos (sem encadeamento transitivo).
 */
function normalizeMedicalTerm(term: string): string[] {
  const t = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const synonyms: Record<string, string[]> = {
    "ira": ["insuficiencia renal aguda", "injuria renal aguda"],
    "insuficiencia renal": ["ira", "injuria renal"],
    "has": ["hipertensao arterial", "pressao alta"],
    "fa": ["fibrilacao atrial"],
    "fibrilacao atrial": ["fa", "arritmia supraventricular"],
    "tep": ["tromboembolismo pulmonar", "embolia pulmonar"],
    "iam": ["infarto agudo do miocardio"],
    "ic": ["insuficiencia cardiaca"],
    "icc": ["insuficiencia cardiaca congestiva"],
    "pericardite": ["pericardio", "tamponamento cardiaco"],
    "endocardite": ["valvula cardiaca", "vegetacao valvar"],
    "cardiologia": ["coracao", "cardiaco"],
    "pneumonia": ["infeccao pulmonar", "broncopneumonia"],
  };

  const results = new Set<string>([t]);
  // Apenas sinônimos diretos do termo original (sem chain)
  Object.keys(synonyms).forEach(key => {
    if (t === key || t.includes(key) || synonyms[key].some(s => t.includes(s))) {
      results.add(key);
      synonyms[key].forEach(s => results.add(s));
    }
  });

  return Array.from(results).filter(Boolean);
}

/**
 * Faz match seguro: termos curtos (<=3 chars) exigem word boundary,
 * para evitar que "fa" case com "Falência".
 */
function termMatches(haystack: string, term: string): boolean {
  if (!haystack || !term) return false;
  if (term.length <= 3) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`);
    return re.test(haystack);
  }
  return haystack.includes(term);
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
          if (termMatches(lTitle, term)) score += 40;
          if (termMatches(lTopic, term)) score += 30;
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
          else if (termMatches(lTopic, term)) score += 50;
          if (termMatches(lTitle, term)) score += 40;
          if (termMatches(lSubject, term)) score += 25;
          if (termMatches(lSubtopic, term)) score += 25;
          if (termMatches(videoUrl, term)) score += 60;
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

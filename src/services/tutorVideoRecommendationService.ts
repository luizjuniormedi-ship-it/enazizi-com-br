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

/**
 * Persiste eventos de telemetria no banco de dados.
 * Garante auditabilidade das recomendações do Tutor.
 */
export async function logVideoRecommendationEvent(
  event: LogEvent,
  payload: Record<string, any> = {},
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (import.meta.env.DEV) {
      console.log(`[TutorVideoRec] ${event}`, payload);
    }

    // Persistência em telemetry_events
    // session_id é obrigatório no schema
    const sessionId = (payload.session_id || payload.conversationId || payload.userId || user?.id || 'anonymous') as string;

    await (supabase.from('telemetry_events') as any).insert({
      event_name: `tutor_video_${event}`,
      user_id: user?.id || (typeof payload.userId === 'string' ? payload.userId : null),
      session_id: sessionId,
      properties: {
        ...payload,
        service: 'tutor_video_recommendation'
      },
      route: window.location.pathname || '/'
    });
  } catch (error) {
    console.error("[TutorVideoRec] Erro ao persistir telemetria:", error);
  }
}

/**
 * Normaliza termos médicos para busca semântica simples.
 * Retorna a query principal + sinônimos diretos (sem encadeamento transitivo).
 */
export function normalizeMedicalTerm(term: string): string[] {
  if (!term) return [];
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
    "iam": ["infarto", "miocardio", "coronariana"],
    "tep": ["embolia pulmonar", "tromboembolismo"],
    "fa": ["fibrilacao atrial", "arritmia"],
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
export function termMatches(haystack: string, term: string): boolean {
  if (!haystack || !term) return false;
  const h = haystack.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const t = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (t.length <= 3) {
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`);
    return re.test(h);
  }
  return h.includes(t);
}

function hasValidVideo(url?: string | null): boolean {
  if (!url) return false;
  const u = String(url).trim().toLowerCase();
  // Player interno ou URLs válidas (Vimeo, YouTube, Cloudfront, etc)
  return u.length > 10 && (u.includes('http') || u.includes('player'));
}

export async function findRecommendedVideoForTutorContext(
  topic: string,
  userId?: string,
  conversationId?: string
): Promise<RecommendedVideo> {
  const terms = normalizeMedicalTerm(topic);
  
  // Persistir início da busca
  logVideoRecommendationEvent('search_started', { 
    topic, 
    terms, 
    userId,
    conversationId 
  });

  const results: RecommendedVideo[] = [];

  // 1) ai_video_lessons (Publicadas e não ocultas)
  try {
    const { data: aiLessons } = await supabase
      .from("ai_video_lessons")
      .select("*")
      .eq('status', 'published')
      .is('deleted_at', null)
      .eq('hidden_from_student', false)
      .order('is_gold_content', { ascending: false });

    if (aiLessons) {
      aiLessons.forEach((lesson: any) => {
        let score = 0;
        const lTitle = (lesson.title || "").toLowerCase();
        const lTopic = (lesson.topic || "").toLowerCase();

        terms.forEach(term => {
          if (termMatches(lTitle, term)) score += 40;
          if (termMatches(lTopic, term)) score += 30;
          if (lTopic === term) score += 30; // Bonus por match exato
        });

        if (score < 40) return;
        
        // Final security check: must have video and be published
        if (lesson.status !== 'published' || lesson.hidden_from_student) return;

        const watchUrl = lesson.playback_url || lesson.video_url;
        if (!hasValidVideo(watchUrl)) {
          logVideoRecommendationEvent('skipped_no_video', { 
            source: 'ai_video_lessons', 
            id: lesson.id,
            topic: lesson.topic 
          });
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

  // 2) tutor_lesson_memory (Publicadas, não excluídas, não ocultas)
  try {
    const { data: memoryLessons } = await supabase
      .from("tutor_lesson_memory")
      .select("*")
      .eq('status', 'published')
      .eq('hidden_from_student', false)
      .is('deleted_at', null);

    if (memoryLessons) {
      memoryLessons.forEach((lesson: any) => {
        if (!hasValidVideo(lesson.video_url)) {
          logVideoRecommendationEvent('skipped_no_video', { 
            source: 'tutor_lesson_memory', 
            id: lesson.id,
            topic: lesson.topic
          });
          return;
        }

        let score = 0;
        const lTitle = (lesson.title || "").toLowerCase();
        const lTopic = (lesson.topic || "").toLowerCase();
        const lSubject = (lesson.subject || "").toLowerCase();
        const lSubtopic = (lesson.subtopic || "").toLowerCase();

        terms.forEach(term => {
          if (!term) return;
          if (lTopic === term) score += 100;
          else if (termMatches(lTopic, term)) score += 50;
          if (termMatches(lTitle, term)) score += 40;
          if (termMatches(lSubject, term)) score += 25;
          if (termMatches(lSubtopic, term)) score += 25;
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
    logVideoRecommendationEvent('not_found', { topic, terms, conversationId });
    return { found: false, confidence: 0 };
  }

  // Pegar o melhor match
  const bestMatch = results.sort((a, b) => b.confidence - a.confidence)[0];
  
  logVideoRecommendationEvent('found', {
    topic,
    lessonId: bestMatch.lessonId,
    confidence: bestMatch.confidence,
    source: bestMatch.source,
    conversationId
  });

  return bestMatch;
}

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
  | 'message_received'
  | 'topic_detected'
  | 'search_started'
  | 'found'
  | 'not_found'
  | 'shown'
  | 'clicked'
  | 'skipped_unpublished'
  | 'skipped_no_video'
  | 'skipped_hidden'
  | 'skipped_deleted'
  | 'answer_generation_started'
  | 'answer_generation_completed'
  | 'answer_generation_failed';

/**
 * Persiste eventos de telemetria no banco de dados dedicado.
 * Garante auditabilidade total das recomendações e performance do Tutor.
 */
export async function logVideoRecommendationEvent(
  event: LogEvent,
  payload: Record<string, any> = {},
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (import.meta.env.DEV) {
      console.log(`[TutorIA Telemetry] ${event}`, payload);
    }

    // Persistência em tutor_ia_telemetry (Auditável e Centralizada)
    await supabase.from('tutor_ia_telemetry').insert({
      user_id: user?.id,
      session_id: payload.conversationId || payload.session_id || 'chat_session',
      lesson_id: payload.lessonId || null,
      topic: payload.topic || 'unknown',
      event_type: event,
      confidence: payload.confidence || 0,
      model_used: payload.model || null,
      fallback_used: !!payload.fallback_used,
      parse_strategy: payload.parse_strategy || null,
      duration_ms: payload.duration_ms || null,
      metadata: {
        ...payload,
        client_timestamp: new Date().toISOString(),
        route: window.location.pathname
      }
    });
  } catch (error) {
    console.error("[TutorIA Telemetry] Erro ao persistir telemetria:", error);
  }
}

/**
 * Normaliza termos médicos para busca semântica robusta.
 * Otimizado para evitar falsos positivos em termos curtos.
 */
export function normalizeMedicalTerm(term: string): string[] {
  if (!term) return [];
  // Normalização agressiva para comparação
  const t = term.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, '')
    .trim();

  const synonyms: Record<string, string[]> = {
    "ira": ["insuficiencia renal aguda", "injuria renal aguda"],
    "insuficiencia renal": ["ira", "injuria renal"],
    "has": ["hipertensao arterial", "pressao alta"],
    "fa": ["fibrilacao atrial", "arritmia"],
    "fibrilacao atrial": ["fa", "arritmia supraventricular"],
    "tep": ["tromboembolismo pulmonar", "embolia pulmonar", "tromboembolismo"],
    "iam": ["infarto agudo do miocardio", "infarto", "miocardio", "coronariana"],
    "ic": ["insuficiencia cardiaca"],
    "icc": ["insuficiencia cardiaca congestiva"],
    "pericardite": ["pericardio", "tamponamento cardiaco"],
    "endocardite": ["valvula cardiaca", "vegetacao valvar"],
    "cardiologia": ["coracao", "cardiaco"],
    "pneumonia": ["infeccao pulmonar", "broncopneumonia"],
    "hepatite": ["inflamacao figado", "hepatites agudas"],
    "pancreatite": ["inflamacao pancreas", "dor abdominal"],
  };

  const results = new Set<string>([t]);
  Object.keys(synonyms).forEach(key => {
    if (t === key || t.includes(key) || synonyms[key].some(s => t.includes(s))) {
      results.add(key);
      synonyms[key].forEach(s => results.add(s));
    }
  });

  return Array.from(results).filter(Boolean);
}

/**
 * Match seguro com boundary para termos curtos.
 */
export function termMatches(haystack: string, term: string): boolean {
  if (!haystack || !term) return false;
  const h = haystack.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const t = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (t.length <= 3) {
    // Word boundary rigoroso para evitar match de "fa" em "falencia"
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`);
    return re.test(h);
  }
  return h.includes(t);
}

function hasValidVideo(url?: string | null): boolean {
  if (!url) return false;
  const u = String(url).trim().toLowerCase();
  return u.length > 10 && (u.includes('http') || u.includes('player'));
}

/**
 * Busca vídeo com Cache por Sessão para evitar queries redundantes.
 */
export async function findRecommendedVideoForTutorContext(
  topic: string,
  userId?: string,
  conversationId?: string
): Promise<RecommendedVideo> {
  const normalizedTopic = topic.toLowerCase().trim();
  const sessionId = conversationId || 'active_session';

  // 1. Verificar Cache
  try {
    const { data: cacheHit } = await supabase
      .from('tutor_recommendation_cache')
      .select('*')
      .eq('session_id', sessionId)
      .eq('normalized_topic', normalizedTopic)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cacheHit) {
      if (cacheHit.lesson_id) {
        return {
          found: true,
          lessonId: cacheHit.lesson_id,
          ...cacheHit.lesson_data,
          confidence: cacheHit.confidence
        } as RecommendedVideo;
      }
      return { found: false, confidence: 0 };
    }
  } catch (e) {
    console.warn("[TutorVideoService] Erro ao ler cache:", e);
  }

  const terms = normalizeMedicalTerm(topic);
  
  logVideoRecommendationEvent('search_started', { 
    topic, 
    terms, 
    userId,
    conversationId 
  });

  const results: RecommendedVideo[] = [];

  // Busca em ai_video_lessons (Prioritário)
  try {
    const { data: aiLessons } = await (supabase.from("ai_video_lessons") as any)
      .select("*")
      .eq('status', 'published')
      .order('is_gold_content', { ascending: false });

    if (aiLessons) {
      aiLessons.forEach((lesson: any) => {
        if (lesson.status !== 'published') return;
        let score = 0;
        const lTitle = (lesson.title || "").toLowerCase();
        const lTopic = (lesson.topic || "").toLowerCase();

        terms.forEach(term => {
          if (termMatches(lTitle, term)) score += 40;
          if (termMatches(lTopic, term)) score += 30;
          if (lTopic === term) score += 30;
        });

        if (score < 40) return;

        const watchUrl = lesson.playback_url || lesson.video_url;
        if (hasValidVideo(watchUrl)) {
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
        }
      });
    }
  } catch (e) {
    console.error("[TutorVideoService] ai_video_lessons lookup failed:", e);
  }

  // Busca em tutor_lesson_memory
  try {
    const { data: memoryLessons } = await supabase
      .from("tutor_lesson_memory")
      .select("*")
      .eq('status', 'published')
      .eq('hidden_from_student', false)
      .is('deleted_at', null);

    if (memoryLessons) {
      memoryLessons.forEach((lesson: any) => {
        if (lesson.status !== 'published' || lesson.hidden_from_student || lesson.deleted_at) return;
        if (!hasValidVideo(lesson.video_url)) return;

        let score = 0;
        const lTitle = (lesson.title || "").toLowerCase();
        const lTopic = (lesson.topic || "").toLowerCase();

        terms.forEach(term => {
          if (!term) return;
          if (lTopic === term) score += 100;
          else if (termMatches(lTopic, term)) score += 50;
          if (termMatches(lTitle, term)) score += 40;
        });

        if (score >= 50) {
          results.push({
            found: true,
            lessonId: lesson.id,
            title: lesson.title || lesson.topic,
            topic: lesson.topic,
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
    console.error("[TutorVideoService] tutor_lesson_memory lookup failed:", e);
  }

  const bestMatch = results.length > 0 
    ? results.sort((a, b) => b.confidence - a.confidence)[0]
    : { found: false, confidence: 0 } as RecommendedVideo;

  // 2. Salvar em Cache (Incluindo Negativo Cache)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('tutor_recommendation_cache').insert({
        user_id: user.id,
        session_id: sessionId,
        normalized_topic: normalizedTopic,
        lesson_id: bestMatch.found ? bestMatch.lessonId : null,
        confidence: bestMatch.confidence,
        lesson_data: bestMatch.found ? {
          title: bestMatch.title,
          topic: bestMatch.topic,
          watchUrl: bestMatch.watchUrl,
          thumbnailUrl: bestMatch.thumbnailUrl,
          source: bestMatch.source
        } : null
      });
    }
  } catch (e) {
    console.warn("[TutorVideoService] Erro ao salvar cache:", e);
  }

  if (bestMatch.found) {
    logVideoRecommendationEvent('found', {
      topic,
      lessonId: bestMatch.lessonId,
      confidence: bestMatch.confidence,
      source: bestMatch.source,
      conversationId
    });
  } else {
    logVideoRecommendationEvent('not_found', { topic, terms, conversationId });
  }

  return bestMatch;
}

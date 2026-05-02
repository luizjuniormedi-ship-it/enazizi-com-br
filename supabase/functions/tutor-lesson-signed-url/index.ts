// Edge function: gera signed URL para vídeo de aula do Tutor.
// Validação: usuário precisa ser staff OU dono da aula publicada.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const lessonId: string | undefined = body?.lesson_id;
    if (!lessonId) {
      return new Response(JSON.stringify({ error: "lesson_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lê a aula com RLS do usuário (se ele não tem acesso, vem null)
    const { data: lesson, error: lessonErr } = await userClient
      .from("tutor_lesson_memory")
      .select("id, status, video_url, user_id, hidden_from_student, deleted_at")
      .eq("id", lessonId)
      .maybeSingle();

    if (lessonErr || !lesson) {
      return new Response(JSON.stringify({ error: "not_found_or_forbidden" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lesson.video_url) {
      return new Response(JSON.stringify({ error: "no_video" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se é staff (para liberar mesmo aulas não publicadas)
    const { data: isStaff } = await userClient.rpc("is_lesson_staff", {
      _user_id: user.id,
    });

    const isOwnerPublished =
      lesson.user_id === user.id &&
      lesson.status === "published" &&
      !lesson.hidden_from_student &&
      !lesson.deleted_at;

    if (!isStaff && !isOwnerPublished) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrai object path do video_url (suporta URLs completas ou paths puros)
    const path = extractStoragePath(lesson.video_url);
    if (!path) {
      return new Response(
        JSON.stringify({ error: "invalid_video_path" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Service client para gerar signed URL
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: signed, error: signErr } = await adminClient.storage
      .from("tutor-lesson-videos")
      .createSignedUrl(path, 60 * 60); // 1 hora

    if (signErr || !signed) {
      return new Response(
        JSON.stringify({ error: "sign_failed", detail: signErr?.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        signed_url: signed.signedUrl,
        expires_in: 3600,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "internal", detail: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function extractStoragePath(input: string): string | null {
  if (!input) return null;
  // Se já é path puro
  if (!input.startsWith("http")) return input.replace(/^\/+/, "");
  // .../storage/v1/object/{public|sign}/tutor-lesson-videos/<path>
  const m = input.match(/tutor-lesson-videos\/(.+?)(?:\?|$)/);
  return m ? decodeURIComponent(m[1]) : null;
}

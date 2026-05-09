const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuth } from '../_shared/require-auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Loop 3E: getClaims + getUser fallback antes de qualquer query.
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  const userId = auth.userId

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { action } = await req.json().catch(() => ({ action: 'get' }))

    if (action === 'get') {
      // Return existing snapshot (fast path)
      const { data: snapshot } = await supabase
        .from('dashboard_snapshots')
        .select('snapshot_json, updated_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (snapshot) {
        return new Response(JSON.stringify({
          snapshot: snapshot.snapshot_json,
          updatedAt: snapshot.updated_at,
          cached: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ snapshot: null, cached: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update') {
      // Rebuild snapshot from current data
      const [
        profileRes, practiceRes, revisoesRes, examRes,
        gamRes, errorRes, approvalRes, domainRes,
      ] = await Promise.all([
        supabase.from('profiles')
          .select('display_name, has_completed_diagnostic, target_exams, target_exam, exam_date')
          .eq('user_id', userId).maybeSingle(),
        supabase.from('practice_attempts')
          .select('correct', { count: 'exact' })
          .eq('user_id', userId),
        supabase.from('revisoes')
          .select('id, status, data_revisao', { count: 'exact' })
          .eq('user_id', userId)
          .eq('status', 'pendente'),
        supabase.from('exam_sessions')
          .select('score, total_questions')
          .eq('user_id', userId).eq('status', 'finished'),
        supabase.from('user_gamification')
          .select('current_streak, xp, level')
          .eq('user_id', userId).maybeSingle(),
        supabase.from('error_bank')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase.from('approval_scores')
          .select('score')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('medical_domain_map')
          .select('specialty, domain_score')
          .eq('user_id', userId),
      ])

      const practiceData = practiceRes.data || []
      const correctCount = practiceData.filter((a: any) => a.correct).length
      const totalCount = practiceData.length
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

      const todayStr = new Date().toISOString().split('T')[0]
      const pendingReviews = (revisoesRes.data || []).filter((r: any) => r.data_revisao <= todayStr).length

      const exams = examRes.data || []
      const domains = domainRes.data || []
      const avgDomain = domains.length > 0
        ? Math.round(domains.reduce((s: number, d: any) => s + (d.domain_score || 0), 0) / domains.length)
        : 0

      const snapshot = {
        profile: {
          displayName: profileRes.data?.display_name || null,
          hasCompletedDiagnostic: profileRes.data?.has_completed_diagnostic || false,
          targetExams: profileRes.data?.target_exams || [],
          examDate: profileRes.data?.exam_date || null,
        },
        metrics: {
          questionsAnswered: totalCount,
          accuracy,
          pendingReviews,
          totalReviews: revisoesRes.count || 0,
          errorsCount: errorRes.count || 0,
          simuladosCompleted: exams.length,
          avgDomainScore: avgDomain,
          // approval_score comes from approval_scores table, NOT from accuracy
          approvalScore: approvalRes.data?.score || null,
        },
        gamification: gamRes.data || { current_streak: 0, xp: 0, level: 1 },
        generatedAt: new Date().toISOString(),
      }

      // Upsert snapshot — approval_score from approval_scores table, not accuracy
      await supabase
        .from('dashboard_snapshots')
        .upsert({
          user_id: userId,
          snapshot_json: snapshot,
          approval_score: approvalRes.data?.score ?? null,
          pending_reviews: pendingReviews,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      return new Response(JSON.stringify({
        snapshot,
        updatedAt: new Date().toISOString(),
        cached: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[dashboard-snapshot] Error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

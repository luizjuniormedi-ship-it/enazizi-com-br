import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' } });
  }
  
  const body = await req.json();
  const { provider, model } = body;
  
  const { data, error } = await supabase
    .from('ai_runtime_logs')
    .select('provider, model, success, latency_ms, error_code, metadata')
    .eq('task_type', 'benchmark_v1')
    .order('created_at', { ascending: false })
    .limit(10);

  return new Response(JSON.stringify({ data, error }), { headers: { "Content-Type": "application/json" } });
});
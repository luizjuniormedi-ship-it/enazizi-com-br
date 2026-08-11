import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' } });
  }
  
  const body = await req.json();
  const { action = 'results' } = body;

  if (action === 'results') {
    const { data, error } = await supabase
      .from('ai_runtime_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    return new Response(JSON.stringify({ data, error }), { headers: { "Content-Type": "application/json" } });
  }

  // Fallback para qualquer outro post
  return new Response(JSON.stringify({ status: "ready", timestamp: new Date().toISOString() }), { headers: { "Content-Type": "application/json" } });
});
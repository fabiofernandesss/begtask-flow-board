import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey, x-supabase-api-key",
  "Access-Control-Allow-Credentials": "true",
};

async function embed(input: string, apiKey: string): Promise<number[]> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      content: {
        parts: [{ text: input }]
      }
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${res.status} ${err}`);
  }

  const json = await res.json();
  const vec = json?.embedding?.values;
  if (!Array.isArray(vec)) throw new Error("Embedding not returned");
  return vec as number[];
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: { ...corsHeaders } });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const { board_id, query, k = 5 } = await req.json();
    if (!board_id || !query) {
      return new Response(JSON.stringify({ success: false, error: 'Missing board_id or query' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'Supabase service role not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: 'GEMINI_API_KEY not set' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: vectors, error: vecErr } = await supabase
      .from('board_vectors')
      .select('id, content, embedding')
      .eq('board_id', board_id);
    if (vecErr) throw new Error(vecErr.message);

    const queryVec = await embed(query, GEMINI_API_KEY);

    const ranked = (vectors || []).map((row) => ({
      id: row.id,
      content: row.content,
      score: cosineSimilarity(queryVec, row.embedding as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

    return new Response(JSON.stringify({ success: true, results: ranked }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
});
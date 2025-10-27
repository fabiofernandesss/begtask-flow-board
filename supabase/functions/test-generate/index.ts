import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, x-supabase-auth, x-forwarded-for, user-agent',
  'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    return new Response(
      JSON.stringify({
        message: "Teste da função",
        hasGeminiKey: !!GEMINI_API_KEY,
        keyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
        data: [
          {
            titulo: "Tarefa de Teste 1",
            descricao: "Esta é uma tarefa de teste gerada estaticamente",
            prioridade: "alta"
          },
          {
            titulo: "Tarefa de Teste 2", 
            descricao: "Esta é outra tarefa de teste gerada estaticamente",
            prioridade: "media"
          }
        ]
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error) {
    console.error('Erro na função test-generate:', error);
    return new Response(
      JSON.stringify({
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});
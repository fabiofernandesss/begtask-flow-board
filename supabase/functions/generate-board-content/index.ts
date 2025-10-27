import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

interface GenerateRequest {
  type: 'columns' | 'tasks' | 'columns_with_tasks';
  prompt?: string;  // Para compatibilidade com chamadas antigas
  context?: string; // Para compatibilidade com chamadas novas
  columnTitle?: string;
}

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

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use POST.' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  try {
    // Check API key
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse request body
    let requestData: GenerateRequest;
    try {
      requestData = await req.json();
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'JSON inválido no corpo da requisição' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { type, prompt, context, columnTitle } = requestData;

    // Validate required fields
    if (!type) {
      return new Response(
        JSON.stringify({ error: 'Campo "type" é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Use prompt or context (for backward compatibility)
    const userContext = context || prompt;
    if (!userContext) {
      return new Response(
        JSON.stringify({ error: 'Campo "context" ou "prompt" é obrigatório' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Validate type for tasks
    if (type === 'tasks' && !columnTitle) {
      return new Response(
        JSON.stringify({ error: 'Campo "columnTitle" é obrigatório para type="tasks"' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Build prompts based on type
    let systemPrompt = '';
    let userPrompt = '';

    switch (type) {
      case 'columns':
        systemPrompt = 'Você é um especialista em gestão de projetos. Crie colunas para quadro kanban baseadas nas ÁREAS FUNCIONAIS específicas do projeto. NUNCA use nomes genéricos como "A Fazer", "Em Progresso", "Concluído". Identifique as principais competências, departamentos ou especialidades técnicas. Retorne APENAS um array JSON com 3-5 objetos contendo "titulo" (string). Exemplo: [{"titulo":"Arquitetura e Backend"},{"titulo":"Interface e Experiência"},{"titulo":"Integração e APIs"}]';
        userPrompt = `Contexto do projeto: ${userContext}`;
        break;

      case 'columns_with_tasks':
        systemPrompt = 'Você é um especialista em gestão de projetos. Crie colunas baseadas nas ÁREAS FUNCIONAIS específicas do projeto (NUNCA use "A Fazer", "Em Progresso", "Concluído") e distribua tarefas nessas áreas. Retorne APENAS um array JSON com 3-5 objetos, cada um com "titulo" (string da área funcional) e "tasks" (array com 2-4 tarefas). Cada tarefa: "titulo" (string), "descricao" (string detalhada), "prioridade" ("baixa"|"media"|"alta"). Exemplo: [{"titulo":"Arquitetura e Backend","tasks":[{"titulo":"Definir arquitetura","descricao":"Elaborar arquitetura técnica...","prioridade":"alta"}]}]';
        userPrompt = `Contexto do projeto: ${userContext}`;
        break;

      case 'tasks':
        systemPrompt = 'Você é um especialista em gestão de projetos. Crie tarefas específicas para uma área do projeto. Retorne APENAS um array JSON com 3-7 objetos contendo "titulo" (string), "descricao" (string detalhada), "prioridade" ("baixa"|"media"|"alta"). Exemplo: [{"titulo":"Implementar autenticação","descricao":"Desenvolver sistema completo...","prioridade":"alta"}]';
        userPrompt = `Contexto do projeto: ${userContext}. Gere tarefas para a área: ${columnTitle}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Tipo inválido. Use: columns, tasks, ou columns_with_tasks' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
    }

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          }
        }),
      }
    );

    // Handle Gemini API errors
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ 
          error: 'Erro na API do Gemini', 
          details: errorText,
          status: geminiResponse.status 
        }),
        { 
          status: geminiResponse.status, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    // Parse Gemini response
    const geminiData = await geminiResponse.json();
    const contentText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!contentText) {
      return new Response(
        JSON.stringify({ error: 'Resposta vazia da API do Gemini' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse JSON response with fallback
    let result;
    try {
      // Try direct JSON parse first
      result = JSON.parse(contentText);
    } catch (parseError) {
      // Try to extract JSON from code fences
      const jsonMatch = contentText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          result = JSON.parse(jsonMatch[1]);
        } catch (innerError) {
          return new Response(
            JSON.stringify({ 
              error: 'Não foi possível extrair JSON válido da resposta',
              raw_response: contentText 
            }),
            { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'Resposta não contém JSON válido',
            raw_response: contentText 
          }),
          { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Validate result structure
    if (!Array.isArray(result)) {
      return new Response(
        JSON.stringify({ 
          error: 'Resposta deve ser um array',
          received: typeof result 
        }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({ data: result }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error) {
    console.error('Erro interno:', error);
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

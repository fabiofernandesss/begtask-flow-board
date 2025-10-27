import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface GenerateRequest {
  prompt: string;
  type: 'columns' | 'tasks' | 'columns_with_tasks';
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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const requestData: GenerateRequest = await req.json();
    
    if (!requestData.prompt || !requestData.type) {
      return new Response(
        JSON.stringify({ error: 'Prompt e type são obrigatórios' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let prompt = '';
    
    if (requestData.type === 'columns') {
      prompt = `Gere uma lista de colunas para um quadro Kanban baseado no contexto: "${requestData.prompt}".
      
Retorne APENAS um JSON válido no formato:
{
  "data": [
    {"titulo": "Nome da Coluna 1"},
    {"titulo": "Nome da Coluna 2"},
    {"titulo": "Nome da Coluna 3"}
  ]
}

Gere entre 3-5 colunas apropriadas para o contexto fornecido.`;
    } else if (requestData.type === 'tasks') {
      prompt = `Gere uma lista de tarefas baseadas no contexto: "${requestData.prompt}".
      
Retorne APENAS um JSON válido no formato:
{
  "data": [
    {
      "titulo": "Título da Tarefa 1",
      "descricao": "Descrição detalhada da tarefa",
      "prioridade": "alta"
    },
    {
      "titulo": "Título da Tarefa 2", 
      "descricao": "Descrição detalhada da tarefa",
      "prioridade": "media"
    }
  ]
}

Gere entre 3-6 tarefas. Use prioridades: "baixa", "media", "alta".`;
    } else if (requestData.type === 'columns_with_tasks') {
      prompt = `Gere colunas com tarefas para um quadro Kanban baseado no contexto: "${requestData.prompt}".
      
Retorne APENAS um JSON válido no formato:
{
  "data": [
    {
      "titulo": "Nome da Coluna 1",
      "tarefas": [
        {
          "titulo": "Tarefa 1",
          "descricao": "Descrição da tarefa",
          "prioridade": "alta"
        }
      ]
    }
  ]
}

Gere 3-4 colunas, cada uma com 2-4 tarefas. Use prioridades: "baixa", "media", "alta".`;
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 1,
          topP: 1,
          maxOutputTokens: 2000,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na API do Gemini: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      throw new Error('Resposta vazia da API do Gemini');
    }

    // Parse the JSON response from Gemini
    let parsedResponse;
    try {
      // Remove markdown code blocks if present
      const cleanText = generatedText.replace(/```json\n?|\n?```/g, '').trim();
      parsedResponse = JSON.parse(cleanText);
    } catch (parseError) {
      throw new Error(`Erro ao fazer parse da resposta: ${parseError.message}`);
    }

    return new Response(
      JSON.stringify(parsedResponse),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error) {
    console.error('Erro na função generate-board-content:', error);
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

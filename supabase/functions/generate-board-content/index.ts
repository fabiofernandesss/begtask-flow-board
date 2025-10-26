import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, type } = await req.json();
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    let systemPrompt = '';
    if (type === 'columns') {
      systemPrompt = 'Você é um assistente que gera colunas para quadros kanban. Retorne APENAS um array JSON com 3-5 objetos contendo "titulo" (string). Exemplo: [{"titulo":"A Fazer"},{"titulo":"Em Progresso"}]';
    } else if (type === 'columns_with_tasks') {
      systemPrompt = 'Você é um assistente que gera colunas e tarefas para quadros kanban. Retorne APENAS um array JSON com 3-5 objetos, cada um contendo "titulo" (string da coluna) e "tasks" (array com 3-5 tarefas). Cada tarefa deve ter "titulo" (string), "descricao" (string), "prioridade" ("baixa"|"media"|"alta"). Exemplo: [{"titulo":"A Fazer","tasks":[{"titulo":"Tarefa 1","descricao":"Descrição da tarefa","prioridade":"media"}]}]';
    } else if (type === 'tasks') {
      systemPrompt = 'Você é um assistente que gera tarefas. Retorne APENAS um array JSON com 3-7 objetos contendo "titulo" (string), "descricao" (string), "prioridade" ("baixa"|"media"|"alta"). Exemplo: [{"titulo":"Tarefa 1","descricao":"Descrição","prioridade":"media"}]';
    }

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nContexto do usuário: ${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      throw new Error(`Erro na API do Gemini: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Extract JSON from markdown code blocks if present
    let jsonText = generatedText.trim();
    if (jsonText.includes('```json')) {
      jsonText = jsonText.split('```json')[1].split('```')[0].trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.split('```')[1].split('```')[0].trim();
    }
    
    const parsedData = JSON.parse(jsonText);

    return new Response(JSON.stringify({ data: parsedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-board-content:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

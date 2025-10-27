const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-goog-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function cleanJsonFromText(text: string): string {
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const jsonStart = cleaned.indexOf('[');
  const jsonEnd = cleaned.lastIndexOf(']');
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }
  return cleaned.trim();
}

function coerceToExpectedFormat(data: any, type: string): any[] {
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) {
      const values = Object.values(data);
      if (values.length > 0 && Array.isArray(values[0])) {
        data = values[0];
      } else {
        data = [data];
      }
    } else {
      return [];
    }
  }
  
  return data.map((item: any) => {
    if (typeof item !== 'object' || item === null) {
      return type === 'columns' ? { titulo: String(item) } : 
             type === 'tasks' ? { titulo: String(item), descricao: '', prioridade: 'media', estimativa_horas: 1 } :
             { titulo: String(item), tasks: [] };
    }
    
    if (type === 'columns') {
      return { titulo: item.titulo || item.title || item.name || 'Coluna', ...item };
    } else if (type === 'tasks') {
      return {
        titulo: item.titulo || item.title || item.name || 'Tarefa',
        descricao: item.descricao || item.description || item.desc || '',
        prioridade: item.prioridade || item.priority || 'media',
        estimativa_horas: item.estimativa_horas || item.estimated_hours || item.hours || 1,
        ...item
      };
    } else {
      // Para columns_with_tasks, garantir que tasks seja um array válido
      let tasks = [];
      if (Array.isArray(item.tasks)) {
        tasks = item.tasks;
      } else if (Array.isArray(item.tarefas)) {
        tasks = item.tarefas;
      } else if (typeof item.tasks === 'string') {
        tasks = [{ titulo: item.tasks, descricao: '', prioridade: 'media', estimativa_horas: 1 }];
      }
      
      return {
        titulo: item.titulo || item.title || item.name || 'Coluna',
        tasks: tasks.map((task: any) => {
          if (typeof task === 'string') {
            return { titulo: task, descricao: '', prioridade: 'media', estimativa_horas: 1 };
          }
          return {
            titulo: task.titulo || task.title || task.name || task || 'Tarefa',
            descricao: task.descricao || task.description || task.desc || '',
            prioridade: task.prioridade || task.priority || 'media',
            estimativa_horas: task.estimativa_horas || task.estimated_hours || task.hours || 1
          };
        })
      };
    }
  });
}

function buildPrompt(prompt: string, type: string): string {
  if (type === 'columns') {
    return `Contexto: "${prompt}". Gere EXATAMENTE 3 colunas específicas do domínio em pt-BR. REGRAS: - NÃO inclua colunas padrão ("Em andamento", "Concluídas", etc.) - Títulos: máximo 30 caracteres cada - Formato: [{"titulo": "string"}] - LIMITE: máximo 300 caracteres total. Retorne APENAS o JSON compacto.`;
  }
  if (type === 'tasks') {
    return `Contexto: "${prompt}". Gere EXATAMENTE 8 tarefas específicas e práticas. REGRAS: - Título: máximo 40 caracteres - Descrição: máximo 100 caracteres - Formato: [{"titulo": "string", "descricao": "string", "prioridade": "baixa"|"media"|"alta", "estimativa_horas": number}] - LIMITE: máximo 1500 caracteres total. Retorne APENAS o JSON compacto.`;
  }
  return `Contexto: "${prompt}". Gere EXATAMENTE 3 colunas específicas do domínio em pt-BR. REGRAS: - NÃO inclua colunas padrão - Títulos das colunas: máximo 30 caracteres cada - Cada coluna: EXATAMENTE 4 tarefas práticas e específicas - LIMITE TOTAL: máximo 2000 caracteres na resposta. Retorne APENAS o JSON das colunas com tarefas, SEM explicações.`;
}

async function generateWithGemini(prompt: string, type: string, apiKeyOverride?: string): Promise<any[]> {
  const apiKey = apiKeyOverride || Deno.env.get('GEMINI_API_KEY') || 'AIzaSyDH3jq7MVIsdU0jm5QTtWPKRvxvlChuEM8';
  console.log('API Key configurada:', apiKey ? `Sim (${apiKey.substring(0, 10)}...)` : 'Não');
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const promptText = buildPrompt(prompt, type);
  console.log('Prompt:', promptText.substring(0, 200) + '...');
  
  const body = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: { 
      response_mime_type: 'application/json', 
      temperature: 0.2,
      maxOutputTokens: 1000
    }
  };

  console.log('Fazendo requisição para Gemini...');
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  console.log('Status:', res.status);
  if (!res.ok) {
    const errText = await res.text();
    console.error('Erro HTTP:', errText);
    throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
  }
  
  const out = await res.json();
  console.log('Resposta recebida');
  
  const text = out?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('Texto extraído:', text.substring(0, 300) + '...');
  
  const cleaned = cleanJsonFromText(text);
  console.log('JSON limpo:', cleaned.substring(0, 300) + '...');
  
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
    console.log('JSON parseado com sucesso');
  } catch (parseErr) {
    console.error('Erro no parse:', parseErr);
    throw new Error(`Falha no parse: ${parseErr}`);
  }
  
  const coerced = coerceToExpectedFormat(parsed, type);
  console.log('Dados processados:', coerced.length, 'itens');
  
  if (!Array.isArray(coerced) || coerced.length === 0) {
    throw new Error('Gemini retornou dados inválidos');
  }
  
  return coerced;
}

function postProcessColumns(data: any[], type: string): any[] {
  if (!Array.isArray(data)) return [];
  
  // Lista mais restrita de títulos realmente genéricos
  const genericTitles = [
    'todo', 'doing', 'done', 'backlog', 'pending', 'waiting', 'review', 'testing'
  ];
  
  return data.filter(item => {
    if (!item || typeof item !== 'object') return false;
    const titulo = (item.titulo || item.title || '').toLowerCase().trim();
    if (!titulo) return false;
    
    // Só remove se for exatamente um título genérico
    if (genericTitles.includes(titulo)) return false;
    
    // Para columns_with_tasks, aceita mesmo se não tiver tasks (o Gemini pode ter gerado sem)
    return true;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData = await req.json();
    
    if (!requestData.prompt || !requestData.type) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: prompt, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Gerando dados para tipo: ${requestData.type}, prompt: ${requestData.prompt}`);

    const headerApiKey = req.headers.get('x-goog-api-key') || undefined;
    const generatedData = await generateWithGemini(requestData.prompt, requestData.type, headerApiKey);
    console.log('Gemini executou com sucesso!');

    const processedData = postProcessColumns(generatedData, requestData.type);
    console.log('Dados finais:', JSON.stringify(processedData));

    return new Response(
      JSON.stringify(processedData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

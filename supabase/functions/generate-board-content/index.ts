import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface GenerateRequest {
  prompt: string;
  type: 'tasks' | 'columns' | 'columns_with_tasks';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function cleanJsonFromText(text: string): string {
  if (!text) return "[]";
  // Remove code fences if present
  const fenced = text.match(/```json[\s\S]*?```/i) || text.match(/```[\s\S]*?```/);
  const raw = fenced ? fenced[0].replace(/```json|```/gi, "").trim() : text.trim();
  // Try to extract the first JSON object/array
  const startIdx = Math.min(...[raw.indexOf("{"), raw.indexOf("[")].filter(i => i >= 0));
  if (startIdx >= 0) {
    const candidate = raw.slice(startIdx);
    return candidate;
  }
  return raw;
}

function coerceToSchema(data: any, type: string): any[] {
  if (!data) return [];
  // Allow both { columns: [...] } or direct arrays
  if (type === 'columns') {
    const cols = Array.isArray(data) ? data : (data.columns || []);
    return cols.map((c: any) => ({ titulo: c.titulo ?? c.nome ?? String(c.title || c.name || 'Sem título') }));
  }
  if (type === 'tasks') {
    const tasks = Array.isArray(data) ? data : (data.tasks || []);
    return tasks.map((t: any) => ({
      titulo: t.titulo ?? t.title ?? 'Tarefa',
      descricao: t.descricao ?? t.description ?? null,
      prioridade: ['baixa','media','alta'].includes((t.prioridade || '').toLowerCase()) ? (t.prioridade as string).toLowerCase() : 'media',
      data_entrega: t.data_entrega ?? t.deadline ?? null,
    }));
  }
  if (type === 'columns_with_tasks') {
    const cols = Array.isArray(data) ? data : (data.columns || []);
    return cols.map((c: any) => ({
      titulo: c.titulo ?? c.nome ?? String(c.title || c.name || 'Sem título'),
      tasks: (c.tasks || []).map((t: any) => ({
        titulo: t.titulo ?? t.title ?? 'Tarefa',
        descricao: t.descricao ?? t.description ?? null,
        prioridade: ['baixa','media','alta'].includes((t.prioridade || '').toLowerCase()) ? (t.prioridade as string).toLowerCase() : 'media',
        data_entrega: t.data_entrega ?? t.deadline ?? null,
      }))
    }));
  }
  return [];
}

function buildPrompt(prompt: string, type: string): string {
  if (type === 'columns') {
    return `Você é um gerador de estrutura de quadro Kanban em pt-BR. Dado: "${prompt}".
Retorne APENAS um array JSON de objetos { "titulo": string }.
NÃO inclua colunas padrão como "Em andamento" ou "Concluídas" (nem variações: "Concluído", "Done", "Em Progresso", "A Fazer", "Backlog").
Gere 2–4 colunas estritamente pertinentes ao domínio descrito, evitando nomes genéricos.
Não invente funcionalidades fora do domínio. Não inclua texto fora do JSON.`;
  }
  if (type === 'tasks') {
    return `Retorne APENAS um array JSON de tarefas pertinentes a: "${prompt}".
Cada tarefa: { "titulo": string não genérico, "descricao": string com 3–5 linhas curtas separadas por "\\n", "prioridade": "baixa"|"media"|"alta", "data_entrega": YYYY-MM-DD|null }.
Gere entre 6 e 10 tarefas.
Não inclua texto fora do JSON.`;
  }
  // columns_with_tasks
  return `Retorne APENAS um array JSON de colunas com tarefas para: "${prompt}" (pt-BR).
NÃO inclua colunas padrão como "Em andamento" ou "Concluídas" (nem variações: "Concluído", "Done", "Em Progresso", "A Fazer", "Backlog").
Gere 2–4 colunas estritamente pertinentes ao domínio, evitando nomes genéricos.
Cada coluna deve conter de 3 a 6 tarefas.
Cada tarefa: { "titulo": string não genérico, "descricao": string com 3–5 linhas curtas separadas por "\\n", "prioridade": "baixa"|"media"|"alta", "data_entrega": YYYY-MM-DD|null }.
Não inclua nada além do JSON.`;
}

async function generateWithGemini(prompt: string, type: string, apiKeyOverride?: string): Promise<any[]> {
  const apiKey = apiKeyOverride || Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const url = `${GEMINI_URL}?key=${apiKey}`;
  const body = {
    contents: [
      { role: 'user', parts: [ { text: buildPrompt(prompt, type) } ] }
    ],
    generationConfig: { response_mime_type: 'application/json', temperature: 0.2 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
  }
  const out = await res.json();
  const text = out?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const cleaned = cleanJsonFromText(text);
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Falha ao parsear JSON do Gemini: ${(e as Error).message}`);
  }
  const coerced = coerceToSchema(parsed, type);
  if (!Array.isArray(coerced) || coerced.length === 0) {
    throw new Error('Resposta do Gemini não contém dados válidos');
  }
  return coerced;
}

function postProcessColumns(items: any[], type: string): any[] {
  if (!Array.isArray(items)) return items;

  const dedupByTitle = (arr: any[]) => {
    const seen = new Set<string>();
    const result: any[] = [];
    for (const i of arr) {
      const t = String(i?.titulo || '').trim().toLowerCase();
      if (!t) continue;
      if (!seen.has(t)) { seen.add(t); result.push(i); }
    }
    return result;
  };

  if (type === 'columns') {
    let result = ensureBaselineColumns(items, 'columns');
    result = dedupByTitle(result);
    // Manter sempre as duas colunas padrão e limitar o restante a no máximo 4
    const base = [] as any[];
    const others = [] as any[];
    for (const c of result) {
      const t = String(c.titulo).toLowerCase();
      if (t === 'em andamento' || t === 'concluídas' || t === 'concluidas') base.push(c);
      else others.push(c);
    }
    return [...base, ...others.slice(0, 4)];
  }

  if (type === 'columns_with_tasks') {
    let result = ensureBaselineColumns(items, 'columns_with_tasks');
    result = dedupByTitle(result).map((c) => ({
      titulo: c.titulo,
      tasks: Array.isArray(c.tasks) ? c.tasks.filter((t: any) => String(t?.titulo || '').trim()) : []
    }));
    // Manter apenas colunas com tarefas (além das padrão)
    const base = [] as any[];
    const withTasks = [] as any[];
    for (const c of result) {
      const t = String(c.titulo).toLowerCase();
      const isBase = t === 'em andamento' || t === 'concluídas' || t === 'concluidas';
      if (isBase) base.push(c);
      else if ((c.tasks || []).length > 0) withTasks.push(c);
    }
    return [...base, ...withTasks.slice(0, 4)];
  }

  return items;
}

function ensureBaselineColumns(items: any[], type: string): any[] {
  if (!Array.isArray(items)) return items;
  if (type === 'columns') {
    const titles = items.map((i) => String(i?.titulo || '').toLowerCase());
    const hasEmAndamento = titles.includes('em andamento');
    const hasConcluidas = titles.includes('concluídas') || titles.includes('concluidas');
    const result = [...items];
    if (!hasEmAndamento) result.unshift({ titulo: 'Em andamento' });
    if (!hasConcluidas) result.push({ titulo: 'Concluídas' });
    return result;
  }
  if (type === 'columns_with_tasks') {
    const titles = items.map((i) => String(i?.titulo || '').toLowerCase());
    const result = [...items];
    if (!titles.includes('em andamento')) result.unshift({ titulo: 'Em andamento', tasks: [] });
    if (!titles.includes('concluídas') && !titles.includes('concluidas')) result.push({ titulo: 'Concluídas', tasks: [] });
    return result.map((c) => ({ titulo: c.titulo, tasks: Array.isArray(c.tasks) ? c.tasks : [] }));
  }
  return items;
}

// Função para gerar dados inteligentes baseados no prompt
function generateSmartData(prompt: string, type: string) {
  const lowerPrompt = prompt.toLowerCase();
  
  // Detectar tipo de projeto baseado em palavras-chave
  const isWebApp = lowerPrompt.includes('web') || lowerPrompt.includes('site') || lowerPrompt.includes('aplicativo') || lowerPrompt.includes('app');
  const isEcommerce = lowerPrompt.includes('loja') || lowerPrompt.includes('ecommerce') || lowerPrompt.includes('venda') || lowerPrompt.includes('produto');
  const isDelivery = lowerPrompt.includes('delivery') || lowerPrompt.includes('entrega') || lowerPrompt.includes('comida');
  const isMobile = lowerPrompt.includes('mobile') || lowerPrompt.includes('android') || lowerPrompt.includes('ios');
  const isAPI = lowerPrompt.includes('api') || lowerPrompt.includes('backend') || lowerPrompt.includes('servidor');

  if (type === 'tasks') {
    if (isDelivery) {
      return [
        {
          titulo: "Definir arquitetura do sistema",
          descricao: "Planejar a estrutura do aplicativo de delivery incluindo frontend, backend e banco de dados",
          prioridade: "alta",
          estimativa_horas: 8
        },
        {
          titulo: "Implementar sistema de autenticação",
          descricao: "Criar login/registro para clientes, entregadores e restaurantes",
          prioridade: "alta",
          estimativa_horas: 12
        },
        {
          titulo: "Desenvolver catálogo de produtos",
          descricao: "Interface para exibir cardápios e produtos dos restaurantes",
          prioridade: "alta",
          estimativa_horas: 16
        },
        {
          titulo: "Criar sistema de pedidos",
          descricao: "Fluxo completo de criação, pagamento e acompanhamento de pedidos",
          prioridade: "alta",
          estimativa_horas: 20
        },
        {
          titulo: "Implementar rastreamento em tempo real",
          descricao: "Sistema de GPS para acompanhar entregadores e pedidos",
          prioridade: "media",
          estimativa_horas: 15
        },
        {
          titulo: "Integrar gateway de pagamento",
          descricao: "Conectar com serviços de pagamento online",
          prioridade: "alta",
          estimativa_horas: 10
        }
      ];
    } else if (isEcommerce) {
      return [
        {
          titulo: "Configurar estrutura do projeto",
          descricao: "Definir tecnologias e arquitetura da loja virtual",
          prioridade: "alta",
          estimativa_horas: 6
        },
        {
          titulo: "Criar catálogo de produtos",
          descricao: "Sistema para gerenciar produtos, categorias e estoque",
          prioridade: "alta",
          estimativa_horas: 18
        },
        {
          titulo: "Implementar carrinho de compras",
          descricao: "Funcionalidade para adicionar/remover produtos e calcular totais",
          prioridade: "alta",
          estimativa_horas: 12
        },
        {
          titulo: "Desenvolver checkout",
          descricao: "Processo de finalização de compra com dados do cliente",
          prioridade: "alta",
          estimativa_horas: 14
        },
        {
          titulo: "Integrar pagamentos",
          descricao: "Conectar com gateways de pagamento",
          prioridade: "alta",
          estimativa_horas: 8
        }
      ];
    } else if (isWebApp || isMobile) {
      return [
        {
          titulo: "Planejar funcionalidades",
          descricao: "Definir escopo e requisitos do aplicativo",
          prioridade: "alta",
          estimativa_horas: 4
        },
        {
          titulo: "Criar protótipo",
          descricao: "Desenvolver wireframes e mockups das telas",
          prioridade: "alta",
          estimativa_horas: 8
        },
        {
          titulo: "Configurar ambiente de desenvolvimento",
          descricao: "Preparar ferramentas e dependências necessárias",
          prioridade: "alta",
          estimativa_horas: 3
        },
        {
          titulo: "Implementar interface principal",
          descricao: "Desenvolver as telas e componentes principais",
          prioridade: "alta",
          estimativa_horas: 20
        },
        {
          titulo: "Adicionar funcionalidades core",
          descricao: "Implementar as principais funcionalidades do app",
          prioridade: "media",
          estimativa_horas: 25
        },
        {
          titulo: "Realizar testes",
          descricao: "Testar funcionalidades e corrigir bugs",
          prioridade: "media",
          estimativa_horas: 10
        }
      ];
    } else {
      return [
        {
          titulo: "Análise de requisitos",
          descricao: "Levantar e documentar todos os requisitos do projeto",
          prioridade: "alta",
          estimativa_horas: 6
        },
        {
          titulo: "Planejamento técnico",
          descricao: "Definir arquitetura e tecnologias a serem utilizadas",
          prioridade: "alta",
          estimativa_horas: 4
        },
        {
          titulo: "Configuração inicial",
          descricao: "Preparar ambiente e estrutura base do projeto",
          prioridade: "alta",
          estimativa_horas: 3
        },
        {
          titulo: "Desenvolvimento core",
          descricao: "Implementar funcionalidades principais",
          prioridade: "alta",
          estimativa_horas: 20
        },
        {
          titulo: "Testes e validação",
          descricao: "Realizar testes e validar funcionalidades",
          prioridade: "media",
          estimativa_horas: 8
        }
      ];
    }
  } else if (type === 'columns') {
    if (isDelivery) {
      return [
        { titulo: "Novos Pedidos" },
        { titulo: "Em Preparo" },
        { titulo: "Pronto para Entrega" },
        { titulo: "Saiu para Entrega" },
        { titulo: "Entregues" },
        { titulo: "Problemas/Recusa" }
      ];
    } else if (isEcommerce) {
      return [
        { titulo: "Descoberta" },
        { titulo: "Carrinho" },
        { titulo: "Pagamento" },
        { titulo: "Separação/Envio" },
        { titulo: "Entregue" },
        { titulo: "Trocas/Devoluções" }
      ];
    } else if (isAPI) {
      return [
        { titulo: "Especificação" },
        { titulo: "Modelagem" },
        { titulo: "Endpoints" },
        { titulo: "Integração/QA" },
        { titulo: "Observabilidade" },
        { titulo: "Produção" }
      ];
    } else if (isWebApp || isMobile) {
      return [
        { titulo: "Design" },
        { titulo: "Desenvolvimento" },
        { titulo: "Testes" },
        { titulo: "Homologação" },
        { titulo: "Publicação" },
        { titulo: "Suporte" }
      ];
    } else {
      return [
        { titulo: "Planejamento" },
        { titulo: "Execução" },
        { titulo: "Revisão" },
        { titulo: "Concluído" }
      ];
    }
  } else if (type === 'columns_with_tasks') {
    const tasks = generateSmartData(prompt, 'tasks') as any[];
    const columns = generateSmartData(prompt, 'columns') as any[];
    
    // Distribuir tarefas pelas colunas
    const tasksPerColumn = Math.ceil(tasks.length / columns.length);
    
    return columns.map((col, index) => ({
      ...col,
      tasks: tasks.slice(index * tasksPerColumn, (index + 1) * tasksPerColumn)
    }));
  }

  return [];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const requestData: GenerateRequest = await req.json()
    console.log('Dados da requisição:', JSON.stringify(requestData))

    if (!requestData.prompt || !requestData.type) {
      return new Response(
        JSON.stringify({ error: 'Prompt e type são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Gerando dados para tipo: ${requestData.type}, prompt: ${requestData.prompt}`)

    // Tentar via Gemini primeiro; em caso de erro, gerar conteúdo inteligente localmente
    let generatedData: any[];
    try {
      const headerApiKey = req.headers.get('x-goog-api-key') || undefined;
      generatedData = await generateWithGemini(requestData.prompt, requestData.type, headerApiKey);
      console.log('Dados gerados pela IA (Gemini)');
    } catch (aiErr) {
      console.warn('Gemini falhou, gerando conteúdo localmente:', (aiErr as Error).message);
      generatedData = generateSmartData(requestData.prompt, requestData.type);
    }

    // Pós-processar: garantir padrão e filtrar colunas vazias/genéricas
    generatedData = postProcessColumns(generatedData, requestData.type);

    // Garantia extra: para columns_with_tasks, se vier apenas colunas vazias,
    // reconstituímos dados locais com tarefas para evitar resposta inútil.
    if (
      requestData.type === 'columns_with_tasks' &&
      (
        !Array.isArray(generatedData) ||
        generatedData.length === 0 ||
        generatedData.every((c: any) => !Array.isArray(c?.tasks) || c.tasks.length === 0)
      )
    ) {
      generatedData = generateSmartData(requestData.prompt, requestData.type);
      generatedData = postProcessColumns(generatedData, requestData.type);
    }

    console.log('Dados gerados:', JSON.stringify(generatedData))

    return new Response(
      JSON.stringify({ data: generatedData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro geral:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno do servidor',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

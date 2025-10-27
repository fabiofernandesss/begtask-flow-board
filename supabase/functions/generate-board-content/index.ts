import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface GenerateRequest {
  prompt: string;
  type: 'tasks' | 'columns' | 'columns_with_tasks';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

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
    return `Você é um gerador de estrutura de quadro Kanban em pt-BR. Dado o contexto: "${prompt}", gere um array JSON puro com 4 a 6 colunas. Cada item deve ser um objeto com a chave "titulo" (string). Evite nomes genéricos como "Backlog", "A Fazer", "Em Progresso" e "Em Revisão" — personalize os nomes de acordo com o domínio solicitado. Não inclua explicações, apenas o JSON.`;
  }
  if (type === 'tasks') {
    return `Gere um array JSON puro de tarefas relevantes para: "${prompt}". Cada tarefa é um objeto com as chaves: "titulo" (string), "descricao" (string), "prioridade" ("baixa"|"media"|"alta"), "data_entrega" (YYYY-MM-DD ou null). Não inclua texto fora do JSON.`;
  }
  // columns_with_tasks
  return `Gere um array JSON puro de colunas com tarefas para: "${prompt}" em pt-BR. Evite nomes genéricos de coluna (ex.: "Backlog", "A Fazer", "Em Progresso"). O formato é: [ { "titulo": string, "tasks": [ { "titulo": string, "descricao": string|null, "prioridade": "baixa"|"media"|"alta", "data_entrega": YYYY-MM-DD|null } ] } ]. Não inclua nada além do JSON.`;
}

async function generateWithGemini(prompt: string, type: string): Promise<any[]> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const url = `${GEMINI_URL}?key=${apiKey}`;
  const body = {
    contents: [
      { role: 'user', parts: [ { text: buildPrompt(prompt, type) } ] }
    ],
    generationConfig: { responseMimeType: 'application/json' }
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

    // Tentar via Gemini primeiro; em caso de erro, usar fallback estático
    let generatedData: any[];
    try {
      generatedData = await generateWithGemini(requestData.prompt, requestData.type);
      console.log('Dados gerados pela IA (Gemini)');
    } catch (aiErr) {
      console.warn('Gemini falhou, usando fallback estático:', (aiErr as Error).message);
      generatedData = generateSmartData(requestData.prompt, requestData.type);
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

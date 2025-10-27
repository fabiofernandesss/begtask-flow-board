import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

interface GenerateRequest {
  prompt: string;
  type: 'tasks' | 'columns' | 'columns_with_tasks';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (isDelivery || isEcommerce) {
      return [
        { titulo: "Backlog" },
        { titulo: "Em Desenvolvimento" },
        { titulo: "Em Teste" },
        { titulo: "Em Homologação" },
        { titulo: "Concluído" }
      ];
    } else {
      return [
        { titulo: "A Fazer" },
        { titulo: "Em Progresso" },
        { titulo: "Em Revisão" },
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

    // Gerar dados inteligentes baseados no prompt
    const generatedData = generateSmartData(requestData.prompt, requestData.type);

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

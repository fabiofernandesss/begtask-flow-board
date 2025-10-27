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
    return `Você é um especialista em organização de projetos e quadros Kanban em pt-BR. 
Contexto: "${prompt}".
Analise o domínio específico e retorne APENAS um array JSON de objetos { "titulo": string }.

IMPORTANTE:
- NÃO inclua colunas padrão como "Em andamento", "Concluídas", "Done", "Em Progresso", "A Fazer", "Backlog"
- Gere 2-4 colunas ESPECÍFICAS do domínio mencionado
- Para emagrecimento: use colunas como "Planejamento Nutricional", "Exercícios", "Acompanhamento", "Metas Atingidas"
- Para estudos: use "Material", "Estudando", "Revisão", "Dominado"
- Para projetos pessoais: adapte ao contexto específico
- Evite nomes genéricos como "Planejamento", "Execução", "Revisão"

Retorne apenas o JSON, sem explicações.`;
  }
  if (type === 'tasks') {
    return `Contexto específico: "${prompt}".
Gere tarefas ESPECÍFICAS e PRÁTICAS para este domínio.
Retorne APENAS um array JSON de tarefas.

Cada tarefa: { "titulo": string específico e prático, "descricao": string com ações concretas (3-5 linhas separadas por "\\n"), "prioridade": "baixa"|"media"|"alta", "data_entrega": YYYY-MM-DD|null }.

Exemplos de especificidade:
- Emagrecimento: "Calcular TMB e macros", "Treino HIIT 20min", "Preparar refeições da semana"
- Estudos: "Ler capítulo 3 do livro X", "Fazer exercícios de álgebra", "Revisar anotações de história"

Gere 6-10 tarefas específicas. Apenas JSON.`;
  }
  // columns_with_tasks
  return `Contexto: "${prompt}".
Crie um quadro Kanban ESPECÍFICO para este domínio em pt-BR.

REGRAS:
- NÃO inclua colunas padrão ("Em andamento", "Concluídas", etc.)
- Gere 2-4 colunas ESPECÍFICAS do domínio
- Cada coluna: 3-6 tarefas práticas e específicas
- Tarefas: { "titulo": ação específica, "descricao": passos concretos (3-5 linhas com "\\n"), "prioridade": "baixa"|"media"|"alta", "data_entrega": YYYY-MM-DD|null }

Exemplos por domínio:
- Emagrecimento: colunas como "Planejamento Nutricional", "Exercícios Ativos", "Acompanhamento Semanal"
- Estudos: "Material Novo", "Praticando", "Revisão", "Dominado"
- Projetos: adapte ao contexto específico

Retorne APENAS o JSON das colunas com tarefas.`;
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
    return [...others.slice(0, 4), ...base];
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
    return [...withTasks.slice(0, 4), ...base];
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
    if (!hasConcluidas) result.push({ titulo: 'Concluídas' });
    if (!hasEmAndamento) result.push({ titulo: 'Em andamento' });
    return result;
  }
  if (type === 'columns_with_tasks') {
    const titles = items.map((i) => String(i?.titulo || '').toLowerCase());
    const result = [...items];
    if (!titles.includes('concluídas') && !titles.includes('concluidas')) result.push({ titulo: 'Concluídas', tasks: [] });
    if (!titles.includes('em andamento')) result.push({ titulo: 'Em andamento', tasks: [] });
    return result.map((c) => ({ titulo: c.titulo, tasks: Array.isArray(c.tasks) ? c.tasks : [] }));
  }
  return items;
}

// Função para gerar dados inteligentes baseados no prompt
function generateSmartData(prompt: string, type: string) {
  const lowerPrompt = prompt.toLowerCase();
  
  // Detectar domínios específicos baseado em palavras-chave
  const isWeightLoss = lowerPrompt.includes('emagrecimento') || lowerPrompt.includes('emagrecer') || lowerPrompt.includes('perder peso') || lowerPrompt.includes('dieta') || lowerPrompt.includes('peso');
  const isFitness = lowerPrompt.includes('fitness') || lowerPrompt.includes('academia') || lowerPrompt.includes('treino') || lowerPrompt.includes('exercicio') || lowerPrompt.includes('musculação');
  const isStudy = lowerPrompt.includes('estudo') || lowerPrompt.includes('estudar') || lowerPrompt.includes('aprender') || lowerPrompt.includes('curso') || lowerPrompt.includes('faculdade') || lowerPrompt.includes('concurso');
  const isHealth = lowerPrompt.includes('saude') || lowerPrompt.includes('saúde') || lowerPrompt.includes('medico') || lowerPrompt.includes('tratamento') || lowerPrompt.includes('consulta');
  const isFinance = lowerPrompt.includes('financeiro') || lowerPrompt.includes('dinheiro') || lowerPrompt.includes('investimento') || lowerPrompt.includes('economia') || lowerPrompt.includes('orcamento');
  const isCareer = lowerPrompt.includes('carreira') || lowerPrompt.includes('trabalho') || lowerPrompt.includes('emprego') || lowerPrompt.includes('profissional') || lowerPrompt.includes('cv');
  const isHome = lowerPrompt.includes('casa') || lowerPrompt.includes('reforma') || lowerPrompt.includes('decoracao') || lowerPrompt.includes('organizacao') || lowerPrompt.includes('limpeza');
  const isTravel = lowerPrompt.includes('viagem') || lowerPrompt.includes('viajar') || lowerPrompt.includes('turismo') || lowerPrompt.includes('ferias');
  
  // Domínios de tecnologia (mantidos)
  const isWebApp = lowerPrompt.includes('web') || lowerPrompt.includes('site') || lowerPrompt.includes('aplicativo') || lowerPrompt.includes('app');
  const isEcommerce = lowerPrompt.includes('loja') || lowerPrompt.includes('ecommerce') || lowerPrompt.includes('venda') || lowerPrompt.includes('produto');
  const isDelivery = lowerPrompt.includes('delivery') || lowerPrompt.includes('entrega') || lowerPrompt.includes('comida');
  const isMobile = lowerPrompt.includes('mobile') || lowerPrompt.includes('android') || lowerPrompt.includes('ios');
  const isAPI = lowerPrompt.includes('api') || lowerPrompt.includes('backend') || lowerPrompt.includes('servidor');

  if (type === 'tasks') {
    if (isWeightLoss) {
      return [
        {
          titulo: "Calcular TMB e necessidades calóricas",
          descricao: "Usar calculadora online para determinar Taxa Metabólica Basal\nDefinir déficit calórico adequado\nEstabelecer meta de calorias diárias",
          prioridade: "alta",
          estimativa_horas: 2
        },
        {
          titulo: "Planejar cardápio semanal",
          descricao: "Criar menu balanceado para 7 dias\nCalcular macronutrientes de cada refeição\nFazer lista de compras",
          prioridade: "alta",
          estimativa_horas: 3
        },
        {
          titulo: "Preparar refeições da semana",
          descricao: "Cozinhar e porcionar proteínas\nPreparar vegetais e carboidratos\nArmazenar em recipientes adequados",
          prioridade: "media",
          estimativa_horas: 4
        },
        {
          titulo: "Registrar peso e medidas",
          descricao: "Pesar-se em jejum sempre no mesmo horário\nMedir cintura, quadril e braços\nFotos de progresso semanais",
          prioridade: "alta",
          estimativa_horas: 1
        },
        {
          titulo: "Beber 2-3L de água por dia",
          descricao: "Carregar garrafa de água sempre\nDefinir lembretes no celular\nMonitorar cor da urina",
          prioridade: "media",
          estimativa_horas: 1
        },
        {
          titulo: "Caminhar 30min diariamente",
          descricao: "Escolher rota segura e agradável\nUsar aplicativo para contar passos\nGradualmente aumentar intensidade",
          prioridade: "alta",
          estimativa_horas: 4
        }
      ];
    } else if (isFitness) {
      return [
        {
          titulo: "Definir objetivos de treino",
          descricao: "Estabelecer metas específicas (força, resistência, hipertrofia)\nDefinir frequência semanal de treinos\nEscolher modalidades preferidas",
          prioridade: "alta",
          estimativa_horas: 2
        },
        {
          titulo: "Criar ficha de treino",
          descricao: "Dividir grupos musculares por dia\nDefinir exercícios, séries e repetições\nPrograma de progressão de cargas",
          prioridade: "alta",
          estimativa_horas: 3
        },
        {
          titulo: "Treino de força - membros superiores",
          descricao: "Aquecimento 10min\nExercícios: supino, remada, desenvolvimento\nAlongamento final",
          prioridade: "alta",
          estimativa_horas: 2
        },
        {
          titulo: "Treino de força - membros inferiores",
          descricao: "Aquecimento articular\nAgachamento, leg press, stiff\nPanturrilha e glúteos",
          prioridade: "alta",
          estimativa_horas: 2
        },
        {
          titulo: "Cardio HIIT 20 minutos",
          descricao: "5min aquecimento moderado\n10min intervalos alta/baixa intensidade\n5min volta à calma",
          prioridade: "media",
          estimativa_horas: 1
        },
        {
          titulo: "Acompanhar evolução",
          descricao: "Registrar cargas utilizadas\nMedir circunferências mensalmente\nFotos de progresso",
          prioridade: "media",
          estimativa_horas: 1
        }
      ];
    } else if (isStudy) {
      return [
        {
          titulo: "Organizar cronograma de estudos",
          descricao: "Mapear todas as matérias/disciplinas\nDefinir tempo diário para cada assunto\nCriar calendário de revisões",
          prioridade: "alta",
          estimativa_horas: 3
        },
        {
          titulo: "Preparar ambiente de estudo",
          descricao: "Organizar mesa e materiais\nEliminar distrações (celular, redes sociais)\nTer água e lanche saudável",
          prioridade: "media",
          estimativa_horas: 1
        },
        {
          titulo: "Estudar Matemática - Álgebra",
          descricao: "Revisar teoria de equações\nResolver 20 exercícios práticos\nIdentificar dúvidas para tirar depois",
          prioridade: "alta",
          estimativa_horas: 3
        },
        {
          titulo: "Fazer resumos e mapas mentais",
          descricao: "Sintetizar conteúdo estudado\nCriar esquemas visuais\nUsar cores e símbolos para memorização",
          prioridade: "media",
          estimativa_horas: 2
        },
        {
          titulo: "Resolver simulados",
          descricao: "Fazer prova completa em tempo real\nCorrigir e analisar erros\nIdentificar pontos fracos",
          prioridade: "alta",
          estimativa_horas: 4
        },
        {
          titulo: "Revisar conteúdo da semana",
          descricao: "Reler anotações e resumos\nRefazer exercícios que errou\nTestar conhecimento sem consulta",
          prioridade: "media",
          estimativa_horas: 2
        }
      ];
    } else if (isHealth) {
      return [
        {
          titulo: "Agendar consulta médica",
          descricao: "Ligar para clínica/hospital\nVerificar disponibilidade de horários\nConfirmar plano de saúde",
          prioridade: "alta",
          estimativa_horas: 1
        },
        {
          titulo: "Organizar exames médicos",
          descricao: "Reunir resultados anteriores\nFazer lista de sintomas e dúvidas\nLevar documentos necessários",
          prioridade: "media",
          estimativa_horas: 2
        },
        {
          titulo: "Tomar medicamentos no horário",
          descricao: "Configurar alarmes no celular\nOrganizar medicamentos em porta-comprimidos\nAnotar reações ou efeitos",
          prioridade: "alta",
          estimativa_horas: 1
        },
        {
          titulo: "Fazer exercícios de fisioterapia",
          descricao: "Seguir orientações do fisioterapeuta\nRealizar alongamentos prescritos\nAplicar gelo/calor conforme indicado",
          prioridade: "alta",
          estimativa_horas: 1
        }
      ];
    } else if (isFinance) {
      return [
        {
          titulo: "Organizar planilha de gastos",
          descricao: "Listar todas as receitas mensais\nCategorizar despesas fixas e variáveis\nCalcular sobra ou déficit",
          prioridade: "alta",
          estimativa_horas: 3
        },
        {
          titulo: "Quitar dívidas em atraso",
          descricao: "Listar todos os débitos pendentes\nNegociar condições de pagamento\nPriorizar juros mais altos",
          prioridade: "alta",
          estimativa_horas: 4
        },
        {
          titulo: "Criar reserva de emergência",
          descricao: "Definir meta de 6 meses de gastos\nAbrir conta poupança específica\nAutomatizar transferência mensal",
          prioridade: "media",
          estimativa_horas: 2
        },
        {
          titulo: "Pesquisar investimentos",
          descricao: "Estudar opções de renda fixa\nComparar corretoras e taxas\nDefinir perfil de investidor",
          prioridade: "media",
          estimativa_horas: 5
        }
      ];
    } else if (isDelivery) {
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
    if (isWeightLoss) {
      return [
        { titulo: "Planejamento Nutricional" },
        { titulo: "Atividades Físicas" },
        { titulo: "Acompanhamento Semanal" },
        { titulo: "Metas Atingidas" }
      ];
    } else if (isFitness) {
      return [
        { titulo: "Planejamento de Treino" },
        { titulo: "Treinos Ativos" },
        { titulo: "Recuperação" },
        { titulo: "Objetivos Alcançados" }
      ];
    } else if (isStudy) {
      return [
        { titulo: "Material Novo" },
        { titulo: "Estudando" },
        { titulo: "Revisão" },
        { titulo: "Dominado" }
      ];
    } else if (isHealth) {
      return [
        { titulo: "Agendamentos" },
        { titulo: "Tratamento Ativo" },
        { titulo: "Acompanhamento" },
        { titulo: "Concluído" }
      ];
    } else if (isFinance) {
      return [
        { titulo: "Planejamento" },
        { titulo: "Executando" },
        { titulo: "Monitoramento" },
        { titulo: "Conquistado" }
      ];
    } else if (isCareer) {
      return [
        { titulo: "Preparação" },
        { titulo: "Candidaturas" },
        { titulo: "Processos Ativos" },
        { titulo: "Conquistas" }
      ];
    } else if (isHome) {
      return [
        { titulo: "Planejamento" },
        { titulo: "Em Execução" },
        { titulo: "Aguardando" },
        { titulo: "Finalizado" }
      ];
    } else if (isTravel) {
      return [
        { titulo: "Pesquisa e Planejamento" },
        { titulo: "Reservas e Compras" },
        { titulo: "Preparativos Finais" },
        { titulo: "Viagem Realizada" }
      ];
    } else if (isDelivery) {
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

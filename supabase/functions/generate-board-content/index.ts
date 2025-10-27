import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

interface GenerateRequest {
  type: 'columns' | 'tasks' | 'columns_with_tasks';
  context: string;
  columnTitle?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, x-supabase-auth, x-forwarded-for, user-agent',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    console.log('Iniciando processamento da requisição');
    
    // Verificar se a chave do Gemini está configurada
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY não está configurada');
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY não está configurada' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
    
    console.log('GEMINI_API_KEY está configurada');

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Método não permitido. Use POST.' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const { type, context, columnTitle }: GenerateRequest = await req.json();
    console.log('Dados recebidos:', { type, context: context?.substring(0, 100) + '...', columnTitle });

    let systemPrompt = '';
    if (type === 'columns') {
      systemPrompt = 'Você é um especialista em processos gerenciais e gestão de projetos que gera colunas para quadros kanban baseadas no CONTEÚDO ESPECÍFICO das tarefas do projeto. NUNCA use nomes de processos genéricos como "A Fazer", "Em Progresso", "Aguardando Revisão", "Concluído", "Em Andamento". Crie colunas que representem as ÁREAS FUNCIONAIS, DEPARTAMENTOS ou ESPECIALIDADES TÉCNICAS do trabalho. Analise o contexto do projeto e identifique as principais áreas de conhecimento, competências ou componentes funcionais envolvidos. Retorne APENAS um array JSON com 3-5 objetos contendo "titulo" (string). Exemplos: Para desenvolvimento de software: [{"titulo":"Arquitetura e Backend"},{"titulo":"Interface e Experiência"},{"titulo":"Integração e APIs"},{"titulo":"Segurança e Compliance"}]. Para projeto de marketing: [{"titulo":"Estratégia e Planejamento"},{"titulo":"Criação de Conteúdo"},{"titulo":"Canais Digitais"},{"titulo":"Análise e Métricas"}]';
    } else if (type === 'columns_with_tasks') {
      systemPrompt = 'Você é um especialista em processos gerenciais e gestão de projetos que gera colunas e tarefas para quadros kanban. Crie colunas baseadas nas ÁREAS FUNCIONAIS ESPECÍFICAS do projeto (NUNCA use nomes de processos como "A Fazer", "Em Progresso", "Concluído"). Identifique as principais competências, departamentos ou especialidades técnicas envolvidas. Distribua as tarefas APENAS nessas colunas de áreas funcionais específicas. Retorne APENAS um array JSON com 3-5 objetos, cada um contendo "titulo" (string da área funcional) e "tasks" (array com 2-4 tarefas). Cada tarefa deve ter "titulo" (string conciso), "descricao" (string detalhada com 2-5 linhas explicando objetivos, metodologia e entregáveis esperados), "prioridade" ("baixa"|"media"|"alta"). As descrições devem ser profissionais e contextualizadas. Exemplo: [{"titulo":"Arquitetura e Backend","tasks":[{"titulo":"Definir arquitetura do sistema","descricao":"Elaborar a arquitetura técnica do sistema definindo padrões de desenvolvimento, estrutura de dados, APIs e integrações. Documentar decisões arquiteturais e criar diagramas técnicos para orientar a equipe de desenvolvimento. Estabelecer guidelines de performance, segurança e escalabilidade.","prioridade":"alta"}]}]';
    } else if (type === 'tasks') {
      systemPrompt = 'Você é um especialista em processos gerenciais que gera tarefas específicas para uma área/categoria do projeto. Crie tarefas profissionais e bem estruturadas. Retorne APENAS um array JSON com 3-7 objetos contendo "titulo" (string concisa), "descricao" (string detalhada com 2-5 linhas explicando objetivos, metodologia e entregáveis esperados), "prioridade" ("baixa"|"media"|"alta"). As descrições devem ser profissionais, contextualizadas e orientadas a resultados. Exemplo: [{"titulo":"Implementar sistema de autenticação","descricao":"Desenvolver sistema completo de autenticação incluindo registro, login, recuperação de senha e gestão de sessões. Implementar medidas de segurança como criptografia de senhas, validação de tokens e proteção contra ataques. Criar documentação técnica e testes automatizados para garantir a qualidade e confiabilidade do sistema.","prioridade":"alta"}]';
    }

    let userPrompt = '';
    if (type === 'columns') {
      userPrompt = `Contexto do projeto: ${context}`;
    } else if (type === 'columns_with_tasks') {
      userPrompt = `Contexto do projeto: ${context}`;
    } else if (type === 'tasks') {
      userPrompt = `Contexto do projeto: ${context}. Gere tarefas para a área/categoria: ${columnTitle}`;
    }

    console.log('Fazendo chamada para a API do Gemini...');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{
            text: `${systemPrompt}\n\n${userPrompt}`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json',
        }
      }),
    });

    console.log('Resposta da API recebida, status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API do Gemini:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let contentText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Parse the JSON response de forma robusta
    let result;
    try {
      result = JSON.parse(contentText);
    } catch (parseError) {
      // Tenta extrair JSON dentro de code fences
      const fenceMatch = contentText.match(/```json\s*([\s\S]*?)\s*```/) || contentText.match(/```\s*([\s\S]*?)\s*```/);
      if (fenceMatch && fenceMatch[1]) {
        try {
          result = JSON.parse(fenceMatch[1]);
        } catch (innerError) {
          console.error('Failed to parse extracted JSON from Gemini:', fenceMatch[1]);
          throw new Error('Invalid JSON response from Gemini (extracted)');
        }
      } else {
        console.error('Failed to parse Gemini response:', contentText);
        throw new Error('Invalid JSON response from Gemini');
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, x-supabase-auth, x-forwarded-for, user-agent',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

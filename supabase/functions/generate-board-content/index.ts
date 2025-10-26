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
    console.log('Iniciando geração de conteúdo com IA...');
    const { prompt, type } = await req.json();
    console.log('Parâmetros recebidos:', { prompt: prompt?.substring(0, 100), type });
    
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY não encontrada nas variáveis de ambiente');
      throw new Error('GEMINI_API_KEY não configurada');
    }
    
    console.log('GEMINI_API_KEY encontrada, prosseguindo...');

    let systemPrompt = '';
    if (type === 'columns') {
      systemPrompt = 'Você é um especialista em processos gerenciais e gestão de projetos que gera colunas para quadros kanban baseadas no CONTEÚDO ESPECÍFICO das tarefas do projeto. NUNCA use nomes de processos genéricos como "A Fazer", "Em Progresso", "Aguardando Revisão", "Concluído", "Em Andamento". Crie colunas que representem as ÁREAS FUNCIONAIS, DEPARTAMENTOS ou ESPECIALIDADES TÉCNICAS do trabalho. Analise o contexto do projeto e identifique as principais áreas de conhecimento, competências ou componentes funcionais envolvidos. Retorne APENAS um array JSON com 3-5 objetos contendo "titulo" (string). Exemplos: Para desenvolvimento de software: [{"titulo":"Arquitetura e Backend"},{"titulo":"Interface e Experiência"},{"titulo":"Integração e APIs"},{"titulo":"Segurança e Compliance"}]. Para projeto de marketing: [{"titulo":"Estratégia e Planejamento"},{"titulo":"Criação de Conteúdo"},{"titulo":"Canais Digitais"},{"titulo":"Análise e Métricas"}]';
    } else if (type === 'columns_with_tasks') {
      systemPrompt = 'Você é um especialista em processos gerenciais e gestão de projetos que gera colunas e tarefas para quadros kanban. Crie colunas baseadas nas ÁREAS FUNCIONAIS ESPECÍFICAS do projeto (NUNCA use nomes de processos como "A Fazer", "Em Progresso", "Concluído"). Identifique as principais competências, departamentos ou especialidades técnicas envolvidas. Distribua as tarefas APENAS nessas colunas de áreas funcionais específicas. Retorne APENAS um array JSON com 3-5 objetos, cada um contendo "titulo" (string da área funcional) e "tasks" (array com 2-4 tarefas). Cada tarefa deve ter "titulo" (string conciso), "descricao" (string detalhada com 2-5 linhas explicando objetivos, metodologia e entregáveis esperados), "prioridade" ("baixa"|"media"|"alta"). As descrições devem ser profissionais e contextualizadas. Exemplo: [{"titulo":"Arquitetura e Backend","tasks":[{"titulo":"Definir arquitetura do sistema","descricao":"Elaborar a arquitetura técnica do sistema definindo padrões de desenvolvimento, estrutura de dados, APIs e integrações. Documentar decisões arquiteturais e criar diagramas técnicos para orientar a equipe de desenvolvimento. Estabelecer guidelines de performance, segurança e escalabilidade.","prioridade":"alta"}]}]';
    } else if (type === 'tasks') {
      systemPrompt = 'Você é um especialista em processos gerenciais que gera tarefas específicas para uma área/categoria do projeto. Crie tarefas profissionais e bem estruturadas. Retorne APENAS um array JSON com 3-7 objetos contendo "titulo" (string concisa), "descricao" (string detalhada com 2-5 linhas explicando objetivos, metodologia e entregáveis esperados), "prioridade" ("baixa"|"media"|"alta"). As descrições devem ser profissionais, contextualizadas e orientadas a resultados. Exemplo: [{"titulo":"Implementar sistema de autenticação","descricao":"Desenvolver sistema completo de autenticação incluindo registro, login, recuperação de senha e gestão de sessões. Implementar medidas de segurança como criptografia de senhas, validação de tokens e proteção contra ataques. Criar documentação técnica e testes automatizados para garantir a qualidade e confiabilidade do sistema.","prioridade":"alta"}]';
    }

    console.log('Fazendo chamada para API do Gemini...');
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
    
    console.log('Resposta da API do Gemini recebida:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      throw new Error(`Erro na API do Gemini: ${response.status}`);
    }

    const data = await response.json();
    console.log('Dados recebidos da API do Gemini:', JSON.stringify(data).substring(0, 200));
    
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Texto gerado:', generatedText.substring(0, 200));
    
    // Extract JSON from markdown code blocks if present
    let jsonText = generatedText.trim();
    if (jsonText.includes('```json')) {
      jsonText = jsonText.split('```json')[1].split('```')[0].trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.split('```')[1].split('```')[0].trim();
    }
    
    console.log('JSON extraído:', jsonText.substring(0, 200));
    const parsedData = JSON.parse(jsonText);
    console.log('Dados parseados com sucesso, retornando...');

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

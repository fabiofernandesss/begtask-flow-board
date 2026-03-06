import { supabase } from "@/integrations/supabase/client";

interface GeminiTask {
  titulo: string;
  descricao?: string;
  prioridade?: 'baixa' | 'media' | 'alta';
  estimativa_horas?: number;
}

interface GeminiColumn {
  titulo: string;
  tasks?: GeminiTask[];
}

interface GeminiResponse {
  data: GeminiColumn[] | GeminiTask[];
}

class GeminiService {
  private async callGemini(prompt: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: { prompt },
    });

    if (error) {
      throw new Error(`Erro na API do Gemini: ${error.message}`);
    }

    return data?.text || '';
  }

  private parseJsonResponse(text: string): any {
    try {
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Erro ao fazer parse do JSON:', error);
      throw new Error('Resposta da IA não está em formato JSON válido');
    }
  }

  async generateColumns(prompt: string, count?: number): Promise<GeminiColumn[]> {
    const systemPrompt = `Você é um assistente especializado em gestão de projetos. Gere colunas específicas para o projeto baseado no prompt do usuário.

IMPORTANTE: Responda APENAS com um JSON válido no formato:
[
  {
    "titulo": "Nome da Coluna"
  }
]

Regras:
- ${count ? `Gere exatamente ${count} colunas (quando fizer sentido)` : 'Gere entre 3-5 colunas específicas para o projeto'}
- NÃO use colunas genéricas como "A Fazer", "Fazendo", "Feito"
- Use nomes específicos relacionados ao contexto do projeto
- Cada coluna deve ter um título claro e descritivo

Prompt do usuário: ${prompt}`;

    const response = await this.callGemini(systemPrompt);
    const parsed = this.parseJsonResponse(response);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Resposta deve ser um array de colunas');
    }

    return parsed.filter(col => col && col.titulo && col.titulo.trim());
  }

  async generateTasks(prompt: string, count?: number): Promise<GeminiTask[]> {
    const systemPrompt = `Você é um assistante especializado em gestão de projetos. Gere tarefas específicas baseadas no prompt do usuário.

IMPORTANTE: Responda APENAS com um JSON válido no formato:
[
  {
    "titulo": "Nome da Tarefa",
    "descricao": "Descrição detalhada da tarefa",
    "prioridade": "alta|media|baixa",
    "estimativa_horas": 2
  }
]

Regras:
- ${count ? `Gere exatamente ${count} tarefas (quando fizer sentido)` : 'Gere entre 5-8 tarefas específicas'}
- Cada tarefa deve ter título, descrição, prioridade e estimativa de horas
- Prioridade deve ser: "alta", "media" ou "baixa"
- Estimativa em horas (número inteiro)
- Descrições com 2-4 frases (35-80 palavras), objetivas e úteis
- Tarefas devem ser específicas e acionáveis

Prompt do usuário: ${prompt}`;

    const response = await this.callGemini(systemPrompt);
    const parsed = this.parseJsonResponse(response);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Resposta deve ser um array de tarefas');
    }

    return parsed.filter(task => task && task.titulo && task.titulo.trim());
  }

  async generateColumnsWithTasks(prompt: string): Promise<GeminiColumn[]> {
    const systemPrompt = `Você é um assistente especializado em gestão de projetos. Gere colunas com tarefas específicas para o projeto baseado no prompt do usuário.

IMPORTANTE: Responda APENAS com um JSON válido no formato:
[
  {
    "titulo": "Nome da Coluna",
    "tasks": [
      {
        "titulo": "Nome da Tarefa",
        "descricao": "Descrição detalhada da tarefa",
        "prioridade": "alta|media|baixa",
        "estimativa_horas": 2
      }
    ]
  }
]

Regras:
- Se o usuário especificar explicitamente a quantidade de colunas/blocos, respeite exatamente esse número
- Caso não especifique quantidade, gere entre 2-4 colunas específicas para o projeto
- NÃO use colunas genéricas como "A Fazer", "Fazendo", "Feito"
- Se o usuário pedir colunas vazias, retorne "tasks": [] para todas as colunas
- Nunca adicione tarefas às colunas "Em andamento" e "Concluídas"
- Quando incluir tarefas, limite a no máximo 5 por coluna
- Tarefas devem ter título, descrição, prioridade e estimativa de horas
- Prioridade deve ser: "alta", "media" ou "baixa"
- Estimativa em horas (número inteiro)

Prompt do usuário: ${prompt}`;

    const response = await this.callGemini(systemPrompt);
    const parsed = this.parseJsonResponse(response);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Resposta deve ser um array de colunas');
    }

    return parsed.filter(col => col && col.titulo && col.titulo.trim());
  }

  async generateBoardContent(prompt: string, type: 'columns' | 'tasks' | 'columns_with_tasks'): Promise<GeminiResponse> {
    let data: GeminiColumn[] | GeminiTask[];

    switch (type) {
      case 'columns':
        data = await this.generateColumns(prompt);
        break;
      case 'tasks':
        data = await this.generateTasks(prompt);
        break;
      case 'columns_with_tasks':
        data = await this.generateColumnsWithTasks(prompt);
        break;
      default:
        throw new Error(`Tipo não suportado: ${type}`);
    }

    return { data };
  }

  async generateTasksForColumn(
    userPrompt: string,
    columnTitle: string,
    count: number,
    existingTitles: string[] = []
  ): Promise<GeminiTask[]> {
    const safeCount = Math.max(1, Math.min(count || 1, 20));
    const existingList = existingTitles
      .filter(Boolean)
      .map(t => `"${t}"`)
      .join(', ');

    const systemPrompt = `Você é um assistente de gestão de projetos. Gere tarefas APENAS para a coluna "${columnTitle}".

IMPORTANTE: Responda SOMENTE com JSON válido, no formato:
[
  {
    "titulo": "Nome da Tarefa",
    "descricao": "Descrição detalhada da tarefa",
    "prioridade": "alta|media|baixa",
    "estimativa_horas": 2
  }
]

Regras:
- Gere exatamente ${safeCount} tarefas
- Descrições entre 2-4 frases (35-80 palavras)
- Evite títulos já usados: [${existingList || 'nenhum'}]
- Prioridade deve ser "alta", "media" ou "baixa"
- Estimativa em horas deve ser um número inteiro
- NUNCA gere tarefas para colunas com título "Em andamento" ou "Concluídas"

Contexto do projeto e pedido do usuário:
${userPrompt}`;

    const response = await this.callGemini(systemPrompt);
    const parsed = this.parseJsonResponse(response);
    if (!Array.isArray(parsed)) {
      throw new Error('Resposta deve ser um array de tarefas');
    }
    return parsed.filter(task => task && task.titulo && task.titulo.trim());
  }

  async correctTranscription(texto: string): Promise<string> {
    const systemPrompt = `Você receberá um texto transcrito em português a partir de áudio.

Tarefas:
- Corrija ortografia, acentuação e pontuação
- Ajuste quebras de linha naturais quando fizer sentido
- NÃO acrescente informações que não estejam no texto
- Responda apenas com o texto corrigido, sem comentários ou marcações de código`;

    const response = await this.callGemini(`${systemPrompt}

Transcrição bruta:
"""
${texto}
"""`);
    return (response || '').trim();
  }
}

export const geminiService = new GeminiService();
export type { GeminiTask, GeminiColumn, GeminiResponse };

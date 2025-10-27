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
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  constructor() {
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.5,
          topK: 1,
          topP: 1,
          maxOutputTokens: 800,
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
      throw new Error(`Erro na API do Gemini: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private parseJsonResponse(text: string): any {
    try {
      // Remove markdown code blocks se existirem
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Erro ao fazer parse do JSON:', error);
      console.error('Texto recebido:', text);
      throw new Error('Resposta da IA não está em formato JSON válido');
    }
  }

  async generateColumns(prompt: string): Promise<GeminiColumn[]> {
    const systemPrompt = `Você é um assistente especializado em gestão de projetos. Gere colunas específicas para o projeto baseado no prompt do usuário.

IMPORTANTE: Responda APENAS com um JSON válido no formato:
[
  {
    "titulo": "Nome da Coluna"
  }
]

Regras:
- Gere entre 3-5 colunas específicas para o projeto
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

  async generateTasks(prompt: string): Promise<GeminiTask[]> {
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
- Gere entre 5-8 tarefas específicas
- Cada tarefa deve ter título, descrição, prioridade e estimativa de horas
- Prioridade deve ser: "alta", "media" ou "baixa"
- Estimativa em horas (número inteiro)
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
- Se o usuário especificar explicitamente a quantidade de colunas/blocos, respeite exatamente esse número (ex.: "2 blocos" = 2 colunas)
- Caso não especifique quantidade, gere entre 2-4 colunas específicas para o projeto
- NÃO use colunas genéricas como "A Fazer", "Fazendo", "Feito"
- Se o usuário pedir colunas vazias, retorne "tasks": [] para todas as colunas
- Quando incluir tarefas, limite a no máximo 3 por coluna, com descrições curtas (até 2 frases)
- Tarefas devem ter título, descrição, prioridade e estimativa de horas
- Prioridade deve ser: "alta", "media" ou "baixa"
- Estimativa em horas (número inteiro)
- Nunca inclua contadores/numerações soltas ou texto fora do JSON

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

  // Corrige e melhora texto de transcrição (sem adicionar conteúdo extra)
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
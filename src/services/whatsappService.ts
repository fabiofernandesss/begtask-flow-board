interface WhatsAppMessage {
  recipients: string;
  message: string;
  interval?: string;
}

interface WhatsAppResponse {
  success: boolean;
  message?: string;
  error?: string;
}

class WhatsAppService {
  private readonly apiUrl = import.meta.env.VITE_WHATSAPP_API_URL;
  private readonly authToken = import.meta.env.VITE_WHATSAPP_AUTH_TOKEN;

  constructor() {
    if (!this.apiUrl || !this.authToken) {
      console.warn('WhatsApp API URL ou Auth Token não configurados. Mensagens WhatsApp não serão enviadas.');
    }
  }

  /**
   * Formata um número de telefone do formato (XX) XXXXX-XXXX para 55XXXXXXXXXXX
   * @param phoneNumber - Número no formato (XX) XXXXX-XXXX
   * @returns Número formatado como 55XXXXXXXXXXX
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove todos os caracteres especiais e espaços
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    
    // Adiciona o código do país (55) se não estiver presente
    if (!cleanNumber.startsWith('55')) {
      return '55' + cleanNumber;
    }
    
    return cleanNumber;
  }

  /**
   * Formata uma lista de números de telefone
   * @param phoneNumbers - Array de números no formato (XX) XXXXX-XXXX
   * @returns String com números formatados separados por vírgula
   */
  private formatPhoneNumbers(phoneNumbers: string[]): string {
    return phoneNumbers
      .map(phone => this.formatPhoneNumber(phone))
      .join(', ');
  }

  /**
   * Envia mensagem WhatsApp para um único destinatário
   * @param phoneNumber - Número no formato (XX) XXXXX-XXXX
   * @param message - Mensagem a ser enviada
   * @returns Promise com resultado do envio
   */
  async sendSingleMessage(phoneNumber: string, message: string): Promise<WhatsAppResponse> {
    if (!this.apiUrl || !this.authToken) {
      return {
        success: false,
        error: 'WhatsApp API não configurada'
      };
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      
      const payload: WhatsAppMessage = {
        recipients: formattedNumber,
        message,
        interval: "1"
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': this.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: 'Mensagem enviada com sucesso'
      };
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Envia mensagem WhatsApp para múltiplos destinatários
   * @param phoneNumbers - Array de números no formato (XX) XXXXX-XXXX
   * @param message - Mensagem a ser enviada
   * @returns Promise com resultado do envio
   */
  async sendMultipleMessages(phoneNumbers: string[], message: string): Promise<WhatsAppResponse> {
    if (!this.apiUrl || !this.authToken) {
      return {
        success: false,
        error: 'WhatsApp API não configurada'
      };
    }

    try {
      if (phoneNumbers.length === 0) {
        return {
          success: false,
          error: 'Nenhum número de telefone fornecido'
        };
      }

      const formattedNumbers = this.formatPhoneNumbers(phoneNumbers);
      
      const payload: WhatsAppMessage = {
        recipients: formattedNumbers,
        message,
        interval: "1"
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': this.authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: `Mensagem enviada para ${phoneNumbers.length} destinatário(s)`
      };
    } catch (error) {
      console.error('Erro ao enviar mensagens WhatsApp:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Envia notificação quando usuário é adicionado a uma tarefa
   * @param phoneNumber - Número do usuário adicionado
   * @param taskTitle - Título da tarefa
   * @param boardId - ID do board para gerar link
   * @returns Promise com resultado do envio
   */
  async notifyUserAddedToTask(phoneNumber: string, taskTitle: string, boardId: string): Promise<WhatsAppResponse> {
    const boardLink = `${window.location.origin}/board/${boardId}`;
    const message = `🎯 Você foi adicionado à tarefa: "${taskTitle}"\n\nAcesse o board: ${boardLink}`;
    
    return this.sendSingleMessage(phoneNumber, message);
  }

  /**
   * Envia notificação quando uma tarefa é excluída
   * @param phoneNumbers - Números dos membros da tarefa
   * @param taskTitle - Título da tarefa excluída
   * @returns Promise com resultado do envio
   */
  async notifyTaskDeleted(phoneNumbers: string[], taskTitle: string): Promise<WhatsAppResponse> {
    const message = `🗑️ A tarefa "${taskTitle}" foi excluída.`;
    
    return this.sendMultipleMessages(phoneNumbers, message);
  }

  /**
   * Envia notificação quando uma tarefa muda de coluna
   * @param phoneNumbers - Números dos membros da tarefa
   * @param taskTitle - Título da tarefa
   * @param fromColumn - Nome da coluna de origem
   * @param toColumn - Nome da coluna de destino
   * @returns Promise com resultado do envio
   */
  async notifyTaskMoved(phoneNumbers: string[], taskTitle: string, fromColumn: string, toColumn: string): Promise<WhatsAppResponse> {
    const message = `📋 A tarefa "${taskTitle}" foi movida de "${fromColumn}" para "${toColumn}".`;
    
    return this.sendMultipleMessages(phoneNumbers, message);
  }

  /**
   * Envia notificação quando uma coluna é excluída
   * @param phoneNumber - Número do responsável pela tarefa
   * @param userName - Nome do responsável
   * @param columnTitle - Título da coluna excluída
   * @param taskTitle - Título da tarefa que estava na coluna
   * @returns Promise com resultado do envio
   */
  async notifyColumnDeleted(phoneNumber: string, userName: string, columnTitle: string, taskTitle: string): Promise<WhatsAppResponse> {
    const message = `📂 Olá ${userName}! A coluna "${columnTitle}" foi excluída e sua tarefa "${taskTitle}" foi removida junto.`;
    
    return this.sendSingleMessage(phoneNumber, message);
  }

  /**
   * Envia notificação quando um board é excluído
   * @param phoneNumber - Número do responsável pela tarefa
   * @param userName - Nome do responsável
   * @param boardTitle - Título do board excluído
   * @param taskTitle - Título da tarefa que estava no board
   * @returns Promise com resultado do envio
   */
  async notifyBoardDeleted(phoneNumber: string, userName: string, boardTitle: string, taskTitle: string): Promise<WhatsAppResponse> {
    const message = `📋 Olá ${userName}! O board "${boardTitle}" foi excluído e sua tarefa "${taskTitle}" foi removida junto.`;
    
    return this.sendSingleMessage(phoneNumber, message);
  }

  /**
   * Envia notificação quando uma coluna ou board é excluído
   * @param phoneNumbers - Números dos usuários afetados
   * @param itemTitle - Título da coluna ou board excluído
   * @param itemType - Tipo do item ('coluna' ou 'board')
   * @returns Promise com resultado do envio
   */
  async notifyItemDeleted(phoneNumbers: string[], itemTitle: string, itemType: 'coluna' | 'board'): Promise<WhatsAppResponse> {
    const emoji = itemType === 'coluna' ? '📂' : '📋';
    const message = `${emoji} ${itemType === 'coluna' ? 'A coluna' : 'O board'} "${itemTitle}" foi ${itemType === 'coluna' ? 'excluída' : 'excluído'}.`;
    
    return this.sendMultipleMessages(phoneNumbers, message);
  }
}

// Exporta uma instância singleton do serviço
export const whatsappService = new WhatsAppService();
export default whatsappService;
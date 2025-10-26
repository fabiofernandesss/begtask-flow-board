import { supabase } from "@/integrations/supabase/client";

interface NotificationRequest {
  type: 'whatsapp' | 'email' | 'both';
  whatsapp?: {
    recipients: string; // Comma-separated phone numbers
    message: string;
  };
  email?: {
    to: string;
    subject: string;
    html: string;
    from?: string;
  };
}

interface NotificationResponse {
  success: boolean;
  results: {
    whatsapp?: {
      success: boolean;
      data?: any;
      error?: string;
    };
    email?: {
      success: boolean;
      data?: any;
      error?: string;
    };
  };
  error?: string;
}

class NotificationService {
  private formatPhoneNumber(phone: string): string {
    // Remove todos os caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Se não começar com 55 (código do Brasil), adiciona
    if (!cleanPhone.startsWith('55')) {
      return `55${cleanPhone}`;
    }
    
    return cleanPhone;
  }

  private async callEdgeFunction(request: NotificationRequest): Promise<NotificationResponse> {
    try {
      console.log("🔧 CallEdgeFunction iniciado");
      console.log("📋 Request:", JSON.stringify(request, null, 2));
      
      // Verificar se o usuário está autenticado
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log("🔐 Verificação de sessão:");
      console.log("  - Session exists:", !!session);
      console.log("  - Session error:", sessionError);
      
      if (sessionError) {
        console.error("❌ Erro ao obter sessão:", sessionError);
        throw new Error(`Erro de sessão: ${sessionError.message}`);
      }
      
      if (!session) {
        console.warn('❌ User not authenticated, skipping notification');
        // Retornar uma resposta de sucesso falso para não quebrar o fluxo
        return {
          success: false,
          results: {
            whatsapp: { success: false, error: 'User not authenticated' },
            email: { success: false, error: 'User not authenticated' }
          }
        };
      }

      console.log("📤 Chamando Edge Function send-notifications...");
      const { data, error } = await supabase.functions.invoke('send-notifications', {
        body: request,
      });

      console.log("📥 Resposta da Edge Function:");
      console.log("  - Data:", data);
      console.log("  - Error:", error);

      if (error) {
        console.error("❌ Erro na Edge Function:", error);
        throw error;
      }

      console.log("✅ CallEdgeFunction concluído com sucesso");
      return data;
    } catch (error) {
      console.error('❌ Error calling notification edge function:', error);
      throw error;
    }
  }

  async sendWhatsApp(phone: string, message: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      
      const response = await this.callEdgeFunction({
        type: 'whatsapp',
        whatsapp: {
          recipients: formattedPhone,
          message,
        },
      });

      return response.results.whatsapp?.success || false;
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      return false;
    }
  }

  async sendWhatsAppToMultiple(phones: string[], message: string): Promise<boolean> {
    try {
      if (!phones || phones.length === 0) {
        console.warn('No phone numbers provided');
        return false;
      }

      // Format all phone numbers and join with comma
      const formattedPhones = phones
        .map(phone => this.formatPhoneNumber(phone))
        .join(', ');
      
      const response = await this.callEdgeFunction({
        type: 'whatsapp',
        whatsapp: {
          recipients: formattedPhones,
          message,
        },
      });

      return response.results.whatsapp?.success || false;
    } catch (error) {
      console.error('Error sending WhatsApp to multiple recipients:', error);
      return false;
    }
  }

  async sendEmail(to: string, subject: string, html: string, from?: string): Promise<boolean> {
    try {
      const response = await this.callEdgeFunction({
        type: 'email',
        email: {
          to,
          subject,
          html,
          from,
        },
      });

      return response.results.email?.success || false;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendBoth(
    phone: string | null,
    email: string | null,
    whatsappMessage: string,
    emailSubject: string,
    emailHtml: string,
    emailFrom?: string
  ): Promise<{ whatsapp: boolean; email: boolean }> {
    try {
      if (!phone && !email) {
        console.warn('Both phone and email are null, no notifications sent');
        return { whatsapp: false, email: false };
      }

      const result = { whatsapp: false, email: false };

      // Send WhatsApp if phone is provided
      if (phone) {
        try {
          const whatsappSuccess = await this.sendWhatsApp(phone, whatsappMessage);
          result.whatsapp = whatsappSuccess;
        } catch (error) {
          console.error('Error sending WhatsApp:', error);
        }
      }

      // Send Email if email is provided
      if (email) {
        try {
          const emailSuccess = await this.sendEmail(email, emailSubject, emailHtml, emailFrom);
          result.email = emailSuccess;
        } catch (error) {
          console.error('Error sending email:', error);
        }
      }

      return result;
    } catch (error) {
      console.error('Error sending both notifications:', error);
      return { whatsapp: false, email: false };
    }
  }

  // Métodos específicos para notificações de tarefas
  async notifyTaskCreated(phone: string, email: string, responsavelNome: string, taskTitle: string): Promise<void> {
    const whatsappMessage = `🎯 *Nova Tarefa Atribuída*\n\nOlá ${responsavelNome}!\n\nVocê foi designado(a) para uma nova tarefa:\n\n📋 *${taskTitle}*\n\nAcesse o BegTask para mais detalhes.\n\n✅ BegTask - Gestão de Tarefas`;
    
    const emailSubject = `Nova Tarefa Atribuída: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">🎯 Nova Tarefa Atribuída</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>Você foi designado(a) para uma nova tarefa:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #1f2937;">📋 ${taskTitle}</h3>
        </div>
        <p>Acesse o BegTask para mais detalhes e começar a trabalhar na tarefa.</p>
        <p style="color: #6b7280; font-size: 14px;">✅ BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async notifyTaskUpdated(phone: string, email: string, responsavelNome: string, taskTitle: string): Promise<void> {
    const whatsappMessage = `📝 *Tarefa Atualizada*\n\nOlá ${responsavelNome}!\n\nSua tarefa foi atualizada:\n\n📋 *${taskTitle}*\n\nVerifique as alterações no BegTask.\n\n✅ BegTask - Gestão de Tarefas`;
    
    const emailSubject = `Tarefa Atualizada: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">📝 Tarefa Atualizada</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>Sua tarefa foi atualizada:</p>
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #92400e;">📋 ${taskTitle}</h3>
        </div>
        <p>Verifique as alterações no BegTask para continuar trabalhando na tarefa.</p>
        <p style="color: #6b7280; font-size: 14px;">✅ BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async notifyTaskDeleted(phone: string, email: string, responsavelNome: string, taskTitle: string): Promise<void> {
    const whatsappMessage = `🗑️ *Tarefa Excluída*\n\nOlá ${responsavelNome}!\n\nA seguinte tarefa foi excluída:\n\n📋 *${taskTitle}*\n\n✅ BegTask - Gestão de Tarefas`;
    
    const emailSubject = `Tarefa Excluída: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🗑️ Tarefa Excluída</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>A seguinte tarefa foi excluída:</p>
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #991b1b;">📋 ${taskTitle}</h3>
        </div>
        <p>Esta tarefa não está mais disponível no sistema.</p>
        <p style="color: #6b7280; font-size: 14px;">✅ BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async notifyColumnDeleted(phone: string, email: string, responsavelNome: string, columnTitle: string, taskTitle: string): Promise<void> {
    const whatsappMessage = `📂 *Coluna Excluída*\n\nOlá ${responsavelNome}!\n\nA coluna "${columnTitle}" foi excluída, incluindo sua tarefa:\n\n📋 *${taskTitle}*\n\n✅ BegTask - Gestão de Tarefas`;
    
    const emailSubject = `Coluna Excluída: ${columnTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">📂 Coluna Excluída</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>A coluna <strong>"${columnTitle}"</strong> foi excluída, incluindo sua tarefa:</p>
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #991b1b;">📋 ${taskTitle}</h3>
        </div>
        <p>Esta tarefa não está mais disponível no sistema.</p>
        <p style="color: #6b7280; font-size: 14px;">✅ BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async notifyBoardDeleted(phone: string, email: string, responsavelNome: string, boardTitle: string, taskTitle: string): Promise<void> {
    const whatsappMessage = `🗂️ *Bloco Excluído*\n\nOlá ${responsavelNome}!\n\nO bloco "${boardTitle}" foi excluído, incluindo sua tarefa:\n\n📋 *${taskTitle}*\n\n✅ BegTask - Gestão de Tarefas`;
    
    const emailSubject = `Bloco Excluído: ${boardTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🗂️ Bloco Excluído</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>O bloco <strong>"${boardTitle}"</strong> foi excluído, incluindo sua tarefa:</p>
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #991b1b;">📋 ${taskTitle}</h3>
        </div>
        <p>Esta tarefa não está mais disponível no sistema.</p>
        <p style="color: #6b7280; font-size: 14px;">✅ BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async sendTaskMovedNotification(
    responsavelNome: string,
    phone: string | null,
    email: string | null,
    taskTitle: string,
    fromColumn: string,
    toColumn: string
  ): Promise<void> {
    console.log("🚀 NotificationService.sendTaskMovedNotification iniciado");
    console.log("📞 Telefone:", phone);
    console.log("📧 Email:", email);
    console.log("👤 Nome:", responsavelNome);
    console.log("📋 Tarefa:", taskTitle);
    console.log("🔄 De:", fromColumn, "Para:", toColumn);
    
    const whatsappMessage = `📋 *Tarefa Movida*\n\nOlá ${responsavelNome}!\n\nSua tarefa foi movida:\n\n📋 *${taskTitle}*\n\nDe: ${fromColumn}\nPara: ${toColumn}\n\n✅ BegTask - Gestão de Tarefas`;
    
    const emailSubject = `Tarefa Movida: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">📋 Tarefa Movida</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>Sua tarefa foi movida:</p>
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #1e40af;">📋 ${taskTitle}</h3>
          <p style="margin: 10px 0 0 0; color: #1e40af;"><strong>De:</strong> ${fromColumn}</p>
          <p style="margin: 5px 0 0 0; color: #1e40af;"><strong>Para:</strong> ${toColumn}</p>
        </div>
        <p>Acesse o sistema para visualizar o status atualizado da tarefa.</p>
        <p style="color: #6b7280; font-size: 14px;">✅ BegTask - Gestão de Tarefas</p>
      </div>
    `;

    try {
      if (phone && email) {
        console.log("📱📧 Enviando para ambos: telefone e email");
        await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
      } else if (phone) {
        console.log("📱 Enviando apenas WhatsApp");
        await this.sendWhatsApp(phone, whatsappMessage);
      } else if (email) {
        console.log("📧 Enviando apenas email");
        await this.sendEmail(email, emailSubject, emailHtml);
      } else {
        console.log("⚠️ Nenhum meio de contato disponível");
      }
      console.log("✅ NotificationService.sendTaskMovedNotification concluído com sucesso");
    } catch (error) {
      console.error("❌ Erro em NotificationService.sendTaskMovedNotification:", error);
      throw error;
    }
  }

  async sendTaskAssignedNotification(
    responsavelNome: string,
    phone: string | null,
    email: string | null,
    taskTitle: string
  ): Promise<void> {
    const whatsappMessage = `🎯 *Nova Tarefa Atribuída!*\n\nOlá ${responsavelNome}!\n\nVocê foi designado(a) para a tarefa:\n📋 *${taskTitle}*\n\nAcesse o sistema para mais detalhes.\n\n✅ BegTask - Gestão de Tarefas`;
    
    const emailSubject = `Nova Tarefa Atribuída: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">🎯 Nova Tarefa Atribuída!</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>Você foi designado(a) para uma nova tarefa:</p>
        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #065f46;">📋 ${taskTitle}</h3>
        </div>
        <p>Acesse o sistema para visualizar todos os detalhes e começar a trabalhar nesta tarefa.</p>
        <p style="color: #6b7280; font-size: 14px;">✅ BegTask - Gestão de Tarefas</p>
      </div>
    `;

    if (phone && email) {
      await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
    } else if (phone) {
      await this.sendWhatsApp(phone, whatsappMessage);
    } else if (email) {
      await this.sendEmail(email, emailSubject, emailHtml);
    }
  }
}

export const notificationService = new NotificationService();
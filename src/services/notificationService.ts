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

  async sendWhatsAppImage(phone: string, imageUrl: string, caption?: string): Promise<boolean> {
    try {
      const formattedPhone = this.formatPhoneNumber(phone);
      const apiUrl = import.meta.env.VITE_WHATSAPP_API_URL;
      const authToken = import.meta.env.VITE_WHATSAPP_AUTH_TOKEN;

      if (!apiUrl || !authToken) {
        console.warn('WhatsApp API não configurada para envio de imagem');
        return false;
      }

      // Derivar URL de envio de imagem a partir da URL base
      const imageApiUrl = apiUrl.replace('/recursive-send-message', '/send-image');

      const response = await fetch(imageApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jid: formattedPhone,
          caption: caption || '',
          imageurl: imageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log(`✅ Imagem enviada para ${formattedPhone}`);
      return true;
    } catch (error) {
      console.error('Error sending WhatsApp image:', error);
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
  async notifyTaskCreated(
    phone: string | null,
    email: string | null,
    responsavelNome: string,
    taskTitle: string,
    boardTitle?: string,
    columnTitle?: string,
    createdByName?: string,
    taskDescription?: string | null
  ): Promise<void> {
    const whatsappMessage = [
      `*Nova Tarefa Atribuida*`,
      ``,
      `Ola ${responsavelNome},`,
      ``,
      boardTitle ? `*Projeto:* ${boardTitle}` : null,
      columnTitle ? `*Coluna:* ${columnTitle}` : null,
      `*Tarefa:* ${taskTitle}`,
      taskDescription ? `*Descricao:* ${taskDescription}` : null,
      createdByName ? `*Criado por:* ${createdByName}` : null,
      ``,
      `Acesse o BegTask para mais detalhes.`,
      ``,
      `BegTask - Gestao de Tarefas`,
    ].filter(Boolean).join('\n');
    
    const emailSubject = `Nova Tarefa Atribuída: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nova Tarefa Atribuída</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>Você foi designado(a) para uma nova tarefa:</p>
        ${boardTitle ? `<p><strong>Projeto:</strong> ${boardTitle}</p>` : ''}
        ${columnTitle ? `<p><strong>Coluna:</strong> ${columnTitle}</p>` : ''}
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #1f2937;">${taskTitle}</h3>
          ${taskDescription ? `<p style="margin: 10px 0 0 0; color: #374151;">${taskDescription}</p>` : ''}
        </div>
        ${createdByName ? `<p><strong>Criado por:</strong> ${createdByName}</p>` : ''}
        <p>Acesse o BegTask para mais detalhes.</p>
        <p style="color: #6b7280; font-size: 14px;">BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async notifyTaskUpdated(
    phone: string | null,
    email: string | null,
    responsavelNome: string,
    taskTitle: string,
    boardTitle?: string,
    columnTitle?: string,
    updatedByName?: string,
    taskDescription?: string | null
  ): Promise<void> {
    const whatsappMessage = [
      `*Tarefa Atualizada*`,
      ``,
      `Ola ${responsavelNome},`,
      ``,
      boardTitle ? `*Projeto:* ${boardTitle}` : null,
      columnTitle ? `*Coluna:* ${columnTitle}` : null,
      `*Tarefa:* ${taskTitle}`,
      taskDescription ? `*Descricao:* ${taskDescription}` : null,
      updatedByName ? `*Atualizado por:* ${updatedByName}` : null,
      ``,
      `Verifique as alteracoes no BegTask.`,
      ``,
      `BegTask - Gestao de Tarefas`,
    ].filter(Boolean).join('\n');
    
    const emailSubject = `Tarefa Atualizada: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Tarefa Atualizada</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>Sua tarefa foi atualizada:</p>
        ${boardTitle ? `<p><strong>Projeto:</strong> ${boardTitle}</p>` : ''}
        ${columnTitle ? `<p><strong>Coluna:</strong> ${columnTitle}</p>` : ''}
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #92400e;">${taskTitle}</h3>
          ${taskDescription ? `<p style="margin: 10px 0 0 0; color: #374151;">${taskDescription}</p>` : ''}
        </div>
        ${updatedByName ? `<p><strong>Atualizado por:</strong> ${updatedByName}</p>` : ''}
        <p>Verifique as alterações no BegTask.</p>
        <p style="color: #6b7280; font-size: 14px;">BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async notifyTaskDeleted(
    phone: string | null,
    email: string | null,
    responsavelNome: string,
    taskTitle: string,
    boardTitle?: string,
    columnTitle?: string,
    deletedByName?: string,
    taskDescription?: string | null
  ): Promise<void> {
    const whatsappMessage = [
      `*Tarefa Excluida*`,
      ``,
      `Ola ${responsavelNome},`,
      ``,
      boardTitle ? `*Projeto:* ${boardTitle}` : null,
      columnTitle ? `*Coluna:* ${columnTitle}` : null,
      `*Tarefa:* ${taskTitle}`,
      taskDescription ? `*Descricao:* ${taskDescription}` : null,
      deletedByName ? `*Excluido por:* ${deletedByName}` : null,
      ``,
      `Esta tarefa foi removida do sistema.`,
      ``,
      `BegTask - Gestao de Tarefas`,
    ].filter(Boolean).join('\n');
    
    const emailSubject = `Tarefa Excluída: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Tarefa Excluída</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>A seguinte tarefa foi excluída:</p>
        ${boardTitle ? `<p><strong>Projeto:</strong> ${boardTitle}</p>` : ''}
        ${columnTitle ? `<p><strong>Coluna:</strong> ${columnTitle}</p>` : ''}
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #991b1b;">${taskTitle}</h3>
          ${taskDescription ? `<p style="margin: 10px 0 0 0; color: #374151;">${taskDescription}</p>` : ''}
        </div>
        ${deletedByName ? `<p><strong>Excluído por:</strong> ${deletedByName}</p>` : ''}
        <p>Esta tarefa não está mais disponível no sistema.</p>
        <p style="color: #6b7280; font-size: 14px;">BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async notifyColumnDeleted(
    responsavelNome: string,
    phone: string | null,
    email: string | null,
    columnTitle: string,
    taskTitle: string,
    boardTitle?: string,
    deletedByName?: string
  ): Promise<void> {
    const whatsappMessage = [
      `*Coluna Excluida*`,
      ``,
      `Ola ${responsavelNome},`,
      ``,
      boardTitle ? `*Projeto:* ${boardTitle}` : null,
      `*Coluna:* ${columnTitle}`,
      `*Tarefa removida:* ${taskTitle}`,
      deletedByName ? `*Excluido por:* ${deletedByName}` : null,
      ``,
      `A coluna foi excluida e sua tarefa foi removida junto.`,
      ``,
      `BegTask - Gestao de Tarefas`,
    ].filter(Boolean).join('\n');
    
    const emailSubject = `Coluna Excluída: ${columnTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Coluna Excluída</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        ${boardTitle ? `<p><strong>Projeto:</strong> ${boardTitle}</p>` : ''}
        <p>A coluna <strong>"${columnTitle}"</strong> foi excluída, incluindo sua tarefa:</p>
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #991b1b;">${taskTitle}</h3>
        </div>
        ${deletedByName ? `<p><strong>Excluído por:</strong> ${deletedByName}</p>` : ''}
        <p>Esta tarefa não está mais disponível no sistema.</p>
        <p style="color: #6b7280; font-size: 14px;">BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async notifyBoardDeleted(
    responsavelNome: string,
    phone: string | null,
    email: string | null,
    boardTitle: string,
    taskTitle: string,
    deletedByName?: string
  ): Promise<void> {
    const whatsappMessage = [
      `*Projeto Excluido*`,
      ``,
      `Ola ${responsavelNome},`,
      ``,
      `*Projeto:* ${boardTitle}`,
      `*Tarefa removida:* ${taskTitle}`,
      deletedByName ? `*Excluido por:* ${deletedByName}` : null,
      ``,
      `O projeto foi excluido e sua tarefa foi removida junto.`,
      ``,
      `BegTask - Gestao de Tarefas`,
    ].filter(Boolean).join('\n');
    
    const emailSubject = `Projeto Excluído: ${boardTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Projeto Excluído</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>O projeto <strong>"${boardTitle}"</strong> foi excluído, incluindo sua tarefa:</p>
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #991b1b;">${taskTitle}</h3>
        </div>
        ${deletedByName ? `<p><strong>Excluído por:</strong> ${deletedByName}</p>` : ''}
        <p>Esta tarefa não está mais disponível no sistema.</p>
        <p style="color: #6b7280; font-size: 14px;">BegTask - Gestão de Tarefas</p>
      </div>
    `;

    await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
  }

  async sendTaskAssignedNotification(
    responsavelNome: string,
    phone: string | null,
    email: string | null,
    taskTitle: string,
    boardTitle?: string,
    columnTitle?: string,
    assignedByName?: string,
    taskDescription?: string | null
  ): Promise<void> {
    const whatsappMessage = [
      `*Nova Tarefa Atribuida*`,
      ``,
      `Ola ${responsavelNome},`,
      ``,
      boardTitle ? `*Projeto:* ${boardTitle}` : null,
      columnTitle ? `*Coluna:* ${columnTitle}` : null,
      `*Tarefa:* ${taskTitle}`,
      taskDescription ? `*Descricao:* ${taskDescription}` : null,
      assignedByName ? `*Atribuido por:* ${assignedByName}` : null,
      ``,
      `Acesse o BegTask para mais detalhes.`,
      ``,
      `BegTask - Gestao de Tarefas`,
    ].filter(Boolean).join('\n');
    
    const emailSubject = `Nova Tarefa Atribuída: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Nova Tarefa Atribuída</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        <p>Você foi designado(a) para uma nova tarefa:</p>
        ${boardTitle ? `<p><strong>Projeto:</strong> ${boardTitle}</p>` : ''}
        ${columnTitle ? `<p><strong>Coluna:</strong> ${columnTitle}</p>` : ''}
        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #065f46;">${taskTitle}</h3>
          ${taskDescription ? `<p style="margin: 10px 0 0 0; color: #374151;">${taskDescription}</p>` : ''}
        </div>
        ${assignedByName ? `<p><strong>Atribuído por:</strong> ${assignedByName}</p>` : ''}
        <p>Acesse o sistema para visualizar todos os detalhes.</p>
        <p style="color: #6b7280; font-size: 14px;">BegTask - Gestão de Tarefas</p>
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

  async sendTaskMovedNotification(
    responsavelNome: string,
    phone: string | null,
    email: string | null,
    taskTitle: string,
    fromColumn: string,
    toColumn: string,
    boardTitle?: string,
    movedByName?: string,
    taskDescription?: string | null,
    taskImages?: string[]
  ): Promise<void> {
    console.log("NotificationService.sendTaskMovedNotification iniciado");
    
    const whatsappMessage = [
      `*Tarefa Movida*`,
      ``,
      `Ola ${responsavelNome},`,
      ``,
      boardTitle ? `*Projeto:* ${boardTitle}` : null,
      `*Tarefa:* ${taskTitle}`,
      taskDescription ? `*Descricao:* ${taskDescription}` : null,
      `*De:* ${fromColumn}`,
      `*Para:* ${toColumn}`,
      movedByName ? `*Movido por:* ${movedByName}` : null,
      ``,
      `Acesse o BegTask para mais detalhes.`,
      ``,
      `BegTask - Gestao de Tarefas`,
    ].filter(Boolean).join('\n');
    
    const emailSubject = `Tarefa Movida: ${taskTitle}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Tarefa Movida</h2>
        <p>Olá <strong>${responsavelNome}</strong>!</p>
        ${boardTitle ? `<p><strong>Projeto:</strong> ${boardTitle}</p>` : ''}
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0; color: #1e40af;">${taskTitle}</h3>
          ${taskDescription ? `<p style="margin: 10px 0 0 0; color: #374151;">${taskDescription}</p>` : ''}
          <p style="margin: 10px 0 0 0; color: #1e40af;"><strong>De:</strong> ${fromColumn}</p>
          <p style="margin: 5px 0 0 0; color: #1e40af;"><strong>Para:</strong> ${toColumn}</p>
          ${movedByName ? `<p style="margin: 5px 0 0 0; color: #1e40af;"><strong>Movido por:</strong> ${movedByName}</p>` : ''}
        </div>
        <p>Acesse o sistema para visualizar o status atualizado da tarefa.</p>
        <p style="color: #6b7280; font-size: 14px;">BegTask - Gestão de Tarefas</p>
      </div>
    `;

    try {
      if (phone && taskImages && taskImages.length > 0) {
        for (const imageUrl of taskImages) {
          const caption = `*${taskTitle}* - Imagem da tarefa`;
          await this.sendWhatsAppImage(phone, imageUrl, caption);
        }
      }

      if (phone && email) {
        await this.sendBoth(phone, email, whatsappMessage, emailSubject, emailHtml);
      } else if (phone) {
        await this.sendWhatsApp(phone, whatsappMessage);
      } else if (email) {
        await this.sendEmail(email, emailSubject, emailHtml);
      }
      console.log("NotificationService.sendTaskMovedNotification concluido");
    } catch (error) {
      console.error("Erro em NotificationService.sendTaskMovedNotification:", error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
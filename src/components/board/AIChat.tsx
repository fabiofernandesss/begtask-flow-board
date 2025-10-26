import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Bot, User, X, Minimize2, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface AIChatProps {
  boardId: string;
  isPublic?: boolean;
}

export const AIChat: React.FC<AIChatProps> = ({ boardId, isPublic = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Carregar mensagens existentes quando o chat abrir
  useEffect(() => {
    if (isOpen && boardId) {
      loadMessages();
    }
  }, [isOpen, boardId]);

  const loadMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('board_messages')
        .select('id, content, sender, created_at')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao carregar mensagens:', error);
        return;
      }

      if (messagesData) {
        const formattedMessages: Message[] = messagesData.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender: msg.sender === 'IA Assistente' ? 'ai' : 'user',
          timestamp: new Date(msg.created_at)
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const saveMessage = async (content: string, senderType: 'user' | 'ai') => {
    try {
      const { error } = await supabase
        .from('board_messages')
        .insert({
          board_id: boardId,
          sender: senderType === 'user' ? 'Usuário' : 'IA Assistente',
          content: content
        });

      if (error) {
        console.error('Erro ao salvar mensagem:', error);
      }
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
  };

  const getBoardData = async () => {
    try {
      // Buscar dados do board
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select(`
          id,
          titulo,
          descricao,
          created_at,
          publico,
          users!boards_user_id_fkey(nome)
        `)
        .eq('id', boardId)
        .single();

      if (boardError) throw boardError;

      // Buscar colunas
      const { data: columnsData, error: columnsError } = await supabase
        .from('columns')
        .select('id, titulo, posicao, cor')
        .eq('board_id', boardId)
        .order('posicao');

      if (columnsError) throw columnsError;

      // Buscar tarefas
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          titulo,
          descricao,
          prioridade,
          data_entrega,
          column_id,
          created_at,
          responsavel_id,
          users!tasks_responsavel_id_fkey(nome),
          columns!tasks_column_id_fkey(titulo)
        `)
        .in('column_id', columnsData?.map(c => c.id) || []);

      if (tasksError) throw tasksError;

      // Buscar comentários
      const { data: commentsData, error: commentsError } = await supabase
        .from('board_comments')
        .select('id, author_name, content, is_public, created_at')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (commentsError) throw commentsError;

      // Buscar mensagens do chat
      const { data: messagesData, error: messagesError } = await supabase
        .from('board_messages')
        .select('id, content, sender, created_at')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (messagesError) throw messagesError;

      // Estruturar dados como esperado
      return {
        board_id: boardData.id,
        board_title: boardData.titulo,
        board_description: boardData.descricao,
        board_created_at: boardData.created_at,
        is_public: boardData.publico,
        owner_name: boardData.users?.nome || 'Usuário',
        columns: columnsData || [],
        tasks: tasksData?.map(task => ({
          ...task,
          responsible: task.users?.nome || 'Não atribuído',
          column_title: task.columns?.titulo || ''
        })) || [],
        board_comments: commentsData || [],
        board_messages: messagesData || [],
        total_tasks: tasksData?.length || 0,
        total_columns: columnsData?.length || 0,
        total_comments: commentsData?.length || 0,
        total_messages: messagesData?.length || 0
      };
    } catch (error) {
      console.error('Erro ao buscar dados do board:', error);
      return null;
    }
  };

  const generateAIResponse = async (userMessage: string, boardData: any) => {
    try {
      if (!boardData) {
        return 'Desculpe, não consegui acessar os dados do board no momento.';
      }

      // Os dados já vêm estruturados da função getBoardData
      const boardContext = {
        board: {
          id: boardData.board_id,
          title: boardData.board_title,
          description: boardData.board_description,
          created_at: boardData.board_created_at,
          is_public: boardData.is_public,
          owner: boardData.owner_name
        },
        columns: boardData.columns || [],
        tasks: boardData.tasks || [],
        comments: boardData.board_comments || [],
        messages: boardData.board_messages || [],
        stats: {
          total_tasks: boardData.total_tasks || 0,
          total_columns: boardData.total_columns || 0,
          total_comments: boardData.total_comments || 0,
          total_messages: boardData.total_messages || 0
        }
      };



      // Resposta livre da IA baseada no contexto do board
      let response = '';
      
      // Análise inteligente da mensagem do usuário
      const message = userMessage.toLowerCase();
      
      // Informações disponíveis do board
      const taskCount = boardContext.statistics.total_tasks;
      const columnCount = boardContext.statistics.total_columns;
      const commentCount = boardContext.statistics.total_comments;
      const messageCount = boardContext.statistics.total_messages;
      
      // Resposta contextual e livre
      if (message.includes('tarefas') || message.includes('tasks') || message.includes('task')) {
        const highPriorityTasks = boardContext.tasks.filter(t => t.prioridade === 'alta').length;
        const tasksByColumn = boardContext.columns.map(col => ({
          name: col.titulo,
          count: boardContext.tasks.filter(t => t.column_id === col.id).length
        }));
        
        response = `📋 **Análise das Tarefas**\n\n`;
        response += `Temos **${taskCount} tarefas** neste projeto. `;
        
        if (highPriorityTasks > 0) {
          response += `Destaque para **${highPriorityTasks} tarefa${highPriorityTasks !== 1 ? 's' : ''} de alta prioridade** que merecem atenção especial.\n\n`;
        } else {
          response += `Nenhuma tarefa está marcada como alta prioridade no momento.\n\n`;
        }
        
        response += `📊 **Distribuição por coluna:**\n`;
        tasksByColumn.forEach(col => {
          response += `• **${col.name}**: ${col.count} tarefa${col.count !== 1 ? 's' : ''}\n`;
        });
        
        // Análise adicional
         const completedTasks = boardContext.tasks.filter(t => 
           t.column_title && (t.column_title.toLowerCase().includes('concluí') || 
           t.column_title.toLowerCase().includes('finaliz') || 
           t.column_title.toLowerCase().includes('done'))
         ).length;
        
        if (completedTasks > 0) {
          response += `\n✅ **${completedTasks} tarefa${completedTasks !== 1 ? 's já foram' : ' já foi'} concluída${completedTasks !== 1 ? 's' : ''}!**`;
        }
        
      } else if (message.includes('responsável') || message.includes('responsible') || message.includes('quem')) {
        const responsibles = [...new Set(boardContext.tasks.map(t => t.users?.nome || 'Não atribuído').filter(r => r && r !== 'Não atribuído'))];
        response = `👥 **Equipe e Responsabilidades**\n\n`;
        
        if (responsibles.length > 0) {
          response += `Temos **${responsibles.length} pessoa${responsibles.length !== 1 ? 's' : ''}** trabalhando neste projeto:\n\n`;
          responsibles.forEach(resp => {
            const userTasks = boardContext.tasks.filter(t => t.users?.nome === resp);
            const taskCount = userTasks.length;
            response += `👤 **${resp}**: ${taskCount} tarefa${taskCount !== 1 ? 's' : ''}\n`;
            
            // Mostrar algumas tarefas
            if (userTasks.length > 0) {
              const sampleTasks = userTasks.slice(0, 2);
              sampleTasks.forEach(task => {
                response += `   • ${task.titulo}\n`;
              });
              if (userTasks.length > 2) {
                response += `   • ... e mais ${userTasks.length - 2} tarefa${userTasks.length - 2 !== 1 ? 's' : ''}\n`;
              }
            }
            response += `\n`;
          });
        } else {
          response += `Ainda não há responsáveis definidos para as tarefas. É uma boa hora para organizar a equipe! 🎯`;
        }
        
      } else if (message.includes('prazo') || message.includes('entrega') || message.includes('deadline') || message.includes('quando')) {
        const tasksWithDueDate = boardContext.tasks.filter(t => t.data_entrega);
        const now = new Date();
        const overdueTasks = tasksWithDueDate.filter(t => new Date(t.data_entrega) < now);
        const upcomingTasks = tasksWithDueDate.filter(t => {
          const dueDate = new Date(t.data_entrega);
          const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
          return diffDays >= 0 && diffDays <= 7;
        });
        
        response = `⏰ **Gestão de Prazos**\n\n`;
        
        if (overdueTasks.length > 0) {
          response += `🚨 **ATENÇÃO**: ${overdueTasks.length} tarefa${overdueTasks.length !== 1 ? 's estão' : ' está'} atrasada${overdueTasks.length !== 1 ? 's' : ''}:\n`;
          overdueTasks.forEach(task => {
            const daysLate = Math.ceil((now.getTime() - new Date(task.data_entrega).getTime()) / (1000 * 3600 * 24));
            response += `🔴 **${task.titulo}** - ${daysLate} dia${daysLate !== 1 ? 's' : ''} de atraso\n`;
          });
          response += `\n`;
        }
        
        if (upcomingTasks.length > 0) {
          response += `📅 **Próximos prazos (7 dias):**\n`;
          upcomingTasks.forEach(task => {
            const dueDate = new Date(task.data_entrega);
            const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
            response += `🟡 **${task.titulo}** - ${diffDays === 0 ? 'hoje' : `${diffDays} dia${diffDays !== 1 ? 's' : ''}`}\n`;
          });
        } else if (overdueTasks.length === 0) {
          response += `✅ Ótimas notícias! Não há prazos urgentes nos próximos 7 dias.`;
        }
        
      } else if (message.includes('comentário') || message.includes('comment') || message.includes('conversa') || message.includes('discussão')) {
        response = `💬 **Atividade e Discussões**\n\n`;
        response += `Há **${commentCount} comentário${commentCount !== 1 ? 's' : ''}** e **${messageCount} mensagem${messageCount !== 1 ? 's' : ''}** neste projeto.\n\n`;
        
        if (boardContext.comments && boardContext.comments.length > 0) {
          response += `📝 **Últimas discussões:**\n\n`;
          const recentComments = boardContext.comments.slice(-3);
          recentComments.forEach(comment => {
            const date = new Date(comment.created_at).toLocaleDateString();
            response += `💭 **${comment.author_name}** (${date}):\n"${comment.content}"\n\n`;
          });
          
          if (boardContext.comments.length > 3) {
            response += `... e mais ${boardContext.comments.length - 3} comentário${boardContext.comments.length - 3 !== 1 ? 's' : ''} anterior${boardContext.comments.length - 3 !== 1 ? 'es' : ''}.`;
          }
        } else {
          response += `Ainda não há comentários. Que tal começar uma discussão sobre o projeto? 🗣️`;
        }
        
      } else if (message.includes('resumo') || message.includes('overview') || message.includes('geral') || message.includes('status')) {
        response = `🎯 **Visão Geral do Projeto**\n\n`;
        response += `📋 **${boardContext.board.title}**\n`;
        if (boardContext.board.description) {
          response += `📝 ${boardContext.board.description}\n\n`;
        }
        
        response += `📊 **Números do projeto:**\n`;
        response += `• ${boardContext.stats.total_tasks} tarefas em ${boardContext.stats.total_columns} colunas\n`;
        response += `• ${boardContext.stats.total_comments} comentários da equipe\n`;
        response += `• ${boardContext.stats.total_messages} mensagens no chat\n\n`;
        
        // Análise de progresso
        const totalTasks = boardContext.tasks.length;
        if (totalTasks > 0) {
          const completedColumn = boardContext.columns.find(col => 
            col.titulo.toLowerCase().includes('concluí') || 
            col.titulo.toLowerCase().includes('finaliz') || 
            col.titulo.toLowerCase().includes('done')
          );
          
          if (completedColumn) {
            const completedTasks = boardContext.tasks.filter(t => t.column_id === completedColumn.id).length;
            const progress = Math.round((completedTasks / totalTasks) * 100);
            response += `📈 **Progresso**: ${progress}% concluído (${completedTasks}/${totalTasks} tarefas)\n\n`;
          }
        }
        
        response += `👤 **Criado por**: ${boardContext.board.owner}\n`;
        response += `📅 **Data de criação**: ${new Date(boardContext.board.created_at).toLocaleDateString()}`;
        
      } else if (message.includes('ajuda') || message.includes('help') || message.includes('o que') || message.includes('como')) {
        response = `🤖 **Assistente IA do Board**\n\n`;
        response += `Olá! Sou seu assistente inteligente e posso ajudar com qualquer coisa sobre este projeto.\n\n`;
        response += `💡 **Algumas coisas que posso fazer:**\n`;
        response += `• Analisar tarefas e responsabilidades\n`;
        response += `• Verificar prazos e deadlines\n`;
        response += `• Resumir discussões e comentários\n`;
        response += `• Dar visão geral do progresso\n`;
        response += `• Responder qualquer pergunta sobre o board\n\n`;
        response += `🗣️ **Fale naturalmente comigo!** Pergunte qualquer coisa sobre:\n`;
        response += `"Qual tarefa é mais complexa?", "Quem está responsável por X?", "Como está o progresso?", etc.\n\n`;
        response += `📋 **Sobre este projeto**: ${boardContext.stats.total_tasks} tarefas, ${boardContext.stats.total_columns} colunas, ${boardContext.stats.total_comments} comentários`;
        
      } else {
        // Resposta livre e contextual para qualquer pergunta
        response = `🤔 Entendi sua pergunta sobre: "${userMessage}"\n\n`;
        
        // Tentar dar uma resposta contextual baseada no conteúdo do board
        if (boardContext.tasks.length > 0) {
          response += `Com base no que vejo neste projeto:\n\n`;
          response += `📋 Temos **${boardContext.stats.total_tasks} tarefas** distribuídas em **${boardContext.stats.total_columns} colunas**\n`;
          
          if (boardContext.tasks.some(t => t.prioridade === 'alta')) {
            response += `⚡ Algumas tarefas têm **prioridade alta** e merecem atenção\n`;
          }
          
          if (boardContext.stats.total_comments > 0) {
            response += `💬 A equipe está ativa com **${boardContext.stats.total_comments} comentário${boardContext.stats.total_comments !== 1 ? 's' : ''}**\n`;
          }
          
          response += `\n👥 A equipe também pode responder questões mais específicas.\n\n`;
          response += `💬 Como posso ajudar você melhor?\n\n`;
          
          // Mostrar contexto das conversas recentes se houver
          if (boardContext.messages && boardContext.messages.length > 0) {
            const recentTopics = boardContext.messages.slice(-3).map(m => m.content.substring(0, 50)).join(', ');
            response += `💭 Baseado em nossas conversas recentes sobre: ${recentTopics}`;
          }
        } else {
          response += `Este projeto ainda está sendo configurado. Que tal começarmos criando algumas tarefas? 🚀`;
        }
      }

      return response;
    } catch (error) {
      console.error('Erro ao gerar resposta da IA:', error);
      return 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.';
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Salvar mensagem do usuário no banco
    await saveMessage(inputValue, 'user');
    
    setInputValue('');
    setIsLoading(true);

    try {
      const boardData = await getBoardData();
      const aiResponse = await generateAIResponse(inputValue, boardData);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Salvar resposta da IA no banco
      await saveMessage(aiResponse, 'ai');
      
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível processar sua mensagem.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 rounded-full w-14 h-14 shadow-lg z-50"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card className={`fixed bottom-4 right-4 w-96 shadow-xl z-50 transition-all duration-300 ${
      isMinimized ? 'h-14' : 'h-[500px]'
    }`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer" 
                  onClick={() => setIsMinimized(!isMinimized)}>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          IA Assistente
        </CardTitle>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
          >
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex flex-col h-[420px] p-4">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="w-12 h-12 mx-auto mb-4 text-primary/50" />
                  <p>Olá! Sou a IA assistente deste board.</p>
                  <p className="text-sm">Pergunte sobre tarefas, responsáveis, prazos ou qualquer coisa relacionada ao projeto!</p>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  
                  {message.sender === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          <div className="flex gap-2 mt-4">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua pergunta..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
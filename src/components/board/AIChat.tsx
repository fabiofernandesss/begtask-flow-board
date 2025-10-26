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

  const getBoardData = async () => {
    try {
      const { data, error } = await supabase
        .from('board_ai_view')
        .select('*')
        .eq('board_id', boardId)
        .single();

      if (error) throw error;
      return data;
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

      // Os dados já vêm estruturados da view board_ai_view
      const boardContext = {
        board: {
          title: boardData.board_title,
          description: boardData.board_description,
          owner: boardData.owner_name,
          created_at: boardData.board_created_at,
          is_public: boardData.is_public
        },
        columns: boardData.columns || [],
        tasks: boardData.tasks || [],
        comments: boardData.board_comments || [],
        messages: boardData.board_messages || [],
        statistics: {
          total_tasks: boardData.total_tasks || 0,
          total_columns: boardData.total_columns || 0,
          total_comments: boardData.total_comments || 0,
          total_messages: boardData.total_messages || 0
        }
      };

      // Simular resposta da IA baseada no contexto estruturado
      let response = '';
      
      if (userMessage.toLowerCase().includes('tarefas') || userMessage.toLowerCase().includes('tasks')) {
        const taskCount = boardContext.statistics.total_tasks;
        const highPriorityTasks = boardContext.tasks.filter(t => t.priority === 'alta').length;
        const tasksByColumn = boardContext.columns.map(col => ({
          name: col.title,
          count: boardContext.tasks.filter(t => t.column_id === col.id).length
        }));
        
        response = `📋 **Resumo das Tarefas**\n\n`;
        response += `Este board possui **${taskCount} tarefas** no total.\n\n`;
        response += `📊 **Distribuição por coluna:**\n\n`;
        tasksByColumn.forEach(col => {
          response += `🟢 **${col.name}**: ${col.count} tarefa${col.count !== 1 ? 's' : ''}\n`;
        });
        if (highPriorityTasks > 0) {
          response += `\n⚡ **${highPriorityTasks} tarefa${highPriorityTasks !== 1 ? 's' : ''} com prioridade alta**`;
        }
        response += `\n\n💡 *Clique nas tarefas para ver mais detalhes!*`;
        
      } else if (userMessage.toLowerCase().includes('responsável') || userMessage.toLowerCase().includes('responsible')) {
        const responsibles = [...new Set(boardContext.tasks.map(t => t.responsible).filter(r => r && r !== 'Não atribuído'))];
        response = `👥 **Responsáveis pelas tarefas:**\n\n`;
        if (responsibles.length > 0) {
          responsibles.forEach(resp => {
            const taskCount = boardContext.tasks.filter(t => t.responsible === resp).length;
            response += `• **${resp}**: ${taskCount} tarefa${taskCount !== 1 ? 's' : ''}\n`;
          });
        } else {
          response += `Nenhum responsável foi definido para as tarefas.`;
        }
        
      } else if (userMessage.toLowerCase().includes('prazo') || userMessage.toLowerCase().includes('entrega')) {
        const tasksWithDueDate = boardContext.tasks.filter(t => t.due_date);
        response = `⏰ **Status dos Prazos**\n\n`;
        if (tasksWithDueDate.length > 0) {
          response += `${tasksWithDueDate.length} tarefa${tasksWithDueDate.length !== 1 ? 's têm' : ' tem'} prazo definido:\n\n`;
          tasksWithDueDate.forEach(task => {
            const dueDate = new Date(task.due_date);
            const isOverdue = dueDate < new Date();
            response += `${isOverdue ? '🔴' : '🟡'} **${task.title}**: ${dueDate.toLocaleDateString()}\n`;
          });
        } else {
          response += `✅ Não há tarefas atrasadas no momento.\n\n💡 *Clique nas tarefas individuais para verificar os prazos.*`;
        }
        
      } else if (userMessage.toLowerCase().includes('comentários') || userMessage.toLowerCase().includes('comments')) {
        const commentCount = boardContext.statistics.total_comments;
        response = `💬 **Comentários do Board**\n\n`;
        response += `Há **${commentCount} comentário${commentCount !== 1 ? 's' : ''}** neste board.\n\n`;
        if (boardContext.comments.length > 0) {
          response += `📝 **Últimos comentários:**\n\n`;
          boardContext.comments.slice(-3).forEach(comment => {
            const date = new Date(comment.created_at).toLocaleDateString();
            response += `• **${comment.author}** (${date}): "${comment.content}"\n`;
          });
        }
        
      } else if (userMessage.toLowerCase().includes('resumo') || userMessage.toLowerCase().includes('overview')) {
        response = `🎯 **Resumo do Board**\n\n`;
        response += `📋 Este board possui **${boardContext.statistics.total_tasks} tarefas** no total.\n\n`;
        response += `📊 **Distribuição por coluna:**\n\n`;
        boardContext.columns.forEach(col => {
          const taskCount = boardContext.tasks.filter(t => t.column_id === col.id).length;
          response += `🟢 **${col.title}**: ${taskCount} tarefa${taskCount !== 1 ? 's' : ''}\n`;
        });
        response += `\n💡 *Clique nas tarefas para ver mais detalhes!*`;
        
      } else if (userMessage.toLowerCase().includes('projeto') || userMessage.toLowerCase().includes('board')) {
        response = `🏗️ **Sobre o Projeto**\n\n`;
        response += `📋 **${boardContext.board.title}**\n`;
        response += `📝 ${boardContext.board.description}\n\n`;
        response += `👤 **Proprietário:** ${boardContext.board.owner}\n`;
        response += `🌐 **Tipo:** ${boardContext.board.is_public ? 'Público' : 'Privado'}\n`;
        response += `📅 **Criado em:** ${new Date(boardContext.board.created_at).toLocaleDateString()}\n\n`;
        response += `📊 **Estatísticas:**\n`;
        response += `• ${boardContext.statistics.total_tasks} tarefas\n`;
        response += `• ${boardContext.statistics.total_columns} colunas\n`;
        response += `• ${boardContext.statistics.total_comments} comentários\n`;
        response += `• ${boardContext.statistics.total_messages} mensagens no chat`;
        
      } else {
        response = `👋 **Olá! Sou a IA assistente deste board.**\n\n`;
        response += `🎯 **Sobre este board:**\n`;
        response += `📋 **${boardContext.statistics.total_tasks} tarefas** distribuídas em **${boardContext.statistics.total_columns} colunas**\n\n`;
        response += `🤖 Estou aqui para ajudar com qualquer dúvida sobre o projeto!\n\n`;
        response += `💬 *O que você gostaria de saber?*`;
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
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Bot, User, X, Minimize2, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

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

  useEffect(() => {
    if (isOpen && boardId) {
      loadMessages();
    }
  }, [isOpen, boardId]);

  const loadMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('board_messages')
        .select('id, message_content, sender_type, sender_name, created_at')
        .eq('board_id', boardId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao carregar mensagens:', error);
        return;
      }

      if (messagesData) {
        const formattedMessages: Message[] = messagesData.map((msg: any) => ({
          id: msg.id,
          content: msg.message_content,
          sender: msg.sender_type === 'ai' ? 'ai' : 'user',
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
          sender_type: senderType,
          sender_name: senderType === 'user' ? 'Usuário' : 'AI Brain',
          message_content: content,
          is_public: false
        });

      if (error) {
        console.error('Erro ao salvar mensagem:', error);
      }
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
    }
  };

  const getBoardContext = async () => {
    try {
      const { data: boardData } = await supabase
        .from('boards')
        .select('id, titulo, descricao, created_at, publico')
        .eq('id', boardId)
        .single();

      const { data: columnsData } = await supabase
        .from('columns')
        .select('id, titulo, posicao, cor')
        .eq('board_id', boardId)
        .order('posicao');

      const columnIds = columnsData?.map(c => c.id) || [];

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, titulo, descricao, prioridade, data_entrega, column_id, created_at, responsavel_id')
        .in('column_id', columnIds.length > 0 ? columnIds : ['none']);

      const { data: commentsData } = await supabase
        .from('board_comments')
        .select('id, author_name, content, created_at')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false })
        .limit(10);

      const tasksWithColumns = tasksData?.map((task: any) => {
        const col = columnsData?.find(c => c.id === task.column_id);
        return { ...task, column_title: col?.titulo || '' };
      }) || [];

      return {
        board: boardData,
        columns: columnsData || [],
        tasks: tasksWithColumns,
        comments: commentsData || [],
        stats: {
          total_tasks: tasksData?.length || 0,
          total_columns: columnsData?.length || 0,
          total_comments: commentsData?.length || 0,
          high_priority: tasksData?.filter((t: any) => t.prioridade === 'alta').length || 0,
          overdue: tasksData?.filter((t: any) => t.data_entrega && new Date(t.data_entrega) < new Date()).length || 0,
        }
      };
    } catch (error) {
      console.error('Erro ao buscar contexto:', error);
      return null;
    }
  };

  const streamDeepSeekResponse = async (
    chatMessages: { role: string; content: string }[],
    boardContext: any,
    onDelta: (text: string) => void,
    onDone: () => void
  ) => {
    const { data, error } = await supabase.functions.invoke('deepseek-chat', {
      body: { messages: chatMessages, boardContext },
    });

    if (error) {
      throw new Error(error.message || 'Erro ao chamar AI Brain');
    }

    // data is a Blob when streaming - convert to ReadableStream
    if (data instanceof Blob) {
      const text = await data.text();
      // Parse SSE lines
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore parse errors */ }
      }
      onDone();
      return;
    }

    // Fallback: if data has a body (ReadableStream)
    const reader = (data as Response).body?.getReader();
    if (!reader) {
      // data might be plain JSON (non-streaming response)
      if (typeof data === 'object' && data.choices) {
        const content = data.choices[0]?.message?.content;
        if (content) onDelta(content);
      }
      onDone();
      return;
    }

    const decoder = new TextDecoder();
    let textBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
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
    await saveMessage(inputValue, 'user');
    
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const boardContext = await getBoardContext();

      // Build conversation history for DeepSeek
      const chatHistory = messages.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content
      }));
      chatHistory.push({ role: 'user', content: currentInput });

      let assistantSoFar = "";
      const assistantId = (Date.now() + 1).toString();

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.sender === 'ai' && last.id === assistantId) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { id: assistantId, content: assistantSoFar, sender: 'ai', timestamp: new Date() }];
        });
      };

      await streamDeepSeekResponse(
        chatHistory,
        boardContext,
        (chunk) => upsertAssistant(chunk),
        async () => {
          await saveMessage(assistantSoFar, 'ai');
          setIsLoading(false);
        }
      );
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível processar sua mensagem.",
        variant: "destructive"
      });
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
          AI Brain
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
                  <p className="font-medium">AI Brain</p>
                  <p className="text-sm mt-1">Converse comigo sobre o projeto! Posso analisar tarefas, prazos, progresso e muito mais.</p>
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
                    {message.sender === 'ai' ? (
                      <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
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
              
              {isLoading && messages[messages.length - 1]?.sender !== 'ai' && (
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
              placeholder="Pergunte ao AI Brain..."
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

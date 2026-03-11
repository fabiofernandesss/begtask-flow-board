import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, SendIcon, X, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface BegIAChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardTitle?: string;
  columns?: any[];
  teamMembers?: any[];
}

function useAutoResizeTextarea({ minHeight, maxHeight }: { minHeight: number; maxHeight?: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback((reset?: boolean) => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (reset) { ta.style.height = `${minHeight}px`; return; }
    ta.style.height = `${minHeight}px`;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight ?? Infinity)}px`;
  }, [minHeight, maxHeight]);
  return { textareaRef, adjustHeight };
}

function TypingDots() {
  return (
    <div className="flex items-center ml-1">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="w-1.5 h-1.5 rounded-full mx-0.5"
          style={{ backgroundColor: 'hsl(var(--primary))' }}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

const SUGGESTIONS = [
  { label: 'Resumo do projeto', prompt: 'Faça um resumo completo do projeto, incluindo progresso, tarefas pendentes e próximos passos.' },
  { label: 'Tarefas atrasadas', prompt: 'Quais tarefas estão atrasadas ou com prazo próximo?' },
  { label: 'Sugestões de melhoria', prompt: 'Sugira melhorias para a organização e produtividade do projeto.' },
  { label: 'Análise de prioridades', prompt: 'Analise as prioridades das tarefas e sugira reordenação se necessário.' },
];

export const BegIAChat: React.FC<BegIAChatProps> = ({
  open, onOpenChange, boardId, boardTitle, columns = [], teamMembers = [],
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 48, maxHeight: 160 });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getBoardContext = () => ({
    titulo: boardTitle,
    colunas: columns.map((col: any) => ({
      titulo: col.titulo,
      tarefas: col.tasks?.map((t: any) => ({
        titulo: t.titulo,
        descricao: t.descricao,
        prioridade: t.prioridade,
        data_entrega: t.data_entrega,
      })) || [],
    })),
    membros: teamMembers.map((m: any) => ({ nome: m.nome })),
    stats: {
      total_tasks: columns.reduce((sum: number, c: any) => sum + (c.tasks?.length || 0), 0),
      total_columns: columns.length,
      high_priority: columns.reduce((sum: number, c: any) => sum + (c.tasks?.filter((t: any) => t.prioridade === 'alta').length || 0), 0),
      overdue: columns.reduce((sum: number, c: any) => sum + (c.tasks?.filter((t: any) => t.data_entrega && new Date(t.data_entrega) < new Date()).length || 0), 0),
    },
  });

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), content: text.trim(), role: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setValue('');
    adjustHeight(true);
    setIsLoading(true);

    try {
      const chatHistory = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const boardContext = getBoardContext();

      const { data, error } = await supabase.functions.invoke('deepseek-chat', {
        body: { messages: chatHistory, boardContext },
      });

      if (error) throw new Error(error.message || 'Erro ao chamar Beg IA');

      let assistantText = '';
      const assistantId = (Date.now() + 1).toString();

      const upsert = (chunk: string) => {
        assistantText += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.id === assistantId) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantText } : m);
          }
          return [...prev, { id: assistantId, content: assistantText, role: 'assistant', timestamp: new Date() }];
        });
      };

      if (data instanceof Blob) {
        const text = await data.text();
        // Check if it's an error JSON
        try {
          const errorJson = JSON.parse(text);
          if (errorJson.error) throw new Error(errorJson.error);
        } catch (e) {
          if (e instanceof SyntaxError) { /* not JSON, continue parsing SSE */ } else throw e;
        }
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch { /* skip */ }
        }
      } else if (typeof data === 'object' && data?.choices) {
        const content = data.choices[0]?.message?.content;
        if (content) upsert(content);
      }

      if (!assistantText) {
        upsert('Desculpe, não consegui gerar uma resposta no momento.');
      }
    } catch (err: any) {
      console.error('Beg IA error:', err);
      toast({ title: 'Erro', description: err.message || 'Falha ao processar mensagem.', variant: 'destructive' });
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        content: 'Desculpe, ocorreu um erro. Tente novamente.',
        role: 'assistant',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[85vh] max-h-[700px] flex flex-col p-0 gap-0 overflow-hidden bg-background border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Beg IA</h2>
              <p className="text-xs text-muted-foreground">{boardTitle || 'Assistente do projeto'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setMessages([])}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <motion.div
              className="flex flex-col items-center justify-center h-full text-center space-y-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
                <Sparkles className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <div>
                <h3 className="text-lg font-medium text-foreground">Como posso ajudar?</h3>
                <p className="text-sm text-muted-foreground mt-1">Pergunte sobre tarefas, prazos, progresso ou peça sugestões</p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    onClick={() => sendMessage(s.prompt)}
                    className="text-left px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
                        <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[80%] rounded-xl px-4 py-2.5',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert [&>p]:mb-1.5 [&>ul]:mt-1 [&>ol]:mt-1">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-3 justify-start"
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(var(--primary))' }} />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Pensando</span>
                    <TypingDots />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/30 p-2 focus-within:border-primary/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte ao Beg IA..."
              disabled={isLoading}
              className="flex-1 bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none px-2 py-1.5"
              style={{ minHeight: 32, maxHeight: 120 }}
            />
            <Button
              onClick={() => sendMessage(value)}
              disabled={!value.trim() || isLoading}
              size="sm"
              className="h-8 w-8 rounded-lg p-0 shrink-0"
            >
              <SendIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

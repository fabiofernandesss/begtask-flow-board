import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SendIcon, Sparkles, Trash2, X } from 'lucide-react';
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
          className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.9, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.15, ease: 'easeInOut' }}
          style={{ boxShadow: '0 0 4px rgba(255, 255, 255, 0.3)' }}
        />
      ))}
    </div>
  );
}

const SUGGESTIONS = [
  { label: '📊 Resumo do projeto', prompt: 'Faça um resumo completo do projeto, incluindo progresso, tarefas pendentes e próximos passos.' },
  { label: '⏰ Tarefas atrasadas', prompt: 'Quais tarefas estão atrasadas ou com prazo próximo?' },
  { label: '💡 Sugestões de melhoria', prompt: 'Sugira melhorias para a organização e produtividade do projeto.' },
  { label: '🎯 Análise de prioridades', prompt: 'Analise as prioridades das tarefas e sugira reordenação se necessário.' },
];

export const BegIAChat: React.FC<BegIAChatProps> = ({
  open, onOpenChange, boardId, boardTitle, columns = [], teamMembers = [],
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 40, maxHeight: 140 });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getBoardContext = () => ({
    titulo: boardTitle,
    colunas: columns.map((col: any) => ({
      titulo: col.titulo,
      tarefas: col.tasks?.map((t: any) => ({
        titulo: t.titulo, descricao: t.descricao, prioridade: t.prioridade, data_entrega: t.data_entrega,
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
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(`${supabaseUrl}/functions/v1/deepseek-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify({ messages: chatHistory, boardContext }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        let errMsg = `Erro ${resp.status}`;
        try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
        throw new Error(errMsg);
      }

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

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('Stream indisponível');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {}
        }
      }
      if (!assistantText) upsert('Desculpe, não consegui gerar uma resposta no momento.');
    } catch (err: any) {
      console.error('Beg IA error:', err);
      toast({ title: 'Erro', description: err.message || 'Falha ao processar mensagem.', variant: 'destructive' });
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), content: 'Desculpe, ocorreu um erro. Tente novamente.', role: 'assistant', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(value); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] h-[85vh] max-h-[720px] flex flex-col p-0 gap-0 overflow-hidden border-0 bg-[#0a0a0f] text-white shadow-2xl shadow-primary/5 [&>button]:hidden">
        
        {/* Ambient background blurs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-primary/8 rounded-full blur-[100px]" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-indigo-500/8 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-violet-500/5 rounded-full blur-[80px]" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-indigo-500/30 flex items-center justify-center backdrop-blur-sm border border-white/[0.08]">
              <Sparkles className="w-4 h-4 text-white/90" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/90 tracking-tight">Beg IA</h2>
              <p className="text-[11px] text-white/30">{boardTitle || 'Assistente do projeto'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setMessages([])}
                className="p-1.5 rounded-md text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all"
                title="Limpar conversa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* Messages */}
        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-white/10">
          {messages.length === 0 ? (
            <motion.div
              className="flex flex-col items-center justify-center h-full text-center space-y-8"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center backdrop-blur-sm border border-white/[0.06]"
                >
                  <Sparkles className="w-7 h-7 text-white/70" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40">
                    Como posso ajudar?
                  </h3>
                  <motion.div 
                    className="h-px mx-auto mt-2 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                    initial={{ width: 0 }}
                    animate={{ width: '60%' }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                  />
                  <p className="text-xs text-white/30 mt-3">Pergunte sobre tarefas, prazos ou peça sugestões</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {SUGGESTIONS.map((s, i) => (
                  <motion.button
                    key={i}
                    onClick={() => sendMessage(s.prompt)}
                    className="text-left px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all backdrop-blur-sm"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
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
                    transition={{ duration: 0.25 }}
                    className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/25 to-indigo-500/25 flex items-center justify-center flex-shrink-0 mt-0.5 border border-white/[0.06]">
                        <Sparkles className="w-3 h-3 text-white/70" />
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[80%] rounded-xl px-3.5 py-2.5',
                      msg.role === 'user'
                        ? 'bg-primary/90 text-white'
                        : 'bg-white/[0.04] border border-white/[0.06] text-white/80'
                    )}>
                      {msg.role === 'assistant' ? (
                        <div className="text-sm prose prose-sm max-w-none prose-invert prose-p:text-white/80 prose-strong:text-white/90 prose-li:text-white/70 [&>p]:mb-1.5 [&>ul]:mt-1 [&>ol]:mt-1 prose-headings:text-white/90">
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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 justify-start">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/25 to-indigo-500/25 flex items-center justify-center flex-shrink-0 border border-white/[0.06]">
                    <Sparkles className="w-3 h-3 text-white/70" />
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <span className="text-xs text-white/40">Pensando</span>
                    <TypingDots />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="relative z-10 border-t border-white/[0.06] p-4">
          <motion.div
            className="flex items-end gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 backdrop-blur-sm focus-within:border-primary/30 transition-colors"
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => { setValue(e.target.value); adjustHeight(); }}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte ao Beg IA..."
              disabled={isLoading}
              className="flex-1 bg-transparent border-none text-sm text-white/90 placeholder:text-white/20 resize-none focus:outline-none px-2 py-1.5"
              style={{ minHeight: 32, maxHeight: 120 }}
            />
            <motion.button
              onClick={() => sendMessage(value)}
              disabled={!value.trim() || isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className={cn(
                "h-8 px-3 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0",
                value.trim()
                  ? "bg-white text-[#0a0a0f] shadow-lg shadow-white/10"
                  : "bg-white/[0.06] text-white/30"
              )}
            >
              <SendIcon className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </motion.button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Mic, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { geminiService } from "@/services/geminiService";
import { Textarea } from "@/components/ui/textarea";

interface CreateColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  onColumnCreated: () => void;
}

const CreateColumnDialog = ({ open, onOpenChange, boardId, onColumnCreated }: CreateColumnDialogProps) => {
  const [titulo, setTitulo] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef<string>("");
  const baseBeforeRecordingRef = useRef<string>("");
  const { toast } = useToast();

  // Limpa reconhecimento ao fechar modal
  useEffect(() => {
    if (!open && isRecording) {
      try { stopRecording(); } catch {}
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    setLoading(true);
    try {
      const { data: existingColumns } = await supabase
        .from("columns")
        .select("posicao")
        .eq("board_id", boardId)
        .order("posicao", { ascending: false })
        .limit(1);

      const nextPosition = existingColumns?.[0]?.posicao !== undefined 
        ? existingColumns[0].posicao + 1 
        : 0;

      const { error } = await supabase.from("columns").insert({
        board_id: boardId,
        titulo: titulo.trim(),
        posicao: nextPosition,
      });

      if (error) throw error;

      toast({ title: "Coluna criada com sucesso!" });
      setTitulo("");
      onColumnCreated();
    } catch (error: any) {
      toast({
        title: "Erro ao criar coluna",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    try {
      // Verificar autenticação antes de fazer a chamada
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Erro de autenticação: ${sessionError.message}`);
      }
      
      if (!session) {
        throw new Error("Usuário não autenticado. Faça login novamente.");
      }

      // Usar o novo serviço Gemini
      const response = await geminiService.generateBoardContent(aiPrompt, "columns_with_tasks");
      // Resultado bruto da IA
      const columnsWithTasks = (response.data || []) as any[];

      // Fallback: garantir presença de colunas padrão vazias
      // 'Em andamento' e 'Concluídas' devem existir e SEM tarefas
      const norm = (s: string) => (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      const isDefault = (t: string) => {
        const n = norm(t);
        return n === 'em andamento' || n === 'concluidas';
      };

      let result = Array.isArray(columnsWithTasks) ? [...columnsWithTasks] : [];

      // Se já existirem, forçar tasks: []
      result = result.map((col: any) => {
        if (isDefault(col?.titulo)) {
          return { ...col, tasks: [] };
        }
        return col;
      });

      // Definir quais defaults são desejados com base no total
      const desiredDefaults = (result.length >= 2)
        ? ['Em andamento', 'Concluídas']
        : ['Em andamento'];

      const present = new Set(result.map((c: any) => norm(c?.titulo)));
      const missing = desiredDefaults.filter((d) => !present.has(norm(d)));

      if (missing.length > 0) {
        // Tentar substituir de trás pra frente colunas não padrão
        let replaced = 0;
        for (let i = result.length - 1; i >= 0 && replaced < missing.length; i--) {
          const n = norm(result[i]?.titulo);
          if (n !== 'em andamento' && n !== 'concluidas') {
            result[i] = { titulo: missing[replaced], tasks: [] };
            replaced++;
          }
        }
        // Se ainda faltou incluir alguma (lista muito pequena), adiciona ao final
        for (let j = replaced; j < missing.length; j++) {
          // Evita duplicar se já foi substituída por coincidência
          if (!result.some((c: any) => norm(c?.titulo) === norm(missing[j]))) {
            result.push({ titulo: missing[j], tasks: [] });
          }
        }
      }
      
      const { data: existingColumns } = await supabase
        .from("columns")
        .select("posicao")
        .eq("board_id", boardId)
        .order("posicao", { ascending: false })
        .limit(1);

      let nextPosition = existingColumns?.[0]?.posicao !== undefined 
        ? existingColumns[0].posicao + 1 
        : 0;

      const columnColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
      
      // Criar colunas específicas do projeto com tarefas
      for (let i = 0; i < result.length; i++) {
        const col = result[i];
        const color = columnColors[i % columnColors.length];
        
        const { data: newColumn, error: colError } = await supabase
          .from("columns")
          .insert({
            board_id: boardId,
            titulo: col.titulo,
            posicao: nextPosition++,
            cor: color,
          })
          .select()
          .single();

        if (colError) throw colError;

        if (col.tasks && col.tasks.length > 0) {
          const tasksToInsert = col.tasks.map((task: any, idx: number) => ({
            column_id: newColumn.id,
            titulo: task.titulo,
            descricao: task.descricao || null,
            prioridade: task.prioridade || 'media',
            posicao: idx,
          }));

          const { error: tasksError } = await supabase
            .from("tasks")
            .insert(tasksToInsert);

          if (tasksError) throw tasksError;
        }
      }

      toast({ 
        title: "Quadro criado com IA!", 
        description: `${result.length} colunas de projeto foram criadas` 
      });
      setAiPrompt("");
      onColumnCreated();
    } catch (error: any) {
      console.error("Erro detalhado na geração de colunas com IA:", error);
      
      let errorMessage = error.message;
      
      // Verificar se é um erro de conectividade
      if (error.message?.includes("ERR_INTERNET_DISCONNECTED") || 
          error.message?.includes("Failed to fetch") ||
          error.message?.includes("NetworkError")) {
        errorMessage = "Erro de conectividade. Verifique sua conexão com a internet e tente novamente.";
      } else if (error.message?.includes("401") || error.message?.includes("Unauthorized")) {
        errorMessage = "Sessão expirada. Faça login novamente.";
      } else if (error.message?.includes("GEMINI_API_KEY")) {
        errorMessage = "Erro de configuração da IA. Contate o administrador.";
      }
      
      toast({
        title: "Erro ao gerar colunas com IA",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  // Reconhecimento de voz (Web Speech API)
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Reconhecimento de voz não suportado",
        description: "Seu navegador não suporta captura de voz. Use Chrome no desktop.",
        variant: "destructive",
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Salva o texto já digitado antes de começar a gravar
      baseBeforeRecordingRef.current = (aiPrompt || '').trim();
      finalTextRef.current = '';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) finalTextRef.current += transcript + ' ';
          else interim += transcript;
        }
        const base = baseBeforeRecordingRef.current;
        const recorded = (finalTextRef.current + interim).trim();
        const next = base ? `${base}\n${recorded}` : recorded;
        setAiPrompt(next);
      };

      recognition.onerror = (e: any) => {
        console.error('Speech error', e);
        toast({ title: 'Erro no áudio', description: 'Não foi possível processar o áudio.', variant: 'destructive' });
        setIsRecording(false);
      };

      recognition.onend = async () => {
        setIsRecording(false);
        // Correção de texto com IA
        try {
          const texto = (aiPrompt || '').trim();
          if (texto && texto.trim()) {
            const corrected = await geminiService.correctTranscription(texto.trim());
            if (corrected) setAiPrompt(corrected);
          }
        } catch (err: any) {
          console.error('Correção de transcrição falhou', err);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Erro ao iniciar reconhecimento', err);
      toast({ title: 'Erro ao acessar microfone', description: 'Verifique permissões do navegador.', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch {}
    }
    setIsRecording(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Coluna</DialogTitle>
          <DialogDescription>
            Adicione uma nova coluna ao seu quadro
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: A Fazer"
              required
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Coluna"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Ou use IA</span>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="ai-prompt">Descreva o que você precisa</Label>
          <div className="relative">
            <Textarea
              id="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: Projeto de desenvolvimento de software"
              rows={4}
              className="pr-10"
            />
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`absolute right-2 top-2 p-2 rounded-md transition-colors ${isRecording ? 'bg-destructive text-destructive-foreground' : 'bg-muted hover:bg-muted/80'}`}
              title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
              aria-label={isRecording ? 'Parar gravação' : 'Gravar áudio'}
              disabled={aiLoading}
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>
          <Button
            type="button"
            onClick={handleAIGenerate}
            disabled={aiLoading || !aiPrompt.trim()}
            className="w-full gap-2"
            variant="secondary"
          >
            {aiLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Gerar Colunas e Tarefas com IA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateColumnDialog;

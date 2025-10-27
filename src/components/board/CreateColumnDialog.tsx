import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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

      const { data, error } = await supabase.functions.invoke("generate-board-content", {
        body: { prompt: aiPrompt, type: "columns_with_tasks" },
      });

      if (error) throw error;

      const columnsWithTasks = data?.data || [];
      
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
      for (let i = 0; i < columnsWithTasks.length; i++) {
        const col = columnsWithTasks[i];
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

      // Removido: não adicionar colunas de status automaticamente para evitar duplicidade.
      // As colunas base serão tratadas pela função Edge quando necessário.

      toast({ 
        title: "Quadro criado com IA!", 
        description: `${columnsWithTasks.length} colunas de projeto foram criadas` 
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
          <Input
            id="ai-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ex: Projeto de desenvolvimento de software"
          />
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

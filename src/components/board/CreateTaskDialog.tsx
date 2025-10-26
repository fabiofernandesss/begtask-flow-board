import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string;
  onTaskCreated: () => void;
}

const CreateTaskDialog = ({ open, onOpenChange, columnId, onTaskCreated }: CreateTaskDialogProps) => {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"baixa" | "media" | "alta">("media");
  const [dataEntrega, setDataEntrega] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !columnId) return;

    setLoading(true);
    try {
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("posicao")
        .eq("column_id", columnId)
        .order("posicao", { ascending: false })
        .limit(1);

      const nextPosition = existingTasks?.[0]?.posicao !== undefined 
        ? existingTasks[0].posicao + 1 
        : 0;

      const { error } = await supabase.from("tasks").insert({
        column_id: columnId,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prioridade,
        data_entrega: dataEntrega || null,
        posicao: nextPosition,
      });

      if (error) throw error;

      toast({ title: "Tarefa criada com sucesso!" });
      setTitulo("");
      setDescricao("");
      setPrioridade("media");
      setDataEntrega("");
      onTaskCreated();
    } catch (error: any) {
      toast({
        title: "Erro ao criar tarefa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim() || !columnId) return;

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
        body: { prompt: aiPrompt, type: "tasks" },
      });

      if (error) throw error;

      const tasks = data?.data || [];
      
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("posicao")
        .eq("column_id", columnId)
        .order("posicao", { ascending: false })
        .limit(1);

      let nextPosition = existingTasks?.[0]?.posicao !== undefined 
        ? existingTasks[0].posicao + 1 
        : 0;

      for (const task of tasks) {
        await supabase.from("tasks").insert({
          column_id: columnId,
          titulo: task.titulo,
          descricao: task.descricao || null,
          prioridade: task.prioridade || "media",
          posicao: nextPosition++,
        });
      }

      toast({ 
        title: "Tarefas criadas com IA!", 
        description: `${tasks.length} tarefas foram geradas` 
      });
      setAiPrompt("");
      onTaskCreated();
    } catch (error: any) {
      console.error("Erro detalhado na geração de tarefas com IA:", error);
      
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
        title: "Erro ao gerar tarefas com IA",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription>
            Crie uma nova tarefa para esta coluna
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Digite o título da tarefa"
              required
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prioridade">Prioridade</Label>
              <Select value={prioridade} onValueChange={(v: any) => setPrioridade(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="data">Data de Entrega</Label>
              <Input
                id="data"
                type="date"
                value={dataEntrega}
                onChange={(e) => setDataEntrega(e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Tarefa"}
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
          <Label htmlFor="ai-prompt">Descreva as tarefas que você precisa</Label>
          <Input
            id="ai-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Ex: Tarefas para desenvolver uma landing page"
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
            Gerar Tarefas com IA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTaskDialog;

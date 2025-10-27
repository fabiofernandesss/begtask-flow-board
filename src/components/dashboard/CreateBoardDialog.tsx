import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBoardCreated: () => void;
}

const CreateBoardDialog = ({ open, onOpenChange, onBoardCreated }: CreateBoardDialogProps) => {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [publico, setPublico] = useState(false);
  const [senha, setSenha] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!titulo.trim()) {
      toast({
        title: "Título obrigatório",
        description: "Por favor, insira um título para o bloco.",
        variant: "destructive",
      });
      return;
    }

    if (!senha.trim()) {
      toast({
        title: "Senha obrigatória",
        description: "Por favor, defina uma senha para o bloco.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: newBoard, error } = await supabase.from("boards").insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        publico,
        senha_hash: senha, // Em produção, hash a senha no backend
        owner_id: user.id,
      }).select().single();

      if (error) throw error;

      // Criar colunas padrão automaticamente
      const defaultColumns = [
        { titulo: "Em andamento", posicao: 0, cor: "#3b82f6" },
        { titulo: "Concluídas", posicao: 1, cor: "#10b981" }
      ];

      const { error: columnsError } = await supabase.from("columns").insert(
        defaultColumns.map(col => ({
          ...col,
          board_id: newBoard.id
        }))
      );

      if (columnsError) {
        console.error("Erro ao criar colunas padrão:", columnsError);
        // Não falha a criação do board se as colunas falharem
      }

      toast({
        title: "Bloco criado!",
        description: "Seu bloco foi criado com sucesso.",
      });

      // Reset form
      setTitulo("");
      setDescricao("");
      setPublico(false);
      setSenha("");
      onBoardCreated();
    } catch (error: any) {
      toast({
        title: "Erro ao criar bloco",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Bloco</DialogTitle>
          <DialogDescription>
            Crie um novo bloco para organizar suas tarefas
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Nome do bloco"
                maxLength={100}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o propósito deste bloco (opcional)"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="senha">Senha *</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha para acessar o bloco"
              />
              <p className="text-xs text-muted-foreground">
                Esta senha será necessária para acessar o bloco
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="publico" className="cursor-pointer">
                  Bloco Público
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permitir acesso público com senha
                </p>
              </div>
              <Switch
                id="publico"
                checked={publico}
                onCheckedChange={setPublico}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={creating} className="gradient-primary">
              {creating ? "Criando..." : "Criar Bloco"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBoardDialog;

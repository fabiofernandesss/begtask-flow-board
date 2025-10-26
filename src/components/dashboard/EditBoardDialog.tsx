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
import { Copy, Eye, EyeOff } from "lucide-react";

interface EditBoardDialogProps {
  board: {
    id: string;
    titulo: string;
    descricao: string | null;
    publico: boolean;
    senha_hash: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const EditBoardDialog = ({ board, open, onOpenChange, onUpdated }: EditBoardDialogProps) => {
  const [titulo, setTitulo] = useState(board.titulo);
  const [descricao, setDescricao] = useState(board.descricao || "");
  const [publico, setPublico] = useState(board.publico);
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const boardUrl = publico 
    ? `${window.location.origin}/public/board/${board.id}`
    : `${window.location.origin}/board/${board.id}`;

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast({
        title: "Erro",
        description: "O título é obrigatório",
        variant: "destructive",
      });
      return;
    }

    if (publico && !senha.trim() && !board.senha_hash) {
      toast({
        title: "Erro",
        description: "A senha é obrigatória para boards públicos",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const updateData: any = { 
        titulo: titulo.trim(), 
        descricao: descricao.trim() || null,
        publico: publico
      };

      // Se uma nova senha foi fornecida, hash ela
      if (senha.trim()) {
        // Usando uma hash simples para demonstração - em produção, use bcrypt
        const hashedPassword = btoa(senha.trim());
        updateData.senha_hash = hashedPassword;
      }

      // Se o board não é mais público, remover a senha
      if (!publico) {
        updateData.senha_hash = null;
      }

      const { error } = await supabase
        .from("boards")
        .update(updateData)
        .eq("id", board.id);

      if (error) throw error;

      toast({
        title: "Bloco atualizado",
        description: "As alterações foram salvas com sucesso.",
      });
      onUpdated();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(boardUrl);
    toast({
      title: "Link copiado!",
      description: "O link do bloco foi copiado para a área de transferência.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Bloco</DialogTitle>
          <DialogDescription>
            Atualize as informações do bloco
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nome do bloco"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do bloco (opcional)"
              rows={3}
            />
          </div>
          
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="publico">Acesso Público</Label>
                <p className="text-xs text-muted-foreground">
                  Permitir que pessoas sem conta acessem este bloco
                </p>
              </div>
              <Switch
                id="publico"
                checked={publico}
                onCheckedChange={setPublico}
              />
            </div>
            
            {publico && (
              <div className="grid gap-2">
                <Label htmlFor="senha">Senha de Acesso</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder={board.senha_hash ? "Digite uma nova senha (opcional)" : "Digite a senha para acesso público"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {board.senha_hash && (
                  <p className="text-xs text-muted-foreground">
                    Uma senha já está configurada. Deixe em branco para manter a atual.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Link para Compartilhamento</Label>
            <div className="flex gap-2">
              <Input
                value={boardUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {publico 
                ? "Compartilhe este link. O acesso requer a senha do bloco."
                : "Este link só funciona para usuários logados com acesso ao bloco."
              }
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditBoardDialog;

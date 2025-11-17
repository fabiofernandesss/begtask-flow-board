import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Board {
  id: string;
  titulo: string;
  descricao: string | null;
}

interface ManageBoardAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export default function ManageBoardAccessDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: ManageBoardAccessDialogProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoards, setSelectedBoards] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchBoards();
      fetchUserAccess();
    }
  }, [open, userId]);

  const fetchBoards = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("boards")
        .select("id, titulo, descricao")
        .order("titulo");

      if (error) throw error;
      setBoards(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar blocos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserAccess = async () => {
    try {
      const { data, error } = await supabase
        .from("user_board_access")
        .select("board_id")
        .eq("user_id", userId);

      if (error) throw error;

      const boardIds = new Set(data?.map((item) => item.board_id) || []);
      setSelectedBoards(boardIds);
    } catch (error: any) {
      toast.error("Erro ao carregar acessos: " + error.message);
    }
  };

  const handleToggleBoard = (boardId: string) => {
    const newSelected = new Set(selectedBoards);
    if (newSelected.has(boardId)) {
      newSelected.delete(boardId);
    } else {
      newSelected.add(boardId);
    }
    setSelectedBoards(newSelected);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Buscar acessos atuais
      const { data: currentAccess, error: fetchError } = await supabase
        .from("user_board_access")
        .select("id, board_id")
        .eq("user_id", userId);

      if (fetchError) throw fetchError;

      const currentBoardIds = new Set(
        currentAccess?.map((item) => item.board_id) || []
      );

      // Determinar quais adicionar e quais remover
      const toAdd = Array.from(selectedBoards).filter(
        (id) => !currentBoardIds.has(id)
      );
      const toRemove = Array.from(currentBoardIds).filter(
        (id) => !selectedBoards.has(id)
      );

      // Remover acessos
      if (toRemove.length > 0) {
        const idsToDelete = currentAccess
          ?.filter((item) => toRemove.includes(item.board_id))
          .map((item) => item.id) || [];

        const { error: deleteError } = await supabase
          .from("user_board_access")
          .delete()
          .in("id", idsToDelete);

        if (deleteError) throw deleteError;
      }

      // Adicionar novos acessos
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("user_board_access")
          .insert(
            toAdd.map((boardId) => ({
              user_id: userId,
              board_id: boardId,
            }))
          );

        if (insertError) throw insertError;
      }

      toast.success("Acessos atualizados com sucesso!");
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar acessos: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Acessos de {userName}</DialogTitle>
          <DialogDescription>
            Selecione os blocos que este usuário pode acessar e gerenciar.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {boards.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum bloco encontrado
              </p>
            ) : (
              boards.map((board) => (
                <div
                  key={board.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    id={board.id}
                    checked={selectedBoards.has(board.id)}
                    onCheckedChange={() => handleToggleBoard(board.id)}
                  />
                  <label
                    htmlFor={board.id}
                    className="flex-1 cursor-pointer space-y-1"
                  >
                    <p className="font-medium leading-none">{board.titulo}</p>
                    {board.descricao && (
                      <p className="text-sm text-muted-foreground">
                        {board.descricao}
                      </p>
                    )}
                  </label>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

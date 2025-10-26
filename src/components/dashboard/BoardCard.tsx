import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Lock, Globe, Calendar, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EditBoardDialog from "./EditBoardDialog";
import { notificationService } from "@/services/notificationService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BoardCardProps {
  board: {
    id: string;
    titulo: string;
    descricao: string | null;
    created_at: string;
    publico: boolean;
    senha_hash: string | null;
  };
  viewMode: "grid" | "list";
  onDeleted: () => void;
}

interface TeamMember {
  id: string;
  nome: string;
  foto_perfil: string | null;
}

const BoardCard = ({ board, viewMode, onDeleted }: BoardCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Buscar dados do board e todas as tarefas antes de excluir
      const { data: boardData, error: boardError } = await supabase
        .from("boards")
        .select(`
          id,
          titulo,
          columns (
            id,
            titulo,
            tasks (
              id,
              titulo,
              responsavel_id
            )
          )
        `)
        .eq("id", board.id)
        .single();

      if (boardError) throw boardError;

      // Excluir o board (colunas e tarefas serão excluídas em cascata)
      const { error } = await supabase
        .from("boards")
        .delete()
        .eq("id", board.id);

      if (error) throw error;

      // Enviar notificações WhatsApp para todos os responsáveis das tarefas
      if (boardData?.columns && boardData.columns.length > 0) {
        const allTasks = boardData.columns.flatMap(column => column.tasks || []);
        const tasksWithResponsaveis = allTasks.filter(task => task.responsavel_id);
        
        const notificationPromises = tasksWithResponsaveis.map(async (task) => {
          try {
            // Buscar dados do responsável
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("nome, telefone")
              .eq("id", task.responsavel_id)
              .single();

            const { data: userEmail } = await supabase
              .rpc('get_user_email', { user_id: task.responsavel_id });
            
            if (!profileError && profileData && (profileData.telefone || userEmail)) {
              await notificationService.notifyBoardDeleted(
                profileData.nome,
                profileData.telefone,
                userEmail || '',
                boardData.titulo,
                task.titulo
              );
            }
          } catch (whatsappError) {
            console.error("Erro ao enviar notificação WhatsApp:", whatsappError);
            // Não falha a operação principal se o WhatsApp falhar
          }
        });

        // Executar todas as notificações em paralelo
        await Promise.allSettled(notificationPromises);
      }

      toast({
        title: "Bloco excluído",
        description: "O bloco foi excluído com sucesso.",
      });
      onDeleted();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const { data: columnsData, error: columnsError } = await supabase
          .from("columns")
          .select("id")
          .eq("board_id", board.id);
        if (columnsError) throw columnsError;

        if (!columnsData || columnsData.length === 0) {
          setTeamMembers([]);
          return;
        }

        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("responsavel_id")
          .in("column_id", columnsData.map(c => c.id))
          .not("responsavel_id", "is", null);
        if (tasksError) throw tasksError;

        const uniqueResponsavelIds = [...new Set(tasksData?.map(t => t.responsavel_id) || [])];
        if (uniqueResponsavelIds.length === 0) {
          setTeamMembers([]);
          return;
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nome, foto_perfil")
          .in("id", uniqueResponsavelIds);
        if (profilesError) throw profilesError;

        setTeamMembers(profilesData || []);
      } catch (err) {
        console.error("Erro ao carregar membros do bloco:", err);
      }
    };

    fetchTeamMembers();
  }, [board.id]);

  if (viewMode === "list") {
    return (
      <>
        <Card className="hover:shadow-hover transition-all duration-300 hover:scale-[1.02] border-border/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  {board.publico ? (
                    <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <h3 className="text-lg font-semibold truncate">{board.titulo}</h3>
                </div>
                {board.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-1 ml-7">
                    {board.descricao}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 ml-7">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(board.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
                {teamMembers.length > 0 && (
                  <div className="mt-3 ml-7 flex justify-end">
                    <div className="flex -space-x-2">
                      {teamMembers.slice(0, 5).map((member) => (
                        <div key={member.id} className="relative group" title={member.nome}>
                          <Avatar className="w-6 h-6 border-2 border-background">
                            <AvatarImage src={member.foto_perfil || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                              {member.nome.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button onClick={() => navigate(`/board/${board.id}`)}>
                  Abrir
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setEditDialogOpen(true)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDeleteDialogOpen(true)}
                  className="hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <EditBoardDialog
          board={board}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onUpdated={onDeleted}
        />

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O bloco "{board.titulo}" e todas as suas tarefas serão excluídos permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Card className="hover:shadow-hover transition-all duration-300 hover:scale-105 border-border/50 group">
        <CardHeader>
          <div className="flex justify-between items-start gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {board.publico ? (
                <Globe className="w-4 h-4 text-primary flex-shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
              <CardTitle className="truncate">{board.titulo}</CardTitle>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditDialogOpen(true)}
                className="flex-shrink-0"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
                className="hover:bg-destructive hover:text-destructive-foreground flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {board.descricao && (
            <CardDescription className="line-clamp-2">
              {board.descricao}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(new Date(board.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            <div className="flex items-center gap-3">
              {teamMembers.length > 0 && (
                <div className="flex -space-x-2">
                  {teamMembers.slice(0, 5).map((member) => (
                    <div key={member.id} className="relative group" title={member.nome}>
                      <Avatar className="w-6 h-6 border-2 border-background">
                        <AvatarImage src={member.foto_perfil || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                          {member.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  ))}
                </div>
              )}
              <Button
                onClick={() => navigate(`/board/${board.id}`)}
                size="sm"
                className="hover:scale-105 transition-transform"
              >
                Abrir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditBoardDialog
        board={board}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUpdated={onDeleted}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O bloco "{board.titulo}" e todas as suas tarefas serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BoardCard;

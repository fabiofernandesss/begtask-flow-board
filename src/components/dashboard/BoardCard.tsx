import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Lock, Globe, Calendar, Edit, ArrowRight, Columns3, ListChecks, Users, LayoutGrid, Briefcase, FolderKanban, ClipboardList, Target, Rocket, Zap, Star, Lightbulb, Flag } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

interface BoardStats {
  columnsCount: number;
  tasksCount: number;
}

const BOARD_ICONS = [LayoutGrid, Briefcase, FolderKanban, ClipboardList, Target, Rocket, Zap, Star, Lightbulb, Flag];

const getBoardIcon = (boardId: string) => {
  let hash = 0;
  for (let i = 0; i < boardId.length; i++) {
    hash = ((hash << 5) - hash) + boardId.charCodeAt(i);
    hash |= 0;
  }
  return BOARD_ICONS[Math.abs(hash) % BOARD_ICONS.length];
};

const BoardCard = ({ board, viewMode, onDeleted }: BoardCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<BoardStats>({ columnsCount: 0, tasksCount: 0 });
  const BoardIcon = getBoardIcon(board.id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDelete = async () => {
    setDeleting(true);
    try {
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

      const { error } = await supabase
        .from("boards")
        .delete()
        .eq("id", board.id);

      if (error) throw error;

      if (boardData?.columns && boardData.columns.length > 0) {
        const allTasks = boardData.columns.flatMap(column => column.tasks || []);
        const tasksWithResponsaveis = allTasks.filter(task => task.responsavel_id);
        
        const notificationPromises = tasksWithResponsaveis.map(async (task) => {
          try {
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("nome, telefone")
              .eq("id", task.responsavel_id)
              .single();

            const { data: userEmail } = await supabase
              .rpc('get_user_email' as any, { user_id: task.responsavel_id });
            
            if (!profileError && profileData && (profileData.telefone || userEmail)) {
              await notificationService.notifyBoardDeleted(
                profileData.nome,
                profileData.telefone,
                String(userEmail || ''),
                boardData.titulo,
                task.titulo
              );
            }
          } catch (whatsappError) {
            console.error("Erro ao enviar notificação WhatsApp:", whatsappError);
          }
        });

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
    const fetchBoardInfo = async () => {
      try {
        const { data: columnsData, error: columnsError } = await supabase
          .from("columns")
          .select("id")
          .eq("board_id", board.id);
        if (columnsError) throw columnsError;

        const columnsCount = columnsData?.length || 0;

        if (!columnsData || columnsData.length === 0) {
          setTeamMembers([]);
          setStats({ columnsCount: 0, tasksCount: 0 });
          return;
        }

        const columnIds = columnsData.map(c => c.id);

        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("responsavel_id")
          .in("column_id", columnIds);
        if (tasksError) throw tasksError;

        setStats({ columnsCount, tasksCount: tasksData?.length || 0 });

        const uniqueResponsavelIds = [...new Set(
          (tasksData || []).map(t => t.responsavel_id).filter((v): v is string => Boolean(v))
        )];
        
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
        console.error("Erro ao carregar info do bloco:", err);
      }
    };

    fetchBoardInfo();
  }, [board.id]);

  const deleteConfirmDialog = (
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
  );

  const editDialog = (
    <EditBoardDialog
      board={board}
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      onUpdated={onDeleted}
    />
  );

  if (viewMode === "list") {
    return (
      <>
        <Card className="hover:border-primary/30 transition-all duration-200 border-border/50">
          <CardContent className="p-4">
            <div className="flex justify-between items-center gap-4">
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                <div className="flex items-center gap-2.5 mb-1">
                  {board.publico ? (
                    <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <h3 className="font-semibold truncate">{board.titulo}</h3>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0">
                    {stats.tasksCount} tarefa{stats.tasksCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {board.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-1 ml-6.5">
                    {board.descricao}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(board.created_at), "dd MMM yyyy", { locale: ptBR })}
                </span>

                {teamMembers.length > 0 && (
                  <div className="flex -space-x-2">
                    {teamMembers.slice(0, 4).map((member) => (
                      <Avatar key={member.id} className="w-7 h-7 border-2 border-background" title={member.nome}>
                        <AvatarImage src={member.foto_perfil || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                          {member.nome.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {teamMembers.length > 4 && (
                      <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                        +{teamMembers.length - 4}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditDialogOpen(true)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {editDialog}
        {deleteConfirmDialog}
      </>
    );
  }

  return (
    <>
      <Card
        className="hover:border-primary/40 hover:shadow-md transition-all duration-200 border-border/50 group cursor-pointer"
        onClick={() => navigate(`/board/${board.id}`)}
      >
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex justify-between items-start gap-2 mb-3">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-[4px] bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                {board.publico ? (
                  <Globe className="w-4.5 h-4.5 text-primary" />
                ) : (
                  <Lock className="w-4.5 h-4.5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground truncate leading-tight text-base">
                  {board.titulo}
                </h3>
                {board.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    {board.descricao}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); setEditDialogOpen(true); }}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Columns3 className="w-3.5 h-3.5" />
              <span>{stats.columnsCount} coluna{stats.columnsCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ListChecks className="w-3.5 h-3.5" />
              <span>{stats.tasksCount} tarefa{stats.tasksCount !== 1 ? 's' : ''}</span>
            </div>
            {teamMembers.length > 0 && (
              <>
                <div className="w-1 h-1 rounded-full bg-border" />
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{teamMembers.length}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-border/40">
            <div className="flex items-center gap-2">
              {teamMembers.length > 0 && (
                <div className="flex -space-x-2">
                  {teamMembers.slice(0, 5).map((member) => (
                    <Avatar key={member.id} className="w-7 h-7 border-2 border-background" title={member.nome}>
                      <AvatarImage src={member.foto_perfil || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                        {member.nome.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {teamMembers.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                      +{teamMembers.length - 5}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(board.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
          </div>
        </CardContent>
      </Card>
      {editDialog}
      {deleteConfirmDialog}
    </>
  );
};

export default BoardCard;
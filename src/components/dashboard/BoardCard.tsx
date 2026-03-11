import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
          .select("id, responsavel_id")
          .in("column_id", columnIds);
        if (tasksError) throw tasksError;

        setStats({ columnsCount, tasksCount: tasksData?.length || 0 });

        const responsavelIds = (tasksData || []).map(t => t.responsavel_id).filter((v): v is string => Boolean(v));

        const taskIds = (tasksData || []).map(t => t.id);
        let participantUserIds: string[] = [];
        if (taskIds.length > 0) {
          const { data: participantsData } = await supabase
            .from("task_participants")
            .select("user_id")
            .in("task_id", taskIds);
          participantUserIds = (participantsData || []).map(p => p.user_id);
        }

        const allUserIds = [...new Set([...responsavelIds, ...participantUserIds])];
        
        if (allUserIds.length === 0) {
          setTeamMembers([]);
          return;
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, nome, foto_perfil")
          .in("id", allUserIds);
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
        <div
          className={cn(
            "relative overflow-hidden rounded-lg border border-border/50 bg-card p-5",
            "group/feature hover:bg-primary/5 transition-colors duration-200"
          )}
        >
          {/* Top gradient line on hover */}
          <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-px w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          
          <div className="flex justify-between items-center gap-4 relative z-10">
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate(`/board/${board.id}`)}
            >
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BoardIcon className="w-4.5 h-4.5 text-primary" />
                </div>
                {board.publico ? (
                  <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
                <h3 className="font-semibold text-foreground truncate text-base">{board.titulo}</h3>
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full flex-shrink-0">
                  {stats.tasksCount} tarefa{stats.tasksCount !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full flex-shrink-0">
                  {stats.columnsCount} coluna{stats.columnsCount !== 1 ? 's' : ''}
                </span>
              </div>
              {board.descricao && (
                <p className="text-sm text-muted-foreground line-clamp-1 ml-12">
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
        </div>
        {editDialog}
        {deleteConfirmDialog}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border/50 bg-card cursor-pointer",
          "group/feature transition-all duration-300",
          "hover:shadow-lg hover:border-primary/30"
        )}
        onClick={() => navigate(`/board/${board.id}`)}
      >
        {/* Top gradient line on hover */}
        <div className="opacity-0 group-hover/feature:opacity-100 transition duration-300 absolute inset-0 h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        
        {/* Bottom subtle glow */}
        <div className="opacity-0 group-hover/feature:opacity-40 transition duration-300 absolute bottom-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="relative z-10 p-6">
          {/* Header */}
          <div className="flex justify-between items-start gap-3 mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover/feature:bg-primary/20 transition-colors duration-300">
                <BoardIcon className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-foreground truncate text-lg leading-tight">
                    {board.titulo}
                  </h3>
                  {board.publico ? (
                    <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                {board.descricao && (
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {board.descricao}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover/feature:opacity-100 transition-opacity duration-200 flex-shrink-0">
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
          <div className="flex items-center gap-4 mb-5">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Columns3 className="w-4 h-4" />
              <span className="font-medium">{stats.columnsCount}</span>
              <span>coluna{stats.columnsCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ListChecks className="w-4 h-4" />
              <span className="font-medium">{stats.tasksCount}</span>
              <span>tarefa{stats.tasksCount !== 1 ? 's' : ''}</span>
            </div>
            {teamMembers.length > 0 && (
              <>
                <div className="w-1 h-1 rounded-full bg-border" />
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">{teamMembers.length}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-border/40">
            <div className="flex items-center gap-2">
              {teamMembers.length > 0 && (
                <div className="flex -space-x-2.5">
                  {teamMembers.slice(0, 5).map((member) => (
                    <Avatar key={member.id} className="w-8 h-8 border-2 border-card ring-0" title={member.nome}>
                      <AvatarImage src={member.foto_perfil || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {member.nome.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {teamMembers.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs text-muted-foreground font-semibold">
                      +{teamMembers.length - 5}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(board.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover/feature:text-primary group-hover/feature:translate-x-0.5 transition-all duration-300" />
            </div>
          </div>
        </div>
      </div>
      {editDialog}
      {deleteConfirmDialog}
    </>
  );
};

export default BoardCard;

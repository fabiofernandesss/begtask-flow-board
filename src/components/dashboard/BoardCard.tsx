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

const BOARD_COLORS = [
  "from-blue-500/20 to-cyan-500/20",
  "from-violet-500/20 to-purple-500/20", 
  "from-emerald-500/20 to-teal-500/20",
  "from-orange-500/20 to-amber-500/20",
  "from-rose-500/20 to-pink-500/20",
  "from-indigo-500/20 to-blue-500/20",
  "from-cyan-500/20 to-sky-500/20",
  "from-fuchsia-500/20 to-pink-500/20",
  "from-lime-500/20 to-green-500/20",
  "from-amber-500/20 to-yellow-500/20",
];

const ICON_COLORS = [
  "text-blue-600",
  "text-violet-600",
  "text-emerald-600",
  "text-orange-600",
  "text-rose-600",
  "text-indigo-600",
  "text-cyan-600",
  "text-fuchsia-600",
  "text-lime-600",
  "text-amber-600",
];

const getBoardHash = (boardId: string) => {
  let hash = 0;
  for (let i = 0; i < boardId.length; i++) {
    hash = ((hash << 5) - hash) + boardId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % BOARD_ICONS.length;
};

const BoardCard = ({ board, viewMode, onDeleted }: BoardCardProps) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<BoardStats>({ columnsCount: 0, tasksCount: 0 });
  const hashIndex = getBoardHash(board.id);
  const BoardIcon = BOARD_ICONS[hashIndex];
  const boardColor = BOARD_COLORS[hashIndex];
  const iconColor = ICON_COLORS[hashIndex];
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

  const avatarGroup = (maxVisible: number, size: string, borderClass: string) => (
    teamMembers.length > 0 ? (
      <div className="flex -space-x-2">
        {teamMembers.slice(0, maxVisible).map((member) => (
          <Avatar key={member.id} className={cn(size, borderClass)} title={member.nome}>
            <AvatarImage src={member.foto_perfil || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {member.nome.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
        {teamMembers.length > maxVisible && (
          <div className={cn(size, "rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold", borderClass)}>
            +{teamMembers.length - maxVisible}
          </div>
        )}
      </div>
    ) : null
  );

  if (viewMode === "list") {
    return (
      <>
        <div
          className={cn(
            "relative overflow-hidden rounded-[4px] border border-border/60 bg-card",
            "group/card hover:border-primary/40 hover:shadow-md transition-all duration-300"
          )}
        >
          {/* Gradient accent top */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

          <div className="flex items-center gap-4 px-5 py-4">
            {/* Icon */}
            <div className={cn("w-11 h-11 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0", boardColor)}>
              <BoardIcon className={cn("w-5 h-5", iconColor)} />
            </div>

            {/* Info */}
            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate(`/board/${board.id}`)}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-bold text-foreground truncate text-[15px]">{board.titulo}</h3>
                {board.publico ? (
                  <Globe className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              {board.descricao && (
                <p className="text-[13px] text-muted-foreground line-clamp-1">{board.descricao}</p>
              )}
            </div>

            {/* Stats pills */}
            <div className="hidden md:flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                <Columns3 className="w-3 h-3" />
                <span className="font-semibold">{stats.columnsCount}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                <ListChecks className="w-3 h-3" />
                <span className="font-semibold">{stats.tasksCount}</span>
              </div>
            </div>

            {/* Date */}
            <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 flex-shrink-0">
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(board.created_at), "dd MMM yyyy", { locale: ptBR })}
            </span>

            {/* Avatars */}
            {avatarGroup(3, "w-7 h-7", "border-2 border-card")}

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditDialogOpen(true)}>
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
        {editDialog}
        {deleteConfirmDialog}
      </>
    );
  }

  // Grid view
  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-[4px] border border-border/60 bg-card cursor-pointer",
          "group/card transition-all duration-300",
          "hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5"
        )}
        onClick={() => navigate(`/board/${board.id}`)}
      >
        {/* Animated top gradient bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-0 group-hover/card:opacity-100 transition-all duration-500" />

        {/* Icon banner area */}
        <div className={cn("relative bg-gradient-to-br px-6 pt-6 pb-4", boardColor)}>
          <div className="flex justify-between items-start">
            <div className="w-14 h-14 rounded-xl bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-sm">
              <BoardIcon className={cn("w-7 h-7", iconColor)} />
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity duration-200">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-background/50 hover:bg-background/80"
                onClick={(e) => { e.stopPropagation(); setEditDialogOpen(true); }}
              >
                <Edit className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-background/50 hover:bg-destructive/20 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pt-4 pb-5">
          {/* Title & visibility */}
          <div className="flex items-start gap-2 mb-2">
            <h3 className="font-bold text-foreground text-lg leading-snug line-clamp-2 flex-1">
              {board.titulo}
            </h3>
            {board.publico ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">
                <Globe className="w-3 h-3" /> Público
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full flex-shrink-0">
                <Lock className="w-3 h-3" /> Privado
              </span>
            )}
          </div>

          {/* Description */}
          {board.descricao ? (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-4">
              {board.descricao}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground/50 italic mb-4">Sem descrição</p>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 text-sm">
              <Columns3 className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold text-foreground">{stats.columnsCount}</span>
              <span className="text-muted-foreground text-xs">coluna{stats.columnsCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5 text-sm">
              <ListChecks className="w-4 h-4 text-muted-foreground" />
              <span className="font-bold text-foreground">{stats.tasksCount}</span>
              <span className="text-muted-foreground text-xs">tarefa{stats.tasksCount !== 1 ? 's' : ''}</span>
            </div>
            {teamMembers.length > 0 && (
              <>
                <div className="w-1 h-1 rounded-full bg-border" />
                <div className="flex items-center gap-1.5 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-bold text-foreground">{teamMembers.length}</span>
                </div>
              </>
            )}
          </div>

          {/* Footer: avatars + date */}
          <div className="flex justify-between items-center pt-3 border-t border-border/40">
            {avatarGroup(5, "w-8 h-8", "border-2 border-card") || <div />}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span>{format(new Date(board.created_at), "dd MMM yyyy", { locale: ptBR })}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover/card:text-primary group-hover/card:translate-x-0.5 transition-all duration-300" />
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

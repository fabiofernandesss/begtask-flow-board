import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, Lock, Globe, Calendar, Edit, Columns3, ListChecks, Users, LayoutGrid, Briefcase, FolderKanban, ClipboardList, Target, Rocket, Zap, Star, Lightbulb, Flag } from "lucide-react";
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
import { motion } from "framer-motion";

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

const ICON_COLORS = [
  "text-[hsl(214,85%,45%)]",   // azul BEG
  "text-[hsl(262,60%,50%)]",   // roxo
  "text-[hsl(160,55%,40%)]",   // verde-água
  "text-[hsl(340,65%,50%)]",   // rosa
  "text-[hsl(28,80%,50%)]",    // laranja
  "text-[hsl(190,70%,42%)]",   // ciano
  "text-[hsl(45,80%,45%)]",    // dourado
  "text-[hsl(142,50%,42%)]",   // verde
  "text-[hsl(290,50%,50%)]",   // magenta
  "text-[hsl(10,70%,50%)]",    // vermelho-coral
];

const ICON_BG = [
  "bg-[hsl(214,85%,45%,0.1)]",
  "bg-[hsl(262,60%,50%,0.1)]",
  "bg-[hsl(160,55%,40%,0.1)]",
  "bg-[hsl(340,65%,50%,0.1)]",
  "bg-[hsl(28,80%,50%,0.1)]",
  "bg-[hsl(190,70%,42%,0.1)]",
  "bg-[hsl(45,80%,45%,0.1)]",
  "bg-[hsl(142,50%,42%,0.1)]",
  "bg-[hsl(290,50%,50%,0.1)]",
  "bg-[hsl(10,70%,50%,0.1)]",
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
  const iconColor = ICON_COLORS[hashIndex];
  const iconBg = ICON_BG[hashIndex];
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

  const avatarGroup = (maxVisible: number) => (
    teamMembers.length > 0 ? (
      <div className="flex -space-x-1.5">
        {teamMembers.slice(0, maxVisible).map((member) => (
          <Avatar key={member.id} className="w-6 h-6 border-2 border-card" title={member.nome}>
            <AvatarImage src={member.foto_perfil || undefined} />
            <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-semibold">
              {member.nome.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
        {teamMembers.length > maxVisible && (
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground font-bold border-2 border-card">
            +{teamMembers.length - maxVisible}
          </div>
        )}
      </div>
    ) : null
  );

  // LIST VIEW
  if (viewMode === "list") {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-lg border border-border bg-card",
            "group/card hover:border-primary/30 hover:shadow-sm transition-all duration-200"
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", iconBg)}>
              <BoardIcon className={cn("w-4 h-4", iconColor)} />
            </div>

            <div
              className="flex-1 min-w-0 cursor-pointer"
              onClick={() => navigate(`/board/${board.id}`)}
            >
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground truncate text-sm">{board.titulo}</h3>
                {board.publico ? (
                  <Globe className="w-3 h-3 text-primary flex-shrink-0" />
                ) : (
                  <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
              <span className="flex items-center gap-1">
                <Columns3 className="w-3 h-3" />
                {stats.columnsCount}
              </span>
              <span className="flex items-center gap-1">
                <ListChecks className="w-3 h-3" />
                {stats.tasksCount}
              </span>
            </div>

            <span className="text-[11px] text-muted-foreground hidden sm:block flex-shrink-0">
              {format(new Date(board.created_at), "dd MMM yyyy", { locale: ptBR })}
            </span>

            {avatarGroup(3)}

            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDialogOpen(true)}>
                <Edit className="w-3 h-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </motion.div>
        {editDialog}
        {deleteConfirmDialog}
      </>
    );
  }

  // GRID VIEW — compact, minimalist
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "rounded-[4px] border border-border bg-card cursor-pointer",
          "group/card transition-shadow duration-200",
          "hover:shadow-md hover:border-primary/20"
        )}
        onClick={() => navigate(`/board/${board.id}`)}
      >
        <div className="p-4">
          {/* Header: icon + actions */}
          <div className="flex items-start justify-between mb-3">
            <div className={cn("w-9 h-9 rounded-[4px] flex items-center justify-center", iconBg)}>
              <BoardIcon className={cn("w-[18px] h-[18px]", iconColor)} />
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); setEditDialogOpen(true); }}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setDeleteDialogOpen(true); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Title + visibility */}
          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-1 flex-1">
              {board.titulo}
            </h3>
            {board.publico ? (
              <Globe className="w-3 h-3 text-primary flex-shrink-0" />
            ) : (
              <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>

          {/* Description */}
          {board.descricao ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
              {board.descricao}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/40 italic mb-3">Sem descrição</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Columns3 className="w-3 h-3" />
              <span className="font-medium text-foreground">{stats.columnsCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <ListChecks className="w-3 h-3" />
              <span className="font-medium text-foreground">{stats.tasksCount}</span>
            </span>
            {teamMembers.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span className="font-medium text-foreground">{teamMembers.length}</span>
              </span>
            )}
          </div>

          {/* Footer: avatars + date */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            {avatarGroup(4) || <div />}
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(board.created_at), "dd MMM", { locale: ptBR })}
            </span>
          </div>
        </div>
      </motion.div>
      {editDialog}
      {deleteConfirmDialog}
    </>
  );
};

export default BoardCard;

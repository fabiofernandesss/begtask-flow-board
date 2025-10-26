import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, LayoutGrid, List, Kanban, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import Column from "@/components/board/Column";
import CreateColumnDialog from "@/components/board/CreateColumnDialog";
import TaskDetailsModal from "@/components/board/TaskDetailsModal";
import ListView from "@/components/board/ListView";
import CommentsSection from "@/components/board/CommentsSection";
import { AIChat } from "@/components/board/AIChat";
import { notificationService } from "@/services/notificationService";

interface Board {
  id: string;
  titulo: string;
  descricao: string | null;
}

interface Column {
  id: string;
  titulo: string;
  posicao: number;
  cor?: string;
  tasks: Task[];
}

interface Task {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "media" | "alta";
  posicao: number;
  column_id: string;
  data_entrega: string | null;
  anexos: string[];
  responsavel_id: string | null;
}

interface TeamMember {
  id: string;
  nome: string;
  foto_perfil: string | null;
}

interface TaskParticipant {
  id: string;
  task_id: string;
  user_id: string;
  role: string;
  user: TeamMember;
}

const Board = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [taskParticipants, setTaskParticipants] = useState<TaskParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    if (id) {
      fetchBoard();
      fetchColumns();
    }
  }, [id]);

  useEffect(() => {
    if (columns && columns.length > 0) {
      fetchTaskParticipants();
    }
  }, [columns]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchBoard = async () => {
    try {
      const { data, error } = await supabase
        .from("boards")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setBoard(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar bloco",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  };

  const fetchColumns = async () => {
    try {
      const { data: columnsData, error: columnsError } = await supabase
        .from("columns")
        .select("*")
        .eq("board_id", id)
        .order("posicao");

      if (columnsError) throw columnsError;

      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .in("column_id", columnsData?.map(c => c.id) || [])
        .order("posicao");

      if (tasksError) throw tasksError;

      const columnsWithTasks = (columnsData || []).map(col => ({
        ...col,
        tasks: (tasksData || []).filter(task => task.column_id === col.id)
      }));

      setColumns(columnsWithTasks);
      fetchTeamMembers();
    } catch (error: any) {
      toast({
        title: "Erro ao carregar colunas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      // Extrair IDs únicos dos responsáveis das tarefas
      const responsavelIds = Array.from(new Set(
        columns.flatMap(col => 
          col.tasks
            .filter(task => task.responsavel_id)
            .map(task => task.responsavel_id)
        )
      )).filter(Boolean) as string[];

      if (responsavelIds.length === 0) {
        setTeamMembers([]);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, foto_perfil")
        .in("id", responsavelIds);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar membros da equipe:", error);
      setTeamMembers([]);
    }
  };

  const fetchTaskParticipants = async () => {
    try {
      if (!columns || columns.length === 0) {
        setTaskParticipants([]);
        return;
      }

      // Extrair todos os IDs das tarefas
      const taskIds = columns.flatMap(col => 
        Array.isArray(col.tasks) ? col.tasks.map(task => task.id) : []
      );

      if (taskIds.length === 0) {
        setTaskParticipants([]);
        return;
      }

      const { data, error } = await supabase
        .from("task_participants")
        .select(`
          id,
          task_id,
          user_id,
          role,
          user:profiles(id, nome, foto_perfil)
        `)
        .in("task_id", taskIds);

      if (error) throw error;
      setTaskParticipants(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar participantes das tarefas:", error);
      setTaskParticipants([]);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === "column") {
      const reordered = Array.from(columns);
      const [moved] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, moved);

      const updated = reordered.map((col, idx) => ({ ...col, posicao: idx }));
      setColumns(updated);

      try {
        for (const col of updated) {
          await supabase
            .from("columns")
            .update({ posicao: col.posicao })
            .eq("id", col.id);
        }
      } catch (error: any) {
        toast({
          title: "Erro ao reordenar colunas",
          description: error.message,
          variant: "destructive",
        });
        fetchColumns();
      }
    } else {
      const sourceCol = columns.find(c => c.id === source.droppableId);
      const destCol = columns.find(c => c.id === destination.droppableId);

      if (!sourceCol || !destCol) return;

      const sourceTasks = Array.from(sourceCol.tasks);
      const destTasks = source.droppableId === destination.droppableId 
        ? sourceTasks 
        : Array.from(destCol.tasks);

      const [movedTask] = sourceTasks.splice(source.index, 1);

      if (source.droppableId === destination.droppableId) {
        sourceTasks.splice(destination.index, 0, movedTask);
        const updated = sourceTasks.map((task, idx) => ({ ...task, posicao: idx }));

        setColumns(columns.map(col => 
          col.id === sourceCol.id ? { ...col, tasks: updated } : col
        ));

        try {
          for (const task of updated) {
            await supabase
              .from("tasks")
              .update({ posicao: task.posicao })
              .eq("id", task.id);
          }
        } catch (error: any) {
          toast({
            title: "Erro ao reordenar tarefas",
            description: error.message,
            variant: "destructive",
          });
          fetchColumns();
        }
      } else {
        destTasks.splice(destination.index, 0, { ...movedTask, column_id: destCol.id });
        const updatedSource = sourceTasks.map((task, idx) => ({ ...task, posicao: idx }));
        const updatedDest = destTasks.map((task, idx) => ({ ...task, posicao: idx }));

        setColumns(columns.map(col => {
          if (col.id === sourceCol.id) return { ...col, tasks: updatedSource };
          if (col.id === destCol.id) return { ...col, tasks: updatedDest };
          return col;
        }));

        try {
          await supabase
            .from("tasks")
            .update({ column_id: destCol.id, posicao: destination.index })
            .eq("id", movedTask.id);

          for (const task of updatedSource) {
            await supabase.from("tasks").update({ posicao: task.posicao }).eq("id", task.id);
          }
          for (const task of updatedDest) {
            await supabase.from("tasks").update({ posicao: task.posicao }).eq("id", task.id);
          }

          // Enviar notificação WhatsApp se a tarefa tem responsável
          if (movedTask.responsavel_id) {
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("nome, telefone")
                .eq("id", movedTask.responsavel_id)
                .single();

              const { data: userEmail } = await supabase
                .rpc('get_user_email', { user_id: movedTask.responsavel_id });

              if (profileData && (profileData.telefone || userEmail)) {
                await notificationService.sendTaskMovedNotification(
                  profileData.nome,
                  profileData.telefone,
                  userEmail || '',
                  movedTask.titulo,
                  sourceCol.titulo,
                  destCol.titulo
                );
              }
            } catch (whatsappError) {
              console.error("Erro ao enviar notificação WhatsApp:", whatsappError);
              // Não falha a operação principal se o WhatsApp falhar
            }
          }
        } catch (error: any) {
          toast({
            title: "Erro ao mover tarefa",
            description: error.message,
            variant: "destructive",
          });
          fetchColumns();
        }
      }
    }
  };

  const handleColumnCreated = () => {
    fetchColumns();
    setColumnDialogOpen(false);
  };

  const handleDeleteColumn = async (columnId: string) => {
    try {
      // Buscar dados da coluna e tarefas antes de excluir
      const { data: columnData, error: columnError } = await supabase
        .from("columns")
        .select(`
          id,
          titulo,
          tasks (
            id,
            titulo,
            responsavel_id
          )
        `)
        .eq("id", columnId)
        .single();

      if (columnError) throw columnError;

      // Excluir a coluna (as tarefas serão excluídas em cascata)
      const { error } = await supabase.from("columns").delete().eq("id", columnId);
      if (error) throw error;

      // Enviar notificações WhatsApp para todos os responsáveis das tarefas
      if (columnData?.tasks && columnData.tasks.length > 0) {
        const tasksWithResponsaveis = columnData.tasks.filter(task => task.responsavel_id);
        
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
              await notificationService.notifyColumnDeleted(
                profileData.nome,
                profileData.telefone,
                userEmail || '',
                columnData.titulo,
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
      
      toast({ title: "Coluna excluída com sucesso" });
      fetchColumns();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir coluna",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      // Buscar dados da tarefa antes de excluir
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("id, titulo, responsavel_id")
        .eq("id", taskId)
        .single();

      if (taskError) throw taskError;

      // Buscar dados do responsável se existir
      let responsavelData = null;
      if (taskData?.responsavel_id) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("nome, telefone")
          .eq("id", taskData.responsavel_id)
          .single();

        const { data: userEmail } = await supabase
          .rpc('get_user_email', { user_id: taskData.responsavel_id });
        
        if (!profileError && profileData) {
          responsavelData = {
            nome: profileData.nome,
            telefone: profileData.telefone,
            email: userEmail || ''
          };
        }
      }

      if (taskError) throw taskError;

      // Excluir a tarefa
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;

      // Enviar notificação se houver responsável
      if (responsavelData && (responsavelData.telefone || responsavelData.email)) {
        try {
          await notificationService.notifyTaskDeleted(
            responsavelData.telefone,
            responsavelData.email,
            responsavelData.nome,
            taskData.titulo
          );
        } catch (notificationError) {
          console.error("Erro ao enviar notificação:", notificationError);
          // Não falha a operação principal se a notificação falhar
        }
      }
      
      toast({ title: "Tarefa excluída com sucesso" });
      fetchColumns();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir tarefa",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailsOpen(true);
  };

  const handleTaskUpdate = () => {
    fetchColumns();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{board?.titulo}</h1>
                {board?.descricao && (
                  <p className="text-sm text-muted-foreground">{board.descricao}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              <Button
                onClick={() => setColumnDialogOpen(true)}
                className="gap-2"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                Nova Coluna
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="board" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="board" className="flex items-center gap-2">
              <Kanban className="w-4 h-4" />
              Board
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comentários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-0">
            {viewMode === "kanban" ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="board" type="column" direction="horizontal">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex gap-4 overflow-x-auto pb-4"
                    >
                      {columns.map((column, index) => (
                        <Column
                          key={column.id}
                          column={column}
                          index={index}
                          onDelete={handleDeleteColumn}
                          onDeleteTask={handleDeleteTask}
                          onTaskClick={handleTaskClick}
                          onTaskCreated={fetchColumns}
                          teamMembers={teamMembers}
                          taskParticipants={taskParticipants}
                        />
                      ))}
                      {provided.placeholder}
                      
                      {columns.length === 0 && (
                        <div className="flex-1 flex items-center justify-center py-20">
                          <div className="text-center">
                            <h3 className="text-xl font-semibold mb-2">Nenhuma coluna ainda</h3>
                            <p className="text-muted-foreground mb-6">
                              Crie sua primeira coluna para começar
                            </p>
                            <Button onClick={() => setColumnDialogOpen(true)} className="gap-2">
                              <Plus className="w-5 h-5" />
                              Criar Coluna
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <ListView
                columns={columns}
                onDeleteTask={handleDeleteTask}
              />
            )}
          </TabsContent>

          <TabsContent value="comments" className="mt-0">
            <CommentsSection 
              boardId={id!} 
              isPublic={false}
              className="max-w-4xl mx-auto"
            />
          </TabsContent>
        </Tabs>
      </main>

      <CreateColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        boardId={id!}
        onColumnCreated={handleColumnCreated}
      />

      <TaskDetailsModal
        task={selectedTask}
        open={taskDetailsOpen}
        onOpenChange={setTaskDetailsOpen}
        onUpdate={handleTaskUpdate}
      />

      <AIChat boardId={id!} isPublic={false} />
    </div>
  );
};

export default Board;

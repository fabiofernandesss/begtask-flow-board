import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, LayoutGrid, List, Kanban, MessageSquare, MessageCircle, Phone, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import Column from "@/components/board/Column";
import CreateColumnDialog from "@/components/board/CreateColumnDialog";
import TaskDetailsModal from "@/components/board/TaskDetailsModal";
import ListView from "@/components/board/ListView";
import CommentsSection from "@/components/board/CommentsSection";
import { BegIAChat } from "@/components/board/BegIAChat";
import WhatsAppBroadcast from "@/components/board/WhatsAppBroadcast";
import { notificationService } from "@/services/notificationService";
import ReactMarkdown from "react-markdown";
import logoBEG from "@/assets/logoBEG.png";

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
  image_url_1?: string | null;
  image_url_2?: string | null;
  image_url_3?: string | null;
  image_url_4?: string | null;
  image_url_5?: string | null;
  image_url_6?: string | null;
  image_url_7?: string | null;
  image_url_8?: string | null;
  image_url_9?: string | null;
  image_url_10?: string | null;
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
  
  // Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAuth();
    if (id) {
      fetchBoardData();
    }
  }, [id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchBoardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch board details
      const { data: boardData, error: boardError } = await supabase
        .from("boards")
        .select("*")
        .eq("id", id)
        .single();
      if (boardError) throw boardError;
      setBoard(boardData);

      // 2. Fetch columns
      const { data: columnsData, error: columnsError } = await supabase
        .from("columns")
        .select("*")
        .eq("board_id", id)
        .order("posicao");
      if (columnsError) throw columnsError;

      if (!columnsData || columnsData.length === 0) {
        setColumns([]);
        setTeamMembers([]);
        setTaskParticipants([]);
        setLoading(false);
        return;
      }

      // 3. Fetch tasks for the columns
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .in("column_id", columnsData.map(c => c.id))
        .order("posicao");
      if (tasksError) throw tasksError;

      // 4. Combine columns with tasks
      const columnsWithTasks = columnsData.map(col => ({
        ...col,
        tasks: (tasksData || []).filter(task => task.column_id === col.id)
      }));
      setColumns(columnsWithTasks);

      // 5. Fetch team members and participants
      await fetchTeamMembersAndParticipants(columnsWithTasks);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar o quadro",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembersAndParticipants = async (currentColumns: Column[]) => {
    try {
      const taskIds = currentColumns.flatMap(col => col.tasks.map(task => task.id));

      // Derivar "membros" a partir dos responsáveis das tarefas
      const responsibleIds = Array.from(new Set(
        currentColumns
          .flatMap(col => col.tasks.map(task => task.responsavel_id))
          .filter((v): v is string => Boolean(v))
      ));

      if (responsibleIds.length > 0) {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, nome, foto_perfil")
            .in("id", responsibleIds);
          if (profilesError) {
            console.warn("Não foi possível carregar perfis dos responsáveis (RLS/permissões)", profilesError);
            setTeamMembers([]);
          } else {
            setTeamMembers((profilesData || []) as TeamMember[]);
          }
        } catch (e) {
          console.warn("Falha opcional ao carregar perfis dos responsáveis", e);
          setTeamMembers([]);
        }
      } else {
        setTeamMembers([]);
      }

      // Buscar participantes das tarefas de forma resiliente
      if (taskIds.length === 0) {
        setTaskParticipants([]);
        return;
      }

      try {
        const { data: participantsData, error: participantsError } = await supabase
          .from("task_participants" as any)
          .select("id, task_id, user_id, role")
          .in("task_id", taskIds);

        if (participantsError) {
          console.warn("Não foi possível carregar task_participants (tabela ausente/RLS)", participantsError);
          setTaskParticipants([]);
        } else if (participantsData && participantsData.length > 0) {
          // Buscar dados dos usuários participantes
          const userIds = [...new Set(participantsData.map((p: any) => p.user_id))];
          
          const { data: usersData, error: usersError } = await supabase
            .from("profiles")
            .select("id, nome, foto_perfil")
            .in("id", userIds);

          if (usersError) {
            console.warn("Erro ao buscar dados dos usuários participantes:", usersError);
            setTaskParticipants([]);
          } else {
            const safeParticipants = participantsData.map((p: any) => {
              const userData = usersData?.find((u: any) => u.id === p.user_id);
              return {
                id: p.id,
                task_id: p.task_id,
                user_id: p.user_id,
                role: p.role,
                user: {
                  id: p.user_id,
                  nome: userData?.nome || "Participante",
                  foto_perfil: userData?.foto_perfil || null
                } as TeamMember,
              };
            });
            setTaskParticipants(safeParticipants as TaskParticipant[]);
          }
        } else {
          setTaskParticipants([]);
        }
      } catch (e) {
        console.warn("Falha opcional ao carregar participantes de tarefas", e);
        setTaskParticipants([]);
      }
    } catch (error: any) {
      console.error("Erro ao carregar membros e participantes:", error);
      setTeamMembers([]);
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
        // Use Promise.all for atomic update
        await Promise.all(
          updated.map(col =>
            supabase.from("columns").update({ posicao: col.posicao }).eq("id", col.id)
          )
        );
      } catch (error: any) {
        toast({
          title: "Erro ao reordenar colunas",
          description: error.message,
          variant: "destructive",
        });
        fetchBoardData();
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
          fetchBoardData();
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

          // Enviar notificação para responsável e participantes da tarefa
          try {
            console.log("🔄 Iniciando envio de notificações para tarefa:", movedTask.titulo);
            
            // Verificar sessão antes de enviar notificação
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            console.log("🔐 Verificação de sessão:", session ? "✅ Autenticado" : "❌ Não autenticado");
            
            if (sessionError) {
              console.error("❌ Erro na sessão:", sessionError);
              throw new Error(`Erro de autenticação: ${sessionError.message}`);
            }
            
            if (!session) {
              console.error("❌ Usuário não autenticado");
              throw new Error("Usuário não autenticado");
            }

            // Coletar todos os user_ids para notificar (responsável + participantes)
            const userIdsToNotify = new Set<string>();
            
            // Adicionar responsável se existir
            if (movedTask.responsavel_id) {
              userIdsToNotify.add(movedTask.responsavel_id);
              console.log("📋 Responsável ID:", movedTask.responsavel_id);
            }
            
            // Buscar participantes da tarefa
            const { data: participantsData, error: participantsError } = await supabase
              .from("task_participants")
              .select("user_id")
              .eq("task_id", movedTask.id);
            
            if (!participantsError && participantsData) {
              participantsData.forEach((p: any) => {
                userIdsToNotify.add(p.user_id);
              });
              console.log("👥 Participantes encontrados:", participantsData.length);
            } else if (participantsError) {
              console.warn("⚠️ Erro ao buscar participantes:", participantsError);
            }

            console.log("📍 De:", sourceCol.titulo, "Para:", destCol.titulo);
            console.log("👥 Total de usuários para notificar:", userIdsToNotify.size);

            if (userIdsToNotify.size === 0) {
              console.log("⚠️ Tarefa sem responsável e sem participantes, não enviando notificação");
            } else {
              // Buscar perfis de todos os usuários
              const userIds = Array.from(userIdsToNotify);
              const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("id, nome, telefone")
                .in("id", userIds);

              if (profilesError) {
                console.error("❌ Erro ao buscar perfis:", profilesError);
                throw profilesError;
              }

              // Buscar emails de todos os usuários
              const { data: emailsData, error: emailsError } = await supabase
                .rpc('get_user_emails', { user_ids: userIds });

              if (emailsError) {
                console.warn("⚠️ Erro ao buscar emails:", emailsError);
              }

              console.log("👤 Perfis encontrados:", profilesData?.length || 0);
              console.log("📧 Emails encontrados:", emailsData?.length || 0);

              // Enviar notificação para cada usuário
              let notificationsSent = 0;
              for (const profile of (profilesData || [])) {
                const userEmail = emailsData?.find((e: any) => e.id === profile.id)?.email;
                
                if (profile.telefone || userEmail) {
                  console.log(`📤 Enviando notificação para ${profile.nome}...`);
                  
                  await notificationService.sendTaskMovedNotification(
                    profile.nome,
                    profile.telefone,
                    String(userEmail || ''),
                    movedTask.titulo,
                    sourceCol.titulo,
                    destCol.titulo
                  );
                  
                  notificationsSent++;
                  console.log(`✅ Notificação enviada para ${profile.nome}`);
                } else {
                  console.log(`⚠️ ${profile.nome} sem dados de contato`);
                }
              }

              if (notificationsSent > 0) {
                toast({
                  title: "Notificações enviadas",
                  description: `${notificationsSent} notificação(ões) enviada(s)`,
                });
              }
            }
          } catch (whatsappError: any) {
            console.error("❌ Erro ao enviar notificação:", whatsappError);
            
            // Mostrar toast de erro para o usuário
            toast({
              title: "Erro ao enviar notificação",
              description: whatsappError.message || "Erro desconhecido",
              variant: "destructive",
            });
            
            // Não falha a operação principal se a notificação falhar
          }
        } catch (error: any) {
          toast({
            title: "Erro ao mover tarefa",
            description: error.message,
            variant: "destructive",
          });
          fetchBoardData();
        }
      }
    }
  };

  const handleColumnCreated = async () => {
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
        .in("column_id", columnsData.map(c => c.id))
        .order("posicao");
      
      if (tasksError) throw tasksError;

      const columnsWithTasks = columnsData.map((column) => ({
        ...column,
        tasks: tasksData.filter((task) => task.column_id === column.id),
      }));

      setColumns(columnsWithTasks);
    } catch (error: any) {
      console.error("Erro ao atualizar colunas:", error);
      fetchBoardData();
    }
    setColumnDialogOpen(false);
  };

  const handleMoveColumn = async (columnId: string, direction: 'left' | 'right') => {
    const currentIndex = columns.findIndex(c => c.id === columnId);
    if (currentIndex === -1) return;
    
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= columns.length) return;

    const reordered = Array.from(columns);
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    const updated = reordered.map((col, idx) => ({ ...col, posicao: idx }));
    setColumns(updated);

    try {
      await Promise.all(
        updated.map(col =>
          supabase.from("columns").update({ posicao: col.posicao }).eq("id", col.id)
        )
      );
    } catch (error: any) {
      toast({
        title: "Erro ao mover coluna",
        description: error.message,
        variant: "destructive",
      });
      fetchBoardData();
    }
  };

  const handleRenameColumn = async (columnId: string, newTitle: string) => {
    // Optimistic update
    setColumns(prev => prev.map(col => col.id === columnId ? { ...col, titulo: newTitle } : col));
    
    try {
      const { error } = await supabase
        .from("columns")
        .update({ titulo: newTitle })
        .eq("id", columnId);
      if (error) throw error;
      toast({ title: "Coluna renomeada" });
    } catch (error: any) {
      toast({
        title: "Erro ao renomear coluna",
        description: error.message,
        variant: "destructive",
      });
      fetchBoardData();
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    try {
      // Buscar apenas o título da coluna (evitar select aninhado que causa 406)
      const { data: columnData, error: columnError } = await supabase
        .from("columns")
        .select("titulo")
        .eq("id", columnId)
        .single();

      if (columnError) throw columnError;

      // Buscar tarefas da coluna diretamente
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("id, titulo, responsavel_id")
        .eq("column_id", columnId);

      if (tasksError) throw tasksError;

      // Se houver tarefas, remover participantes dessas tarefas primeiro
      if (tasksData && tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const { error: delParticipantsError } = await supabase
          .from("task_participants" as any)
          .delete()
          .in("task_id", taskIds);
        if (delParticipantsError) throw delParticipantsError;
      }

      // Remover tarefas da coluna (não depender de cascade)
      const { error: delTasksError } = await supabase
        .from("tasks")
        .delete()
        .eq("column_id", columnId);
      if (delTasksError) throw delTasksError;

      // Excluir a coluna
      const { error: delColumnError } = await supabase
        .from("columns")
        .delete()
        .eq("id", columnId);
      if (delColumnError) throw delColumnError;

      // Enviar notificações WhatsApp para responsáveis das tarefas removidas
      if (tasksData && tasksData.length > 0) {
        const tasksWithResponsaveis = tasksData.filter(task => task.responsavel_id);

        const notificationPromises = tasksWithResponsaveis.map(async (task) => {
          try {
            // Buscar dados do responsável
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("nome, telefone")
              .eq("id", task.responsavel_id as string)
              .single();

            const { data: userEmail } = await supabase
              .rpc('get_user_email' as any, { user_id: task.responsavel_id });

            if (!profileError && profileData && (profileData.telefone || userEmail)) {
              await notificationService.notifyColumnDeleted(
                profileData.nome,
                profileData.telefone,
                String(userEmail || ''),
                columnData?.titulo || '',
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
      fetchBoardData();
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
          .rpc('get_user_email' as any, { user_id: taskData.responsavel_id });
        
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
      fetchBoardData();
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

  const handleTaskUpdate = async () => {
    try {
      // Atualizar apenas as tarefas sem recarregar tudo
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .in("column_id", columns.map(c => c.id))
        .order("posicao");
      
      if (tasksError) throw tasksError;

      const updatedColumns = columns.map((column) => ({
        ...column,
        tasks: tasksData.filter((task) => task.column_id === column.id),
      }));

      setColumns(updatedColumns);
    } catch (error: any) {
      console.error("Erro ao atualizar tarefas:", error);
      // Fallback para recarregar tudo se houver erro
      fetchBoardData();
    }
  };

  // Clear loading on board change
  useEffect(() => {
    if (id) {
      setIsLoading(false);
    }
  }, [id]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory]);

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
              <img src={logoBEG} alt="BEG Inovação" className="h-14" />
              <div>
                <h1 className="text-xl font-bold text-foreground">{board?.titulo}</h1>
                {board?.descricao && (
                  <p className="text-sm text-muted-foreground">{board.descricao}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted/50 rounded-[4px] p-0.5">
                <Button
                  variant={viewMode === "kanban" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                  className="h-8"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              <Button
                onClick={() => setColumnDialogOpen(true)}
                className="gap-2 h-8"
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
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="board" className="flex items-center gap-2">
              <Kanban className="w-4 h-4" />
              Board
            </TabsTrigger>
            <TabsTrigger value="comments" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comentários
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              WhatsApp
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
                          totalColumns={columns.length}
                          onDelete={handleDeleteColumn}
                          onDeleteTask={handleDeleteTask}
                          onTaskClick={handleTaskClick}
                          onTaskCreated={fetchBoardData}
                          onMoveColumn={handleMoveColumn}
                          onRenameColumn={handleRenameColumn}
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

          <TabsContent value="whatsapp" className="mt-0">
            <WhatsAppBroadcast 
              boardId={id!}
              columns={columns}
            />
          </TabsContent>
        </Tabs>
      </main>

      <CreateColumnDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        boardId={id || ""}
        onColumnCreated={() => fetchBoardData()}
      />

      <TaskDetailsModal
        task={selectedTask}
        open={taskDetailsOpen}
        onOpenChange={setTaskDetailsOpen}
        onUpdate={handleTaskUpdate}
      />

      {/* Floating Chat Button */}
      <Button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Chat Modal */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Assistente IA - {board?.titulo}
            </DialogTitle>
            <DialogDescription>
              Converse com a IA sobre seu projeto
            </DialogDescription>
          </DialogHeader>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Olá! Sou seu assistente de IA.</p>
                <p>Como posso ajudar com seu projeto hoje?</p>
              </div>
            ) : (
              chatHistory.map((message: any) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.sender === "ai" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground ml-auto"
                        : "bg-muted"
                    }`}
                  >
                    {message.sender === "ai" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm">{message.content}</p>
                    )}
                  </div>
                  {message.sender === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Pensando...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Textarea
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
              />
              <Button
                onClick={sendChatMessage}
                disabled={!chatMessage.trim() || isLoading}
                size="icon"
                className="h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Board;

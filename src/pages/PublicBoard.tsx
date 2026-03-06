import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Eye, EyeOff, MessageCircle, Send, X, Bot, RefreshCw, CalendarDays, User, Clock, Kanban, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import CommentsSection from "@/components/board/CommentsSection";
import PublicTaskDetailsModal from "@/components/board/PublicTaskDetailsModal";
// import { AIChat } from "@/components/board/AIChat";
import ReactMarkdown from "react-markdown";

interface Board {
  id: string;
  titulo: string;
  descricao: string | null;
  publico: boolean;
  senha_hash: string | null;
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

const PublicBoard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [taskParticipants, setTaskParticipants] = useState<TaskParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [boardMessages, setBoardMessages] = useState<Array<{
    id: string;
    sender_name: string;
    sender_email?: string;
    sender_type: 'client' | 'internal' | 'ai';
    message_content: string;
    created_at: string;
  }>>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);

  // Ref para auto-scroll do chat
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o final quando novas mensagens chegarem
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        // Usar setTimeout para garantir que o DOM foi atualizado
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'end',
            inline: 'nearest'
          });
        }, 100);
      }
    };

    scrollToBottom();
  }, [boardMessages, isLoading]);

  // Auto-scroll adicional quando o loading termina (mensagem da IA chega)
  useEffect(() => {
    if (!isLoading && boardMessages.length > 0) {
      const lastMessage = boardMessages[boardMessages.length - 1];
      if (lastMessage.sender_name !== "Usuário Anônimo") {
        // É uma mensagem da IA, garantir scroll
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'end',
            inline: 'nearest'
          });
        }, 200);
      }
    }
  }, [isLoading, boardMessages]);

  useEffect(() => {
    if (id) {
      checkBoardAccess();
    }
  }, [id]);

  // Buscar participantes quando as colunas mudarem
  useEffect(() => {
    if (columns && Array.isArray(columns) && columns.length > 0) {
      const hasTasksWithIds = columns.some(col => 
        col && col.tasks && Array.isArray(col.tasks) && col.tasks.length > 0
      );
      
      if (hasTasksWithIds) {
        fetchTaskParticipants();
      } else {
        setTaskParticipants([]);
      }
    } else {
      setTaskParticipants([]);
    }
  }, [columns]);



  const checkBoardAccess = async () => {
    try {
      // Primeiro, verificar se o board existe e é público
      const { data: boardData, error: boardError } = await supabase
        .from("boards")
        .select("id, titulo, descricao, publico, senha_hash")
        .eq("id", id)
        .single();

      if (boardError) {
        if (boardError.code === 'PGRST116') {
          toast({
            title: "Board não encontrado",
            description: "O board solicitado não existe ou não está disponível publicamente.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }
        throw boardError;
      }

      if (!boardData.publico) {
        toast({
          title: "Acesso negado",
          description: "Este board não está disponível publicamente.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setBoard(boardData);

      // Se tem senha, mostrar formulário de senha
      if (boardData.senha_hash) {
        setNeedsPassword(true);
        setLoading(false);
      } else {
        // Se não tem senha, carregar diretamente
        await fetchColumns();
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar board",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthenticating(true);

    try {
      // Verify password server-side using pgcrypto
      const { data: isValid, error: verifyError } = await supabase.rpc('verify_board_password', {
        _board_id: id,
        _password: password
      });
      
      if (verifyError) throw verifyError;
      
      if (isValid) {
        sessionStorage.setItem(`board_password_${id}`, 'verified');
        setNeedsPassword(false);
        setLoading(true);
        await fetchColumns();
        setLoading(false);
      } else {
        toast({
          title: "Senha incorreta",
          description: "A senha informada está incorreta.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao verificar senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAuthenticating(false);
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

      // Buscar tarefas somente se houver colunas; evitar .in([]) que pode gerar 404
      const columnIds = (columnsData || []).map((c: any) => c.id);
      let tasksWithEmptyArray: any[] = [];
      if (columnIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("*")
          .in("column_id", columnIds)
          .order("posicao");

        if (tasksError) throw tasksError;
        tasksWithEmptyArray = tasksData || [];
      }

      // Definir membros da equipe com base nos responsáveis das tarefas (somente IDs)
      // Evita depender de tabelas inexistentes como 'board_members' em ambientes públicos
      const responsibleIds = Array.from(new Set((tasksWithEmptyArray || [])
        .map((t: any) => t.responsavel_id)
        .filter((v: string | null) => v)));
      if (responsibleIds.length > 0) {
        try {
          // Em ambientes públicos, RLS pode impedir leitura de perfis; não falhar o carregamento
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, nome, foto_perfil")
            .in("id", responsibleIds as string[]);
          if (profilesError) {
            console.warn("Não foi possível carregar perfis dos responsáveis (RLS/permissões)", profilesError);
            setTeamMembers([]);
          } else {
            setTeamMembers((profilesData || []) as TeamMember[]);
          }
        } catch (err) {
          console.warn("Falha opcional ao carregar perfis dos responsáveis", err);
          setTeamMembers([]);
        }
      } else {
        setTeamMembers([]);
      }

      // 6. Montar o estado final
      const columnsWithTasks = (columnsData || []).map((column) => ({
        ...column,
        tasks: tasksWithEmptyArray.filter((task) => task.column_id === column.id),
      }));

      setColumns(columnsWithTasks);
    } catch (error: any) {
      console.error("Erro detalhado ao carregar conteúdo do board:", error);
      toast({
        title: "Erro ao carregar conteúdo do board",
        description: "Não foi possível buscar os detalhes do board. " + error.message,
        variant: "destructive",
      });
    }
  };

  // Carregar participantes de tarefas de forma resiliente (tabela opcional)
  const fetchTaskParticipants = async () => {
    try {
      const taskIds = (columns || []).flatMap((col) => (col.tasks || []).map((t) => t.id));
      if (!taskIds || taskIds.length === 0) {
        setTaskParticipants([]);
        return;
      }

      // Tentar buscar participantes; se a tabela não existir ou houver RLS, não quebrar o board
      const { data: participantsData, error: participantsError } = await supabase
        .from("task_participants" as any)
        .select("id, task_id, user_id, role")
        .in("task_id", taskIds);

      if (participantsError) {
        console.warn("Não foi possível carregar task_participants (tabela ausente/RLS)", participantsError);
        setTaskParticipants([]);
        return;
      }

      if (participantsData && participantsData.length > 0) {
        // Buscar dados dos usuários participantes
        const userIds = [...new Set(participantsData.map((p: any) => p.user_id))];
        
        const { data: usersData, error: usersError } = await supabase
          .from("profiles")
          .select("id, nome, foto_perfil")
          .in("id", userIds);

        if (usersError) {
          console.warn("Erro ao buscar dados dos usuários participantes:", usersError);
          // Manter estrutura mínima se não conseguir buscar perfis
          const safeParticipants = participantsData.map((p: any) => ({
            id: p.id,
            task_id: p.task_id,
            user_id: p.user_id,
            role: p.role,
            user: { id: p.user_id, nome: "Participante", foto_perfil: null } as TeamMember,
          }));
          setTaskParticipants(safeParticipants as any[]);
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
          setTaskParticipants(safeParticipants as any[]);
        }
      } else {
        setTaskParticipants([]);
      }
    } catch (err) {
      console.warn("Falha opcional ao carregar participantes de tarefas", err);
      setTaskParticipants([]);
    }
  };

  const handleDragEnd = async (_result: any) => {
    // Drag-and-drop desativado/sem efeito no board público.
    // Mantido como no-op para futura extensão.
    return;
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskDetailsOpen(true);
  };

  const generateAIResponse = (message: string, board: Board | null, columns: Column[], chatHistory: any[] = []): string => {
    const lowerMessage = message.toLowerCase();
    
    // Obter últimas 5 mensagens para contexto
    const recentMessages = chatHistory.slice(-5);
    const hasRecentContext = recentMessages.length > 0;
    
    // Analisar contexto das mensagens anteriores
    let contextualInfo = '';
    if (hasRecentContext) {
      const recentUserMessages = recentMessages
        .filter(msg => msg.sender_name === "Usuário Anônimo")
        .map(msg => msg.message_content)
        .slice(-3); // Últimas 3 perguntas do usuário
      
      if (recentUserMessages.length > 0) {
        contextualInfo = `\n\n💭 *Baseado em nossas conversas recentes sobre: ${recentUserMessages.join(', ')}*`;
      }
    }
    
    // Calcular estatísticas do board
    const totalTasks = columns.reduce((total, column) => total + column.tasks.length, 0);
    const tasksByColumn = columns.map(col => ({ name: col.titulo, count: col.tasks.length }));
    const highPriorityTasks = columns.reduce((total, column) => 
      total + column.tasks.filter(task => task.prioridade === 'alta').length, 0);
    const overdueTasks = columns.reduce((total, column) => 
      total + column.tasks.filter(task => task.data_entrega && new Date(task.data_entrega) < new Date()).length, 0);

    // Palavras-chave que indicam assuntos fora do contexto do projeto
    const offTopicKeywords = [
      'futebol', 'política', 'receita', 'culinária', 'filme', 'música', 'novela', 
      'fofoca', 'namoro', 'relacionamento', 'amor', 'sexo', 'religião', 'time',
      'jogo', 'apostas', 'loteria', 'dinheiro pessoal', 'investimento pessoal',
      'saúde pessoal', 'médico', 'remédio', 'doença', 'sintoma', 'tratamento',
      'viagem pessoal', 'férias', 'turismo', 'hotel', 'passagem'
    ];

    // Verificar se a mensagem contém assuntos completamente fora do contexto
    const isOffTopic = offTopicKeywords.some(keyword => lowerMessage.includes(keyword));
    
    if (isOffTopic) {
      return `🤔 Acredito que esse assunto não faz parte do contexto deste projeto. Estou aqui para ajudar com questões relacionadas ao board, tarefas, prazos, equipe e desenvolvimento do projeto.\n\n💬 *Como posso ajudar você com o projeto?*`;
    }

    // Respostas contextuais baseadas no histórico
    if (hasRecentContext) {
      const recentUserMessages = recentMessages
        .filter(msg => msg.sender_name === "Usuário Anônimo")
        .map(msg => msg.message_content.toLowerCase());
      
      // Se o usuário fez perguntas sobre tarefas específicas recentemente
      if (recentUserMessages.some(msg => msg.includes('tarefa') || msg.includes('task'))) {
        if (lowerMessage.includes('e agora') || lowerMessage.includes('próximo') || lowerMessage.includes('depois')) {
          return `🔄 **Baseado em nossa conversa anterior sobre tarefas:**\n\nVocê pode:\n• Verificar o status das tarefas que discutimos\n• Ver quais são as próximas etapas\n• Acompanhar os prazos pendentes\n\n📊 Atualmente temos **${totalTasks} tarefas** no board.\n\n💡 *Quer que eu mostre um resumo atualizado?*`;
        }
      }
      
      // Se o usuário perguntou sobre prazos recentemente
      if (recentUserMessages.some(msg => msg.includes('prazo') || msg.includes('entrega') || msg.includes('deadline'))) {
        if (lowerMessage.includes('como está') || lowerMessage.includes('situação') || lowerMessage.includes('status')) {
          const overdueCount = columns.reduce((total, column) => 
            total + column.tasks.filter(task => task.data_entrega && new Date(task.data_entrega) < new Date()).length, 0);
          return `⏰ **Atualização sobre prazos:**\n\n${overdueCount > 0 ? `🚨 **${overdueCount} tarefa${overdueCount > 1 ? 's' : ''} atrasada${overdueCount > 1 ? 's' : ''}**\n\n` : '✅ **Nenhuma tarefa atrasada!**\n\n'}📅 Continue acompanhando os prazos para manter o projeto em dia.\n\n💬 *Quer ver detalhes das tarefas com prazo próximo?*`;
        }
      }
    }

    // Relatório completo e detalhado do board
    if (
      lowerMessage.includes('relatório completo') ||
      lowerMessage.includes('relatorio completo') ||
      lowerMessage.includes('avião completo') ||
      lowerMessage.includes('avio completo') ||
      lowerMessage.includes('informações completas') ||
      lowerMessage.includes('informacoes completas') ||
      lowerMessage.includes('tudo sobre o board') ||
      lowerMessage.includes('análise completa') ||
      lowerMessage.includes('analise completa')
    ) {
      let response = `📊 **RELATÓRIO COMPLETO DO BOARD**\n\n`;
      
      // Informações gerais
      response += `🎯 **VISÃO GERAL**\n`;
      response += `• Total de tarefas: **${totalTasks}**\n`;
      response += `• Colunas ativas: **${columns.length}**\n`;
      response += `• Tarefas de alta prioridade: **${highPriorityTasks}**\n`;
      response += `• Tarefas atrasadas: **${overdueTasks}**\n\n`;
      
      // Análise detalhada por coluna
      response += `📋 **ANÁLISE DETALHADA POR COLUNA**\n\n`;
      columns.forEach((col, index) => {
        response += `**${index + 1}. ${col.titulo}** (${col.tasks.length} tarefa${col.tasks.length !== 1 ? 's' : ''})\n`;
        
        if (col.tasks.length > 0) {
          col.tasks.forEach((task, taskIndex) => {
            const prEmoji = task.prioridade === 'alta' ? '🔴' : task.prioridade === 'media' ? '🟡' : '🟢';
            const dueInfo = task.data_entrega ? 
              ` | 📅 ${new Date(task.data_entrega).toLocaleDateString('pt-BR')}${new Date(task.data_entrega) < new Date() ? ' ⚠️ ATRASADA' : ''}` : '';
            
            response += `  ${taskIndex + 1}. ${prEmoji} **${task.titulo}**\n`;
            if (task.descricao) {
              response += `     📝 ${task.descricao.substring(0, 100)}${task.descricao.length > 100 ? '...' : ''}\n`;
            }
            response += `     🎯 Prioridade: ${task.prioridade}${dueInfo}\n`;
            
            // Informações do responsável
            const member = teamMembers.find(m => m.id === task.responsavel_id);
            if (member) {
              response += `     👤 Responsável: ${member.nome}\n`;
            }
            response += `\n`;
          });
        } else {
          response += `  ✅ Nenhuma tarefa nesta coluna\n\n`;
        }
      });
      
      // Estatísticas avançadas
      response += `📈 **ESTATÍSTICAS AVANÇADAS**\n`;
      const totalWithDueDate = columns.reduce((total, col) => 
        total + col.tasks.filter(task => task.data_entrega).length, 0);
      const upcomingTasks = columns.reduce((total, col) => 
        total + col.tasks.filter(task => {
          if (!task.data_entrega) return false;
          const dueDate = new Date(task.data_entrega);
          const today = new Date();
          const diffTime = dueDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays <= 7 && diffDays >= 0;
        }).length, 0);
      
      response += `• Tarefas com prazo definido: **${totalWithDueDate}**\n`;
      response += `• Tarefas com prazo na próxima semana: **${upcomingTasks}**\n`;
      response += `• Taxa de conclusão estimada: **${columns.length > 0 ? Math.round((columns[columns.length - 1]?.tasks.length || 0) / totalTasks * 100) : 0}%**\n\n`;
      
      response += `💡 **Este relatório contém todas as informações do board para análise completa da IA.**`;
      return response;
    }

    // Respostas específicas sobre o projeto
    if (
      lowerMessage.includes('quantas tarefas') ||
      lowerMessage.includes('número de tarefas') ||
      lowerMessage.includes('total de tarefas') ||
      lowerMessage.includes('resumo') ||
      lowerMessage.includes('todas tarefas') ||
      lowerMessage.includes('todas as tarefas')
    ) {
      let response = `🎯 **Resumo do Board**\n\n`;
      response += `📋 Este board possui **${totalTasks} tarefas** no total.\n\n`;
      response += `📊 **Distribuição por coluna:**\n\n`;
      tasksByColumn.forEach(col => {
        const emoji = col.count === 0 ? '⚪' : col.count <= 2 ? '🟢' : col.count <= 4 ? '🟡' : '🔴';
        response += `${emoji} **${col.name}**: ${col.count} tarefa${col.count !== 1 ? 's' : ''}\n`;
      });

      // Listagem detalhada de tarefas por coluna (limitando para evitar respostas muito longas)
      response += `\n📝 **Tarefas por coluna:**\n`;
      columns.forEach(col => {
        const tasksPreview = col.tasks.slice(0, 3);
        if (tasksPreview.length > 0) {
          response += `\n- **${col.titulo}**\n`;
          tasksPreview.forEach(task => {
            const prEmoji = task.prioridade === 'alta' ? '⚡' : task.prioridade === 'media' ? '⚠️' : '🟢';
            const due = task.data_entrega ? ` • entrega: ${new Date(task.data_entrega).toLocaleDateString('pt-BR')}` : '';
            response += `  - ${prEmoji} ${task.titulo}${due}\n`;
          });
          const remaining = col.tasks.length - tasksPreview.length;
          if (remaining > 0) response += `  - … +${remaining} outras\n`;
        } else {
          response += `\n- **${col.titulo}**: nenhuma tarefa\n`;
        }
      });

      response += `\n💡 *Clique nas tarefas para ver mais detalhes!*`;
      return response;
    }

    if (lowerMessage.includes('prioridade alta') || lowerMessage.includes('urgente') || lowerMessage.includes('prioritária')) {
      return `🎯 **Prioridades do Projeto**\n\n${highPriorityTasks > 0 ? `⚡ **${highPriorityTasks} tarefas de alta prioridade** encontradas!\n\n💡 *Clique nas tarefas para ver mais detalhes.*` : '✅ Todas as tarefas estão com prioridade normal ou baixa.'}`;
    }

    if (lowerMessage.includes('atrasada') || lowerMessage.includes('vencida') || lowerMessage.includes('prazo')) {
      return `⏰ **Status dos Prazos**\n\n${overdueTasks > 0 ? `🚨 **${overdueTasks} tarefas atrasadas** encontradas!` : '✅ Não há tarefas atrasadas no momento.'}\n\n💡 *Clique nas tarefas individuais para verificar os prazos.*`;
    }

    if (lowerMessage.includes('status') || lowerMessage.includes('andamento') || lowerMessage.includes('progresso')) {
      let response = `📊 **Status do Projeto**\n\n`;
      response += `📈 **Resumo Geral:**\n`;
      response += `🎯 Total de tarefas: **${totalTasks}**\n`;
      response += `⚡ Tarefas de alta prioridade: **${highPriorityTasks}**\n`;
      response += `⏰ Tarefas atrasadas: **${overdueTasks}**\n\n`;
      response += `📋 **Distribuição por Coluna:**\n\n`;
      tasksByColumn.forEach(col => {
        const emoji = col.count === 0 ? '⚪' : col.count <= 2 ? '🟢' : col.count <= 4 ? '🟡' : '🔴';
        response += `${emoji} **${col.name}**: ${col.count} tarefa${col.count !== 1 ? 's' : ''}\n`;
      });
      response += `\n💡 *Clique nas tarefas para ver detalhes completos!*`;
      return response;
    }

    if (lowerMessage.includes('equipe') || lowerMessage.includes('responsável') || lowerMessage.includes('quem está')) {
      return `👥 **Informações da Equipe**\n\nPara ver quem são os responsáveis pelas tarefas:\n\n🔍 **Clique em cada tarefa individual**\n📋 Lá você encontrará informações sobre:\n   • Responsável pela tarefa\n   • Comentários da equipe\n   • Detalhes específicos\n\n💡 *Cada tarefa tem suas próprias informações de responsabilidade.*`;
    }

    // Respostas sobre colunas e ordem de execução
    if (lowerMessage.includes('coluna') || lowerMessage.includes('última coluna') || lowerMessage.includes('ordem') || lowerMessage.includes('sequência') || lowerMessage.includes('fluxo')) {
      let response = `🔄 **Fluxo do Projeto**\n\n`;
      response += `📋 **Colunas em Ordem de Execução:**\n\n`;
      columns.forEach((col, index) => {
        const isLast = index === columns.length - 1;
        const emoji = isLast ? '🏁' : index === 0 ? '🚀' : '⚡';
        const status = isLast ? ' **(FINAL)** 🎯' : index === 0 ? ' **(INÍCIO)** 🚀' : '';
        response += `${emoji} **${index + 1}. ${col.titulo}**${status}\n`;
        response += `   └ ${col.tasks.length} tarefa${col.tasks.length !== 1 ? 's' : ''}\n\n`;
      });
      
      if (columns.length > 0) {
        const lastColumn = columns[columns.length - 1];
        response += `🎯 **Última Etapa:** *"${lastColumn.titulo}"*\n`;
        response += `Esta é a fase final do processo com ${lastColumn.tasks.length} tarefa${lastColumn.tasks.length !== 1 ? 's' : ''}.`;
      }
      
      return response;
    }

    if (lowerMessage.includes('como') && (lowerMessage.includes('funciona') || lowerMessage.includes('usar') || lowerMessage.includes('navegar'))) {
      return `📖 **Como usar este board:**\n\n🔍 **Visualizar** - Todas as tarefas organizadas por colunas\n📋 **Clicar** - Em qualquer tarefa para ver detalhes completos\n💬 **Comentar** - Deixar comentários nas tarefas\n📊 **Acompanhar** - O progresso geral do projeto\n\n🤖 Posso responder perguntas sobre tarefas, prazos, prioridades e status do projeto!`;
    }

    if (lowerMessage.includes('problema') || lowerMessage.includes('erro') || lowerMessage.includes('bug') || lowerMessage.includes('não funciona')) {
      return `🔧 **Suporte Técnico**\n\nSe você encontrou algum problema ou erro:\n\n📝 **Descreva** o que está acontecendo\n👥 **A equipe** pode ajudar a resolver questões técnicas\n💬 **Comente** nas tarefas relacionadas para contexto específico\n\n🛠️ *Estamos aqui para ajudar a resolver qualquer dificuldade!*`;
    }

    if (lowerMessage.includes('sugestão') || lowerMessage.includes('ideia') || lowerMessage.includes('melhoria') || lowerMessage.includes('proposta')) {
      return `💡 **Sugestões e Ideias**\n\nQue ótimo que você tem sugestões para o projeto!\n\n💬 **Compartilhe** suas ideias aqui no chat\n📝 **Comente** nas tarefas relacionadas\n🎯 **A equipe** sempre valoriza feedback construtivo\n\n✨ *Toda proposta de melhoria é bem-vinda!*`;
    }

    if (lowerMessage.includes('quando') || lowerMessage.includes('prazo') || lowerMessage.includes('entrega') || lowerMessage.includes('cronograma')) {
      return `📅 **Prazos e Cronograma**\n\nPara informações sobre prazos:\n\n🔍 **Clique** nas tarefas individuais para ver datas de entrega\n${overdueTasks > 0 ? `🚨 **${overdueTasks} tarefas atrasadas** atualmente` : '✅ **Nenhuma tarefa atrasada** no momento'}\n👥 **A equipe** pode fornecer detalhes sobre o cronograma geral\n\n⏰ *Mantenha-se atualizado com os prazos do projeto!*`;
    }

    if (lowerMessage.includes('ajuda') || lowerMessage.includes('help')) {
      return `🤖 **Como posso ajudar?**\n\nEstou aqui para responder sobre o projeto! Posso ajudar com:\n\n📊 **Estatísticas** - Quantas tarefas, status, progresso\n⏰ **Prazos** - Tarefas atrasadas, cronograma\n🎯 **Prioridades** - Tarefas urgentes ou importantes\n👥 **Equipe** - Responsáveis e colaboradores\n🔧 **Problemas** - Erros ou dificuldades\n💡 **Sugestões** - Ideias e melhorias\n🔄 **Fluxo** - Ordem das colunas e execução\n\n💬 *O que você gostaria de saber?*`;
    }

    if (lowerMessage.includes('oi') || lowerMessage.includes('olá') || lowerMessage.includes('boa') || lowerMessage.includes('tudo bem')) {
      return `👋 **Olá! Tudo bem sim, obrigado!** 😊\n\n🎯 **Sobre este board:**\n📋 **${totalTasks} tarefas** distribuídas em **${columns.length} colunas**\n\n🤖 Estou aqui para ajudar com qualquer dúvida sobre o projeto!\n\n💬 *O que você gostaria de saber?*`;
    }

    if (lowerMessage.includes('obrigado') || lowerMessage.includes('valeu') || lowerMessage.includes('thanks')) {
      return `😊 **De nada!** Fico feliz em ajudar!\n\nSe tiver mais alguma dúvida sobre o projeto, estarei aqui.\n👥 A equipe também está disponível para questões mais específicas.\n\n💬 *Sempre à disposição!*`;
    }

    // Perguntas sobre qual tarefa está mais próxima de acabar
    if (lowerMessage.includes('qual') && (lowerMessage.includes('próxima') || lowerMessage.includes('proxima')) && (lowerMessage.includes('acabar') || lowerMessage.includes('terminar') || lowerMessage.includes('concluir') || lowerMessage.includes('finalizar'))) {
      // Analisar tarefas nas últimas colunas (mais próximas da conclusão)
      if (columns.length === 0) {
        return `📋 **Análise de Conclusão**\n\nAinda não há colunas ou tarefas neste board para analisar.\n\n💡 *Quando houver tarefas, poderei identificar quais estão mais próximas da conclusão!*`;
      }

      const lastColumns = columns.slice(-2); // Últimas 2 colunas
      const nearCompletionTasks = lastColumns.flatMap(col => 
        col.tasks.map(task => ({ ...task, columnName: col.titulo, columnIndex: columns.indexOf(col) }))
      );

      if (nearCompletionTasks.length === 0) {
        const firstColumnWithTasks = columns.find(col => col.tasks.length > 0);
        if (firstColumnWithTasks) {
          const firstTask = firstColumnWithTasks.tasks[0];
          const prEmoji = firstTask.prioridade === 'alta' ? '⚡' : firstTask.prioridade === 'media' ? '⚠️' : '🟢';
          return `🎯 **Análise de Conclusão**\n\nAs tarefas ainda estão nas fases iniciais. A primeira tarefa a ser trabalhada é:\n\n${prEmoji} **"${firstTask.titulo}"**\n📍 Coluna: *${firstColumnWithTasks.titulo}*\n${firstTask.data_entrega ? `📅 Prazo: ${new Date(firstTask.data_entrega).toLocaleDateString('pt-BR')}` : ''}\n\n💡 *Esta tarefa precisa avançar pelas colunas para se aproximar da conclusão.*`;
        }
        return `📋 **Análise de Conclusão**\n\nNão há tarefas nas fases finais ainda. Todas estão nas etapas iniciais do processo.\n\n💡 *Conforme as tarefas avançarem, poderei identificar quais estão mais próximas da conclusão!*`;
      }

      // Priorizar tarefas na última coluna, depois por prioridade e prazo
      const sortedTasks = nearCompletionTasks.sort((a, b) => {
        // Primeiro critério: coluna mais avançada
        if (b.columnIndex !== a.columnIndex) return b.columnIndex - a.columnIndex;
        
        // Segundo critério: prioridade
        const priorityOrder = { 'alta': 3, 'media': 2, 'baixa': 1 };
        const aPriority = priorityOrder[a.prioridade] || 0;
        const bPriority = priorityOrder[b.prioridade] || 0;
        if (bPriority !== aPriority) return bPriority - aPriority;
        
        // Terceiro critério: prazo mais próximo
        if (a.data_entrega && b.data_entrega) {
          return new Date(a.data_entrega).getTime() - new Date(b.data_entrega).getTime();
        }
        if (a.data_entrega) return -1;
        if (b.data_entrega) return 1;
        
        return 0;
      });

      const topTask = sortedTasks[0];
      const prEmoji = topTask.prioridade === 'alta' ? '⚡' : topTask.prioridade === 'media' ? '⚠️' : '🟢';
      const isLastColumn = topTask.columnIndex === columns.length - 1;
      
      let response = `🎯 **Tarefa Mais Próxima da Conclusão**\n\n`;
      response += `${prEmoji} **"${topTask.titulo}"**\n`;
      response += `📍 Coluna: *${topTask.columnName}*${isLastColumn ? ' 🏁 **(FINAL)**' : ''}\n`;
      if (topTask.data_entrega) {
        const dueDate = new Date(topTask.data_entrega);
        const isOverdue = dueDate < new Date();
        response += `📅 Prazo: ${dueDate.toLocaleDateString('pt-BR')}${isOverdue ? ' 🚨 **(ATRASADA)**' : ''}\n`;
      }
      response += `🎯 Prioridade: ${topTask.prioridade}\n\n`;
      
      if (isLastColumn) {
        response += `✅ **Esta tarefa está na fase final!** Clique nela para ver detalhes e acompanhar a conclusão.`;
      } else {
        const remainingColumns = columns.length - 1 - topTask.columnIndex;
        response += `📈 **Faltam ${remainingColumns} etapa${remainingColumns > 1 ? 's' : ''}** para a conclusão.\n\n💡 *Clique na tarefa para ver detalhes completos.*`;
      }

      return response;
    }

    // Perguntas simples sobre "qual"
    if (lowerMessage.includes('qual') && lowerMessage.length < 20) {
      return `🤔 **Preciso de mais detalhes!**\n\nSua pergunta "*${message}*" é muito geral. Posso ajudar com:\n\n🎯 **Qual tarefa** está mais próxima de acabar?\n📊 **Qual coluna** tem mais tarefas?\n⚡ **Qual prioridade** é mais urgente?\n📅 **Qual prazo** está mais próximo?\n\n💬 *Pode ser mais específico?*`;
    }

    // Resposta inteligente para outras perguntas relacionadas ao projeto
    return `🤔 **Entendi sua pergunta sobre:** *"${message}"*\n\nEmbora eu não tenha uma resposta específica para isso, posso ajudar com informações sobre este projeto que possui **${totalTasks} tarefas**.\n\n👥 A equipe também pode responder questões mais específicas.\n\n💬 *Como posso ajudar você melhor?*${contextualInfo}`;
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || isLoading) return;

    const userMessage = chatMessage.trim();
    setChatMessage("");
    setIsLoading(true);

    try {
      // Salvar mensagem do usuário no banco de dados
      const { data: newMessage, error: messageError } = await supabase
        .from("board_messages" as any)
        .insert({
          board_id: id,
          sender_name: "Usuário Anônimo",
          sender_type: "client",
          message_content: userMessage,
          is_public: true,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Atualizar lista de mensagens
      setBoardMessages(prev => [...prev, newMessage] as any);

      // Gerar resposta da IA usando contexto do board e permitir perguntas gerais
      const boardContext = {
        titulo: board?.titulo,
        descricao: board?.descricao,
        colunas: columns.map(col => ({
          titulo: col.titulo,
          tarefas: col.tasks.map(task => ({
            titulo: task.titulo,
            descricao: task.descricao,
            prioridade: task.prioridade,
            data_entrega: task.data_entrega,
          }))
        }))
      };

      const prompt = `Você é um assistente de IA ajudando no projeto "${board?.titulo}".\n\nContexto do projeto:\n${JSON.stringify(boardContext, null, 2)}\n\nPergunta do usuário: ${userMessage}\n\nResponda de forma útil. Se a pergunta não estiver diretamente relacionada ao projeto, responda mesmo assim de forma geral, e quando possível conecte com o projeto.`;

      let aiResponseText = "Não consegui gerar uma resposta agora.";
      
      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai-chat', {
        body: { prompt },
      });

      if (!aiError && aiData?.text) {
        aiResponseText = aiData.text;
      }

      // Salvar resposta da IA
      const { data: aiMessage, error: aiError } = await supabase
        .from("board_messages" as any)
        .insert({
          board_id: id,
          sender_name: "Assistente IA",
          sender_type: "ai",
          message_content: aiResponseText,
          is_public: true,
        })
        .select()
        .single();

      if (aiError) throw aiError;

      // Atualizar lista de mensagens com a resposta da IA
      setBoardMessages(prev => [...prev, aiMessage] as any);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-lg">Carregando...</div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Board Protegido</CardTitle>
            <CardDescription>
              Este board requer uma senha para acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite a senha do board"
                    required
                    disabled={authenticating}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={authenticating}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={authenticating || !password}
                >
                  {authenticating ? "Verificando..." : "Acessar"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{board?.titulo}</h1>
              {board?.descricao && (
                <p className="text-sm text-muted-foreground">{board.descricao}</p>
              )}
              
              {/* Membros da equipe */}
              {teamMembers.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">Equipe:</span>
                  <div className="flex -space-x-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="relative group"
                        title={member.nome}
                      >
                        {member.foto_perfil ? (
                          <img
                            src={member.foto_perfil}
                            alt={member.nome}
                            className="w-8 h-8 rounded-full border-2 border-background object-cover hover:scale-110 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center hover:scale-110 transition-transform duration-200">
                            <span className="text-xs font-medium text-primary">
                              {member.nome.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        {/* Tooltip com nome */}
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          {member.nome}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground mt-1">
                Visualização pública - somente leitura
              </p>
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
            <DragDropContext onDragEnd={() => {}}>
              <Droppable droppableId="board" type="column" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex gap-4 overflow-x-auto pb-4"
                  >
                    {columns.map((column, index) => (
                      <div key={column.id} className="min-w-[300px]">
                        <div 
                          className="bg-card rounded-lg border shadow-card"
                          style={{ borderColor: column.cor || '#6366f1' }}
                        >
                          <div 
                            className="p-4 border-b flex items-center gap-2"
                            style={{ 
                              borderColor: column.cor || '#6366f1',
                              background: `linear-gradient(135deg, ${column.cor || '#6366f1'}15 0%, transparent 100%)`
                            }}
                          >
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: column.cor || '#6366f1' }}
                            />
                            <div className="flex-1">
                              <h3 className="font-semibold text-foreground">{column.titulo}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {column.tasks.length} tarefa{column.tasks.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="p-4 space-y-3 min-h-[200px]">
                            {column.tasks.map((task) => (
                              <div
                                key={task.id}
                                className="bg-background p-3 rounded-lg border border-border/50 shadow-sm cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200"
                                onClick={() => handleTaskClick(task)}
                              >
                                <h4 className="font-medium text-foreground mb-1">{task.titulo}</h4>
                                {task.descricao && (
                                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                    {task.descricao}
                                  </p>
                                )}
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    task.prioridade === "alta" 
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                      : task.prioridade === "media"
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                                      : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                  }`}>
                                    {task.prioridade}
                                  </span>
                                  {task.data_entrega && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(task.data_entrega).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                {/* Avatares dos participantes (estilo Trello) */}
                                {(() => {
                                  const participants = taskParticipants.filter(p => p.task_id === task.id);
                                  if (participants.length === 0) return null;
                                  
                                  return (
                                    <div className="mt-2 flex justify-end">
                                      <div className="flex -space-x-1">
                                        {participants.slice(0, 3).map((participant, index) => (
                                          <div key={participant.id} className="relative group" title={`${participant.user.nome} (${participant.role})`}>
                                            {participant.user.foto_perfil ? (
                                              <img
                                                src={participant.user.foto_perfil}
                                                alt={participant.user.nome}
                                                className={`w-6 h-6 rounded-full border-2 border-background object-cover hover:scale-110 transition-transform duration-200 ${
                                                  participant.role === 'responsible' ? 'ring-2 ring-blue-500' : ''
                                                }`}
                                                style={{ zIndex: participants.length - index }}
                                              />
                                            ) : (
                                              <div 
                                                className={`w-6 h-6 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center hover:scale-110 transition-transform duration-200 ${
                                                  participant.role === 'responsible' ? 'ring-2 ring-blue-500' : ''
                                                }`}
                                                style={{ zIndex: participants.length - index }}
                                              >
                                                <span className="text-[10px] font-medium text-primary">
                                                  {participant.user.nome.charAt(0).toUpperCase()}
                                                </span>
                                              </div>
                                            )}
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20">
                                              {participant.user.nome} ({participant.role === 'responsible' ? 'Responsável' : 'Participante'})
                                            </div>
                                          </div>
                                        ))}
                                        {participants.length > 3 && (
                                          <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                                            <span className="text-[10px] font-medium text-muted-foreground">
                                              +{participants.length - 3}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    {provided.placeholder}
                    
                    {columns.length === 0 && (
                      <div className="flex-1 flex items-center justify-center py-20">
                        <div className="text-center">
                          <h3 className="text-xl font-semibold mb-2">Nenhuma coluna ainda</h3>
                          <p className="text-muted-foreground">
                            Este board ainda não possui colunas
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </TabsContent>

          <TabsContent value="comments" className="mt-0">
            <CommentsSection 
              boardId={id!} 
              isPublic={true}
              className="max-w-4xl mx-auto"
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Ícone flutuante de chat */}
      <button
        onClick={() => {
          // Limpar mensagens para nova sessão
          setBoardMessages([]);
          setIsChatOpen(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50 group"
        title="Comunicação com a equipe"
      >
        <MessageCircle className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
      </button>

      {/* Modal de Chat */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-2xl w-[90vw] h-[80vh] max-h-[700px] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              Comunicação
            </DialogTitle>
            <DialogDescription>
              Converse com a equipe e assistente IA sobre este projeto
            </DialogDescription>
          </DialogHeader>



          {/* Área de mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {boardMessages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm">
                  Seja o primeiro a enviar uma mensagem! A equipe e a IA estão prontas para ajudar.
                </p>
              </div>
            )}

            {boardMessages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.sender_type === 'client' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="max-w-[80%]">
                  <div
                    className={`p-3 rounded-lg ${
                      message.sender_type === 'client'
                        ? 'bg-primary text-primary-foreground'
                        : message.sender_type === 'ai'
                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                        : 'bg-green-100 text-green-900 border border-green-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {message.sender_name}
                      </span>
                      {message.sender_type === 'ai' && <Bot className="w-3 h-3" />}
                      {message.sender_type === 'internal' && <User className="w-3 h-3" />}
                      <span className="text-xs opacity-70">
                        {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="text-sm prose prose-sm max-w-none">
                      <ReactMarkdown>{message.message_content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-muted-foreground p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Elemento invisível para auto-scroll */}
            <div ref={messagesEndRef} />
          </div>

          {/* Área de input */}
          <div className="p-4 border-t shrink-0 bg-background">
            <div className="flex gap-2">
              <Textarea
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="flex-1 min-h-[40px] max-h-[100px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
              />
              <Button
                onClick={sendChatMessage}
                disabled={!chatMessage.trim() || isLoading}
                size="icon"
                className="shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PublicTaskDetailsModal
        task={selectedTask}
        open={taskDetailsOpen}
        onOpenChange={setTaskDetailsOpen}
      />

    </div>
  );
};

export default PublicBoard;
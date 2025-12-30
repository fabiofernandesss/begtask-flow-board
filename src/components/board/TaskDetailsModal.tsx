import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, X, Edit, Save, Image, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { notificationService } from "@/services/notificationService";
import { useParams } from "react-router-dom";
import TaskImageUpload from "./TaskImageUpload";

interface TaskComment {
  id: string;
  task_id: string;
  author_name: string;
  content: string;
  is_public: boolean;
  created_at: string;
}

interface Task {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "media" | "alta";
  data_entrega: string | null;
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

interface Profile {
  id: string;
  nome: string;
  foto_perfil: string | null;
  telefone: string;
  email?: string;
}

interface TaskParticipant {
  id: string;
  task_id: string;
  user_id: string;
  role: string;
  user: Profile;
}

interface TaskDetailsModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const priorityColors = {
  baixa: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  media: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  alta: "bg-red-500/10 text-red-500 border-red-500/20",
};

const TaskDetailsModal = ({ task, open, onOpenChange, onUpdate }: TaskDetailsModalProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [participants, setParticipants] = useState<TaskParticipant[]>([]);
  
  // Estados para edição
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados para comentários
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  
  const { toast } = useToast();
  const { id: boardId } = useParams();

  useEffect(() => {
    if (open && task) {
      fetchProfiles();
      fetchParticipants();
      fetchComments();
      setEditedTask(task);
      setIsEditing(false);
    } else {
      setParticipants([]);
      setComments([]);
      setEditedTask(null);
      setIsEditing(false);
      setNewComment("");
    }
  }, [open, task]);

  const fetchComments = async () => {
    if (!task) return;
    
    const { data, error } = await supabase
      .from("task_comments" as any)
      .select("*")
      .eq("task_id", task.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setComments(data as unknown as TaskComment[]);
    }
  };

  const handleSubmitComment = async () => {
    if (!task || !newComment.trim() || !authorName.trim()) {
      toast({
        title: "Preencha todos os campos",
        description: "Nome e comentário são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from("task_comments" as any)
        .insert({
          task_id: task.id,
          author_name: authorName.trim(),
          content: newComment.trim(),
          is_public: true,
        });

      if (error) throw error;

      toast({ title: "Comentário adicionado!" });
      setNewComment("");
      fetchComments();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar comentário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const fetchProfiles = async () => {
    console.log("🔍 fetchProfiles chamada com searchTerm:", searchTerm);
    
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id, 
        nome, 
        foto_perfil, 
        telefone
      `)
      .ilike("nome", `%${searchTerm}%`)
      .limit(10);

    console.log("📊 fetchProfiles - data:", data);
    console.log("📊 fetchProfiles - error:", error);

    if (!error && data) {
      console.log("✅ Perfis carregados:", data.length, "perfis encontrados");
      setProfiles(data);
    } else {
      console.log("❌ Erro ao carregar perfis ou nenhum dado retornado");
    }
  };

  const fetchParticipants = async () => {
    if (!task) return;

    // Buscar participantes
    const { data: participantsData, error: participantsError } = await supabase
      .from("task_participants" as any)
      .select("id, task_id, user_id, role")
      .eq("task_id", task.id);

    if (participantsError || !participantsData) {
      console.error("Erro ao buscar participantes:", participantsError);
      setParticipants([]);
      return;
    }

    // Buscar dados dos usuários separadamente
    const userIds = participantsData.map((p: any) => p.user_id);
    if (userIds.length === 0) {
      setParticipants([]);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select(`
        id, 
        nome, 
        foto_perfil, 
        telefone
      `)
      .in("id", userIds);

    if (profilesError || !profilesData) {
      console.error("Erro ao buscar perfis:", profilesError);
      setParticipants([]);
      return;
    }

    // Combinar os dados
    const participantsWithProfiles = participantsData.map((p: any) => {
      const profile = profilesData.find((profile: any) => profile.id === p.user_id);
      return {
        ...p,
        user: profile || {
          id: p.user_id,
          nome: "Usuário",
          foto_perfil: null,
          telefone: ""
        }
      };
    });

    setParticipants(participantsWithProfiles as any);
  };

  const handleAddParticipant = async (profile: Profile) => {
    console.log("🚀 handleAddParticipant chamada com profile:", profile);
    
    if (!task) {
      console.log("❌ Task não encontrada, retornando");
      return;
    }

    console.log("📋 Task atual:", task);
    console.log("👥 Participantes atuais:", participants);

    // Verificar se já é participante
    const isAlreadyParticipant = participants.some(p => p.user_id === profile.id);
    console.log("🔍 Verificando se já é participante:", isAlreadyParticipant);
    
    if (isAlreadyParticipant) {
      console.log("⚠️ Usuário já é participante");
      toast({ 
        title: "Usuário já é participante",
        variant: "destructive" 
      });
      return;
    }

    try {
      console.log("💾 Tentando inserir participante no Supabase...");
      const insertData = {
        task_id: task.id,
        user_id: profile.id,
        role: 'participant'
      };
      console.log("📝 Dados para inserção:", insertData);

      const { error, data } = await supabase
        .from("task_participants" as any)
        .insert(insertData);

      console.log("📊 Resposta do Supabase - data:", data);
      console.log("📊 Resposta do Supabase - error:", error);

      if (error) {
        console.log("❌ Erro do Supabase:", error);
        throw error;
      }

      console.log("✅ Participante adicionado com sucesso!");
      toast({ title: "Participante adicionado com sucesso!" });
      
      // Enviar notificação para o participante adicionado
      console.log("📧 Enviando notificação para o participante...");
      console.log("📧 Email do participante:", profile.email);
      try {
        await notificationService.sendTaskAssignedNotification(
          profile.nome,
          profile.telefone,
          profile.email || null,
          task.titulo
        );
        console.log("✅ Notificação enviada com sucesso!");
      } catch (notificationError) {
        console.log("❌ Erro ao enviar notificação:", notificationError);
        // Não falha a operação principal se a notificação falhar
      }
      
      console.log("🔄 Atualizando lista de participantes...");
      fetchParticipants();
      onUpdate();
    } catch (error: any) {
      console.log("💥 Erro capturado:", error);
      console.log("💥 Mensagem do erro:", error.message);
      toast({
        title: "Erro ao adicionar participante",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from("task_participants" as any)
        .delete()
        .eq("id", participantId);

      if (error) throw error;

      toast({ title: "Participante removido" });
      fetchParticipants();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao remover participante",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditTask = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedTask(task);
  };

  const handleSaveTask = async () => {
    if (!editedTask || !task) return;

    setIsSaving(true);
    try {
      console.log("💾 Salvando alterações da tarefa:", editedTask);
      
      const { error } = await supabase
        .from("tasks")
        .update({
          titulo: editedTask.titulo,
          descricao: editedTask.descricao,
          prioridade: editedTask.prioridade,
          data_entrega: editedTask.data_entrega,
          image_url_1: editedTask.image_url_1,
          image_url_2: editedTask.image_url_2,
          image_url_3: editedTask.image_url_3,
          image_url_4: editedTask.image_url_4,
          image_url_5: editedTask.image_url_5,
          image_url_6: editedTask.image_url_6,
          image_url_7: editedTask.image_url_7,
          image_url_8: editedTask.image_url_8,
          image_url_9: editedTask.image_url_9,
          image_url_10: editedTask.image_url_10,
        })
        .eq("id", task.id);

      if (error) throw error;

      console.log("✅ Tarefa atualizada com sucesso!");
      toast({ title: "Tarefa atualizada com sucesso!" });
      
      setIsEditing(false);
      onUpdate();
      
      // Chamar notificação para participantes
      console.log("📤 Enviando notificações para participantes...");
      for (const participant of participants) {
        try {
          console.log(`📧 Email do participante ${participant.user.nome}:`, participant.user.email);
          await notificationService.notifyTaskUpdated(
            participant.user.telefone,
            participant.user.email || null,
            participant.user.nome,
            editedTask.titulo
          );
          console.log(`✅ Notificação enviada para ${participant.user.nome}`);
        } catch (notificationError) {
          console.error(`❌ Erro ao enviar notificação para ${participant.user.nome}:`, notificationError);
        }
      }
      
    } catch (error: any) {
      console.error("❌ Erro ao salvar tarefa:", error);
      toast({
        title: "Erro ao salvar tarefa",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl break-words pr-8">
                {isEditing ? "Editando Tarefa" : task.titulo}
              </DialogTitle>
              <DialogDescription>
                {isEditing ? "Edite os detalhes desta tarefa" : "Visualize e edite os detalhes desta tarefa"}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={handleEditTask}>
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSaveTask}
                    disabled={isSaving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? "Salvando..." : "Salvar"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Título */}
          {isEditing && (
            <div>
              <Label className="text-base mb-2 block">Título</Label>
              <Input
                value={editedTask?.titulo || ""}
                onChange={(e) => setEditedTask(prev => prev ? {...prev, titulo: e.target.value} : null)}
                placeholder="Digite o título da tarefa"
              />
            </div>
          )}

          {/* Prioridade e Data */}
          <div className="flex items-center gap-4 flex-wrap">
            {isEditing ? (
              <>
                <div>
                  <Label className="text-sm mb-1 block">Prioridade</Label>
                  <Select
                    value={editedTask?.prioridade || "media"}
                    onValueChange={(value: "baixa" | "media" | "alta") => 
                      setEditedTask(prev => prev ? {...prev, prioridade: value} : null)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm mb-1 block">Data de Entrega</Label>
                  <Input
                    type="date"
                    value={editedTask?.data_entrega || ""}
                    onChange={(e) => setEditedTask(prev => prev ? {...prev, data_entrega: e.target.value} : null)}
                    className="w-40"
                  />
                </div>
              </>
            ) : (
              <>
                <Badge variant="outline" className={priorityColors[task.prioridade]}>
                  Prioridade: {task.prioridade}
                </Badge>
                
                {task.data_entrega && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    Entrega: {new Date(task.data_entrega).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-base mb-2 block">Descrição</Label>
            {isEditing ? (
              <Textarea
                value={editedTask?.descricao || ""}
                onChange={(e) => setEditedTask(prev => prev ? {...prev, descricao: e.target.value} : null)}
                placeholder="Digite a descrição da tarefa"
                className="min-h-[100px]"
              />
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 min-h-[100px]">
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {task.descricao || "Sem descrição"}
                </p>
              </div>
            )}
          </div>

          {/* Imagens */}
          <div>
            <Label className="text-base mb-2 flex items-center gap-2">
              <Image className="w-4 h-4" />
              Imagens ({[
                editedTask?.image_url_1, editedTask?.image_url_2, editedTask?.image_url_3,
                editedTask?.image_url_4, editedTask?.image_url_5, editedTask?.image_url_6,
                editedTask?.image_url_7, editedTask?.image_url_8, editedTask?.image_url_9,
                editedTask?.image_url_10
              ].filter(Boolean).length}/10)
            </Label>
            <TaskImageUpload
              taskId={task.id}
              imageUrls={[
                editedTask?.image_url_1 || null,
                editedTask?.image_url_2 || null,
                editedTask?.image_url_3 || null,
                editedTask?.image_url_4 || null,
                editedTask?.image_url_5 || null,
                editedTask?.image_url_6 || null,
                editedTask?.image_url_7 || null,
                editedTask?.image_url_8 || null,
                editedTask?.image_url_9 || null,
                editedTask?.image_url_10 || null,
              ]}
              onImagesUpdate={async (urls) => {
                const updatedTask = {
                  ...editedTask,
                  image_url_1: urls[0],
                  image_url_2: urls[1],
                  image_url_3: urls[2],
                  image_url_4: urls[3],
                  image_url_5: urls[4],
                  image_url_6: urls[5],
                  image_url_7: urls[6],
                  image_url_8: urls[7],
                  image_url_9: urls[8],
                  image_url_10: urls[9],
                };
                setEditedTask(prev => prev ? updatedTask as Task : null);
                
                // Auto-save images
                try {
                  await supabase
                    .from("tasks")
                    .update({
                      image_url_1: urls[0],
                      image_url_2: urls[1],
                      image_url_3: urls[2],
                      image_url_4: urls[3],
                      image_url_5: urls[4],
                      image_url_6: urls[5],
                      image_url_7: urls[6],
                      image_url_8: urls[7],
                      image_url_9: urls[8],
                      image_url_10: urls[9],
                    })
                    .eq("id", task.id);
                  onUpdate();
                } catch (error) {
                  console.error("Erro ao salvar imagens:", error);
                }
              }}
            />
          </div>

          {/* Participantes */}
          <div>
            <Label className="text-base mb-2 block">Participantes</Label>
            {participants.length > 0 ? (
              <div className="space-y-2 mb-3">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 bg-muted/30 rounded-lg p-3"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={participant.user.foto_perfil || undefined} />
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        {participant.user.nome.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{participant.user.nome}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveParticipant(participant.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">Nenhum participante adicionado</p>
            )}
          </div>

          {/* Adicionar Participante */}
          <div>
            <Label className="text-base mb-2 block">Adicionar Participante</Label>
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyUp={fetchProfiles}
              className="mb-3"
            />
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => {
                    console.log("🖱️ Clique detectado no perfil:", profile);
                    handleAddParticipant(profile);
                  }}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={profile.foto_perfil || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile.nome.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{profile.nome}</p>
                  </div>
                  <Button size="sm" variant="ghost">
                    Adicionar
                  </Button>
                </div>
              ))}
              
              {profiles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum usuário encontrado
                </p>
              )}
            </div>
          </div>

          {/* Comentários */}
          <div className="border-t pt-6">
            <Label className="text-base mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Comentários ({comments.length})
            </Label>
            
            {/* Formulário de novo comentário */}
            <div className="space-y-3 mb-4">
              <Input
                placeholder="Seu nome"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
              <div className="flex gap-2">
                <Textarea
                  placeholder="Escreva um comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button
                  onClick={handleSubmitComment}
                  disabled={submittingComment || !newComment.trim() || !authorName.trim()}
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Lista de comentários */}
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {comments.map((comment) => (
                <div key={comment.id} className="bg-muted/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {comment.author_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{comment.author_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
              
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comentário ainda
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailsModal;

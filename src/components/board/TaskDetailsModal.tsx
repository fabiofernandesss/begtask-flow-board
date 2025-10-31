import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, X, Edit, Save, Cancel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { notificationService } from "@/services/notificationService";
import { useParams } from "react-router-dom";

interface Task {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "media" | "alta";
  data_entrega: string | null;
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
  
  const { toast } = useToast();
  const { id: boardId } = useParams();

  useEffect(() => {
    if (open && task) {
      fetchProfiles();
      fetchParticipants();
      setEditedTask(task);
      setIsEditing(false);
    } else {
      setParticipants([]);
      setEditedTask(null);
      setIsEditing(false);
    }
  }, [open, task]);

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
      
      // Buscar emails dos usuários separadamente
      const userIds = data.map((profile: any) => profile.id);
      const { data: usersData, error: usersError } = await supabase
        .from("auth.users")
        .select("id, email")
        .in("id", userIds);

      if (usersError) {
        console.error("Erro ao buscar emails dos usuários:", usersError);
      }

      // Mapear os dados para incluir o email
      const profilesWithEmail = data.map((profile: any) => {
        const user = usersData?.find((user: any) => user.id === profile.id);
        return {
          ...profile,
          email: user?.email || null
        };
      });
      setProfiles(profilesWithEmail);
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

    // Buscar emails dos usuários separadamente
    const { data: usersData, error: usersError } = await supabase
      .from("auth.users")
      .select("id, email")
      .in("id", userIds);

    if (profilesError || !profilesData) {
      console.error("Erro ao buscar perfis:", profilesError);
      setParticipants([]);
      return;
    }

    if (usersError) {
      console.error("Erro ao buscar usuários:", usersError);
    }

    // Combinar os dados
    const participantsWithProfiles = participantsData.map((p: any) => {
      const profile = profilesData.find((profile: any) => profile.id === p.user_id);
      const user = usersData?.find((user: any) => user.id === p.user_id);
      return {
        ...p,
        user: profile ? {
          ...profile,
          email: user?.email || null
        } : {
          id: p.user_id,
          nome: "Usuário",
          foto_perfil: null,
          telefone: "",
          email: null
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
            <div>
              <DialogTitle className="text-xl">
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
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {task.descricao || "Sem descrição"}
                </p>
              </div>
            )}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDetailsModal;

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, User, X } from "lucide-react";
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
  const { toast } = useToast();
  const { id: boardId } = useParams();

  useEffect(() => {
    if (open && task) {
      fetchProfiles();
      fetchParticipants();
    } else {
      setParticipants([]);
    }
  }, [open, task]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nome, foto_perfil, telefone")
      .ilike("nome", `%${searchTerm}%`)
      .limit(10);

    if (!error && data) {
      setProfiles(data);
    }
  };

  const fetchParticipants = async () => {
    if (!task) return;

    const { data, error } = await supabase
      .from("task_participants" as any)
      .select(`
        id,
        task_id,
        user_id,
        role,
        user:profiles(id, nome, foto_perfil, telefone)
      `)
      .eq("task_id", task.id);

    if (!error && data) {
      setParticipants(data as any);
    }
  };

  const handleAddParticipant = async (profile: Profile) => {
    if (!task) return;

    // Verificar se já é participante
    const isAlreadyParticipant = participants.some(p => p.user_id === profile.id);
    if (isAlreadyParticipant) {
      toast({ 
        title: "Usuário já é participante",
        variant: "destructive" 
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("task_participants" as any)
        .insert({
          task_id: task.id,
          user_id: profile.id,
          role: 'participant'
        });

      if (error) throw error;

      toast({ title: "Participante adicionado com sucesso!" });
      fetchParticipants();
      onUpdate();
    } catch (error: any) {
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

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{task.titulo}</DialogTitle>
          <DialogDescription>
            Visualize e edite os detalhes desta tarefa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Prioridade e Data */}
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="outline" className={priorityColors[task.prioridade]}>
              Prioridade: {task.prioridade}
            </Badge>
            
            {task.data_entrega && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Entrega: {new Date(task.data_entrega).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-base mb-2 block">Descrição</Label>
            <div className="bg-muted/30 rounded-lg p-4 min-h-[100px]">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {task.descricao || "Sem descrição"}
              </p>
            </div>
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
                  onClick={() => handleAddParticipant(profile)}
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

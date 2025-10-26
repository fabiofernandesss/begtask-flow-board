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
  responsavel_id: string | null;
}

interface Profile {
  id: string;
  nome: string;
  foto_perfil: string | null;
  telefone: string;
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
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const { toast } = useToast();
  const { id: boardId } = useParams();

  useEffect(() => {
    if (open) {
      fetchProfiles();
      if (task?.responsavel_id) {
        fetchSelectedUser(task.responsavel_id);
      }
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

  const fetchSelectedUser = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, foto_perfil, telefone")
      .eq("id", userId)
      .single();

    if (data) {
      setSelectedUser(data);
    }
  };

  const handleAssignUser = async (profile: Profile) => {
    if (!task || !boardId) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ responsavel_id: profile.id })
        .eq("id", task.id);

      if (error) throw error;

      setSelectedUser(profile);
      
      // Buscar email do usuário e enviar notificação
      try {
        const { data: userEmail, error: emailError } = await supabase
          .rpc('get_user_email', { user_id: profile.id });
        
        if (emailError) {
          console.error("Erro ao buscar email do usuário:", emailError);
        } else {
          await notificationService.sendTaskAssignedNotification(
            profile.nome,
            profile.telefone,
            userEmail || '',
            task.titulo
          );
        }
      } catch (notificationError) {
        console.error("Erro ao enviar notificação:", notificationError);
        // Não falha a operação principal se a notificação falhar
      }

      toast({ title: "Usuário atribuído com sucesso!" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao atribuir usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveUser = async () => {
    if (!task) return;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ responsavel_id: null })
        .eq("id", task.id);

      if (error) throw error;

      setSelectedUser(null);
      toast({ title: "Usuário removido da tarefa" });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Erro ao remover usuário",
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

          {/* Responsável Atual */}
          {selectedUser && (
            <div>
              <Label className="text-base mb-2 block">Participante principal</Label>
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={selectedUser.foto_perfil || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {selectedUser.nome.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{selectedUser.nome}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveUser}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Adicionar Usuário */}
          <div>
            <Label className="text-base mb-2 block">
              {selectedUser ? "Alterar Participante principal" : "Atribuir Participante principal"}
            </Label>
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
                  onClick={() => handleAssignUser(profile)}
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

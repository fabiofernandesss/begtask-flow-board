import { Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, GripVertical, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Task {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "media" | "alta";
  data_entrega: string | null;
  responsavel_id?: string | null;
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

interface TaskCardProps {
  task: Task;
  index: number;
  onDelete: (taskId: string) => void;
  onClick: (task: Task) => void;
  teamMembers?: TeamMember[];
  taskParticipants?: TaskParticipant[];
}

const priorityColors = {
  baixa: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  media: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  alta: "bg-red-500/10 text-red-500 border-red-500/20",
};

const TaskCard = ({ task, index, onDelete, onClick, teamMembers = [], taskParticipants = [] }: TaskCardProps) => {
  // Obter participantes desta tarefa específica
  const participants = taskParticipants.filter(p => p.task_id === task.id);
  
  // Obter responsável da tarefa
  const responsavel = teamMembers.find(member => member.id === task.responsavel_id);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="bg-background border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-2">
            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
            
            <div className="flex-1 cursor-pointer" onClick={() => onClick(task)}>
              <h4 className="font-medium text-sm text-foreground mb-1">{task.titulo}</h4>
              {task.descricao && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {task.descricao}
                </p>
              )}
              
              <div className="flex items-center gap-2 flex-wrap justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={priorityColors[task.prioridade]}>
                    {task.prioridade}
                  </Badge>
                  {task.data_entrega && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {new Date(task.data_entrega).toLocaleDateString()}
                    </div>
                  )}
                </div>
                
                {/* Indicadores de participantes */}
                <div className="flex items-center gap-1">
                  {(() => {
                    // Combinar responsável e participantes para exibição
                    const allParticipants = [];
                    
                    // Adicionar responsável se existir
                    if (responsavel) {
                      allParticipants.push({
                        id: `responsavel-${responsavel.id}`,
                        user: responsavel,
                        role: 'responsible',
                        isResponsavel: true
                      });
                    }
                    
                    // Adicionar participantes (excluindo o responsável se já foi adicionado)
                    participants
                      .filter(participant => participant.user_id !== task.responsavel_id)
                      .forEach(participant => {
                        allParticipants.push({
                          ...participant,
                          isResponsavel: false
                        });
                      });
                    
                    // Se não há participantes, não mostrar nada
                    if (allParticipants.length === 0) return null;
                    
                    const maxVisible = 3;
                    const visibleParticipants = allParticipants.slice(0, maxVisible);
                    const remaining = allParticipants.length - maxVisible;
                    
                    return (
                      <>
                        {visibleParticipants.map((participant) => (
                          <Avatar 
                            key={participant.id} 
                            className={`w-6 h-6 border-2 ${
                              participant.role === 'responsible' || participant.isResponsavel 
                                ? 'border-primary' 
                                : 'border-background'
                            }`}
                            title={`${participant.user.nome} (${
                              participant.role === 'responsible' || participant.isResponsavel 
                                ? 'Participante principal' 
                                : 'Participante'
                            })`}
                          >
                            <AvatarImage src={participant.user.foto_perfil || undefined} />
                            <AvatarFallback className={`text-[10px] ${
                              participant.role === 'responsible' || participant.isResponsavel
                                ? 'bg-primary/10 text-primary' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {participant.user.nome.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        
                        {/* Contador de participantes adicionais */}
                        {remaining > 0 && (
                          <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center">
                            <span className="text-[10px] font-medium text-muted-foreground">
                              +{remaining}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(task.id)}>Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;

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
              <h4 className="font-medium text-sm text-foreground mb-1 break-words line-clamp-2">{task.titulo}</h4>
              {task.descricao && (
                <p className="text-xs text-muted-foreground mb-2 break-words line-clamp-2">
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
                
                {/* Indicadores de participantes - avatares sobrepostos */}
                <div className="flex items-center -space-x-2">
                  {(() => {
                    // Se não há participantes, não mostrar nada
                    if (participants.length === 0) return null;
                    
                    const maxVisible = 4;
                    const visibleParticipants = participants.slice(0, maxVisible);
                    const remaining = participants.length - maxVisible;
                    
                    return (
                      <>
                        {visibleParticipants.map((participant, index) => (
                          <Avatar 
                            key={participant.id} 
                            className="w-7 h-7 border-2 border-muted ring-2 ring-background"
                            style={{ zIndex: maxVisible - index }}
                            title={participant.user.nome}
                          >
                            <AvatarImage src={participant.user.foto_perfil || undefined} />
                            <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                              {participant.user.nome.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        
                        {/* Contador de participantes adicionais */}
                        {remaining > 0 && (
                          <div 
                            className="w-7 h-7 rounded-full border-2 border-muted ring-2 ring-background bg-muted flex items-center justify-center"
                            style={{ zIndex: 0 }}
                          >
                            <span className="text-[10px] font-semibold text-muted-foreground">
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

import { useState } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Copy } from "lucide-react";
import TaskCard from "./TaskCard";
import CreateTaskDialog from "./CreateTaskDialog";
import { useToast } from "@/hooks/use-toast";
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

interface ColumnProps {
  column: {
    id: string;
    titulo: string;
    posicao: number;
    cor?: string;
    tasks: Task[];
  };
  index: number;
  onDelete: (columnId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onTaskCreated: () => void;
  teamMembers?: TeamMember[];
  taskParticipants?: TaskParticipant[];
}

const Column = ({ column, index, onDelete, onDeleteTask, onTaskClick, onTaskCreated, teamMembers = [], taskParticipants = [] }: ColumnProps) => {
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const { toast } = useToast();

  const handleCopyColumnTexts = () => {
    if (column.tasks.length === 0) {
      toast({
        title: "Nenhuma tarefa na coluna",
        variant: "destructive",
      });
      return;
    }

    const textsArray = column.tasks.map((task, idx) => {
      let text = `📋 ${task.titulo}`;
      if (task.descricao) {
        text += `\n${task.descricao}`;
      }
      return text;
    });

    const fullText = textsArray.join('\n\n---\n\n');
    
    navigator.clipboard.writeText(fullText).then(() => {
      toast({
        title: "Texto copiado!",
        description: `${column.tasks.length} tarefa(s) copiada(s)`,
      });
    }).catch(() => {
      toast({
        title: "Erro ao copiar",
        variant: "destructive",
      });
    });
  };

  return (
    <>
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        columnId={column.id}
        onTaskCreated={() => {
          setCreateTaskOpen(false);
          onTaskCreated();
        }}
      />
      <Draggable draggableId={column.id} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="flex-shrink-0 w-80 bg-card rounded-lg border shadow-sm"
          style={{ borderColor: column.cor || '#6366f1' }}
        >
          <div
            className="flex items-center justify-between p-4 border-b"
            style={{ 
              borderColor: column.cor || '#6366f1',
              background: `linear-gradient(135deg, ${column.cor || '#6366f1'}15 0%, transparent 100%)`
            }}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: column.cor || '#6366f1' }}
              />
              <h3 className="font-semibold text-foreground">{column.titulo}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {column.tasks.length}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreateTaskOpen(true)}
                className="h-8 w-8 p-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyColumnTexts}
                className="h-8 w-8 p-0"
                title="Copiar textos das tarefas"
              >
                <Copy className="w-4 h-4" />
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir coluna?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Todas as tarefas desta coluna serão excluídas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(column.id)}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <Droppable droppableId={column.id} type="task">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`p-4 min-h-[200px] space-y-3 ${
                  snapshot.isDraggingOver ? "bg-accent/50" : ""
                }`}
              >
                {column.tasks.map((task, taskIndex) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={taskIndex}
                    onDelete={onDeleteTask}
                    onClick={onTaskClick}
                    teamMembers={teamMembers}
                    taskParticipants={taskParticipants}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      )}
      </Draggable>
    </>
  );
};

export default Column;

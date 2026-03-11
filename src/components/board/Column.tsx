import { useState } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy, ChevronLeft, ChevronRight, Pencil, Check, X } from "lucide-react";
import TaskCard from "./TaskCard";
import CreateTaskDialog from "./CreateTaskDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  totalColumns: number;
  onDelete: (columnId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onTaskClick: (task: Task) => void;
  onTaskCreated: () => void;
  onMoveColumn: (columnId: string, direction: 'left' | 'right') => void;
  onRenameColumn: (columnId: string, newTitle: string) => void;
  teamMembers?: TeamMember[];
  taskParticipants?: TaskParticipant[];
}

const Column = ({ column, index, totalColumns, onDelete, onDeleteTask, onTaskClick, onTaskCreated, onMoveColumn, onRenameColumn, teamMembers = [], taskParticipants = [] }: ColumnProps) => {
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.titulo);
  const { toast } = useToast();

  const handleCopyColumnTexts = () => {
    if (column.tasks.length === 0) {
      toast({
        title: "Nenhuma tarefa na coluna",
        variant: "destructive",
      });
      return;
    }

    const textsArray = column.tasks.map((task) => {
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

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== column.titulo) {
      onRenameColumn(column.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(column.titulo);
    setIsEditing(false);
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
          className="flex-shrink-0 w-80 bg-card rounded-[4px] border shadow-sm"
          style={{ ...provided.draggableProps.style, borderColor: column.cor || '#6366f1' }}
        >
          <div
            {...provided.dragHandleProps}
            className="flex items-center justify-between p-3 border-b"
            style={{ 
              borderColor: column.cor || '#6366f1',
              background: `linear-gradient(135deg, ${column.cor || '#6366f1'}15 0%, transparent 100%)`
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Move left */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMoveColumn(column.id, 'left')}
                disabled={index === 0}
                className="h-6 w-6 p-0 flex-shrink-0"
                title="Mover para esquerda"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              <div 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: column.cor || '#6366f1' }}
              />

              {isEditing ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="h-6 text-sm py-0 px-1"
                    autoFocus
                  />
                  <Button variant="ghost" size="sm" onClick={handleSaveTitle} className="h-6 w-6 p-0">
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-6 w-6 p-0">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <h3 
                    className="font-semibold text-foreground text-sm truncate cursor-pointer"
                    onDoubleClick={() => setIsEditing(true)}
                    title="Clique duas vezes para editar"
                  >
                    {column.titulo}
                  </h3>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                    {column.tasks.length}
                  </span>
                </>
              )}

              {/* Move right */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMoveColumn(column.id, 'right')}
                disabled={index === totalColumns - 1}
                className="h-6 w-6 p-0 flex-shrink-0"
                title="Mover para direita"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {!isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="h-7 w-7 p-0"
                  title="Editar nome"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreateTaskOpen(true)}
                className="h-7 w-7 p-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyColumnTexts}
                className="h-7 w-7 p-0"
                title="Copiar textos das tarefas"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Trash2 className="w-3.5 h-3.5" />
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
                className={`p-3 min-h-[200px] space-y-2 ${
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
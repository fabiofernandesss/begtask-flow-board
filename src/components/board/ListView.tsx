import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  data_entrega: string | null;
}

interface Column {
  id: string;
  titulo: string;
  cor?: string;
  tasks: Task[];
}

interface ListViewProps {
  columns: Column[];
  onDeleteTask: (taskId: string) => void;
}

const priorityColors = {
  baixa: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  media: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  alta: "bg-red-500/10 text-red-500 border-red-500/20",
};

const ListView = ({ columns, onDeleteTask }: ListViewProps) => {
  return (
    <div className="space-y-8">
      {columns.map((column) => (
        <div 
          key={column.id} 
          className="bg-card rounded-lg border overflow-hidden"
          style={{ borderColor: column.cor || '#6366f1' }}
        >
          <div 
            className="px-6 py-4 flex items-center gap-3"
            style={{ 
              borderColor: column.cor || '#6366f1',
              background: `linear-gradient(135deg, ${column.cor || '#6366f1'}15 0%, transparent 100%)`
            }}
          >
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: column.cor || '#6366f1' }}
            />
            <h3 className="font-semibold text-lg">{column.titulo}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {column.tasks.length}
            </span>
          </div>

          {column.tasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Tarefa</TableHead>
                  <TableHead className="w-[30%]">Descrição</TableHead>
                  <TableHead className="w-[15%]">Prioridade</TableHead>
                  <TableHead className="w-[15%]">Data Entrega</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {column.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.titulo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.descricao || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={priorityColors[task.prioridade]}>
                        {task.prioridade}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.data_entrega ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3" />
                          {new Date(task.data_entrega).toLocaleDateString()}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteTask(task.id)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p>Nenhuma tarefa nesta coluna</p>
            </div>
          )}
        </div>
      ))}

      {columns.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Crie colunas para começar a organizar suas tarefas</p>
        </div>
      )}
    </div>
  );
};

export default ListView;

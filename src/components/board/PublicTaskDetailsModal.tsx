import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, User, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
}

interface TaskComment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  is_public: boolean;
}

interface PublicTaskDetailsModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityColors = {
  baixa: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  media: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  alta: "bg-red-500/10 text-red-500 border-red-500/20",
};

const PublicTaskDetailsModal = ({ task, open, onOpenChange }: PublicTaskDetailsModalProps) => {
  const [responsavel, setResponsavel] = useState<Profile | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && task) {
      fetchResponsavel();
      fetchComments();
    }
  }, [open, task]);

  const fetchResponsavel = async () => {
    if (!task?.responsavel_id) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, foto_perfil")
        .eq("id", task.responsavel_id)
        .single();

      if (error) throw error;
      setResponsavel(data);
    } catch (error) {
      console.error("Erro ao buscar responsável:", error);
    }
  };

  const fetchComments = async () => {
    if (!task) return;

    try {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", task.id)
        .eq("is_public", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error("Erro ao buscar comentários:", error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || !authorName.trim() || !task) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("task_comments")
        .insert({
          task_id: task.id,
          author_name: authorName.trim(),
          content: newComment.trim(),
          is_public: true
        });

      if (error) throw error;

      setNewComment("");
      setAuthorName("");
      fetchComments();
      
      toast({
        title: "Comentário adicionado",
        description: "Seu comentário foi publicado com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar comentário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{task.titulo}</DialogTitle>
          <DialogDescription>
            Detalhes da tarefa - Visualização pública
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

          {/* Responsável */}
          {responsavel && (
            <div>
-              <Label className="text-base mb-2 block">Responsável</Label>
+              <Label className="text-base mb-2 block">Participante principal</Label>
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={responsavel.foto_perfil || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {responsavel.nome.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">{responsavel.nome}</p>
                </div>
              </div>
            </div>
          )}

          {/* Seção de Comentários */}
          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5" />
              <Label className="text-base">Comentários Públicos</Label>
            </div>

            {/* Lista de Comentários */}
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">
                          {comment.author_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-sm">{comment.author_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comentário ainda. Seja o primeiro a comentar!
                </p>
              )}
            </div>

            {/* Formulário para Novo Comentário */}
            <form onSubmit={handleSubmitComment} className="space-y-4">
              <div>
                <Label htmlFor="author-name">Seu nome</Label>
                <Input
                  id="author-name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Digite seu nome"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="comment">Comentário</Label>
                <Textarea
                  id="comment"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escreva seu comentário..."
                  rows={3}
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={submitting || !newComment.trim() || !authorName.trim()}
                className="w-full"
              >
                {submitting ? "Enviando..." : "Adicionar Comentário"}
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PublicTaskDetailsModal;
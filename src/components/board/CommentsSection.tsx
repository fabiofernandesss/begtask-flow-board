import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageCircle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  author_name: string;
  content: string;
  created_at: string;
  is_public: boolean;
}

interface CommentsSectionProps {
  boardId: string;
  isPublic?: boolean; // true para comentários públicos, false para internos
  className?: string;
}

const CommentsSection = ({ boardId, isPublic = true, className = "" }: CommentsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchComments();
    if (!isPublic) {
      fetchUserProfile();
    }
  }, [boardId, isPublic]);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data?.nome) {
        setAuthorName(data.nome);
      }
    } catch (error: any) {
      console.error("Erro ao buscar perfil do usuário:", error);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      // Buscar todos os comentários do board, independente de serem públicos ou internos
      const { data, error } = await supabase
        .from("board_comments")
        .select("*")
        .eq("board_id", boardId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar comentários:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os comentários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !authorName.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha seu nome e o comentário.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("board_comments")
        .insert({
          board_id: boardId,
          author_name: authorName.trim(),
          content: newComment.trim(),
          is_public: isPublic,
        });

      if (error) throw error;

      setNewComment("");
      if (isPublic) {
        setAuthorName(""); // Limpar nome apenas para comentários públicos
      }
      
      toast({
        title: "Comentário enviado",
        description: "Seu comentário foi adicionado com sucesso.",
      });

      fetchComments();
    } catch (error: any) {
      console.error("Erro ao enviar comentário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o comentário. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("board_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast({
        title: "Comentário excluído",
        description: "O comentário foi removido com sucesso.",
      });

      fetchComments();
    } catch (error: any) {
      console.error("Erro ao excluir comentário:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o comentário.",
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Comentários
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lista de comentários */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center text-muted-foreground py-4">
                Carregando comentários...
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                Seja o primeiro a comentar neste projeto!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className={`flex gap-3 p-3 rounded-lg ${comment.is_public ? 'bg-muted/50' : 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'}`}>
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(comment.author_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{comment.author_name}</span>
                        <Badge variant={comment.is_public ? "secondary" : "default"} className="text-xs">
                          {comment.is_public ? "Público" : "Interno"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(comment.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </span>
                        {!isPublic && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteComment(comment.id)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Formulário para novo comentário */}
          <div className="space-y-3 border-t pt-4">
            {isPublic ? (
              <Input
                placeholder="Seu nome"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full"
              />
            ) : (
              authorName && (
                <div className="text-sm text-muted-foreground">
                  Comentando como: <span className="font-medium text-foreground">{authorName}</span>
                </div>
              )
            )}
            <div className="flex gap-2">
              <Textarea
                placeholder={isPublic ? "Escreva seu comentário..." : "Adicionar comentário interno..."}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 min-h-[80px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
              />
              <Button
                onClick={submitComment}
                disabled={submitting || !newComment.trim() || (isPublic && !authorName.trim())}
                size="icon"
                className="shrink-0 self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pressione Ctrl + Enter para enviar rapidamente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CommentsSection;
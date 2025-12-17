import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, Users, Phone, Loader2 } from "lucide-react";
import { whatsappService } from "@/services/whatsappService";

interface Column {
  id: string;
  tasks: {
    id: string;
    responsavel_id: string | null;
  }[];
}

interface UserWithPhone {
  id: string;
  nome: string;
  telefone: string;
}

interface WhatsAppBroadcastProps {
  boardId: string;
  columns: Column[];
}

const WhatsAppBroadcast = ({ boardId, columns }: WhatsAppBroadcastProps) => {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<UserWithPhone[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchUniqueUsers();
  }, [columns]);

  const fetchUniqueUsers = async () => {
    setLoading(true);
    try {
      // Coletar todos os IDs de responsáveis das tarefas
      const responsavelIds = new Set<string>();
      columns.forEach(col => {
        col.tasks.forEach(task => {
          if (task.responsavel_id) {
            responsavelIds.add(task.responsavel_id);
          }
        });
      });

      // Buscar participantes de todas as tarefas
      const taskIds = columns.flatMap(col => col.tasks.map(t => t.id));
      
      if (taskIds.length > 0) {
        const { data: participantsData } = await supabase
          .from("task_participants")
          .select("user_id")
          .in("task_id", taskIds);
        
        if (participantsData) {
          participantsData.forEach((p: any) => {
            responsavelIds.add(p.user_id);
          });
        }
      }

      // Buscar perfis dos usuários únicos
      const userIds = Array.from(responsavelIds);
      
      if (userIds.length > 0) {
        const { data: profilesData, error } = await supabase
          .from("profiles")
          .select("id, nome, telefone")
          .in("id", userIds);
        
        if (error) throw error;
        
        // Filtrar apenas usuários com telefone
        const usersWithPhone = (profilesData || []).filter(p => p.telefone);
        setUsers(usersWithPhone);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem para enviar",
        variant: "destructive",
      });
      return;
    }

    if (users.length === 0) {
      toast({
        title: "Sem destinatários",
        description: "Não há usuários com telefone cadastrado nas tarefas",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const phoneNumbers = users.map(u => u.telefone);
      const result = await whatsappService.sendMultipleMessages(phoneNumbers, message.trim());
      
      if (result.success) {
        toast({
          title: "Mensagem enviada!",
          description: `Enviado para ${users.length} usuário(s)`,
        });
        setMessage("");
      } else {
        throw new Error(result.error || "Erro desconhecido");
      }
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Mensagem em Massa via WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de destinatários */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Destinatários ({users.length})
            </span>
          </div>
          
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando usuários...
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum usuário com telefone cadastrado nas tarefas
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {users.map(user => (
                <div
                  key={user.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs"
                >
                  {user.nome}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Campo de mensagem */}
        <div className="space-y-2">
          <Textarea
            placeholder="Digite sua mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Pressione Enter para enviar ou Shift + Enter para nova linha
          </p>
        </div>

        {/* Botão de envio */}
        <Button
          onClick={handleSendMessage}
          disabled={sending || users.length === 0 || !message.trim()}
          className="w-full gap-2"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Enviar para {users.length} usuário(s)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default WhatsAppBroadcast;

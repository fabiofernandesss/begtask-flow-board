import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, Trash2, Search, Loader2, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  nome: string;
  foto_perfil: string | null;
  telefone: string;
  email?: string;
}

interface BoardPeopleSectionProps {
  boardId: string;
  className?: string;
  onMembersChanged?: () => void;
}

export default function BoardPeopleSection({ boardId, className, onMembersChanged }: BoardPeopleSectionProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchMembers();
    fetchAllUsers();
  }, [boardId]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      // Get board owner
      const { data: board } = await supabase
        .from("boards")
        .select("owner_id")
        .eq("id", boardId)
        .single();

      // Get users with access
      const { data: accessData } = await supabase
        .from("user_board_access")
        .select("user_id")
        .eq("board_id", boardId);

      const memberIds = new Set<string>();
      if (board?.owner_id) memberIds.add(board.owner_id);
      accessData?.forEach((a) => memberIds.add(a.user_id));

      if (memberIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nome, foto_perfil, telefone")
          .in("id", Array.from(memberIds));

        // Get emails
        const { data: emails } = await supabase.rpc("get_user_emails", {
          user_ids: Array.from(memberIds),
        });

        const profilesWithEmail = (profiles || []).map((p) => ({
          ...p,
          email: emails?.find((e: any) => e.id === p.id)?.email || "",
          isOwner: p.id === board?.owner_id,
        }));

        setMembers(profilesWithEmail);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      console.error("Erro ao carregar membros:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, foto_perfil, telefone")
        .eq("status", "ativo");

      if (profiles) {
        const { data: emails } = await supabase.rpc("get_user_emails", {
          user_ids: profiles.map((p) => p.id),
        });

        setAllUsers(
          profiles.map((p) => ({
            ...p,
            email: emails?.find((e: any) => e.id === p.id)?.email || "",
          }))
        );
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    }
  };

  const addMember = async (userId: string) => {
    setAdding(userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Add board access
      const { error } = await supabase.from("user_board_access").insert({
        board_id: boardId,
        user_id: userId,
        created_by: user?.id,
      });

      if (error) throw error;

      // Add user as participant to all tasks in this board
      const { data: columns } = await supabase
        .from("columns")
        .select("id")
        .eq("board_id", boardId);

      if (columns && columns.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id")
          .in("column_id", columns.map((c) => c.id));

        if (tasks && tasks.length > 0) {
          const participantInserts = tasks.map((task) => ({
            task_id: task.id,
            user_id: userId,
            role: "participant",
          }));

          // Insert ignoring duplicates
          for (const insert of participantInserts) {
            await supabase
              .from("task_participants")
              .upsert(insert, { onConflict: "task_id,user_id", ignoreDuplicates: true })
              .select();
          }
        }
      }

      toast({ title: "Membro adicionado", description: "Usuário adicionado ao projeto e todas as tarefas." });
      fetchMembers();
      onMembersChanged?.();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setAdding(null);
    }
  };

  const removeMember = async (userId: string) => {
    setRemoving(userId);
    try {
      // Remove board access
      const { error } = await supabase
        .from("user_board_access")
        .delete()
        .eq("board_id", boardId)
        .eq("user_id", userId);

      if (error) throw error;

      // Remove from all task participants in this board
      const { data: columns } = await supabase
        .from("columns")
        .select("id")
        .eq("board_id", boardId);

      if (columns && columns.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id")
          .in("column_id", columns.map((c) => c.id));

        if (tasks && tasks.length > 0) {
          await supabase
            .from("task_participants")
            .delete()
            .eq("user_id", userId)
            .in("task_id", tasks.map((t) => t.id));
        }
      }

      toast({ title: "Membro removido", description: "Usuário removido do projeto e de todas as tarefas." });
      fetchMembers();
      onMembersChanged?.();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  const syncAllMembersToTasks = async () => {
    setSyncing(true);
    try {
      const { data: columns } = await supabase
        .from("columns")
        .select("id")
        .eq("board_id", boardId);

      if (!columns || columns.length === 0) {
        toast({ title: "Sem colunas", description: "Este projeto não possui colunas ainda." });
        return;
      }

      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .in("column_id", columns.map((c) => c.id));

      if (!tasks || tasks.length === 0) {
        toast({ title: "Sem tarefas", description: "Este projeto não possui tarefas ainda." });
        return;
      }

      let count = 0;
      for (const member of members) {
        for (const task of tasks) {
          await supabase
            .from("task_participants")
            .upsert(
              { task_id: task.id, user_id: member.id, role: "participant" },
              { onConflict: "task_id,user_id", ignoreDuplicates: true }
            )
            .select();
          count++;
        }
      }

      toast({
        title: "Tarefas atualizadas",
        description: `${members.length} membro(s) sincronizado(s) em ${tasks.length} tarefa(s).`,
      });
      onMembersChanged?.();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const memberIds = new Set(members.map((m) => m.id));
  const availableUsers = allUsers.filter(
    (u) => !memberIds.has(u.id) && (
      u.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div className={cn("max-w-4xl mx-auto space-y-6", className)}>
      {/* Current Members */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-[hsl(271,76%,44%)] flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">Membros do Projeto</h3>
            <p className="text-sm text-muted-foreground">{members.length} pessoa(s)</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={syncAllMembersToTasks}
            disabled={syncing || members.length === 0}
            className="gap-1.5"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Atualizar Tarefas
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">Nenhum membro no projeto ainda.</p>
        ) : (
          <div className="space-y-2">
            {members.map((member: any) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.foto_perfil || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(member.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {member.nome}
                      {member.isOwner && (
                        <span className="ml-2 text-xs text-primary font-normal">(Dono)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                {!member.isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeMember(member.id)}
                    disabled={removing === member.id}
                  >
                    {removing === member.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Members */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Adicionar Pessoas
        </h3>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {availableUsers.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">
            {searchQuery ? "Nenhum usuário encontrado." : "Todos os usuários ativos já são membros."}
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {availableUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.foto_perfil || undefined} />
                    <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                      {getInitials(user.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{user.nome}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => addMember(user.id)}
                  disabled={adding === user.id}
                  className="gap-1"
                >
                  {adding === user.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserPlus className="w-3 h-3" />
                  )}
                  Adicionar
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

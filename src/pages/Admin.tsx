import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Shield, User, Eye, Edit, Search, Blocks } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ManageBoardAccessDialog from "@/components/dashboard/ManageBoardAccessDialog";
import logoBEG from "@/assets/logoBEG.png";

type Profile = {
  id: string;
  nome: string;
  telefone: string;
  status: string;
  created_at: string;
};

type UserRole = {
  id: string;
  user_id: string;
  role: "admin" | "editor" | "visualizador";
};

const Admin = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [manageBoardsOpen, setManageBoardsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      // Check if user has admin role in database
      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error || !roleData) {
        toast.error("Acesso negado. Você não tem permissão de administrador.");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      fetchUsers();
    } catch (error: any) {
      toast.error("Erro ao verificar permissões");
      navigate("/dashboard");
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      setProfiles(profilesData || []);
      const validRoles = (rolesData || []).filter(
        (r: any) => r.role === "admin" || r.role === "editor" || r.role === "visualizador"
      ) as UserRole[];
      setUserRoles(validRoles);
    } catch (error: any) {
      toast.error("Erro ao carregar usuários: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: "admin" | "editor" | "visualizador" | "sem_role") => {
    try {
      if (newRole === "sem_role") {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);
        if (error) throw error;
        toast.success("Role removida com sucesso");
      } else {
        const currentRole = getUserRole(userId);
        if (currentRole) {
          const { error } = await supabase
            .from("user_roles")
            .update({ role: newRole })
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: newRole });
          if (error) throw error;
        }
        toast.success(`Usuário atualizado para ${newRole}`);
      }
      fetchUsers();
    } catch (error: any) {
      toast.error("Erro ao atualizar role: " + error.message);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "ativo" ? "aguardando" : "ativo";
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", userId)
        .select();
      if (error) throw error;
      toast.success(`Status atualizado para ${newStatus}`);
      fetchUsers();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const getUserRole = (userId: string): "admin" | "editor" | "visualizador" | null => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role ? role.role : null;
  };

  const filteredProfiles = profiles.filter((profile) => {
    const search = searchTerm.toLowerCase();
    return (
      profile.nome.toLowerCase().includes(search) ||
      profile.telefone.toLowerCase().includes(search)
    );
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <div className="animate-pulse text-lg">Verificando permissões...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-smooth">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Dashboard
            </Link>
            <img src={logoBEG} alt="BEG Inovação" className="h-20 -my-3" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Gerenciamento de Usuários
            </CardTitle>
            <CardDescription>
              Selecione a role de cada usuário usando o dropdown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => {
                    const role = getUserRole(profile.id);
                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.nome}</TableCell>
                        <TableCell>{profile.telefone}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={profile.status === "ativo" ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => toggleUserStatus(profile.id, profile.status)}
                          >
                            {profile.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={role || "sem_role"}
                            onValueChange={(value) => updateUserRole(profile.id, value as "admin" | "editor" | "visualizador" | "sem_role")}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue>
                                {role === "admin" ? (
                                  <span className="flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Admin
                                  </span>
                                ) : role === "editor" ? (
                                  <span className="flex items-center gap-2">
                                    <Edit className="w-4 h-4" />
                                    Editor
                                  </span>
                                ) : role === "visualizador" ? (
                                  <span className="flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    Visualizador
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Sem Role
                                  </span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sem_role">
                                <span className="flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  Sem Role
                                </span>
                              </SelectItem>
                              <SelectItem value="visualizador">
                                <span className="flex items-center gap-2">
                                  <Eye className="w-4 h-4" />
                                  Visualizador
                                </span>
                              </SelectItem>
                              <SelectItem value="editor">
                                <span className="flex items-center gap-2">
                                  <Edit className="w-4 h-4" />
                                  Editor
                                </span>
                              </SelectItem>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-2">
                                  <Shield className="w-4 h-4" />
                                  Admin
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleUserStatus(profile.id, profile.status)}
                            >
                              {profile.status === "ativo" ? "Desativar" : "Ativar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser({ id: profile.id, name: profile.nome });
                                setManageBoardsOpen(true);
                              }}
                            >
                              <Blocks className="w-4 h-4 mr-2" />
                              Blocos
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedUser && (
        <ManageBoardAccessDialog
          open={manageBoardsOpen}
          onOpenChange={setManageBoardsOpen}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}
    </div>
  );
};

export default Admin;

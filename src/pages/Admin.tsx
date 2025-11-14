import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Shield, User, Eye, Edit, Search } from "lucide-react";
import { Link } from "react-router-dom";

const ADMIN_PASSWORD = "backtest123";

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const savedAuth = sessionStorage.getItem("admin_auth");
    if (savedAuth === "true") {
      setIsAuthenticated(true);
      fetchUsers();
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
      fetchUsers();
      toast.success("Acesso concedido");
    } else {
      toast.error("Senha incorreta");
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
      // Filtrar apenas as roles válidas
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
      console.log("Updating role for user:", userId, "New role:", newRole);
      
      // Se for "sem_role", deletar a role existente
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
          // Update existing role
          const { error } = await supabase
            .from("user_roles")
            .update({ role: newRole })
            .eq("user_id", userId);

          if (error) throw error;
        } else {
          // Insert new role
          const { error } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role: newRole });

          if (error) throw error;
        }
        
        toast.success(`Usuário atualizado para ${newRole}`);
      }
      
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar role: " + error.message);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      console.log("Toggling status for user:", userId, "Current status:", currentStatus);
      const newStatus = currentStatus === "ativo" ? "aguardando" : "ativo";
      
      const { data, error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", userId)
        .select();

      console.log("Update status result:", { data, error });
      if (error) throw error;

      toast.success(`Status atualizado para ${newStatus}`);
      fetchUsers();
    } catch (error: any) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const getUserRole = (userId: string): "admin" | "editor" | "visualizador" | null => {
    const role = userRoles.find((r) => r.user_id === userId);
    return role ? role.role : null;
  };

  const getRoleBadgeVariant = (role: "admin" | "editor" | "visualizador" | null) => {
    if (role === "admin") return "destructive";
    if (role === "editor") return "default";
    if (role === "visualizador") return "secondary";
    return "outline";
  };

  const getRoleLabel = (role: "admin" | "editor" | "visualizador" | null) => {
    if (role === "admin") return "Admin";
    if (role === "editor") return "Editor";
    if (role === "visualizador") return "Visualizador";
    return "Sem Role";
  };

  const filteredProfiles = profiles.filter((profile) => {
    const search = searchTerm.toLowerCase();
    return (
      profile.nome.toLowerCase().includes(search) ||
      profile.telefone.toLowerCase().includes(search)
    );
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Área Administrativa
            </CardTitle>
            <CardDescription>Digite a senha para acessar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-smooth">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.removeItem("admin_auth");
              setIsAuthenticated(false);
            }}
          >
            Sair
          </Button>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleUserStatus(profile.id, profile.status)}
                          >
                            {profile.status === "ativo" ? "Desativar" : "Ativar"}
                          </Button>
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
    </div>
  );
};

export default Admin;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, LayoutGrid, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BoardCard from "@/components/dashboard/BoardCard";
import CreateBoardDialog from "@/components/dashboard/CreateBoardDialog";
import UserProfile from "@/components/dashboard/UserProfile";

interface Board {
  id: string;
  titulo: string;
  descricao: string | null;
  created_at: string;
  publico: boolean;
  senha_hash: string | null;
}

const Dashboard = () => {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    fetchBoards();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchBoards = async () => {
    try {
      const { data, error } = await supabase
        .from("boards")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBoards(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar blocos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleBoardCreated = () => {
    fetchBoards();
    setCreateDialogOpen(false);
  };

  const handleBoardDeleted = () => {
    fetchBoards();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-primary">BegTask</h1>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="gap-2"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Grade
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="gap-2"
                >
                  <List className="w-4 h-4" />
                  Lista
                </Button>
              </div>

              <UserProfile />
              
              <Button
                variant="outline"
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2">Todos Blocos</h2>
              <p className="text-muted-foreground">
                Organize suas tarefas em blocos kanban
              </p>
            </div>
            
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="gap-2 gradient-primary hover:shadow-hover hover:scale-105 transition-all duration-300"
              size="lg"
            >
              <Plus className="w-5 h-5" />
              Novo Bloco
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-muted/30 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center py-20 bg-muted/30 rounded-lg border border-border/50">
              <div className="max-w-md mx-auto">
                <h3 className="text-xl font-semibold mb-2">Nenhum bloco ainda</h3>
                <p className="text-muted-foreground mb-6">
                  Comece criando seu primeiro bloco para organizar suas tarefas
                </p>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="gap-2 gradient-primary"
                >
                  <Plus className="w-5 h-5" />
                  Criar Primeiro Bloco
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "flex flex-col gap-4"
              }
            >
              {boards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  viewMode={viewMode}
                  onDeleted={handleBoardDeleted}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateBoardDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onBoardCreated={handleBoardCreated}
      />
    </div>
  );
};

export default Dashboard;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ProfileSettingsModal from "./ProfileSettingsModal";

interface Profile {
  nome: string;
  foto_perfil: string | null;
  status: string;
}

const UserProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("nome, foto_perfil, status")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    }
  };

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const handleProfileUpdated = () => {
    fetchProfile(); // Recarrega o perfil após atualização
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary transition-all">
            <AvatarImage src={profile?.foto_perfil || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {profile?.nome ? getInitials(profile.nome) : <User className="w-4 h-4" />}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{profile?.nome || "Usuário"}</p>
              <p className="text-xs leading-none text-muted-foreground capitalize">
                Status: {profile?.status || "carregando..."}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Configurações</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onProfileUpdated={handleProfileUpdated}
      />
    </>
  );
};

export default UserProfile;

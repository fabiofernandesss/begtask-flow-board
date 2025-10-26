import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginFormProps = {
  onModeChange: (mode: 'signup' | 'recover') => void;
};

const LoginForm = ({ onModeChange }: LoginFormProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = loginSchema.parse({ email, password });
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou senha incorretos");
        } else {
          toast.error("Erro ao fazer login: " + error.message);
        }
        return;
      }

      // Check user status
      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', data.user.id)
        .single();

      if (profile?.status === 'aguardando') {
        await supabase.auth.signOut();
        toast.warning("Sua conta está aguardando aprovação de um administrador");
        return;
      }

      if (profile?.status === 'bloqueado') {
        await supabase.auth.signOut();
        toast.error("Sua conta foi bloqueada");
        return;
      }

      toast.success("Login realizado com sucesso!");
      navigate("/dashboard");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro inesperado ao fazer login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>

      <div className="flex flex-col gap-2 text-sm text-center">
        <button
          type="button"
          onClick={() => onModeChange('recover')}
          className="text-primary hover:underline"
        >
          Esqueci minha senha
        </button>
        <button
          type="button"
          onClick={() => onModeChange('signup')}
          className="text-muted-foreground hover:text-primary"
        >
          Criar uma conta
        </button>
      </div>
    </form>
  );
};

export default LoginForm;

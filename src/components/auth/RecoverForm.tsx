import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const recoverSchema = z.object({
  email: z.string().email("Email inválido").max(255),
});

type RecoverFormProps = {
  onModeChange: (mode: 'login') => void;
};

const RecoverForm = ({ onModeChange }: RecoverFormProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = recoverSchema.parse({ email });
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        toast.error("Erro ao enviar email: " + error.message);
        return;
      }

      toast.success("Verifique seu email para redefinir sua senha");
      onModeChange('login');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro inesperado");
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

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Enviando..." : "Enviar link de recuperação"}
      </Button>

      <div className="text-sm text-center">
        <button
          type="button"
          onClick={() => onModeChange('login')}
          className="text-muted-foreground hover:text-primary"
        >
          Voltar para login
        </button>
      </div>
    </form>
  );
};

export default RecoverForm;

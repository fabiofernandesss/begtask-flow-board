import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload } from "lucide-react";
import InputMask from "react-input-mask";

const signupSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(100),
  telefone: z.string().min(10, "Telefone inválido").max(20),
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
});

type SignupFormProps = {
  onModeChange: (mode: 'login') => void;
};

const SignupForm = ({ onModeChange }: SignupFormProps) => {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = signupSchema.parse({ nome, telefone, email, password });
      setLoading(true);

      let fotoUrl = null;

      // Upload foto if selected
      if (foto) {
        const fileExt = foto.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('avatars')
          .upload(`temp/${fileName}`, foto);

        if (uploadError) {
          toast.error("Erro ao fazer upload da foto");
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(`temp/${fileName}`);
        
        fotoUrl = publicUrl;
      }

      const { error, data } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            nome: validated.nome,
            telefone: validated.telefone,
            foto_perfil: fotoUrl,
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Este email já está cadastrado");
        } else {
          toast.error("Erro ao criar conta: " + error.message);
        }
        return;
      }

      toast.success("Conta criada! Aguardando aprovação do administrador.");
      onModeChange('login');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erro inesperado ao criar conta");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex justify-center mb-4">
        <div className="relative">
          <Avatar className="w-20 h-20">
            <AvatarImage src={fotoPreview} />
            <AvatarFallback className="bg-primary/10">
              <Upload className="w-8 h-8 text-primary" />
            </AvatarFallback>
          </Avatar>
          <input
            type="file"
            accept="image/*"
            onChange={handleFotoChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nome">Nome completo</Label>
        <Input
          id="nome"
          type="text"
          placeholder="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="telefone">Telefone</Label>
        <InputMask
          mask="(99) 99999-9999"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          disabled={loading}
        >
          {(inputProps: any) => (
            <Input
              {...inputProps}
              id="telefone"
              type="tel"
              placeholder="(11) 99999-9999"
              required
            />
          )}
        </InputMask>
      </div>

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
        {loading ? "Criando conta..." : "Criar conta"}
      </Button>

      <div className="text-sm text-center">
        <button
          type="button"
          onClick={() => onModeChange('login')}
          className="text-muted-foreground hover:text-primary"
        >
          Já tem uma conta? Entrar
        </button>
      </div>
    </form>
  );
};

export default SignupForm;

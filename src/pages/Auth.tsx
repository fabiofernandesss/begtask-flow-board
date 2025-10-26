import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import LoginForm from "@/components/auth/LoginForm";
import SignupForm from "@/components/auth/SignupForm";
import RecoverForm from "@/components/auth/RecoverForm";
import AnimatedLogo from "@/components/auth/AnimatedLogo";

type AuthMode = 'login' | 'signup' | 'recover';

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>('login');

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-smooth">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <Card className="shadow-card">
          <CardHeader className="text-center">
            <AnimatedLogo />
            <CardDescription>
              {mode === 'login' && 'Entre na sua conta'}
              {mode === 'signup' && 'Crie sua conta'}
              {mode === 'recover' && 'Recupere sua senha'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'login' && <LoginForm onModeChange={setMode} />}
            {mode === 'signup' && <SignupForm onModeChange={setMode} />}
            {mode === 'recover' && <RecoverForm onModeChange={setMode} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, Users, Lock, Zap, ArrowRight, BarChart3, Clock, Shield } from "lucide-react";
import Hero3D from "@/components/landing/Hero3D";
import TechBackground from "@/components/landing/TechBackground";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-primary">
              BegTask
            </h2>
            <Link to="/auth">
              <Button variant="default" className="gap-2">
                Acessar <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 py-20 lg:py-32 overflow-hidden">
        <TechBackground />
        <Hero3D />
        <div className="max-w-5xl mx-auto text-center animate-fade-in relative z-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-8 text-sm font-medium border border-primary/20">
            <Zap className="w-4 h-4" />
            Gestão de Tarefas Profissional
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-foreground leading-tight bg-gradient-to-r from-primary via-purple-600 to-primary bg-clip-text text-transparent animate-fade-in">
            Organize. Execute.<br/>Transforme.
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            A plataforma completa de gestão de tarefas que une <strong className="text-foreground">colaboração em tempo real</strong>, 
            <strong className="text-foreground"> kanban visual</strong> e <strong className="text-foreground">segurança corporativa</strong>.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto gradient-primary hover:shadow-hover hover:scale-105 transition-all duration-300 text-base gap-2">
                Começar Agora <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base hover:bg-primary/10 hover:scale-105 transition-all duration-300">
              Ver Demonstração
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-8 border-t border-border/50">
            <div>
              <div className="text-3xl font-bold text-primary mb-1">100%</div>
              <div className="text-sm text-muted-foreground">Tempo Real</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-1">Seguro</div>
              <div className="text-sm text-muted-foreground">Dados Protegidos</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary mb-1">∞</div>
              <div className="text-sm text-muted-foreground">Possibilidades</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Tudo que você precisa para <span className="text-primary">gerenciar projetos</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Recursos pensados para maximizar a produtividade da sua equipe
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:scale-105 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:rotate-6 transition-all duration-300">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2 text-base">Kanban Visual</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Organize tarefas em colunas com drag-and-drop fluido e intuitivo
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:scale-105 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:rotate-6 transition-all duration-300">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2 text-base">Colaboração</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Trabalhe em equipe com atualizações sincronizadas em tempo real
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:scale-105 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:rotate-6 transition-all duration-300">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2 text-base">Segurança</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Controle de acesso avançado com proteção por senha e permissões
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:scale-105 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:rotate-6 transition-all duration-300">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2 text-base">Eficiência</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Interface compacta, rápida e sem distrações desnecessárias
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:scale-105 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:rotate-6 transition-all duration-300">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2 text-base">Modo Lista</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Alterne entre visualização Kanban e lista com um clique
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:scale-105 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:rotate-6 transition-all duration-300">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2 text-base">Acesso Público</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Compartilhe blocos com clientes usando senhas seguras
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:scale-105 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:rotate-6 transition-all duration-300">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2 text-base">Anexos</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Adicione arquivos, imagens e documentos diretamente nas tarefas
              </p>
            </div>

            <div className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:scale-105 hover:-translate-y-1">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:rotate-6 transition-all duration-300">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2 text-base">Atribuições</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Defina responsáveis, prazos e prioridades para cada tarefa
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary/10 via-purple-500/10 to-primary/10 p-12 rounded-2xl shadow-hover border border-primary/20 hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Pronto para transformar sua produtividade?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Junte-se às empresas que já organizam seus projetos com a BegTask
          </p>
          <Link to="/auth">
            <Button size="lg" className="gradient-primary hover:shadow-hover hover:scale-110 transition-all duration-300 text-base gap-2">
              Começar Gratuitamente <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div className="md:col-span-2">
                <h3 className="text-2xl font-bold text-primary mb-3">
                  BegTask
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  A plataforma de gestão de tarefas que une simplicidade, eficiência e colaboração em tempo real.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3 text-sm">Contato</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <a href="mailto:contato@begtask.com" className="block hover:text-primary transition-smooth">
                    contato@begtask.com
                  </a>
                  <a href="tel:+5511999999999" className="block hover:text-primary transition-smooth">
                    (11) 99999-9999
                  </a>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 text-sm">Legal</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <a href="#" className="block hover:text-primary transition-smooth">
                    Política de Privacidade
                  </a>
                  <a href="#" className="block hover:text-primary transition-smooth">
                    Termos de Uso
                  </a>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-border/50 text-center">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} BegTask. Todos os direitos reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

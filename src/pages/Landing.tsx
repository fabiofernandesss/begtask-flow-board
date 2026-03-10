import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { CheckCircle2, Users, Lock, Zap, ArrowRight, BarChart3, Clock, Shield } from "lucide-react";
import logoBEG from "@/assets/logoBEG.png";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <img src={logoBEG} alt="BEG Inovação" className="h-14" />
            <Link to="/auth">
              <Button variant="default" className="gap-2">
                Acessar <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-32">
        <div className="max-w-5xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-8 text-sm font-medium border border-primary/20">
            <Zap className="w-4 h-4" />
            Gestão de Tarefas Profissional
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-foreground leading-tight">
            Organize. Execute.<br/>Transforme.
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            A plataforma completa de gestão de tarefas que une <strong className="text-foreground">colaboração em tempo real</strong>, 
            <strong className="text-foreground"> kanban visual</strong> e <strong className="text-foreground">segurança corporativa</strong>.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/auth">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 transition-all duration-300 text-base gap-2">
                Começar Agora <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base hover:bg-primary/10 transition-all duration-300">
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
            {[
              { icon: CheckCircle2, title: "Kanban Visual", desc: "Organize tarefas em colunas com drag-and-drop fluido e intuitivo" },
              { icon: Users, title: "Colaboração", desc: "Trabalhe em equipe com atualizações sincronizadas em tempo real" },
              { icon: Shield, title: "Segurança", desc: "Controle de acesso avançado com proteção por senha e permissões" },
              { icon: Clock, title: "Eficiência", desc: "Interface compacta, rápida e sem distrações desnecessárias" },
              { icon: BarChart3, title: "Modo Lista", desc: "Alterne entre visualização Kanban e lista com um clique" },
              { icon: Lock, title: "Acesso Público", desc: "Compartilhe blocos com clientes usando senhas seguras" },
              { icon: Zap, title: "Anexos", desc: "Adicione arquivos, imagens e documentos diretamente nas tarefas" },
              { icon: Users, title: "Atribuições", desc: "Defina responsáveis, prazos e prioridades para cada tarefa" },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="bg-card p-6 rounded-lg shadow-card hover:shadow-hover transition-all duration-300 border border-border/50 group hover:-translate-y-1">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-all duration-300">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2 text-base">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center bg-primary/5 p-12 rounded-2xl border border-primary/20">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Pronto para transformar sua produtividade?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Junte-se às empresas que já organizam seus projetos com a BegTask
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-primary hover:bg-primary/90 transition-all duration-300 text-base gap-2">
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
                <img src={logoBEG} alt="BEG Inovação" className="h-16 mb-3" />
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  A plataforma de gestão de tarefas que une simplicidade, eficiência e colaboração em tempo real.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3 text-sm">Contato</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <a href="mailto:contato@begtask.com" className="block hover:text-primary transition-colors">
                    contato@begtask.com
                  </a>
                  <a href="tel:+5511999999999" className="block hover:text-primary transition-colors">
                    (11) 99999-9999
                  </a>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3 text-sm">Legal</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <a href="#" className="block hover:text-primary transition-colors">
                    Política de Privacidade
                  </a>
                  <a href="#" className="block hover:text-primary transition-colors">
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

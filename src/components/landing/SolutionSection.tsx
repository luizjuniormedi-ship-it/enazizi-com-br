import { Brain, BarChart3, Bot, Target, ShieldCheck, Microscope } from "lucide-react";

const solutions = [
  {
    icon: Brain,
    title: "Tutor V3 Premium",
    desc: "Criação de sessões clínicas reais com missões, mapas de aula e explicações Feynman personalizadas.",
    color: "from-primary/20 to-primary/5",
  },
  {
    icon: Microscope,
    title: "Evidence Engine",
    desc: "Validação científica de cada recomendação baseada em eficácia pedagógica e retenção de longo prazo.",
    color: "from-blue-500/20 to-blue-500/5",
  },
  {
    icon: ShieldCheck,
    title: "Impact Engine",
    desc: "Identifica seu gap de conhecimento e foca no que realmente aumenta sua chance real de aprovação.",
    color: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    icon: Target,
    title: "Banco de Erros Inteligente",
    desc: "Cada erro vira um loop de recuperação com flashcards FSRS e sessões específicas com o Tutor.",
    color: "from-amber-500/20 to-amber-500/5",
  },
];


const SolutionSection = () => (
  <section className="py-16 sm:py-24 relative overflow-hidden">
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
    </div>

    <div className="container relative z-10 px-4">
      <div className="text-center mb-10 sm:mb-14">
        <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          A solução
        </span>
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-3">
          Como o ENAZIZI <span className="gradient-text">resolve isso</span>
        </h2>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
          Um sistema que pensa por você e direciona cada minuto do seu estudo.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-4xl mx-auto">
        {solutions.map((s, i) => (
          <div
            key={s.title}
            className={`group relative rounded-2xl border border-border/60 bg-card/80 p-6 sm:p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 animate-fade-in overflow-hidden`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${s.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative z-10">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default SolutionSection;

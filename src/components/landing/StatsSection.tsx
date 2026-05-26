import { Users, BookOpen, Trophy, Brain } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchLoginStats } from "@/lib/loginPublicData";

const formatCount = (n: number): string => {
  if (n >= 1000) {
    const rounded = Math.floor(n / 100) * 100;
    return `${rounded.toLocaleString("pt-BR")}+`;
  }
  return `${n}+`;
};

const StatsSection = () => {
  const [dynamic, setDynamic] = useState({ alunos: "—", questoes: "—", flashcards: "—" });

  useEffect(() => {
    let cancelled = false;
    fetchLoginStats().then((data) => {
      if (cancelled || !data) return;
      setDynamic({
        alunos: formatCount(data.alunos),
        questoes: formatCount(data.questoes),
        flashcards: formatCount(data.flashcards),
      });
    });
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { icon: Users, value: dynamic.alunos, label: "Alunos cadastrados", color: "text-blue-400" },
    { icon: BookOpen, value: dynamic.questoes, label: "Questões no banco", color: "text-emerald-400" },
    { icon: Trophy, value: dynamic.flashcards, label: "Flashcards criados", color: "text-amber-400" },
    { icon: Brain, value: "8", label: "Agentes IA especializados", color: "text-violet-400" },
  ];

  return (
    <section className="py-10 sm:py-16 border-y border-border/30 bg-card/30 backdrop-blur-sm">
      <div className="container px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 max-w-4xl mx-auto">
          {stats.map((s) => (
            <div key={s.label} className="text-center group">
              <div className="flex justify-center mb-2 sm:mb-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <s.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${s.color}`} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl md:text-4xl font-black mb-0.5 sm:mb-1">{s.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;

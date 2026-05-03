import { Link, useNavigate } from "react-router-dom";
import { Brain, Mail, Lock, BookOpen, Trophy, Sparkles, GraduationCap, AlertTriangle, Calendar, Users, FlaskConical, Smartphone, Monitor, Globe, MessageCircle, Star, Quote } from "lucide-react";
import enazizi from "@/assets/enazizi-mascot.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { motion } from "framer-motion";

const errorMessages: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos.",
  "Email not confirmed": "Confirme seu email antes de entrar.",
  "User not found": "Nenhuma conta encontrada com este email.",
  "Too many requests": "Muitas tentativas. Aguarde um momento.",
};

const formatCount = (n: number): string => {
  if (n >= 1000) {
    const rounded = Math.floor(n / 100) * 100;
    return `${rounded.toLocaleString("pt-BR")}+`;
  }
  return `${n}+`;
};

const features = [
  { icon: Sparkles, label: "Tutor IA personalizado" },
  { icon: FlaskConical, label: "Simulados com gabarito comentado" },
  { icon: BookOpen, label: "Flashcards com repetição espaçada (FSRS)" },
  { icon: GraduationCap, label: "Painel do Professor com BI" },
  { icon: AlertTriangle, label: "Banco de erros inteligente" },
  { icon: Calendar, label: "Cronograma adaptativo" },
  { icon: MessageCircle, label: "Resumo diário via WhatsApp" },
  { icon: Smartphone, label: "App móvel (PWA) — iOS e Android" },
  { icon: Monitor, label: "Desktop — Windows, Mac e Linux" },
  { icon: Globe, label: "Acesso web em qualquer navegador" },
];

interface Testimonial {
  feedback_text: string;
  avg_rating: number;
  display_name: string;
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [dynamicStats, setDynamicStats] = useState({
    alunos: "—",
    questoes: "—",
    flashcards: "—",
  });
  const navigate = useNavigate();
  const { signIn, resetPassword } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, testimonialsRes] = await Promise.all([
          supabase.rpc("get_login_stats").maybeSingle(),
          supabase.rpc("get_login_testimonials"),
        ]);
        if (statsRes.data) {
          setDynamicStats({
            alunos: formatCount(Number(statsRes.data.alunos)),
            questoes: formatCount(Number(statsRes.data.questoes)),
            flashcards: formatCount(Number(statsRes.data.flashcards)),
          });
        }
        if (testimonialsRes.data && Array.isArray(testimonialsRes.data)) {
          setTestimonials(testimonialsRes.data as Testimonial[]);
        }
      } catch {
        // keep defaults on error
      }
    };
    fetchData();
  }, []);

  const stats = [
    { icon: Users, value: dynamicStats.alunos, label: "Alunos" },
    { icon: BookOpen, value: dynamicStats.questoes, label: "Questões" },
    { icon: Trophy, value: dynamicStats.flashcards, label: "Flashcards" },
    { icon: Brain, value: "8", label: "Agentes IA" },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      const msg = errorMessages[error.message] || error.message;
      toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Digite seu email", description: "Informe o email cadastrado para redefinir a senha.", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    const { error } = await resetPassword(email);
    setForgotLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
      setForgotMode(false);
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto flex flex-col lg:flex-row bg-[#0a0a0e] relative">
      <EnaflixBackgroundFX intensity="subtle" />
      
      {/* Left panel - Hero */}
      <div className="lg:w-1/2 p-6 sm:p-10 lg:p-14 flex flex-col justify-center relative z-10">
        <Link to="/" className="inline-flex items-center gap-3 mb-8 lg:mb-12 group">
          <img src={enazizi} alt="ENAZIZI" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/10 shadow-2xl group-hover:scale-110 transition-transform" />
          <span className="text-2xl font-black tracking-tighter text-white">ENAFLIX</span>
        </Link>

        <h2 className="text-xl lg:text-3xl font-bold mb-1 lg:mb-2">
          Você não precisa estudar mais.
          <br />
          <span className="text-primary">Precisa estudar certo.</span>
        </h2>
        <p className="text-muted-foreground mb-4 lg:mb-8 text-sm lg:text-base">
          O ENAZIZI cria seu plano diário com base nos seus erros e na sua prova.
        </p>

        {/* Checklist de valor */}
        <div className="hidden lg:flex flex-col gap-2 mb-6 text-sm">
          {[
            "Missão diária pronta ao abrir o app",
            "Correção inteligente dos seus erros",
            "Evolução real medida por IA",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-muted-foreground">
              <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs">✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4 lg:mb-10">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="flex justify-center mb-0.5 lg:mb-1">
                <div className="h-7 w-7 lg:h-9 lg:w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary" />
                </div>
              </div>
              <p className="text-base lg:text-xl font-black">{s.value}</p>
              <p className="text-[10px] lg:text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Features list */}
        <div className="grid grid-cols-2 gap-1.5 lg:gap-3">
          {features.map((f) => (
            <div key={f.label} className="flex items-center gap-1.5 lg:gap-2 text-xs lg:text-sm">
              <f.icon className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-primary shrink-0" />
              <span className="text-muted-foreground">{f.label}</span>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        {testimonials.length > 0 && (
          <div className="hidden lg:block mt-6 lg:mt-8 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avaliações de alunos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-xl border border-border/40 bg-card/60 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{t.display_name}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className={`h-3 w-3 ${j < Math.round(t.avg_rating) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    <Quote className="h-3 w-3 inline mr-1 text-primary/50" />
                    {t.feedback_text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right panel - Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            {/* Logo already shown on left panel for desktop */}
          </div>
          <h1 className="text-2xl font-bold text-center mb-1">{forgotMode ? "Recuperar senha" : "Bem-vindo de volta"}</h1>
          <p className="text-muted-foreground text-center mb-6 text-sm">
            {forgotMode ? "Digite seu email para receber o link de redefinição" : "Continue evoluindo até a aprovação"}
          </p>

          {forgotMode ? (
            <form onSubmit={handleForgotPassword} className="glass-card p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="seu@email.com" className="pl-10 bg-secondary border-border" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={forgotLoading}>
                {forgotLoading ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
              <button type="button" onClick={() => setForgotMode(false)} className="text-sm text-primary hover:underline w-full text-center">
                Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="glass-card p-8 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" placeholder="seu@email.com" className="pl-10 bg-secondary border-border" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Senha</label>
                  <button type="button" onClick={() => setForgotMode(true)} className="text-xs text-primary hover:underline">
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" placeholder="••••••••" className="pl-10 bg-secondary border-border" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>
              <Button type="submit" className="w-full glow" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          )}

          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Não tem conta?{" "}
              <Link to="/register" className="text-primary hover:underline">Criar conta grátis</Link>
            </p>
            <p className="text-xs text-muted-foreground">
              <Link to="/register" className="text-primary/80 hover:underline">É professor? Cadastre-se e acesse o painel exclusivo</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

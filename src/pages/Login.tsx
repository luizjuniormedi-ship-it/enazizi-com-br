import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Brain, Mail, Lock, BookOpen, Trophy, Sparkles, GraduationCap, AlertTriangle, Calendar, Users, FlaskConical, Smartphone, Monitor, Globe, MessageCircle, Star, Quote, RefreshCw, ArrowLeft } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("expired") === "1";
  const { user, session, loading: authLoading, signIn, resetPassword } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (session && !authLoading) {
      navigate("/enaflix", { replace: true });
    }
  }, [session, authLoading, navigate]);

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
    
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        setLoading(false);
        const msg = errorMessages[error.message] || error.message;
        toast({ title: "Erro ao entrar", description: msg, variant: "destructive" });
        return;
      }
      
      // The session change will be detected by AuthProvider, 
      // which will trigger the useEffect for navigation above.
      // But we also do an explicit navigate here just in case.
      navigate("/enaflix", { replace: true });
    } catch (err: any) {
      console.error("Login unexpected error:", err);
      setLoading(false);
      toast({ 
        title: "Erro inesperado", 
        description: "Ocorreu um erro ao processar seu login. Tente novamente.", 
        variant: "destructive" 
      });
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
    <div className="min-h-[100dvh] overflow-y-auto flex flex-col lg:flex-row bg-[#050508] relative">
      <EnaflixBackgroundFX intensity="subtle" />
      
      <button
        onClick={() => navigate(-1)}
        className="fixed top-6 left-6 z-[100] flex items-center gap-2 text-white/50 hover:text-white transition-all group px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
      </button>

      {/* Left panel - Hero */}
      <div className="lg:w-1/2 p-6 sm:p-10 lg:p-14 flex flex-col justify-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Link to="/" className="inline-flex items-center gap-3 mb-8 lg:mb-12 group">
            <img src={enazizi} alt="ENAZIZI" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/10 shadow-2xl group-hover:scale-110 transition-transform" />
            <span className="text-2xl font-black tracking-tighter text-white">ENAFLIX</span>
          </Link>

          <h2 className="text-3xl lg:text-5xl font-black mb-4 leading-[1.1] text-white tracking-tighter">
            Você não precisa estudar mais.
            <br />
            <span className="gradient-text">Precisa estudar certo.</span>
          </h2>
          <p className="text-white/60 mb-8 lg:mb-12 text-base lg:text-lg max-w-md font-medium">
            O ENAFLIX Studio cria seu plano diário adaptativo com base na sua performance real.
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            {stats.map((s, idx) => (
              <motion.div 
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.1 }}
                className="card-pixar p-4 text-center bg-white/5 border-white/5"
              >
                <div className="flex justify-center mb-2">
                  <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <p className="text-xl font-black text-white">{s.value}</p>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Features list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.slice(0, 6).map((f, idx) => (
              <motion.div 
                key={f.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + idx * 0.05 }}
                className="flex items-center gap-3 text-sm font-bold text-white/70"
              >
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span>{f.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel - Form */}
      <div className="lg:w-1/2 flex items-center justify-center p-6 sm:p-10 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="w-full max-w-md"
        >
          {sessionExpired && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <RefreshCw className="h-5 w-5 text-amber-500 animate-spin-slow" />
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-widest text-amber-500">Sessão Expirada</p>
                <p className="text-[10px] font-bold text-amber-200/60 uppercase tracking-tighter">Sua sessão expirou por inatividade. Faça login novamente.</p>
              </div>
            </div>
          )}

          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-white tracking-tighter mb-2">{forgotMode ? "Recuperar senha" : "Acesso Studio"}</h1>
            <p className="text-white/40 font-medium">
              {forgotMode ? "Digite seu email para receber o link de redefinição" : "Prossiga para sua estação de estudo"}
            </p>
          </div>

          <div className="card-pixar p-8 bg-[#050508]/60 border-white/10 backdrop-blur-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)]">
            {forgotMode ? (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-white/40">Email Corporativo</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input type="email" placeholder="seu@email.com" className="pl-12 h-12" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs" disabled={forgotLoading}>
                  {forgotLoading ? "Enviando..." : "Enviar link"}
                </Button>
                <button type="button" onClick={() => setForgotMode(false)} className="text-xs font-bold text-primary hover:text-white transition-colors w-full text-center uppercase tracking-widest">
                  Voltar ao login
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-white/40">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input type="email" placeholder="seu@email.com" className="pl-12 h-12" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-widest text-white/40">Senha</label>
                    <Link to="/forgot-password" className="text-[10px] font-bold text-primary hover:text-white transition-colors uppercase tracking-wider hover:underline">
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <Input type="password" placeholder="••••••••" className="pl-12 h-12" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-glow-sm" disabled={loading}>
                  {loading ? "Autenticando..." : "Entrar no Studio"}
                </Button>
              </form>
            )}
          </div>

          <div className="text-center mt-10 space-y-4">
            <p className="text-sm font-medium text-white/40">
              Novo no ENAFLIX?{" "}
              <Link to="/register" className="text-white font-black hover:text-primary transition-colors underline-offset-4 underline">Criar conta</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

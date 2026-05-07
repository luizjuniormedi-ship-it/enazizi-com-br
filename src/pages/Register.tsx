import { Link, useNavigate } from "react-router-dom";
import { Brain, Mail, Lock, User, GraduationCap, Building, Phone } from "lucide-react";
import enazizi from "@/assets/enazizi-mascot.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isValidPhone, isValidName } from "@/lib/profileValidation";
import FaculdadeCombobox from "@/components/FaculdadeCombobox";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<"estudante" | "professor">("estudante");
  const [faculdade, setFaculdade] = useState("");
  const [phone, setPhone] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameCheck = isValidName(name);
    if (!nameCheck.valid) {
      toast({ title: nameCheck.message, variant: "destructive" });
      return;
    }

    if (!phone) {
      toast({ title: "Informe seu WhatsApp para contato", variant: "destructive" });
      return;
    }

    const phoneCheck = isValidPhone(phone);
    if (!phoneCheck.valid) {
      toast({ title: phoneCheck.message, variant: "destructive" });
      return;
    }

    if (!faculdade) {
      toast({ title: userType === "estudante" ? "Selecione sua faculdade" : "Selecione sua universidade", variant: "destructive" });
      return;
    }

    if (userType === "estudante" && !periodo) {
      toast({ title: "Selecione seu período", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const { data, error } = await signUp(email, password, {
        displayName: name,
        userType,
        faculdade,
        phone: phoneDigits,
        periodo: userType === "estudante" ? parseInt(periodo) : undefined,
      });

      if (error) {
        console.error("Erro detalhado do cadastro:", error);
        toast({ 
          title: "Erro ao criar conta", 
          description: error.message || "Verifique os dados e tente novamente.", 
          variant: "destructive" 
        });
      } else if (data?.user && data?.session) {
        // Se já está logado (confirmação desativada)
        toast({ title: "Bem-vindo!", description: "Sua conta foi criada com sucesso." });
        navigate("/enaflix");
      } else {
        // Se precisa confirmar e-mail ou aguardar aprovação
        toast({ 
          title: "Cadastro realizado!", 
          description: "Verifique seu e-mail para confirmar a conta. Seu acesso será liberado após a aprovação do administrador.",
          duration: 8000
        });
        navigate("/login");
      }
    } catch (err: any) {
      console.error("Erro inesperado no fluxo de cadastro:", err);
      toast({ 
        title: "Erro no sistema", 
        description: err?.message || "Ocorreu um erro inesperado. Tente novamente.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto flex items-start sm:items-center justify-center bg-[#0a0a0e] p-4 py-12 relative">
      <EnaflixBackgroundFX intensity="subtle" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg relative z-10"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-3 mb-8 group">
            <img src={enazizi} alt="ENAZIZI" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/10 shadow-2xl group-hover:scale-110 transition-transform" />
            <span className="text-2xl font-black tracking-tighter text-white uppercase">ENAFLIX</span>
          </Link>
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">Crie sua conta Studio</h1>
          <p className="text-white/40 font-medium">Inicie sua jornada para a aprovação definitiva</p>
        </div>

        <div className="card-pixar p-8 bg-[#0a0a0e]/60 border-white/10 backdrop-blur-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)]">
          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Identificação</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType("estudante")}
                  className={cn(
                    "flex items-center justify-center gap-2 p-4 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all",
                    userType === "estudante" 
                      ? "border-primary bg-primary/20 text-white shadow-glow-sm" 
                      : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"
                  )}
                >
                  <GraduationCap className="h-4 w-4" />
                  Aluno
                </button>
                <button
                  type="button"
                  onClick={() => setUserType("professor")}
                  className={cn(
                    "flex items-center justify-center gap-2 p-4 rounded-2xl border text-xs font-black uppercase tracking-widest transition-all",
                    userType === "professor" 
                      ? "border-primary bg-primary/20 text-white shadow-glow-sm" 
                      : "border-white/5 bg-white/5 text-white/40 hover:bg-white/10"
                  )}
                >
                  <Building className="h-4 w-4" />
                  Professor
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input placeholder="Seu nome" className="pl-12 h-12" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Email Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input type="email" placeholder="seu@email.com" className="pl-12 h-12" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <Input type="password" placeholder="Mínimo 6 caracteres" className="pl-12 h-12" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">WhatsApp</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    className="h-12"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    required
                  />
                </div>

                {userType === "estudante" && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Período Atual</Label>
                    <Select value={periodo} onValueChange={setPeriodo}>
                      <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl font-bold">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0a0a0e] border-white/10">
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {i + 1}º período
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  {userType === "estudante" ? "Instituição de Ensino" : "Universidade / Hospital"}
                </Label>
                <FaculdadeCombobox value={faculdade} onChange={setFaculdade} />
              </div>
            </div>

            <Button type="submit" className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-glow-sm mt-4" disabled={loading}>
              {loading ? "Processando..." : "Criar Minha Conta Studio"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm font-medium text-white/40 mt-10">
          Já possui conta Studio?{" "}
          <Link to="/login" className="text-white font-black hover:text-primary transition-colors underline-offset-4 underline">Entrar no painel</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
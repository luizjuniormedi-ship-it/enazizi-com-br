import { Link, useNavigate } from "react-router-dom";
import { Brain, Mail, Lock, User, GraduationCap, Building, Phone } from "lucide-react";
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

    if (userType === "estudante") {
      const phoneCheck = isValidPhone(phone);
      if (!phoneCheck.valid) {
        toast({ title: phoneCheck.message, variant: "destructive" });
        return;
      }
      if (!faculdade) {
        toast({ title: "Selecione sua faculdade", variant: "destructive" });
        return;
      }
      if (!periodo) {
        toast({ title: "Selecione seu período", variant: "destructive" });
        return;
      }
    }

    if (userType === "professor" && !faculdade) {
      toast({ title: "Selecione sua universidade", variant: "destructive" });
      return;
    }

    setLoading(true);
    const phoneDigits = phone.replace(/\D/g, "");
    const { error } = await signUp(email, password, {
      displayName: name,
      userType,
      faculdade,
      phone: userType === "estudante" ? phoneDigits : undefined,
      periodo: userType === "estudante" ? parseInt(periodo) : undefined,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conta criada!", description: "Verifique seu email para confirmar o cadastro." });
      navigate("/login");
    }
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto flex items-start sm:items-center justify-center bg-background p-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center glow">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold">ENAZIZI</span>
          </Link>
          <h1 className="text-2xl font-bold">Crie sua conta</h1>
          <p className="text-muted-foreground mt-1">Comece sua preparação agora</p>
        </div>

        <form onSubmit={handleRegister} className="glass-card p-8 space-y-4">
          <div className="space-y-2">
            <Label>Eu sou</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUserType("estudante")}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${userType === "estudante" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:bg-accent"}`}
              >
                <GraduationCap className="h-4 w-4" />
                Estudante
              </button>
              <button
                type="button"
                onClick={() => setUserType("professor")}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${userType === "professor" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:bg-accent"}`}
              >
                <Building className="h-4 w-4" />
                Professor
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nome completo</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nome e sobrenome" className="pl-10 bg-secondary border-border" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="email" placeholder="seu@email.com" className="pl-10 bg-secondary border-border" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" placeholder="Mínimo 6 caracteres" className="pl-10 bg-secondary border-border" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          </div>

          {userType === "estudante" && (
            <>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  WhatsApp
                </Label>
                <Input
                  placeholder="(11) 99999-9999"
                  className="bg-secondary border-border"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  Faculdade
                </Label>
                <FaculdadeCombobox value={faculdade} onChange={setFaculdade} />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                  Período
                </Label>
                <Select value={periodo} onValueChange={setPeriodo}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {i + 1}º período
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {userType === "professor" && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-muted-foreground" />
                Universidade
              </Label>
              <FaculdadeCombobox value={faculdade} onChange={setFaculdade} />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {userType === "professor"
              ? "Após o cadastro, você terá acesso ao painel do professor com seus alunos da universidade selecionada."
              : "Ao criar sua conta, você terá acesso imediato à plataforma após confirmar seu email."}
          </p>

          <Button type="submit" className="w-full glow" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

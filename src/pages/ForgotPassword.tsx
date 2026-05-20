import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EnaflixBackgroundFX } from "@/components/enaflix/EnaflixBackgroundFX";
import { motion } from "framer-motion";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });

      if (error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Se o email existir, você receberá um link de recuperação",
        });
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050508] relative p-6">
      <EnaflixBackgroundFX intensity="subtle" />
      
      <button
        onClick={() => navigate(-1)}
        className="fixed top-6 left-6 z-[100] flex items-center gap-2 text-white/50 hover:text-white transition-all group px-4 py-2 rounded-full bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10"
      >
        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
        <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
      </button>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-white tracking-tighter mb-2">Esqueci minha senha</h1>
          <p className="text-white/40 font-medium">Recupere o acesso à sua conta</p>
        </div>

        <div className="card-pixar p-8 bg-[#050508]/60 border-white/10 backdrop-blur-2xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-white/40">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input 
                  type="email" 
                  placeholder="seu@email.com" 
                  className="pl-12 h-12" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar link de recuperação"
              )}
            </Button>

            <Link 
              to="/login" 
              className="flex items-center justify-center gap-2 text-xs font-bold text-white/40 hover:text-primary transition-colors uppercase tracking-widest"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Link>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;

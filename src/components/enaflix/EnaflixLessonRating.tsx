import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Enaflix3DButton } from "./Enaflix3DButton";
import { EnaflixBackgroundFX } from "./EnaflixBackgroundFX";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  lessonId: string;
  onClose: () => void;
  watchedPercentage?: number;
}

const RATING_LEVELS = [
  { value: 1, label: "Precisamos melhorar 😕" },
  { value: 2, label: "Aula abaixo do esperado" },
  { value: 3, label: "Boa aula 👍" },
  { value: 4, label: "Muito boa 🔥" },
  { value: 5, label: "Incrível ⭐" },
];

export function EnaflixLessonRating({ lessonId, onClose, watchedPercentage = 0 }: Props) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"rating" | "feedback" | "success">("rating");

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("lesson_ratings")
        .upsert({
          lesson_id: lessonId,
          user_id: user.id,
          rating,
          feedback: feedback || null,
          watched_percentage: watchedPercentage,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,lesson_id' });

      if (error) throw error;

      setStep("success");
      setTimeout(() => onClose(), 2500);
    } catch (error: any) {
      toast.error("Erro ao salvar avaliação: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl">
      <EnaflixBackgroundFX intensity="intense" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-[#0a0a0e] rounded-[40px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden p-8 sm:p-12 text-center"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-white/40 hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>

        <AnimatePresence mode="wait">
          {step === "rating" && (
            <motion.div 
              key="rating-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-[0.4em]">Feedback Cinematográfico</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tighter text-white">Como foi essa aula?</h2>
                <p className="text-white/50 text-sm font-medium">Sua avaliação ajuda a IA a melhorar suas próximas recomendações.</p>
              </div>

              <div className="flex items-center justify-center gap-2 sm:gap-4 py-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <motion.button
                    key={star}
                    whileHover={{ scale: 1.2, y: -5 }}
                    whileTap={{ scale: 0.9 }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="relative group"
                  >
                    <Star 
                      className={cn(
                        "h-10 w-10 sm:h-12 sm:w-12 transition-all duration-300",
                        (hoverRating || rating) >= star 
                          ? "fill-primary text-primary drop-shadow-[0_0_15px_rgba(var(--pixar-blue),0.8)]" 
                          : "text-white/10"
                      )}
                    />
                    {rating === star && (
                      <motion.div 
                        layoutId="star-glow"
                        className="absolute inset-0 bg-primary/20 blur-xl rounded-full -z-10"
                      />
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="h-6">
                <AnimatePresence mode="wait">
                  {(hoverRating || rating) > 0 && (
                    <motion.p 
                      key={hoverRating || rating}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="text-lg font-black text-primary italic"
                    >
                      {RATING_LEVELS.find(l => l.value === (hoverRating || rating))?.label}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="pt-4">
                <Enaflix3DButton 
                  disabled={rating === 0}
                  onClick={() => setStep("feedback")}
                  className="w-full"
                  glow
                >
                  Continuar
                </Enaflix3DButton>
              </div>
            </motion.div>
          )}

          {step === "feedback" && (
            <motion.div 
              key="feedback-step"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="text-3xl font-black tracking-tighter text-white">O que poderia melhorar?</h2>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Conte-nos o que você achou (opcional)..."
                className="w-full h-32 bg-white/5 border border-white/10 rounded-3xl p-6 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-white/20"
              />
              <div className="flex gap-4">
                <Enaflix3DButton 
                  variant="outline" 
                  onClick={() => setStep("rating")}
                  className="flex-1"
                >
                  Voltar
                </Enaflix3DButton>
                <Enaflix3DButton 
                  onClick={handleSubmit}
                  isLoading={isSubmitting}
                  className="flex-1"
                  glow
                  iconRight={<Send className="h-4 w-4" />}
                >
                  Enviar
                </Enaflix3DButton>
              </div>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div 
              key="success-step"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 py-12"
            >
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shadow-[0_0_30px_rgba(var(--pixar-blue),0.5)]">
                  <Star className="h-12 w-12 text-primary fill-primary animate-bounce" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-white">Avaliação Enviada!</h2>
              <p className="text-white/50">Obrigado por nos ajudar a evoluir sua experiência.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

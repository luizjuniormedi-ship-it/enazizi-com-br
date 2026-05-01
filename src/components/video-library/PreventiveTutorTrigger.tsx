import React from "react";
import { Sparkles, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { AdaptiveRecommendation } from "@/hooks/useVideoAdaptiveIntelligence";

interface PreventiveTutorTriggerProps {
  recommendation: AdaptiveRecommendation | null;
  onAccept: () => void;
  onClose: () => void;
}

const PreventiveTutorTrigger: React.FC<PreventiveTutorTriggerProps> = ({ 
  recommendation, 
  onAccept, 
  onClose 
}) => {
  if (!recommendation) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
      >
        <div className="bg-background/95 backdrop-blur-md border border-primary/20 rounded-2xl p-4 shadow-2xl shadow-primary/10">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              {recommendation.type === 'tutor_hint' ? (
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              ) : (
                <MessageSquare className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-primary">{recommendation.title}</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {recommendation.description}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  onClick={onAccept}
                  className="h-8 text-xs bg-primary hover:bg-primary/90"
                >
                  Sim, por favor
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={onClose}
                  className="h-8 text-xs hover:bg-muted"
                >
                  Agora não
                </Button>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PreventiveTutorTrigger;

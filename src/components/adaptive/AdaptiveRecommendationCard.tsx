import React from "react";
import { 
  Sparkles, 
  ArrowRight, 
  X, 
  BrainCircuit, 
  Clock, 
  Lightbulb,
  BookOpen,
  MessageSquare
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AdaptiveRecommendation {
  id: string;
  recommendation_text: string;
  action_taken: string;
  action_payload: any;
  estimated_time_min?: number;
  trigger_type: string;
  node_name?: string;
}

interface AdaptiveRecommendationCardProps {
  recommendation: AdaptiveRecommendation;
  onAccept: (id: string) => void;
  onIgnore: (id: string) => void;
  className?: string;
}

const AdaptiveRecommendationCard = ({ 
  recommendation, 
  onAccept, 
  onIgnore,
  className 
}: AdaptiveRecommendationCardProps) => {
  const getIcon = () => {
    switch (recommendation.action_taken) {
      case 'suggest_feynman': return <Lightbulb className="h-5 w-5 text-amber-500" />;
      case 'inject_micro_review': return <BookOpen className="h-5 w-5 text-blue-500" />;
      case 'suggest_tutor': return <MessageSquare className="h-5 w-5 text-purple-500" />;
      default: return <BrainCircuit className="h-5 w-5 text-primary" />;
    }
  };

  const getActionLabel = () => {
    switch (recommendation.action_taken) {
      case 'suggest_feynman': return 'Ver Explicação Feynman';
      case 'inject_micro_review': return 'Iniciar Micro-Revisão';
      case 'suggest_tutor': return 'Abrir Tutor IA';
      default: return 'Ver Detalhes';
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-lg animate-in slide-in-from-right duration-500",
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-primary/20">
              Recomendação Adaptativa
            </Badge>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 rounded-full hover:bg-red-500/10 hover:text-red-500"
            onClick={() => onIgnore(recommendation.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex gap-3">
          <div className="mt-1">
            {getIcon()}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium leading-tight">
              {recommendation.recommendation_text}
            </p>
            {recommendation.node_name && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                Conceito: <span className="font-bold text-primary">{recommendation.node_name}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          {recommendation.estimated_time_min && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
              <Clock className="h-3 w-3" /> {recommendation.estimated_time_min} min
            </div>
          )}
          <Button 
            size="sm" 
            className="h-8 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-sm"
            onClick={() => onAccept(recommendation.id)}
          >
            {getActionLabel()} <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdaptiveRecommendationCard;

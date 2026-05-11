import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, X, Loader2, Check } from "lucide-react";

interface SuggestedTopic {
  tema: string;
  especialidade: string;
  dificuldade: string;
  subtopico?: string;
}

interface Props {
  uploadId: string;
  filename: string;
  topics: SuggestedTopic[];
  isEnriching?: boolean;
  enrichmentProgress?: number;
  onAdd: (topics: SuggestedTopic[]) => Promise<void>;
  onDismiss: () => void;
}

const CronogramaSmartSuggestions = ({ uploadId, filename, topics, onAdd, onDismiss }: Props) => {
  const [adding, setAdding] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<number[]>(topics.map((_, i) => i));

  const toggleTopic = (index: number) => {
    setSelectedTopics(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleAdd = async () => {
    if (selectedTopics.length === 0) return;
    setAdding(true);
    try {
      const topicsToAdd = topics.filter((_, i) => selectedTopics.includes(i));
      await onAdd(topicsToAdd);
    } finally {
      setAdding(false);
    }
  };

  if (topics.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-4 duration-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Sugestões da IA para "{filename}"
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Identificamos {topics.length} temas relevantes neste documento. Adicione-os ao seu cronograma:
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {topics.map((topic, i) => (
            <div 
              key={i}
              onClick={() => toggleTopic(i)}
              className={`flex items-start justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                selectedTopics.includes(i) 
                  ? "bg-background border-primary shadow-sm" 
                  : "bg-background/50 border-transparent hover:border-muted-foreground/30"
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{topic.tema}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">{topic.especialidade}</span>
                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0 uppercase">
                    {topic.dificuldade}
                  </Badge>
                </div>
              </div>
              <div className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${
                selectedTopics.includes(i) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"
              }`}>
                {selectedTopics.includes(i) && <Check className="h-2.5 w-2.5" />}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onDismiss} disabled={adding}>
            Agora não
          </Button>
          <Button size="sm" onClick={handleAdd} disabled={adding || selectedTopics.length === 0}>
            {adding ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-2" />}
            Adicionar {selectedTopics.length} Temas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CronogramaSmartSuggestions;
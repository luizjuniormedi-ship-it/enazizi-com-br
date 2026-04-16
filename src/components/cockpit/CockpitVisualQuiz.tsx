import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import type { CockpitVisualWeak } from "@/hooks/useCockpitData";

interface Props {
  weaknesses: CockpitVisualWeak[];
}

const LABEL: Record<string, string> = {
  rx_torax: "RX de tórax",
  ecg: "ECG",
  tomografia: "Tomografia",
  rm: "Ressonância",
  histologia: "Histologia",
  dermatoscopia: "Dermatoscopia",
};

export default function CockpitVisualQuiz({ weaknesses }: Props) {
  const navigate = useNavigate();
  if (!weaknesses?.length) return null;
  const top = weaknesses[0];
  return (
    <Card className="p-6 border-warning/20 bg-warning/5">
      <div className="flex items-center gap-2 mb-2">
        <Eye className="h-5 w-5 text-warning" />
        <h2 className="text-lg font-semibold">👁️ Fraqueza visual detectada</h2>
      </div>
      <p className="text-sm mb-3">
        Você está com <strong className="text-warning">{Math.round(Number(top.accuracy) * 100)}%</strong> de acerto em{" "}
        <strong>{LABEL[top.image_type] ?? top.image_type}</strong>. Treine agora para subir a curva.
      </p>
      <Button size="sm" onClick={() => navigate(`/dashboard/image-quiz?type=${top.image_type}`)} className="gap-1">
        Treinar quiz visual
      </Button>
    </Card>
  );
}

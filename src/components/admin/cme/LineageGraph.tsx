import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitBranch, Box, Film, CheckCircle2 } from "lucide-react";

export default function CMELineageGraph({ generationId }: { generationId: string }) {
  // Simplified visual lineage
  const steps = [
    { label: "Sessão Original", icon: GitBranch, color: "text-blue-500" },
    { label: "Chaptering AI", icon: Box, color: "text-purple-500" },
    { label: "Scene Graph", icon: Box, color: "text-pink-500" },
    { label: "GPU Rendering", icon: Film, color: "text-orange-500" },
    { label: "Videoaula ENAFLIX", icon: CheckCircle2, color: "text-green-500" },
  ];

  return (
    <div className="p-4 border rounded-xl bg-card">
      <h3 className="text-lg font-semibold mb-6">Knowledge Lineage Tracking</h3>
      <div className="relative flex justify-between items-start">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted z-0" />
        {steps.map((step, i) => (
          <div key={i} className="relative z-10 flex flex-col items-center gap-2 group">
            <div className={`p-2 rounded-full bg-background border shadow-sm group-hover:scale-110 transition-transform`}>
              <step.icon className={`h-6 w-6 ${step.color}`} />
            </div>
            <span className="text-xs font-medium text-center max-w-[80px]">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

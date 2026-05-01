import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GPUFleetPanel } from "@/components/admin/cme/GPUFleetPanel";

const GPUFleetPage = () => {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">GPU Orchestration Center</h1>
        <Button variant="outline" className="gap-2 font-bold" onClick={() => navigate("/admin/cme-executive")}>
          <ChevronLeft className="h-4 w-4" /> Voltar ao Monitor
        </Button>
      </div>
      <GPUFleetPanel />
    </div>
  );
};

export default GPUFleetPage;

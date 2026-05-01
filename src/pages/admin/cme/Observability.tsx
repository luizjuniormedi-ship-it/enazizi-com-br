
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CMEObservabilityPanel } from "@/components/admin/cme/ObservabilityPanel";

const CMEObservabilityPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
              <Monitor className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">CME Enterprise Observability</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest opacity-70">Real-time Telemetry & Bottleneck Analysis</p>
            </div>
          </div>
          <Button variant="outline" className="gap-2 font-bold" onClick={() => navigate("/admin/cinematic-engine")}>
            <ChevronLeft className="h-4 w-4" /> Back to Studio
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <CMEObservabilityPanel />
      </div>
    </div>
  );
};

export default CMEObservabilityPage;

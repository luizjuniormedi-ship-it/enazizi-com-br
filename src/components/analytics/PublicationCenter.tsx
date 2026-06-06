
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LearningScienceSnapshot } from "@/types/learningScience";
import { 
  BookOpen, FileText, Download, Share2, 
  Binary, FlaskConical, ExternalLink,
  ClipboardCheck, Database, History
} from 'lucide-react';

interface PublicationCenterProps {
  snapshot: LearningScienceSnapshot;
}

export const PublicationCenter: React.FC<PublicationCenterProps> = ({ snapshot }) => {
  const { causality, validation, featureAttributions } = snapshot;

  return (
    <div className="space-y-6 mt-8 border-t pt-8">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded bg-purple-500/10 text-purple-600">
          <BookOpen className="w-5 h-5" />
        </div>
        <h2 className="text-2xl font-bold">Scientific Publication Center</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Causality Confidence Engine */}
        <Card className="lg:col-span-1 border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Binary className="w-4 h-4" /> Causality Confidence Engine
            </CardTitle>
            <CardDescription className="text-xs">Diferenciando correlação de causalidade real</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground uppercase mb-1">Causality Tier</div>
              <div className="text-xl font-black text-purple-600 mb-2">{causality.tier}</div>
              <Badge variant="outline" className="bg-white/50 border-purple-200">
                Confidence: {(causality.confidence * 100).toFixed(1)}%
              </Badge>
            </div>
            
            <div className="space-y-3 mt-4">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Stability Index</span>
                <span className="font-mono">{causality.stabilityIndex}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Matching Method</span>
                <span className="font-mono">Propensity Score</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Longitudinal Span</span>
                <span className="font-mono">180 Days</span>
              </div>
            </div>

            <div className="mt-6 p-2 rounded bg-white/40 text-[9px] text-muted-foreground italic border border-purple-100">
              "Impacto validado via análise multivariada de coortes independentes."
            </div>
          </CardContent>
        </Card>

        {/* Scientific Reports Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Generated Scientific Reports
              </CardTitle>
              <CardDescription className="text-xs">Documentação auditável para publicações</CardDescription>
            </div>
            <Button size="sm" className="gap-1 text-[10px] h-8">
              <FlaskConical className="w-3 h-3" /> NEW REPORT
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { title: "Longitudinal Impact of Tutor V3 on Medical Proficiency", date: "2026-05-15", type: "WHITE_PAPER", status: "Published" },
                { title: "FSRS Implementation: A Multi-Cohort Study on Retention", date: "2026-04-20", type: "RESEARCH_DATASET", status: "Archived" },
                { title: "Readiness vs ENARE Results: Calibration Analysis", date: "2026-06-02", type: "EXECUTIVE_SUMMARY", status: "Draft" }
              ].map((report, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-primary/5 bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded bg-primary/10 text-primary`}>
                      <ClipboardCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold">{report.title}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-muted-foreground font-mono">{report.date}</span>
                        <Badge variant="outline" className="text-[8px] h-4 py-0 leading-none">{report.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-emerald-500/10 bg-emerald-500/5 flex items-center gap-3">
                <Database className="w-5 h-5 text-emerald-600" />
                <div>
                  <div className="text-[10px] font-bold">Open Access Dataset</div>
                  <div className="text-[8px] text-muted-foreground">Anonymized Cohort Data (N=4,200)</div>
                </div>
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </div>
              <div className="p-3 rounded-lg border border-blue-500/10 bg-blue-500/5 flex items-center gap-3">
                <History className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="text-[10px] font-bold">Metric Stability Log</div>
                  <div className="text-[8px] text-muted-foreground">Drift Monitor & Calibration History</div>
                </div>
                <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

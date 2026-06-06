
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LearningScienceSnapshot } from "@/types/learningScience";
import { 
  Building2, Users, GraduationCap, TrendingUp, 
  BarChart4, ArrowRight, ShieldCheck, Microscope,
  FileSpreadsheet, FileBarChart, Presentation
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts';

interface InstitutionalDashboardProps {
  snapshot: LearningScienceSnapshot;
}

export const InstitutionalDashboard: React.FC<InstitutionalDashboardProps> = ({ snapshot }) => {
  const { institutional, evidenceHealth } = snapshot;

  if (!institutional) return null;

  return (
    <div className="space-y-6 mt-8 border-t pt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <Badge variant="outline" className="mb-1 text-[10px] uppercase font-mono">Institutional View</Badge>
            <h2 className="text-2xl font-bold tracking-tight">{institutional.institutionName}</h2>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 py-1 px-3">
            <Microscope className="w-3 h-3 mr-1" /> Evidence Health: {institutional.evidenceScore}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">
            REFRESHED: {new Date().toLocaleTimeString()}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
              <Users className="w-3 h-3" /> Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{institutional.totalStudents}</div>
            <div className="text-[10px] text-muted-foreground mt-1">+12 este mês</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
              <GraduationCap className="w-3 h-3" /> Avg Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{institutional.avgReadiness}%</div>
            <Progress value={institutional.avgReadiness} className="h-1 mt-2 bg-primary/20" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
              <TrendingUp className="w-3 h-3" /> Approval Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">{institutional.approvalRate}%</div>
            <div className="text-[10px] text-muted-foreground mt-1">Acima da média nacional</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Tier Ranking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">GOLD</div>
            <Badge variant="secondary" className="text-[9px] mt-1">AUDIT_CERTIFIED</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cohort Science Center */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart4 className="w-4 h-4 text-primary" /> Cohort Performance Comparison
            </CardTitle>
            <CardDescription className="text-xs">Análise científica por coorte de estudo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={institutional.cohorts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  <Bar dataKey="readiness" name="Readiness (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="approvalRate" name="Aprovação (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Institution Quick Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-primary" /> Export Institutional Proof
            </CardTitle>
            <CardDescription className="text-xs">Gerar pacotes de evidência para stakeholders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="group p-3 rounded-lg border border-primary/10 hover:border-primary/30 bg-muted/30 cursor-pointer transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Presentation className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="text-xs font-bold">Investor Proof Pack</div>
                    <div className="text-[10px] text-muted-foreground">Growth & Impact ROI</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            
            <div className="group p-3 rounded-lg border border-primary/10 hover:border-primary/30 bg-muted/30 cursor-pointer transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="text-xs font-bold">Scientific Dataset</div>
                    <div className="text-[10px] text-muted-foreground">Reproducible Research (CSV)</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Scientific Tier A</span>
              </div>
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                Dados desta instituição possuem confiança estatística &gt; 95% e validade externa comprovada.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

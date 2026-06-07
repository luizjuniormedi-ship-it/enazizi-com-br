import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CVRPDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['cvrp-specialty-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cvrp_specialty_stats')
        .select('*')
        .order('ocr_percentage', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const globalOCR = stats 
    ? stats.reduce((acc, curr) => acc + curr.ocr_percentage, 0) / stats.length 
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CRITICAL': return 'bg-destructive text-destructive-foreground';
      case 'POOR': return 'bg-orange-500 text-white';
      case 'PARTIAL': return 'bg-yellow-500 text-black';
      case 'OPERATIONAL': return 'bg-green-500 text-white';
      default: return 'bg-secondary';
    }
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">ENAZIZI GOLD - CVRP</h1>
          <p className="text-muted-foreground">Curriculum Visibility Recovery Program</p>
        </div>
        <Card className="w-[300px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Global OCR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalOCR.toFixed(1)}%</div>
            <Progress value={globalOCR} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Physical Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.reduce((acc, curr) => acc + curr.physical_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Visible Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.reduce((acc, curr) => acc + curr.visible_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ghost Competencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats?.reduce((acc, curr) => acc + curr.lost_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Incident Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              P0 CEGUEIRA TAXONÔMICA (CONTROLADO)
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Specialty OCR Audit</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Specialty</TableHead>
                <TableHead className="text-right">Physical</TableHead>
                <TableHead className="text-right">Visible</TableHead>
                <TableHead>OCR</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats?.map((item) => (
                <TableRow key={item.specialty}>
                  <TableCell className="font-medium">{item.specialty}</TableCell>
                  <TableCell className="text-right">{item.physical_count}</TableCell>
                  <TableCell className="text-right">{item.visible_count}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={item.ocr_percentage} className="w-[60px]" />
                      <span className="text-sm font-mono">{item.ocr_percentage}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CVRPDashboard;

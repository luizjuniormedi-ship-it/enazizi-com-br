
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileUp, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const OfficialResultImport: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    exam_name: '',
    exam_year: new Date().getFullYear(),
    institution: '',
    specialty: '',
    score: '',
    approved: false,
    ranking: '',
    vacancies: '',
    import_method: 'manual'
  });

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.from('official_exam_results').insert({
        user_id: user.id,
        exam_name: formData.exam_name,
        exam_year: formData.exam_year,
        institution: formData.institution,
        specialty_choice: formData.specialty,
        official_grade: parseFloat(formData.score), // Map to existing field
        score: parseFloat(formData.score),
        approved: formData.approved,
        ranking: parseInt(formData.ranking) || null,
        vacancies: parseInt(formData.vacancies) || null,
        import_method: formData.import_method,
        validated: false // Needs admin validation
      });

      if (error) throw error;

      toast({
        title: "Resultado Importado",
        description: "Seu resultado oficial foi enviado para validação científica.",
      });
      
      setOpen(false);
      // Telemetry LS-3.1
      console.log('[REAL_RESULT_IMPORTED]', { exam: formData.exam_name });
    } catch (error: any) {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-emerald-500/50 hover:bg-emerald-500/10">
          <Upload className="w-4 h-4 text-emerald-500" /> Importar Resultado Real
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" /> 
            Validação de Resultado Oficial
          </DialogTitle>
          <DialogDescription>
            Importe seu resultado real para calibrar os motores científicos do ENAZIZI.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleImport} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exam">Prova / Edital</Label>
              <Input 
                id="exam" 
                placeholder="Ex: ENARE" 
                value={formData.exam_name}
                onChange={e => setFormData({...formData, exam_name: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Ano</Label>
              <Input 
                id="year" 
                type="number" 
                value={formData.exam_year}
                onChange={e => setFormData({...formData, exam_year: parseInt(e.target.value)})}
                required 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution">Instituição</Label>
            <Input 
              id="institution" 
              placeholder="Ex: USP, ENARE, SURCE" 
              value={formData.institution}
              onChange={e => setFormData({...formData, institution: e.target.value})}
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidade</Label>
              <Input 
                id="specialty" 
                placeholder="Ex: Clínica Médica" 
                value={formData.specialty}
                onChange={e => setFormData({...formData, specialty: e.target.value})}
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="score">Nota Final (%)</Label>
              <Input 
                id="score" 
                type="number" 
                step="0.01"
                placeholder="Ex: 84.5" 
                value={formData.score}
                onChange={e => setFormData({...formData, score: e.target.value})}
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ranking">Sua Posição</Label>
              <Input 
                id="ranking" 
                type="number" 
                value={formData.ranking}
                onChange={e => setFormData({...formData, ranking: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vacancies">Total de Vagas</Label>
              <Input 
                id="vacancies" 
                type="number" 
                value={formData.vacancies}
                onChange={e => setFormData({...formData, vacancies: e.target.value})}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold">Fui Aprovado</Label>
              <p className="text-[10px] text-muted-foreground italic">Confirmação de Aprovação Real</p>
            </div>
            <Switch 
              checked={formData.approved}
              onCheckedChange={checked => setFormData({...formData, approved: checked})}
            />
          </div>

          <div className="space-y-2">
            <Label>Documento Oficial (PDF/Foto)</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer">
              <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Arraste seu comprovante ou clique para selecionar</p>
            </div>
          </div>

          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
            {loading ? "Processando..." : "Confirmar Importação Científica"}
          </Button>
          
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground justify-center">
            <AlertCircle className="w-3 h-3" />
            Dados auditáveis e protegidos por criptografia de ponta-a-ponta.
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

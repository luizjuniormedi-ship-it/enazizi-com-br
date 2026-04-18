import React, { memo } from "react";
import { MessageCircle, Stethoscope, FileSearch, Syringe, Pill, HeartPulse, Target, HelpCircle, Users, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const QUICK_ACTION_CATEGORIES = [
  {
    label: "Anamnese", icon: MessageCircle, color: "text-blue-500",
    actions: [
      { label: "HDA", prompt: "Gostaria de saber mais sobre a história da doença atual. Quando começaram os sintomas? Como evoluíram?" },
      { label: "Ant. Pessoais", prompt: "Quais são seus antecedentes pessoais? Doenças prévias, cirurgias, internações?" },
      { label: "Ant. Familiares", prompt: "Há doenças na família? Pais, irmãos?" },
      { label: "Hábitos de Vida", prompt: "Quais são seus hábitos? Tabagismo, etilismo, atividade física, alimentação?" },
      { label: "Medicamentos", prompt: "Faz uso de algum medicamento? Quais?" },
      { label: "Alergias", prompt: "Tem alergia a algum medicamento ou substância?" },
      { label: "Rev. de Sistemas", prompt: "Gostaria de fazer uma revisão de sistemas. Tem sentido algo diferente em outros órgãos? Febre, perda de peso, alterações urinárias, intestinais?" },
    ],
  },
  {
    label: "Exame Físico", icon: Stethoscope, color: "text-green-500",
    actions: [
      { label: "Cardiovascular", prompt: "Gostaria de realizar exame físico cardiovascular: ausculta cardíaca, pulsos, pressão venosa jugular, perfusão periférica." },
      { label: "Respiratório", prompt: "Gostaria de realizar exame físico respiratório: inspeção, palpação, percussão e ausculta pulmonar." },
      { label: "Abdome", prompt: "Gostaria de realizar exame físico abdominal: inspeção, ausculta, palpação superficial e profunda, percussão." },
      { label: "Neurológico", prompt: "Gostaria de realizar exame neurológico: nível de consciência, pupilas, força muscular, reflexos, sensibilidade, sinais meníngeos." },
      { label: "Musculoesq.", prompt: "Gostaria de realizar exame do sistema musculoesquelético: inspeção, palpação, amplitude de movimento, testes especiais." },
      { label: "Cabeça/Pescoço", prompt: "Gostaria de examinar cabeça e pescoço: orofaringe, otoscopia, linfonodos cervicais, tireoide, rigidez de nuca." },
      { label: "Pele/Mucosas", prompt: "Gostaria de examinar pele e mucosas: coloração, hidratação, lesões, edema, turgor." },
    ],
  },
  {
    label: "Exames", icon: FileSearch, color: "text-purple-500",
    actions: [
      { label: "Hemograma", prompt: "Solicito hemograma completo." },
      { label: "Bioquímica", prompt: "Solicito exames bioquímicos: glicemia, ureia, creatinina, sódio, potássio, TGO, TGP, bilirrubinas." },
      { label: "Gasometria", prompt: "Solicito gasometria arterial." },
      { label: "ECG", prompt: "Solicito eletrocardiograma de 12 derivações." },
      { label: "Rx Tórax", prompt: "Solicito radiografia de tórax PA e perfil." },
      { label: "TC", prompt: "Solicito tomografia computadorizada." },
      { label: "USG", prompt: "Solicito ultrassonografia." },
      { label: "RM", prompt: "Solicito ressonância magnética." },
    ],
  },
  {
    label: "Conduta", icon: Syringe, color: "text-red-500",
    actions: [
      { label: "Acesso Venoso", prompt: "Providenciar acesso venoso periférico calibroso e iniciar hidratação venosa." },
      { label: "Monitorização", prompt: "Solicito monitorização cardíaca contínua, oximetria de pulso e PA não-invasiva." },
      { label: "Oxigenoterapia", prompt: "Iniciar oxigenoterapia suplementar." },
      { label: "Sonda", prompt: "Solicitar passagem de sonda (nasogástrica/vesical conforme indicação)." },
      { label: "IOT", prompt: "Preparo para intubação orotraqueal: kit de via aérea, drogas de sequência rápida, posicionamento." },
    ],
  },
  {
    label: "Tratamento", icon: Pill, color: "text-orange-500",
    actions: [
      { label: "Analgesia", prompt: "Prescrevo analgesia: dipirona 1g EV ou tramadol 100mg EV, conforme intensidade da dor. Avaliar escala de dor." },
      { label: "Antibiótico", prompt: "Inicio antibioticoterapia empírica. Qual o esquema mais adequado para a suspeita clínica? Prescrevo conforme protocolo institucional." },
      { label: "Anticoagulação", prompt: "Avalio indicação de anticoagulação. Prescrevo heparina conforme peso e indicação clínica." },
      { label: "Corticoide", prompt: "Prescrevo corticoterapia: hidrocortisona/metilprednisolona EV conforme indicação." },
      { label: "Droga Vasoativa", prompt: "Inicio noradrenalina 0,1 mcg/kg/min em BIC, titular conforme PAM alvo ≥ 65 mmHg." },
      { label: "Sedação", prompt: "Prescrevo sedação: midazolam + fentanil em BIC para paciente intubado, ou diazepam EV para agitação." },
      { label: "Cristaloide", prompt: "Prescrevo expansão volêmica com SF 0,9% 500-1000ml EV rápido, reavaliar resposta hemodinâmica." },
      { label: "Alta/Internação", prompt: "Defino destino do paciente: alta hospitalar com orientações, ou internação em enfermaria/UTI. Justifico a decisão." },
    ],
  },
];

interface QuickActionsBarProps {
  loading: boolean;
  onSendAction: (prompt: string, label: string) => void;
  onOpenMobileVitals: () => void;
  onOpenPrescription: () => void;
  onSendDiagnosis: () => void;
  onPreceptor: () => void;
  onSpecialist: () => void;
  onFinish: () => void;
}

const QuickActionsBar = memo(function QuickActionsBar({
  loading, onSendAction, onOpenMobileVitals, onOpenPrescription, onSendDiagnosis, onPreceptor, onSpecialist, onFinish,
}: QuickActionsBarProps) {
  return (
    <div className="border-t border-border/30 p-2 space-y-1.5 shrink-0">
      <div className="flex gap-1.5 flex-wrap">
        <Button
          variant="ghost" size="sm"
          className="text-xs shrink-0 gap-1.5 h-8 text-red-500 lg:hidden"
          onClick={onOpenMobileVitals}
        >
          <HeartPulse className="h-3.5 w-3.5" /> Vitais
        </Button>
        {QUICK_ACTION_CATEGORIES.map((cat) => (
          <Popover key={cat.label}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`text-xs shrink-0 gap-1.5 h-8 ${cat.color}`} disabled={loading}>
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1.5" align="start">
              <div className="space-y-0.5">
                {cat.actions.map((action) => (
                  <button
                    key={action.label}
                    className="w-full text-left px-3 py-2 text-xs rounded-md hover:bg-muted/60 transition-colors"
                    onClick={() => onSendAction(action.prompt, `${cat.label}: ${action.label}`)}
                    disabled={loading}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ))}
        <Button variant="ghost" size="sm" className="text-xs shrink-0 gap-1.5 h-8" disabled={loading} onClick={onOpenPrescription}>
          <Pill className="h-3.5 w-3.5" /> Prescrever
        </Button>
        <Button variant="ghost" size="sm" className="text-xs shrink-0 gap-1.5 h-8" disabled={loading} onClick={onSendDiagnosis}>
          <Target className="h-3.5 w-3.5" /> Diagnóstico
        </Button>
      </div>
      <div className="flex gap-1.5 flex-wrap border-t border-border/30 pt-1.5">
        <Button variant="outline" size="sm" className="text-xs shrink-0 gap-1.5 h-8 border-amber-500/50 text-amber-600 hover:bg-amber-500/10" disabled={loading} onClick={onPreceptor}>
          <HelpCircle className="h-3.5 w-3.5" /> Preceptor
        </Button>
        <Button variant="outline" size="sm" className="text-xs shrink-0 gap-1.5 h-8 border-blue-500/50 text-blue-600 hover:bg-blue-500/10" disabled={loading} onClick={onSpecialist}>
          <Users className="h-3.5 w-3.5" /> Parecer
        </Button>
        <div className="flex-1" />
        <Button variant="destructive" size="sm" className="text-xs shrink-0 gap-1.5 h-8" disabled={loading} onClick={onFinish}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Encerrar
        </Button>
      </div>
    </div>
  );
});

export default QuickActionsBar;

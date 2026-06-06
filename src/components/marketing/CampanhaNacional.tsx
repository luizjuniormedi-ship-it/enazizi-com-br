
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Video, 
  Clapperboard, 
  MessageSquareText, 
  Camera, 
  Sparkles, 
  MidjourneyIcon, 
  Instagram, 
  Youtube, 
  Send,
  Zap,
  Target,
  Brain,
  Stethoscope,
  ShieldCheck,
  TrendingUp,
  Award
} from 'lucide-react';

const STORYBOARDS = [
  {
    title: "VÍDEO 01 — O PROBLEMA",
    scenes: [
      { id: 1, visual: "Aluno cercado por PDFs e pilhas de papel em um quarto escuro.", text: "Você estuda horas e esquece tudo dias depois." },
      { id: 2, visual: "Close no rosto do aluno frustrado olhando para milhares de questões em uma tela.", text: "Milhares de questões. Nenhuma estratégia." },
      { id: 3, visual: "Gráfico de desempenho estagnado.", text: "A maioria estuda muito. Poucos evoluem." },
    ]
  },
  {
    title: "VÍDEO 02 — O ENAZIZI",
    scenes: [
      { id: 1, visual: "Interface do ENAZIZI abrindo com efeitos cinematográficos.", text: "Conheça o ENAZIZI." },
      { id: 2, visual: "Destaque no Readiness Score (92%).", text: "Sua chance real de aprovação." },
      { id: 3, visual: "Impact Dashboard mostrando temas prioritários.", text: "Estude exatamente o que mais cai." },
    ]
  },
  {
    title: "VÍDEO 03 — TUTOR V3",
    scenes: [
      { id: 1, visual: "Tutor ensinando IAM (Infarto Agudo do Miocárdio) com fluxogramas dinâmicos.", text: "Não é um chatbot." },
      { id: 2, visual: "Mapa da Aula sendo construído em tempo real.", text: "É um preceptor digital." },
      { id: 3, visual: "Bloqueio pedagógico: 'Você só avança após dominar este conceito'.", text: "Ele só avança quando você aprende." },
    ]
  }
];

const AI_PROMPTS = {
  midjourney: [
    "Medical student frustrated, surrounded by glowing digital PDF icons, high-tech classroom, cinematic lighting, hyper-realistic, 8k --ar 16:9",
    "Digital futuristic hospital dashboard, hologram data points, blue and primary accents, clean interface, medical core, unreal engine 5 render --ar 16:9",
    "Close up of an AI avatar with medical preceptor features, wise eyes, digital particles, futuristic neural network background, cinematic --ar 16:9"
  ],
  sora: [
    "A drone shot moving through a library where books turn into digital particles and flow into a modern tablet screen showing the ENAZIZI interface.",
    "First-person view of a doctor successfully managing a septic shock simulation in a virtual hospital, heartbeat sound sync, high tension."
  ]
};

export const CampanhaNacionalDashboard: React.FC = () => {
  return (
    <div className="space-y-8 p-6 bg-[#050508] text-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic flex items-center gap-3 text-primary">
            <Zap className="h-8 w-8 animate-pulse" />
            Campanha Nacional: ENAZIZI V6 Launch
          </h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em] mt-1">
            Integrated Marketing Suite • Industrial Grade Creative Assets
          </p>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/30 uppercase tracking-widest text-[10px] px-3 py-1">
          Ready for Launch
        </Badge>
      </div>

      <Tabs defaultValue="storyboards" className="space-y-6">
        <TabsList className="bg-white/5 border border-white/10 p-1">
          <TabsTrigger value="storyboards" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-primary data-[state=active]:text-black">
            Storyboards
          </TabsTrigger>
          <TabsTrigger value="prompts" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-primary data-[state=active]:text-black">
            Prompts IA (Sora/MJ)
          </TabsTrigger>
          <TabsTrigger value="channels" className="text-[10px] font-black uppercase tracking-widest px-6 data-[state=active]:bg-primary data-[state=active]:text-black">
            Canais & Ads
          </TabsTrigger>
        </TabsList>

        <TabsContent value="storyboards" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {STORYBOARDS.map((video, idx) => (
              <Card key={idx} className="bg-white/5 border-white/10 backdrop-blur-xl">
                <CardHeader className="pb-3 border-b border-white/5">
                  <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <Clapperboard className="h-4 w-4 text-primary" /> {video.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {video.scenes.map((scene) => (
                    <div key={scene.id} className="space-y-2 group">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[8px] font-mono border-white/10 opacity-40">CENA {scene.id}</Badge>
                        <Camera className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </div>
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] leading-relaxed italic text-white/70">
                        {scene.visual}
                      </div>
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-bold text-primary text-center">
                        "{scene.text}"
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Prompts Midjourney
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {AI_PROMPTS.midjourney.map((p, i) => (
                  <div key={i} className="group relative">
                    <pre className="p-4 rounded-xl bg-black/60 border border-white/5 text-[10px] font-mono text-white/50 leading-relaxed whitespace-pre-wrap group-hover:text-white transition-colors">
                      {p}
                    </pre>
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6">
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Video className="h-4 w-4 text-blue-500" /> Prompts Sora / Veo 3
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {AI_PROMPTS.sora.map((p, i) => (
                  <div key={i} className="group relative">
                    <pre className="p-4 rounded-xl bg-black/60 border border-white/5 text-[10px] font-mono text-white/50 leading-relaxed whitespace-pre-wrap group-hover:text-white transition-colors">
                      {p}
                    </pre>
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6">
                      <Send className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white/5 border-white/10 border-t-4 border-t-pink-600">
              <CardHeader className="py-3">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Instagram className="h-3 w-3" /> Instagram Ads
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-[10px] text-white/40">Formatos: Reels, Stories</div>
                <Badge className="bg-emerald-500/10 text-emerald-500">CTA: Saiba Mais</Badge>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 border-t-4 border-t-red-600">
              <CardHeader className="py-3">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Youtube className="h-3 w-3" /> YouTube Shorts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-[10px] text-white/40">Foco: Demonstração Tutor V3</div>
                <Badge className="bg-emerald-500/10 text-emerald-500">CTA: Testar Grátis</Badge>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 border-t-4 border-t-blue-600">
              <CardHeader className="py-3">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Target className="h-3 w-3" /> Meta / Facebook
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-[10px] text-white/40">Público: Estudantes Med 5/6</div>
                <Badge className="bg-emerald-500/10 text-emerald-500">Amostra: 50.000 users</Badge>
              </CardContent>
            </Card>
            <Card className="bg-white/5 border-white/10 border-t-4 border-t-primary">
              <CardHeader className="py-3">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Award className="h-3 w-3" /> Email Marketing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-[10px] text-white/40">Frequência: D0, D3, D7</div>
                <Badge className="bg-emerald-500/10 text-emerald-500">Status: Automated</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Campaign Summary Footer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/10">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-white/40">Conceito Criativo</div>
            <div className="text-sm font-black text-white italic">"Sistema Operacional da Aprovação"</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-white/40">Pilar Central</div>
            <div className="text-sm font-black text-white italic">Hospital Virtual + Tutor IA</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase text-white/40">Tagline de Impacto</div>
            <div className="text-sm font-black text-white italic">"Evolua de forma inteligente."</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampanhaNacionalDashboard;

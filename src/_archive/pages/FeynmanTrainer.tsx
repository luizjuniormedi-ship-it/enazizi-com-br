import { Lightbulb } from "lucide-react";
import AgentChat from "@/components/agents/AgentChat";

const quickActions = [
  { label: "🧠 Explicar um tema", prompt: "Quero praticar o Método Feynman! Me dê um tema de medicina para eu explicar com minhas próprias palavras, como se fosse para um leigo.", icon: "🧠" },
  { label: "📝 Avaliar explicação", prompt: "Vou te enviar minha explicação de um conceito médico. Avalie usando os 4 critérios do Método Feynman: Clareza, Completude, Precisão e Simplicidade.", icon: "📝" },
  { label: "🔬 Simplificar conceito", prompt: "Me ajude a simplificar um conceito médico complexo usando o Método Feynman. Quero transformar algo difícil em uma explicação que qualquer pessoa entenderia.", icon: "🔬" },
  { label: "🎯 Identificar lacunas", prompt: "Vou explicar um tema e quero que você identifique exatamente quais lacunas de conhecimento minha explicação revela. Seja rigoroso!", icon: "🎯" },
];

const FeynmanTrainer = () => (
  <AgentChat
    title="Método Feynman"
    subtitle="Explique como se fosse para um leigo — descubra o que você realmente sabe."
    icon={<Lightbulb className="h-6 w-6 text-yellow-400" />}
    welcomeMessage={`💡 **Método Feynman — Aprenda ensinando!**

O Método Feynman é simples e poderoso:
1. **Escolha um conceito** médico
2. **Explique com suas palavras** como se fosse para alguém sem formação médica
3. **Eu avalio** sua explicação em 4 critérios: Clareza ✨, Completude 📋, Precisão 🎯 e Simplicidade 💬
4. **Identifique as lacunas** e reformule as partes fracas

Escolha uma ação rápida ou me diga qual tema quer explicar! 👇`}
    placeholder="Explique um conceito médico com suas palavras..."
    functionName="feynman-trainer"
    quickActions={quickActions}
  />
);

export default FeynmanTrainer;

import { auditQuestionGovernance, nearDuplicateScore } from "../../_shared/question-filters.ts";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

Deno.test("detecta cluster quase duplicado apesar de pequenas variações", () => {
  const base = "Paciente de 67 anos com dor torácica opressiva há duas horas, sudorese e supra de ST anterior. Qual a conduta imediata mais adequada?";
  const variant = "Paciente com 67 anos apresenta dor torácica opressiva há 2 horas, sudorese e supra de ST anterior. Qual é a conduta imediata mais adequada?";
  assert(nearDuplicateScore(base, variant) >= 0.82, "variante não agrupada");
});

Deno.test("bloqueia explicação que declara alternativa diferente como correta", () => {
  const result = auditQuestionGovernance({
    statement: "Caso clínico original sobre síndrome coronariana aguda com dados suficientes para decisão.",
    options: ["Angioplastia primária imediata", "Alta ambulatorial", "Observação", "Apenas analgesia"],
    correct_index: 0,
    explanation: "A alternativa B é a correta, pois o paciente deve receber alta ambulatorial.",
  }, []);
  assert(!result.allowed && result.blockers.includes("answer_explanation_contradiction"), "contradição aceita");
});

Deno.test("aprova coerência determinística sem duplicata", () => {
  const result = auditQuestionGovernance({
    statement: "Caso clínico original sobre síndrome coronariana aguda com dados suficientes para decisão.",
    options: ["Angioplastia primária imediata", "Alta ambulatorial", "Observação", "Apenas analgesia"],
    correct_index: 0,
    explanation: "A alternativa A é correta porque a angioplastia primária imediata oferece reperfusão no tempo recomendado.",
  }, []);
  assert(result.allowed, `bloqueio inesperado: ${result.blockers.join(",")}`);
});

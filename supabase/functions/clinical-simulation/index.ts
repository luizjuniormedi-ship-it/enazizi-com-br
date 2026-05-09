import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiFetch, sanitizeAiContent } from "../_shared/ai-fetch.ts";
import { logAiUsage } from "../_shared/ai-cache.ts";
import { getBancaProfile, buildBancaBlock } from "../_shared/banca-profiles.ts";
import { requireAuth } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extrai e parseia JSON de respostas da IA de forma segura.
 * Lida com: markdown fences, texto antes/depois do JSON,
 * booleanos com comentários, trailing commas, campos malformados.
 */
function safeParseAIJson(raw: string, _action: string): Record<string, unknown> {
  // 1. Remove markdown fences
  let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```\s*/g, "").trim();

  // 2. Extract the outermost JSON object
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found");
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  // 3. Sanitize common AI malformations
  // Fix: true (some comment) → true
  cleaned = cleaned.replace(/:\s*(true|false)\s*\([^)]*\)/gi, ": $1");
  // Fix: "value" (comment) → "value"
  cleaned = cleaned.replace(/("(?:[^"\\]|\\.)*")\s*\([^)]*\)/g, "$1");
  // Fix trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
  // Fix single quotes used as string delimiters (basic cases)
  // Fix NaN or undefined values
  cleaned = cleaned.replace(/:\s*NaN\b/g, ": 0");
  cleaned = cleaned.replace(/:\s*undefined\b/g, ": null");

  // 4. Parse
  return JSON.parse(cleaned);
}


const SYSTEM_PROMPT = `IDIOMA OBRIGATÓRIO: TUDO em PORTUGUÊS BRASILEIRO (pt-BR). NUNCA use inglês como idioma principal. Inglês permitido APENAS em nomes de artigos/guidelines.

Você é o simulador de PLANTÃO MÉDICO do sistema ENAZIZI. Você desempenha DOIS papéis simultâneos:

1. **PACIENTE**: Responde às perguntas do médico (aluno) de forma realista. Não entrega o diagnóstico facilmente.
2. **NARRADOR CLÍNICO**: Descreve achados de exame físico e resultados de exames quando solicitados.

## REGRA CRÍTICA DE ANTI-REPETIÇÃO E ATUALIZAÇÃO

**NUNCA repita o mesmo caso clínico.** A cada novo caso você DEVE:
- Escolher uma CONDIÇÃO DIFERENTE dentro da especialidade solicitada (nunca repetir diagnóstico)
- Variar OBRIGATORIAMENTE todos estes parâmetros:
  * Faixa etária (criança, adolescente, adulto jovem, meia-idade, idoso)
  * Sexo biológico (alterne entre masculino e feminino)
  * Comorbidades de base (DM2, HAS, obesidade, tabagismo, etilismo, nenhuma, gestante, imunossuprimido, HIV+, transplantado, etc.)
  * Cenário de atendimento (PS de hospital terciário, UPA, UBS, SAMU, UTI, enfermaria, ambulatório de emergência, sala de parto)
  * Região/contexto social (urbano, rural, comunidade ribeirinha, população em situação de rua, presídio, indígena)
  * Horário/turno (madrugada, plantão noturno, final de semana, dia de semana)
- Priorizar diagnósticos MENOS COMUNS e desafiadores (não apenas IAM, AVC e pneumonia)
- Incluir apresentações ATÍPICAS de doenças comuns (ex: IAM sem dor torácica em idoso diabético)
- Usar dados epidemiológicos ATUALIZADOS (diretrizes 2024-2026, protocolos MS, SBC, SBP, FEBRASGO)
- Incluir doenças TROPICAIS e NEGLIGENCIADAS quando pertinente (dengue grave, leptospirose, malária, leishmaniose, Chagas agudo, febre amarela, chikungunya com complicações)
- Considerar EMERGÊNCIAS ATUAIS: arboviroses, surtos sazonais, resistência antimicrobiana, novas diretrizes de sepse (Sepsis-3/4)
- Incorporar cenários de SAÚDE MENTAL em emergência (tentativa de suicídio, surto psicótico, delirium, síndrome neuroléptica maligna)

### Banco de Cenários por Especialidade (use como inspiração, NÃO se limite a estes):

**Clínica Médica**: cetoacidose diabética, crise tireotóxica, insuficiência adrenal aguda, porfiria, síndrome hemolítico-urêmica, PTT, CIVD, embolia gordurosa, síndrome de lise tumoral, hipercalcemia maligna, encefalopatia hepática, síndrome hepatorrenal, pneumonia por Pneumocystis, histoplasmose disseminada, endocardite em usuário de drogas IV, febre de origem indeterminada, vasculite ANCA+, LES com nefrite, esclerodermia com crise renal

**Cirurgia**: vólvulo de sigmoide, isquemia mesentérica aguda, perfuração de úlcera, Fournier, trauma hepático grau IV, lesão de vias biliares, hérnia de Richter encarcerada, diverticulite complicada (Hinchey III/IV), pancreatite necrotizante, síndrome compartimental abdominal, trauma penetrante cervical, pneumotórax hipertensivo, tamponamento cardíaco traumático, lesão de grandes vasos, amputação traumática

**Pediatria**: invaginação intestinal, estenose hipertrófica do piloro, corpo estranho em via aérea, epiglotite, laringotraqueobronquite grave, síndrome de Kawasaki, púrpura de Henoch-Schönlein, síndrome nefrótica com peritonite, meningite neonatal, sepse neonatal tardia, enterocolite necrosante, kernicterus, crise falcêmica, cetoacidose diabética em criança, maus-tratos infantil

**Ginecologia e Obstetrícia**: placenta acreta com hemorragia, eclâmpsia refratária, síndrome HELLP, embolia de líquido amniótico, rotura uterina, prolapso de cordão, descolamento prematuro de placenta com CIVD, gravidez ectópica rota, torção de ovário, abscesso tubo-ovariano roto, hemorragia pós-parto refratária, inversão uterina aguda

**Emergência**: intoxicação por organofosforado, overdose de opioide, síndrome serotoninérgica, anafilaxia refratária, queimadura de via aérea, afogamento, hipotermia grave, rabdomiólise, síndrome de esmagamento, envenenamento ofídico (botrópico/crotálico/laquético), acidente com aranha-marrom

**Psiquiatria em Emergência**: síndrome neuroléptica maligna, delirium tremens, intoxicação aguda por cocaína/crack, agitação psicomotora com risco, catatonia maligna

**Dermatologia de Urgência**: necrólise epidérmica tóxica (NET), síndrome de Stevens-Johnson, pênfigo vulgar com sepse, fasciíte necrosante

**Neurologia de Urgência**: status epilepticus, AVC de fossa posterior, dissecção de artéria vertebral, miastenia gravis em crise, síndrome de Guillain-Barré com insuficiência respiratória, hemorragia subaracnóidea Fisher IV, trombose venosa cerebral

**Oncologia**: neutropenia febril pós-quimioterapia, síndrome de lise tumoral, compressão medular por metástase, síndrome da veia cava superior, hipercalcemia maligna, derrame pericárdico neoplásico com tamponamento, obstrução intestinal por carcinomatose, tromboembolismo em paciente oncológico, dor oncológica refratária, mucosite grave pós-QT, metástase cerebral com hipertensão intracraniana, carcinoma de pulmão com síndrome de Pancoast



### Início do Caso
Ao receber action="start", gere um caso clínico de pronto-socorro/plantão com:
- Queixa principal do paciente (em 1ª pessoa, como paciente falaria)
- Sinais vitais básicos COERENTES com a classificação de risco solicitada
- Cenário do atendimento (PS, enfermaria, UTI, SAMU, sala de emergência)
- NÃO revele o diagnóstico

## REGRA CRÍTICA DE CLASSIFICAÇÃO DE RISCO (TRIAGE)
Você DEVE respeitar a classificação de risco (triage_color) solicitada na mensagem do usuário:
- **VERMELHO** (Emergência): paciente em risco iminente de morte. Sinais vitais gravemente alterados (hipotensão severa, taquicardia extrema, SpO2 < 85%, rebaixamento de consciência, choque). Ex: parada cardiorrespiratória, politrauma grave, IAM com choque cardiogênico, anafilaxia, hemorragia maciça.
- **LARANJA** (Muito Urgente): sinais de gravidade importante, risco de deterioração rápida. Sinais vitais significativamente alterados. Ex: sepse em evolução, AVC agudo, abdome agudo com peritonite, intoxicação grave, cetoacidose diabética.
- **AMARELO** (Urgente): paciente com sinais de alerta mas hemodinamicamente estável no momento. Sinais vitais podem estar levemente alterados. Ex: dor torácica atípica, pneumonia com febre alta, crise hipertensiva, desidratação moderada, fratura exposta.
- **VERDE** (Pouco Urgente): condição sem risco imediato, mas que necessita atendimento. Sinais vitais normais ou minimamente alterados. Ex: infecção urinária, lombalgia aguda, crise de enxaqueca, ferimentos leves, alergia cutânea.

Os sinais vitais DEVEM refletir a gravidade da classificação. NÃO coloque sinais vitais normais em paciente vermelho, nem sinais vitais graves em paciente verde.

Responda SEMPRE em JSON válido:
{
  "patient_presentation": "texto da apresentação do paciente em 1ª pessoa",
  "vitals": { "PA": "...", "FC": "...", "FR": "...", "Temp": "...", "SpO2": "..." },
  "setting": "Pronto-Socorro / UTI / Enfermaria",
  "triage_color": "vermelho/amarelo/verde",
  "hidden_diagnosis": "diagnóstico correto (NÃO mostrar ao aluno)",
  "hidden_key_findings": ["achado1", "achado2", "achado3"],
  "difficulty_score": 1-5
}

### Durante a Simulação
Responda em JSON:
- Se o aluno faz ANAMNESE → responda como paciente, revelando informações gradualmente
- Se o aluno pede EXAME FÍSICO → NÃO forneça achados automaticamente. Primeiro PERGUNTE qual sistema ou região o aluno deseja examinar (ex: "Qual sistema ou região você gostaria de examinar? Cardiovascular, respiratório, abdome, neurológico, musculoesquelético, pele/mucosas, cabeça e pescoço...?"). Quando o aluno especificar o sistema:
  * Forneça APENAS os achados do sistema/região solicitado, com detalhes semiológicos completos
  * Se o sistema examinado NÃO é o mais relevante para o caso → dê uma dica sutil sem entregar o diagnóstico (ex: "O exame do sistema X está dentro da normalidade. Há algum outro sistema que você gostaria de examinar?")
  * Se o sistema É relevante → descreva os achados positivos e negativos pertinentes com riqueza de detalhes
  * O aluno pode solicitar exame de múltiplos sistemas, um por vez
  * Ao descrever os achados, SEMPRE inclua:
    - Nome técnico da manobra semiológica realizada (ex: "Sinal de Blumberg", "Manobra de Giordano", "Sinal de Murphy")
    - Breve descrição da técnica de execução (ex: "descompressão brusca do abdome")
    - Achado encontrado (positivo ou negativo) e seu significado clínico
    - Sugestão de manobras complementares que o aluno poderia solicitar
    Exemplo: "Ao realizar a Manobra de Blumberg (descompressão brusca do abdome), observa-se dor intensa à descompressão em FID → sugere irritação peritoneal. Considere também avaliar o Sinal de Rovsing e o Sinal do Psoas."
  * Quando response_type for "physical_exam", inclua no JSON um campo adicional:
    "maneuvers_performed": [{ "name": "Nome da Manobra", "technique": "Como executar", "finding": "Achado positivo ou negativo", "interpretation": "Significado clínico" }]
    Inclua no mínimo 2 manobras relevantes ao sistema examinado (quando aplicável).
- Se o aluno pede EXAMES LABORATORIAIS → NÃO forneça resultados automaticamente. Primeiro PERGUNTE quais exames específicos ele deseja solicitar (ex: "Quais exames laboratoriais você gostaria de solicitar?"). Quando o aluno especificar os exames:
  * Se o exame solicitado NÃO é o padrão-ouro ou o mais indicado para o caso → AVISE: "Atenção: [exame solicitado] não é o exame padrão-ouro para investigar [suspeita clínica]. O exame mais indicado seria [exame correto]. Deseja solicitar mesmo assim ou prefere trocar?" Mas AINDA ASSIM forneça o resultado se o aluno insistir.
  * Se o exame É adequado → forneça os resultados COMPLETOS imediatamente (com valores numéricos, unidades e faixas de referência)
  * Sempre forneça resultados completos quando o aluno confirmar o exame: "Hemograma: Hb 8,2 g/dL (ref: 12-16), Leucócitos 18.500/mm³ (ref: 4.000-11.000)..."
- Se o aluno pede EXAMES DE IMAGEM → NÃO forneça resultados automaticamente. Primeiro PERGUNTE qual exame de imagem específico ele deseja (ex: "Qual exame de imagem você gostaria de solicitar?"). Quando o aluno especificar:
  * Se o exame NÃO é o padrão-ouro para o caso → AVISE: "Atenção: [exame solicitado] não é o exame padrão-ouro para essa investigação. O mais indicado seria [exame correto]. Deseja prosseguir?" Mas forneça o resultado se insistir.
  * Se o exame É adequado → descreva os laudos COMPLETOS imediatamente (achados positivos e negativos relevantes)
- Se o aluno prescreve MEDICAÇÃO → descreva a EVOLUÇÃO do paciente após a medicação:
  * Se a medicação é CORRETA e adequada → mostre melhora gradual dos sinais vitais e sintomas (ex: "Após 30 minutos da administração de [medicação], paciente refere melhora da dor. PA estabilizou em 120/80, FC reduziu para 88bpm.")
  * Se a medicação é PARCIALMENTE correta (dose errada, via inadequada) → melhora parcial com alerta sutil (ex: "Paciente apresenta melhora discreta, porém mantém [sintoma]. A dose pode estar subótima.")
  * Se a medicação é INCORRETA ou perigosa → piora clínica proporcional (ex: "Após administração, paciente evolui com [efeito adverso]. Sinais vitais: [piora].")
  * SEMPRE atualize os sinais vitais para refletir o impacto do tratamento
  * Inclua "treatment_outcome": "improved|partial|worsened|no_effect" no JSON
- Se o aluno propõe DIAGNÓSTICO → NÃO confirme nem negue diretamente, deixe-o justificar

## DECISÃO DE TRATAMENTO ADAPTATIVA
Para casos de classificação VERMELHA ou LARANJA, ou quando o paciente está instável/grave/crítico:
- O tratamento é PARTE ESSENCIAL do caso — o aluno DEVE tratar para resolver o caso
- Se o aluno não prescrever tratamento após diagnóstico correto, inclua "critical_action_needed": "Diagnóstico identificado, mas o paciente precisa de tratamento imediato!"
- Avalie a SEQUÊNCIA LÓGICA: estabilização → diagnóstico → tratamento → reavaliação
- Para sepse: avalie protocolo 1h (hemoculturas + ATB + volume)
- Para IAM: avalie AAS + anticoagulação + reperfusão
- Para AVC: avalie janela terapêutica e neuroimagem antes de conduta

Para casos VERDES ou AMARELOS estáveis:
- Tratamento é desejável mas não obrigatório para boa nota
- Valorize mais o raciocínio diagnóstico

## INTERVENÇÕES EXTERNAS (OBRIGATÓRIO — insira ALEATORIAMENTE durante o caso)
A cada 3-5 interações, INSIRA uma intervenção externa para testar a capacidade do aluno de lidar com múltiplas demandas simultâneas. Escolha ALEATORIAMENTE entre:
- **Enfermagem**: "Doutor, a enfermeira informa que [evento]: soro terminou / bomba de infusão alarme / paciente do leito ao lado dessaturando / familiar pedindo informações / técnica perguntando se pode administrar [medicação]"
- **Resultado inesperado**: "Doutor, acabou de chegar o resultado de [exame]: [valor alterado inesperado que muda ou confirma o raciocínio]"
- **Familiar**: "Doutor, a família do paciente chegou e quer saber o diagnóstico e prognóstico"
- **Intercorrência**: "Doutor, o paciente [piora/evento súbito]: começou a vomitar / apresentou convulsão / PA caiu subitamente / SpO2 caindo"
- **Outro paciente**: "Doutor, tem um paciente na sala de espera classificado como [cor] com [queixa] — o que faz?"

Inclua na resposta JSON o campo "external_intervention": true quando houver intervenção.
O aluno deve lidar com a intervenção E continuar o caso principal. Avalie na nota final.

## REGRA CRÍTICA: SINAIS VITAIS DINÂMICOS
Em TODA resposta de interação (action="interact"), você DEVE incluir o campo "vitals" com os sinais vitais ATUALIZADOS do paciente. Os sinais vitais devem mudar dinamicamente conforme:
- A conduta do aluno (ex: hidratação melhora PA, oxigênio melhora SpO2)
- A evolução natural da doença (ex: sepse piora FC e PA se não tratada)
- Condutas perigosas (ex: medicação errada piora sinais vitais)
- Tempo decorrido sem intervenção (piora progressiva)
- **TRATAMENTO prescrito**: melhora ou piora conforme adequação da medicação

Responda em JSON:
{
  "response": "texto da resposta (como paciente ou narrador)",
  "response_type": "anamnesis|physical_exam|lab_result|imaging|prescription|treatment|diagnosis_attempt|other",
  "patient_status": "estável/instável/grave/crítico",
  "vitals": { "PA": "...", "FC": "...", "FR": "...", "Temp": "...", "SpO2": "..." },
  "time_elapsed_minutes": número de minutos que se passaram,
  "hint": "dica sutil se o aluno estiver perdido (opcional)",
  "score_delta": pontuação delta (-3 a +3) baseado na qualidade da ação,
  "critical_action_needed": "string descrevendo ação urgente necessária, se houver (opcional, null se não houver)",
  "treatment_outcome": "improved|partial|worsened|no_effect (quando o aluno prescreve tratamento, null caso contrário)",
  "category_scores": {
    "anamnesis": 0-15,
    "physical_exam": 0-15,
    "complementary_exams": 0-15,
    "management": 0-15
  },
  "structured_data": {
    "type": "anamnesis|physical_exam|lab|imaging|prescription|treatment|other",
    "summary": "resumo curto do achado principal (1 frase)",
    "system": "sistema examinado se physical_exam (cardiovascular, respiratório, etc), null caso contrário"
  },
  "teaching_tip": "dica didática contextual se learner_mode estiver ativo (opcional, null se não)",
  "maneuvers_performed": [{"name":"Nome da manobra","technique":"Como realizar","finding":"Achado encontrado","interpretation":"Significado clínico"}]
}

Critérios de score_delta para TRATAMENTO:
- Tratamento correto e oportuno (droga certa, dose adequada, via correta): +3
- Tratamento correto mas dose/via inadequada: +1
- Tratamento parcialmente correto (faltou componente importante): +1
- Tratamento inadequado mas não perigoso: -1
- Tratamento perigoso ou contraindicado: -3
- Tratamento atrasado em paciente crítico: -2

REGRA OBRIGATÓRIA: Quando response_type = "physical_exam", o campo "maneuvers_performed" é OBRIGATÓRIO e deve conter no mínimo 2 manobras semiológicas relevantes ao sistema examinado, com técnica de execução e interpretação clínica detalhadas.

Critérios de score_delta:
- Pergunta relevante na anamnese: +1
- Exame físico direcionado ao sistema correto: +2
- Exame físico de sistema irrelevante: 0
- Exame complementar adequado (padrão-ouro): +2
- Exame complementar razoável: +1
- Exame desnecessário/caro sem indicação: -1
- Conduta correta e oportuna: +3
- Conduta potencialmente perigosa: -3
- Conduta parcialmente correta: +1
- Diagnóstico correto com justificativa: +3
- Diagnóstico correto sem justificativa: +1
- Raciocínio clínico estruturado (mencionou diagnósticos diferenciais): +2
- Demora excessiva para agir em paciente grave: -2

### Ajuda do Preceptor
Quando action="hint", você age como PRECEPTOR/PROFESSOR orientador:
- NÃO revele o diagnóstico diretamente
- Analise o que o aluno já fez (anamnese, exames, condutas)
- Dê dicas de RACIOCÍNIO CLÍNICO: "Que sistema você acha que está mais comprometido?", "Você já pensou em descartar X?", "Que exame te ajudaria a diferenciar A de B?"
- Sugira próximos passos metodológicos sem entregar a resposta
- Use linguagem pedagógica e encorajadora

Responda em JSON:
{
  "response": "texto da orientação do preceptor",
  "response_type": "preceptor_hint",
  "clinical_reasoning_tips": ["dica1", "dica2", "dica3"],
  "suggested_next_steps": ["próximo passo sugerido 1", "próximo passo sugerido 2"],
  "score_delta": 0
}

### Parecer de Especialista
Quando action="specialist", o aluno está solicitando interconsulta/parecer de um especialista.
- Aja como o médico ESPECIALISTA da área solicitada
- Dê um parecer técnico e objetivo sobre o caso
- Inclua recomendações específicas da especialidade
- Se a especialidade solicitada for irrelevante para o caso, indique isso educadamente e sugira a especialidade mais adequada
- Use linguagem técnica apropriada de especialista para especialista

Responda em JSON:
{
  "response": "texto do parecer do especialista",
  "response_type": "specialist_opinion",
  "specialist": "nome da especialidade",
  "recommendations": ["recomendação1", "recomendação2"],
  "relevance": "alta/média/baixa",
  "score_delta": pontuação (-1 se irrelevante, +1 se adequado, +2 se excelente escolha)
}

### Finalização
Quando action="finish", avalie o desempenho completo com avaliação DETALHADA em 7 categorias.
Inclua também uma análise de DIAGNÓSTICOS DIFERENCIAIS: liste 3-5 diagnósticos diferenciais relevantes para o caso, indicando se o aluno os considerou durante o atendimento.
{
  "final_score": 0-100,
  "grade": "A/B/C/D/F",
  "correct_diagnosis": "diagnóstico correto",
  "student_got_diagnosis": true/false,
  "time_total_minutes": minutos totais,
  "evaluation": {
    "anamnesis": { "score": 0-15, "feedback": "avaliação detalhada da anamnese realizada" },
    "physical_exam": { "score": 0-15, "feedback": "avaliação do exame físico" },
    "complementary_exams": { "score": 0-15, "feedback": "avaliação dos exames solicitados" },
    "diagnosis": { "score": 0-15, "feedback": "avaliação da hipótese diagnóstica e diagnósticos diferenciais" },
    "prescription": { "score": 0-15, "feedback": "avaliação da prescrição: medicamentos, doses, vias, posologia. Se não prescreveu, indicar o que deveria ter prescrito" },
    "management": { "score": 0-15, "feedback": "avaliação da conduta geral: internação vs alta, leito adequado, monitorização, dieta, cuidados" },
    "referral": { "score": 0-10, "feedback": "avaliação dos pedidos de parecer/encaminhamento: solicitou as especialidades corretas? O momento foi adequado?" }
  },
  "differential_diagnosis": [
    {
      "diagnosis": "nome do diagnóstico diferencial",
      "reasoning": "por que esse diagnóstico entra no diferencial deste caso (sinais/sintomas compatíveis)",
      "how_to_rule_out": "exame ou achado clínico chave que descarta esse diagnóstico",
      "student_considered": true/false (se o aluno mencionou ou descartou esse diagnóstico durante o atendimento)
    }
  ],
  "strengths": ["..."],
  "improvements": ["..."],
  "ideal_approach": "texto descrevendo a abordagem ideal para o caso, incluindo prescrição modelo e conduta completa",
  "ideal_prescription": "prescrição modelo completa com medicamentos, doses, vias e intervalos",
  "physical_exam_expected": {
    "inspection": ["achado → significado clínico (ex: 'Abdome distendido → sugere obstrução ou ascite')"],
    "palpation": ["achado → significado clínico (ex: 'Dor à palpação em FID com descompressão brusca positiva → peritonite localizada')"],
    "auscultation": ["achado → significado clínico (ex: 'Murmúrio vesicular abolido em base D → derrame pleural')"],
    "vital_signs_expected": "sinais vitais esperados para este diagnóstico (ex: 'Taquicardia (FC>100), hipotensão se choque')",
    "maneuvers": [
      {
        "name": "Nome técnico da manobra semiológica",
        "technique": "Descrição de como executar a manobra passo a passo",
        "positive_finding": "O que constitui um achado positivo",
        "indicates": "O que o achado positivo indica clinicamente"
      }
    ]
  },
  "xp_earned": 10-100
}

IMPORTANTE sobre physical_exam_expected:
- Com base no diagnóstico oculto e no quadro clínico, descreva os achados de exame físico ESPERADOS para este caso específico
- Inclua manobras semiológicas ESPECÍFICAS com nome técnico correto, técnica de execução e interpretação
- Mínimo 2 manobras quando aplicável
- Os achados devem ser coerentes com o diagnóstico do caso
- Use nomenclatura médica brasileira padrão

## IMPORTANTE
- Seja realista como paciente (use linguagem coloquial, não termos médicos)
- Sinais vitais devem ser coerentes com o quadro E ATUALIZADOS A CADA INTERAÇÃO
- Resultados de exames devem ser realistas e coerentes
- Se o aluno fizer algo perigoso, o paciente deve reagir (piora dos sinais vitais) e inclua "critical_action_needed" descrevendo a urgência
- Mantenha consistência ao longo de toda a simulação
- Na avaliação final, seja RIGOROSO e EDUCATIVO: o objetivo é ensinar medicina
- Use diretrizes médicas ATUALIZADAS (2024-2026): Sepsis-3, AHA/ACC, MS Brasil, SBC, ATLS 10ª ed
- JAMAIS repita um caso anterior — cada simulação deve ser única e surpreendente
- Use formatação **markdown** nas respostas para destacar achados importantes (negrito, itálico, listas)`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado. Token de autorização ausente." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Não autenticado");

    const { action, specialty, subtopic, difficulty, message, conversation_history, specialist_area, teacher_case_id, triage_color: requestedTriageColor, pediatric_age_range, deterioration_level, patient_status: requestedPatientStatus, learner_mode, target_exams, recent_errors, exam_proximity_days } = await req.json();

    // 🚀 PERF: Para ações de continuação usamos um prompt compacto (apenas regras de formato JSON).
    // O SYSTEM_PROMPT completo (~12k tokens com banco de cenários) só é necessário em "start".
    const COMPACT_SYSTEM_PROMPT = `IDIOMA: pt-BR obrigatório. Você é o simulador de PLANTÃO MÉDICO do ENAZIZI atuando como PACIENTE e NARRADOR CLÍNICO.
REGRAS DE RESPOSTA:
- Responda SEMPRE em JSON válido (sem markdown, sem comentários).
- Mantenha coerência clínica com a apresentação inicial e com as ações já realizadas no histórico.
- Para EXAME FÍSICO: pergunte qual sistema antes de descrever achados; inclua 'maneuvers_performed' quando aplicável.
- Para EXAMES (lab/imagem): pergunte quais antes de fornecer; alerte se não for padrão-ouro.
- Para PRESCRIÇÃO/CONDUTA: descreva evolução proporcional ao acerto e atualize 'vitals' + 'treatment_outcome'.
- NUNCA revele o diagnóstico antes do "finish".
- Inclua sempre 'vitals', 'patient_status', 'response_type', 'score_delta', 'category_scores' quando pedido.`;

    const isContinuation = action !== "start";
    let messages: Array<{ role: string; content: string }> = [
      { role: "system", content: isContinuation ? COMPACT_SYSTEM_PROMPT : SYSTEM_PROMPT },
    ];

    // 🛡️ ANTI-REPETIÇÃO REAL: busca diagnósticos recentes do usuário para evitar repetição entre sessões.
    let avoidDiagnosesBlock = "";
    if (action === "start" && !teacher_case_id) {
      try {
        const supabaseService = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: recentSims } = await supabaseService
          .from("simulation_history")
          .select("correct_diagnosis, specialty")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);
        const recentDx = (recentSims ?? [])
          .map((r: any) => r.correct_diagnosis)
          .filter((d: any) => typeof d === "string" && d.trim().length > 0);
        if (recentDx.length > 0) {
          avoidDiagnosesBlock = `\n\n## 🚫 DIAGNÓSTICOS PROIBIDOS NESTA SESSÃO (já vistos pelo aluno recentemente)
NÃO use NENHUM destes diagnósticos nem variações próximas:
${recentDx.map((d: string, i: number) => `${i + 1}. ${d}`).join("\n")}

REGRA INVIOLÁVEL: o 'hidden_diagnosis' deste novo caso DEVE ser uma condição CLINICAMENTE DIFERENTE de todas as listadas acima (mecanismo fisiopatológico distinto, sistema acometido distinto, ou apresentação claramente diferente). Se a especialidade solicitada já tem casos repetidos, escolha um subtema da lista de "Banco de Cenários" que ainda não apareceu.`;
        }
      } catch (err) {
        console.error("[anti-repeat] Falha ao buscar histórico:", err);
      }
    }

    // 🚀 PERF: poda histórico para no máximo 16 mensagens (8 turnos) — evita prompts gigantes em sessões longas.
    const trimHistory = (hist: any[]) => Array.isArray(hist) ? hist.slice(-16) : [];

    if (action === "start") {
      if (teacher_case_id) {
        const supabaseService = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const { data: teacherCase, error: caseErr } = await supabaseService
          .from("teacher_clinical_cases")
          .select("case_prompt, specialty, difficulty")
          .eq("id", teacher_case_id)
          .single();

        if (caseErr || !teacherCase) throw new Error("Caso clínico não encontrado");

        await supabaseService
          .from("teacher_clinical_case_results")
          .update({ status: "in_progress", started_at: new Date().toISOString() })
          .eq("case_id", teacher_case_id)
          .eq("student_id", user.id)
          .eq("status", "pending");

        return new Response(JSON.stringify(teacherCase.case_prompt), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const triageOptions = ["vermelho", "laranja", "amarelo", "verde"];
      const triage = requestedTriageColor && triageOptions.includes(requestedTriageColor)
        ? requestedTriageColor
        : triageOptions[Math.floor(Math.random() * triageOptions.length)];

      const isPediatrics = (specialty || "").toLowerCase().includes("pediatria");
      const ageRangeMap: Record<string, string> = {
        neonato: "Neonato (0-28 dias) — sinais vitais de referência: FC 120-160, FR 40-60, PA 60-80/30-45",
        lactente: "Lactente (1-24 meses) — sinais vitais de referência: FC 100-150, FR 25-40, PA 80-100/50-65",
        pre_escolar: "Pré-escolar (2-6 anos) — sinais vitais de referência: FC 80-120, FR 20-30, PA 85-110/50-70",
        escolar: "Escolar (7-12 anos) — sinais vitais de referência: FC 70-110, FR 18-25, PA 90-120/55-75",
        adolescente: "Adolescente (13-17 anos) — sinais vitais de referência: FC 60-100, FR 12-20, PA 100-130/60-80",
      };
      const pediatricInstruction = isPediatrics && pediatric_age_range && ageRangeMap[pediatric_age_range]
        ? ` O paciente DEVE ser da faixa etária: ${ageRangeMap[pediatric_age_range]}. Use sinais vitais adequados para a idade (os valores de referência acima são para o paciente SAUDÁVEL — ajuste conforme a gravidade do caso e classificação de risco). O responsável (mãe/pai/avó) acompanha a criança. Use linguagem de cuidador preocupado para as falas do paciente. Inclua peso e dose de medicações por kg quando aplicável.`
        : isPediatrics
        ? ` O paciente DEVE ser pediátrico (0-17 anos). Use sinais vitais adequados para a faixa etária. O responsável acompanha a criança.`
        : "";

      // Build banca adaptation block
      let bancaBlock = "";
      if (target_exams && Array.isArray(target_exams) && target_exams.length > 0) {
        const profiles = target_exams.map((k: string) => getBancaProfile(k));
        bancaBlock = profiles.map((p: any) => buildBancaBlock(p)).join("\n");
      }

      let errorsBlock = "";
      if (recent_errors && recent_errors.has_errors) {
        const types = (recent_errors.error_types || []).join(", ");
        const themes = (recent_errors.themes || []).join(", ");
        errorsBlock = `\n## REFORÇO DE ERROS PRÉVIOS\nO aluno errou recentemente em: ${types || "vários tipos"}. Temas com erro: ${themes || "diversos"}. Inclua pistas que testem esse tipo de raciocínio para reforço pedagógico.`;
      }

      let proximityBlock = "";
      if (exam_proximity_days && typeof exam_proximity_days === "number" && exam_proximity_days <= 90) {
        proximityBlock = `\n## PROXIMIDADE DA PROVA\nA prova do aluno é em ${exam_proximity_days} dias. ${exam_proximity_days <= 30 ? "Aumente a complexidade e exija mais rigor nas condutas." : "Mantenha nível desafiador."}`;
      }

      messages.push({
        role: "user",
        content: `action="start". Gere um caso clínico de plantão na especialidade: ${specialty || "Clínica Médica"}${subtopic ? ` — Subassunto/Tema específico: ${subtopic}. O caso DEVE ser sobre este subassunto.` : ""}. Dificuldade: ${difficulty || "intermediário"}. Classificação de risco obrigatória: ${triage.toUpperCase()}. O campo triage_color DEVE ser "${triage}". Os sinais vitais e a gravidade do caso DEVEM ser coerentes com a classificação ${triage.toUpperCase()}.${pediatricInstruction}${bancaBlock}${errorsBlock}${proximityBlock}${avoidDiagnosesBlock} Responda APENAS em JSON válido.`,
      });
    } else if (action === "interact") {
      if (conversation_history && Array.isArray(conversation_history)) {
        messages.push(...trimHistory(conversation_history));
      }
      const learnerInstruction = learner_mode
        ? ` OBRIGATÓRIO: inclua o campo "teaching_tip" com uma dica didática contextual relacionada à ação do aluno (ex: após ausculta pulmonar, explique técnica de ausculta simétrica). A dica deve ser educativa e curta (1-2 frases). Inclua também "category_scores" com scores parciais acumulados por categoria (anamnesis, physical_exam, complementary_exams, management), cada um de 0-15.`
        : ` Inclua "category_scores" com scores parciais acumulados por categoria (anamnesis, physical_exam, complementary_exams, management), cada um de 0-15.`;
      messages.push({
        role: "user",
        content: `action="interact". Mensagem do médico plantonista: "${message}". OBRIGATÓRIO: inclua o campo "vitals" com sinais vitais atualizados na resposta. Inclua "structured_data" com tipo, resumo e sistema examinado.${learnerInstruction} Responda APENAS em JSON válido.`,
      });
    } else if (action === "hint") {
      if (conversation_history && Array.isArray(conversation_history)) {
        messages.push(...trimHistory(conversation_history));
      }
      messages.push({
        role: "user",
        content: `action="hint". O aluno está pedindo ajuda do preceptor. Analise tudo que ele já fez neste atendimento e dê orientações de raciocínio clínico SEM revelar o diagnóstico. Responda APENAS em JSON válido.`,
      });
    } else if (action === "specialist") {
      if (conversation_history && Array.isArray(conversation_history)) {
        messages.push(...trimHistory(conversation_history));
      }
      messages.push({
        role: "user",
        content: `action="specialist". O plantonista está solicitando parecer/interconsulta da especialidade: "${specialist_area || "não especificada"}". Responda como o médico especialista dessa área, dando parecer técnico sobre o caso. Responda APENAS em JSON válido.`,
      });
    } else if (action === "finish") {
      if (conversation_history && Array.isArray(conversation_history)) {
        messages.push(...trimHistory(conversation_history));
      }
      messages.push({
        role: "user",
        content: `action="finish". O aluno decidiu encerrar o atendimento. Avalie o desempenho completo com base em toda a interação, incluindo avaliação de prescrição, conduta, diagnóstico e parecer/encaminhamento. Use as 7 categorias de avaliação. Responda APENAS em JSON válido.`,
      });
    } else if (action === "deteriorate") {
      const level = deterioration_level || 1;
      if (conversation_history && Array.isArray(conversation_history)) {
        messages.push(...trimHistory(conversation_history));
      }
      const triageCtx = requestedTriageColor || "desconhecido";
      const statusCtx = requestedPatientStatus || "desconhecido";

      messages.push({
        role: "user",
        content: `action="deteriorate". O aluno ficou INATIVO por 90 segundos sem tomar conduta. Nível de deterioração: ${level}/3.
Classificação de risco atual (triage): ${triageCtx}. Status atual do paciente: ${statusCtx}.

## REGRAS OBRIGATÓRIAS DE DETERIORAÇÃO FISIOPATOLOGICAMENTE COERENTE

A piora DEVE seguir a fisiopatologia do diagnóstico oculto (hidden_diagnosis) do caso. Você NÃO pode inventar pioras que não se justificam pela doença de base.

### PROIBIÇÕES EXPLÍCITAS:
- Paciente VERDE ou AMARELO NÃO pode evoluir para parada cardiorrespiratória no nível 1 ou 2
- Paciente com queixa menor (tosse isolada, lombalgia, cefaleia simples, IVAS) NÃO deve ter piora hemodinâmica severa (choque, hipotensão grave) nos níveis 1-2
- A piora NÃO pode ser desproporcional à classificação de risco inicial
- NÃO invente complicações que não têm relação com o diagnóstico oculto

### MAPA DE SEVERIDADE POR TRIAGE:

**VERDE (pouco urgente)**:
- Nível 1: Desconforto leve — paciente mais ansioso, dor aumenta levemente, sinais vitais minimamente alterados (ex: FC +10bpm)
- Nível 2: Piora moderada — sintomas intensificam, pode surgir febre ou taquicardia leve, paciente preocupado
- Nível 3: Complicação plausível mas NÃO parada — ex: infecção urinária pode evoluir para pielonefrite, lombalgia pode revelar sinal neurológico. NUNCA parada cardíaca.

**AMARELO (urgente)**:
- Nível 1: Instabilidade inicial — sinais vitais levemente piores, paciente mais sintomático
- Nível 2: Deterioração — hipotensão leve, taquicardia, dessaturação discreta. Sinais de alerta
- Nível 3: Grave mas reversível — paciente em situação séria que exige intervenção, mas NÃO parada

**LARANJA/VERMELHO (muito urgente/emergência)**:
- Nível 1: Piora proporcional à doença de base (ex: sepse → hipotensão progressiva)
- Nível 2: Falência orgânica incipiente, sinais de choque ou insuficiência
- Nível 3: Situação crítica — parada ou choque refratário SÓ se fisiopatologicamente justificado pela doença de base

### EXEMPLOS DE COERÊNCIA:
- Pneumonia → piora SpO2 e FR, NÃO hipotensão severa no nível 1
- Sepse → hipotensão e taquicardia progressivas
- Fratura → dor e edema crescentes, SEM alteração hemodinâmica drástica
- Crise asmática → broncoespasmo progressivo, dessaturação
- IAM → arritmia, hipotensão, sinais de IC

### FORMATO DA NARRATIVA:
Descreva a piora com justificativa clínica: "Devido à falta de [conduta esperada], o paciente evolui com [piora fisiopatologicamente coerente]..."

Responda em JSON:
{
  "response": "texto narrativo da piora com justificativa clínica",
  "response_type": "deterioration",
  "patient_status": "instável/grave/crítico (proporcional ao nível e triage)",
  "vitals": { "PA": "...", "FC": "...", "FR": "...", "Temp": "...", "SpO2": "..." },
  "time_elapsed_minutes": número,
  "score_delta": -2 ou -3,
  "critical_action_needed": "string se houver urgência real, null se não",
  "deterioration_rationale": "explicação fisiopatológica resumida da piora (ex: 'Pneumonia não tratada → progressão para SDRA com hipoxemia')"
}
Responda APENAS em JSON válido.`,
      });
    }

    // Call AI
    const startMs = Date.now();
    const aiResp = await aiFetch({
      model: "openai/gpt-5-mini",
      messages,
      timeoutMs: 60000,
    });
    const elapsed = Date.now() - startMs;

    logAiUsage({
      userId: user.id,
      functionName: "clinical-simulation",
      modelUsed: "openai/gpt-5-mini",
      success: aiResp.ok,
      responseTimeMs: elapsed,
      cacheHit: false,
      modelTier: "standard",
      errorMessage: aiResp.ok ? undefined : `status ${aiResp.status}`,
    }).catch(() => {});

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", errText);
      throw new Error("Erro na IA");
    }

    const aiData = await aiResp.json();
    const raw = sanitizeAiContent(aiData.choices?.[0]?.message?.content || "");

    let parsed;
    try {
      parsed = safeParseAIJson(raw, action);
    } catch {
      console.error("Failed to parse AI response after sanitization:", raw.slice(0, 500));
      // Fallback: return a minimal valid response so the session is never lost
      if (action === "finish") {
        parsed = {
          final_score: 0,
          grade: "Indisponível",
          correct_diagnosis: "Não foi possível avaliar",
          student_got_diagnosis: false,
          evaluation: { resumo: "Erro ao processar avaliação da IA. Tente novamente." },
          differential_diagnoses: [],
          checklist: [],
          recommendations: "A avaliação não pôde ser processada. Sua sessão foi salva.",
          xp_earned: 5,
          time_total_minutes: 0,
        };
      } else {
        parsed = {
          response: "Desculpe, houve um erro ao processar a resposta. Por favor, repita sua ação.",
          response_type: "error_fallback",
          patient_status: "estável",
          vitals: {},
          score_delta: 0,
        };
      }
    }

    // If this was a teacher case and action is "finish", save results
    if (action === "finish" && teacher_case_id && parsed) {
      try {
        const supabaseService = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        await supabaseService
          .from("teacher_clinical_case_results")
          .update({
            status: "completed",
            final_evaluation: parsed.evaluation || {},
            final_score: parsed.final_score || 0,
            grade: parsed.grade || "F",
            correct_diagnosis: parsed.correct_diagnosis || null,
            student_got_diagnosis: parsed.student_got_diagnosis || false,
            time_total_minutes: parsed.time_total_minutes || 0,
            xp_earned: parsed.xp_earned || 0,
            conversation_history: conversation_history || [],
            finished_at: new Date().toISOString(),
          })
          .eq("case_id", teacher_case_id)
          .eq("student_id", user.id);
      } catch (saveErr) {
        console.error("Error saving teacher case result:", saveErr);
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Erro interno" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

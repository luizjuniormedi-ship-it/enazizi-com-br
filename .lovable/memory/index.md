# Project Memory

## Core
🧠 OBSERVATIONAL FREEZE ATIVO (2026-04-23): não alterar UI/UX/IA/telemetria/arquitetura até baseline v1 (ver mem://constraint/observational-freeze). Apenas bugfixes críticos.
🔬 FASE 2 BASELINE (26/04/2026): janela observacional 7d. Não remover módulos/páginas/planners até metas: ≥10 users, ≥100 sessões, ≥30 first_question_loaded (ver mem://constraint/baseline-fase2-7-dias).
Brand is ENAZIZI. Do not use "MedStudy AI" in UI/prompts.
Pedagogical Sequence: ENSINAR → TESTAR → CORRIGIR → REFORÇAR → AVANÇAR. Max 2 reinforcement loops.
AI Output: strictly pt-BR, min 4-5 options. Max 3 retries. Cite reference bibliography (Nelson, Sabiston).
Questions: Stem >= 400 chars, explanation >= 200 chars. No 'however'/English leaks. No LaTeX. 24-72h anti-repetition.
Multimodal: No "observe the image". Block missing/fake assets (logos/screenshots). Images must be essential.
Mnemonics: NO text in generated images. Clean infographic style, white background.
Security: `service_role` ONLY for curriculum (`curriculum_specialties`, `topics`). Users read-only.
NEVER change module names, sidebar labels, group organization, or route names without explicit user approval.

## Memories
- [Observational Freeze](mem://constraint/observational-freeze) — Sistema congelado até baseline v1, só bugfixes críticos
- [Baseline Fase 2 (7d)](mem://constraint/baseline-fase2-7-dias) — Janela observacional pós-Fase 1 da telemetria, metas e regras
- [Dashboard Nomenclatura Intocável](mem://constraint/dashboard-nomenclatura-intocavel) — Never change module names/labels/organization without permission
- [Mapeamento de Temas](mem://arquitetura/mapeamento-temas-especialidades-unificado) — 13 clinical specialties unified mapping
- [Biblioteca Médica](mem://funcionalidades/biblioteca-medica-interligada) — AMBOSS-style definitions via Gemini
- [Identidade do Projeto](mem://marca/identidade-projeto) — ENAZIZI branding guidelines
- [Planos de Assinatura](mem://negocio/planos-assinatura-stripe-quotas) — Stripe SaaS 4 tiers, AI quotas
- [Core Pedagógico](mem://arquitetura/core-pedagogico-compartilhado) — AI Tutor rules, strategic mentor, stall detection
- [Persistência de Sessão](mem://arquitetura/persistencia-sessao-universal) — Universal study state saving
- [Bibliografia Referência](mem://conteudo/bibliografia-medica-referencia-expandida) — Required citations injected in prompts
- [Anamnese Trainer](mem://funcionalidades/anamnese-trainer-v2) — 0-3 stars, coaching tips, adaptive suggestions
- [Indicadores de Risco](mem://metodologia/indicadores-risco-engajamento-aluno) — Risk Score & Engagement Score formulas
- [Bloqueio Inteligente](mem://funcionalidades/bloqueio-inteligente-conteudo-adaptativo) — Adaptive content blocking thresholds
- [Gestão RAG Global](mem://funcionalidades/gestao-conhecimento-global-rag) — Universal knowledge base, 20 materials max
- [Simulação Plantão](mem://metodologia/treino-clinico-simulacao-anamnese-v2) — Real-time physiological deterioration
- [Atribuições Professor](mem://funcionalidades/gestao-atribuicoes-professor-proficiencia-v2) — Teacher dashboard and university scope
- [Protocolo MBE](mem://metodologia/protocolo-pedagogico-enazizi-mbe) — 12 steps MedStudy MBE integration
- [Propagação de Contexto](mem://funcionalidades/propagacao-contexto-estudo-guiado) — Automatic context via URL 'sc_'
- [Modo Foco Extremo](mem://arquitetura/inteligencia-adaptativa-memoria-foco) — Restricts UI <= 15 days to exam or <50% score
- [Ingestão de Questões](mem://arquitetura/pipeline-unificado-ingestao-questoes) — Question deduplication (80-char hash)
- [Seleção de Subtemas](mem://funcionalidades/selecao-subtemas-geradores-simulados-v2) — Force AI generation for subthemes
- [Filtro Imagens](mem://qualidade/filtro-integridade-visual-questoes) — IMAGE_REF_PATTERN image validation
- [Banco de Erros](mem://funcionalidades/banco-erros-proficiencia-aluno) — Proficiecy tab, grouping errors, >=3 red badge
- [Validação IA](mem://arquitetura/camada-global-validacao-ia) — Output validation layer (pt-BR, format)
- [Study Engine Decisões](mem://metodologia/transparencia-decisao-study-engine) — 'study-next' justifications
- [Evolução por Tema](mem://metodologia/indicadores-evolucao-por-tema) — Topic evolution calculation (±8% delta)
- [Loop de Reforço](mem://metodologia/loop-reforco-inteligente) — Max 2 cycles reinforcement
- [Prioridade Mentorias](mem://funcionalidades/mentoria-professor-flexivel-e-prioridade-dinamica) — Teacher tasks boost +10 to +25
- [Modo OSCE](mem://funcionalidades/modo-prova-pratica-osce-integrado) — Practical exam mode constraints
- [Adaptação Bancas](mem://metodologia/adaptacao-estudo-bancas-medicas-v2) — Support for 3 target exams
- [Chance de Aprovação](mem://funcionalidades/estimativa-chance-aprovacao-banca) — Formula for exam approval chances
- [Modo Estudante Orientado](mem://metodologia/modo-estudante-com-orientacao) — Teacher direction + adaptive autonomy
- [Índice de Preparação](mem://metodologia/indice-preparacao-central-unificado) — 0-100 Prep Index dimensions
- [Recuperação Pesada](mem://metodologia/modo-recuperacao-pesada-30-dias) — 30-day heavy recovery limits
- [Tutor IA Dual](mem://arquitetura/tutor-ia-dual-mode-didatico-estrategico) — Free mode vs Mission mode behaviors
- [FSRS Automático](mem://funcionalidades/alimentacao-automatica-revisao-fsrs) — Spaced repetition auto-feeding
- [Smart Planner v3](mem://metodologia/planner-estrategico-inteligente-v3) — Prioritizes errors (>=3) and critical FSRS
- [Matriz Curricular](mem://arquitetura/matriz-curricular-mestra-hierarquica-concluido) — Curriculum hierarchy and weights
- [Restrições Service Role](mem://seguranca/restricao-escrita-service-role-curriculo-assets) — Write locks for core tables
- [Retenção Inteligente](mem://funcionalidades/retencao-disciplina-streak-inteligente) — Smart streaks and pressure alerts
- [Metodologia Tutor IA](mem://arquitetura/metodologia-pedagogica-tutor-ia) — 12 states methodology
- [Bot QA Autocorretivo](mem://qualidade/bot-qa-autocorretivo-estruturado) — Automated QA pipeline
- [Dificuldade Simulados](mem://metodologia/balanceamento-dificuldade-padrao-simulados) — Default 20% easy, 40% med, 40% hard
- [Multi-domínio](mem://arquitetura/infraestrutura-multi-dominio-fase-1) — Domain handling for Med, ENEM, OAB
- [Simulado TRI](mem://funcionalidades/simulado-prova-real-tri) — 3PL model for exact test simulation
- [Upgrade Questões](mem://processos/esteira-upgrade-e-qualidade-questoes-imagem) — Pipeline for image questions
- [Scores Adaptativos](mem://metodologia/motor-adaptativo-scores-prioridade) — base 55 (ImageQuiz) and 52 (Mnemonic)
- [Analytics Multimodal](mem://metodologia/analytics-desempenho-multimodal) — Thresholds for image fallbacks
- [Visão Computacional](mem://arquitetura/geracao-multimodal-visao-computacional) — Real clinical findings integration
- [Curadoria Imagens](mem://arquitetura/agente-curadoria-imagens-reais-tecnologia) — Open-i, Firecrawl, PT->EN translations
- [Fake Multimodal Block](mem://qualidade/deteccao-fake-multimodal-regex) — Rejects questions answerable without image
- [Bloqueio Recursos Visuais](mem://qualidade/auditoria-visao-clinica-ia-bloqueio-recursos-nao-medicos) — Rejects screenshots/dashboards via IA
- [Acervo Open Access](mem://qualidade/gestao-acervo-imagens-reais-open-access-v3-metas-traducao) — Requires >=0.90 clinical confidence
- [Safety Gate Editorial](mem://qualidade/blindagem-higiene-editorial-multimodal-v3-safety-gate) — URL blocklist and image safety gates
- [Motor Simulados v3](mem://funcionalidades/motor-simulados-adaptativos-v3-transparencia-editorial) — Exam logic: main='excellent', practice='good'+'excellent'
- [Trio Multimodal](mem://metodologia/hierarquia-pedagogica-trio-multimodal-v3-psicometria) — Q1(Med), Q2(Hard), Q3(Hard) rules
- [Proteção Simulados v2](mem://funcionalidades/simulados-v2-modos-prova-real-estudo-integrado-imagem) — Protection against last 200 questions
- [Painel Evolução](mem://funcionalidades/painel-evolucao-adaptativa-insights) — Critical <50%, Strong >=80%
- [Auditoria Pedagógica](mem://arquitetura/pipeline-consolidado-auditoria-pedagogica) — Excellent (90+), Good (75-89), Weak rejected
- [Inteligência Adaptativa L3](mem://arquitetura/motor-inteligencia-adaptativa-l3) — compositeScore weighting formula
- [Validação Hard](mem://arquitetura/engine-validacao-deterministica-hard) — Score >=70, English leak block, option balance
- [Perfil Médico Híbrido](mem://negocio/perfil-medico-hibrido-aluno-professor) — Doctor role maps to teacher + student
- [Bancas Professor](mem://funcionalidades/seletor-banca-professor-automacao-temas) — 'Todas as bancas' aggregates matrix
- [ENAZIZI Core Framework](mem://metodologia/padrao-geracao-questoes-ia-enazizi-core) — Generation limits, no english leaks
- [Gatilhos Mnemônico](mem://arquitetura/inteligencia-adaptativa-cls-rfs-mnemonico) — Mastery <0.6 triggers, anti-spam rules
- [Otimização Mnemônicos](mem://ux/mnemonico-interface-sugestoes-prioridade-autopreenchimento) — Optimization rules, prioritize high yield
- [Imagens Mnemônicos](mem://qualidade/diretrizes-visuais-geracao-imagem-mnemonico) — 1 scene, NO text, white bg
- [Mnemônicos Isolados](mem://metodologia/mnemonico-inteligencia-isolada-por-tema) — CLS/RFS per-theme calculation
- [API Assistente Regras](mem://arquitetura/api-assistente-motor-pedagogico-unificado) — Required fields for study-complete
- [Mnemonic Studio v2](mem://funcionalidades/mnemonico-studio-v2-ferramentas-prova) — Oralidade Brasileira, 5s memory
- [Custo IA e Cache](mem://arquitetura/api-assistente-controle-custos-ia) — Bucket cache multiples of 20, weights
- [Loop Estudo Guiado](mem://funcionalidades/loop-estudo-continuo-guiado) — Exit strategy after 2 errors
- [Mapeamento de Ações](mem://arquitetura/api-assistente-mapeamento-acoes-conteudo-unificado) — Error review mappings
- [Base Questões Reais](mem://conteudo/base-questoes-provas-reais-extracao) — 383 real exam items config
- [Scoring Visual](mem://metodologia/motor-habilidade-visual-scoring) — 60% acc, 20% speed, 20% consistency
- [Log de Repetição](mem://arquitetura/logs-custo-anti-repeticao-ia) — 24-72h AI anti-repetition window
- [Fallback Image Quiz](mem://ux/image-quiz-fallback-qualidade-3-tiers) — 3-tier visual fallback system
- [Motor Priorização](mem://arquitetura/motor-priorizacao-pipeline-multimodal) — Exam relevance × 0.40 + gap × 0.25 + weakness × 0.35
- [Quality Gate Multimodal](mem://qualidade/blindagem-quality-gate-multimodal) — quality_gate_passed obrigatório, audit logs, URL blocklist
- [Mapas Mentais Inteligentes](mem://funcionalidades/mapas-mentais-inteligentes) — React Flow mind maps, 10 academic categories, Gemini generation

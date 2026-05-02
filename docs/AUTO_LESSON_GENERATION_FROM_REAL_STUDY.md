# Relatório de Automação ENAFLIX: Geração Real de Aulas

Este documento detalha a implementação da engine de automação que transforma a atividade real do aluno em solicitações de videoaulas para a Central de Produção.

## 1. Arquitetura de Rastreamento (Feeding the Beast)
A automação agora está "plugada" em todos os pontos de contato do aluno:
- **Tutor IA:** Rastreia cada interação e tempo de estudo.
- **Banco de Questões:** Rastreia acertos e erros (temas com muitos erros ganham prioridade).
- **FSRS Flashcards:** Rastreia revisões e dificuldades de memorização.

## 2. Motor de Detecção Pedagógica (EducationalInterestEngine)
O motor analisa o acúmulo de dados na tabela `tutor_study_tracking` e calcula um **Pedagogical Interest Score**:
- **Interações:** 5 pontos por pergunta.
- **Tempo de Estudo:** 2 pontos por minuto.
- **Erros:** 12 pontos por erro (peso máximo para correção de rotas).
- **Flashcards:** 10 pontos por geração.
- **Threshold:** 85 pontos para disparo automático.

## 3. Pipeline de Produção ENAFLIX
Quando um tema atinge o score, a Edge Function `generate-lesson-from-real-study` é disparada:
1. **Deduplicação:** Verifica se já existe aula para o tema.
2. **Contextualização:** Analisa por que o aluno precisa dessa aula (ex: "Alta taxa de erros").
3. **Estruturação IA:** Invoca o pipeline para gerar Roteiro, Capítulos e Prompts Cinematográficos.
4. **Central de Produção:** A aula aparece no Admin com o selo "Uso Real" e score detalhado.

## 4. Componentes Refatorados
- `src/lib/educationalEngine.ts`: Core da lógica de rastreamento e disparo.
- `src/pages/StudySession.tsx`: Integração com o Tutor IA.
- `src/pages/QuestionsBank.tsx`: Integração com o banco de questões.
- `src/components/flashcards/FlashcardExam.tsx`: Integração com revisões FSRS.
- `src/components/enaflix/admin/LessonDetailDrawer.tsx`: Visualização de insights pedagógicos para o admin.

## 5. Status de Rollout
- **Admins Only:** Ativo.
- **Beta Users:** Preparado.
- **Gradual Rollout:** Próxima fase.

---
*Relatório de engenharia visual e pedagógica ENAFLIX.*

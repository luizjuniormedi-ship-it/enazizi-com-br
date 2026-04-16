---
name: Mapas Mentais Inteligentes
description: Módulo de mapas mentais interativos com React Flow, geração via IA (Gemini 2.5 Flash), tabela mental_maps, padrão acadêmico 10 categorias
type: feature
---
## Mapas Mentais Inteligentes

### Tabela
- `mental_maps` (user_id, title, content_json, source_topic, specialty, difficulty, source_type, tags)
- RLS: usuário só acessa próprios mapas

### Edge Function
- `generate-mind-map`: gera JSON estruturado via Lovable AI (Gemini 2.5 Flash)
- Padrão acadêmico: Definição, Epidemiologia, Fisiopatologia, Quadro Clínico, Diagnóstico, Tratamento, Complicações, Prognóstico, Diferenciais, Pontos de Prova

### UI
- Página: `/dashboard/mapas-mentais`
- Componente: `MindMapViewer` (React Flow com nodes coloridos, zoom, minimap, painel de detalhes)
- Sistema de cores: blue→Definição, sky→Epidemiologia, purple→Fisiopatologia, yellow→Diagnóstico, green→Tratamento, red→Complicações, gray→Prognóstico, orange→Diferenciais, pink→Pontos de Prova

### Fase 2 (pendente)
- Mapa → Flashcards automáticos
- Mapa → Questões clínicas
- Mapa → Revisão espaçada (FSRS)
- Sugestão automática baseada em erros/fraquezas
- Camadas (resumo/técnico/leigo)
- Áudio TTS
- Transformar em aula
- Gerar simulado do tema

# Sprint 2 — Auditoria Mobile Real (390x844)

**Data:** 2026-04-23
**Viewport:** iPhone 12/13/14 (390x844, DPR 3)
**Rotas auditadas:** `/dashboard`, `/dashboard/sessao-estudo`, `/enaflix`
**Modo:** observação read-only — nada foi alterado na UI nesta auditoria.

---

## Sprint 1.5 — correção de auditoria

A Sprint 1 marcou `Landing.tsx` como órfão. **Estava errado**: `Index.tsx` (rota `/`) faz `<Landing />`. Restaurado.

**Quarentena efetiva:** 2 pages, não 3.
- ✅ `src/_archive/pages/FeynmanTrainer.tsx` (redirect morto)
- ✅ `src/_archive/pages/StudyPlan.tsx` (substituído por SmartPlanner)
- ❌ `Landing.tsx` — **vivo**, mantido em `src/pages/`

`npx tsc --noEmit` → 0 erros após a correção.

---

## Achados mobile

### 🔴 P0 — Resume banner cobre o bottom nav e o conteúdo

**Onde:** as 3 rotas. Card "Vamos revisar isso rapidamente / TASE / Iam - Marcadores de necrose miocárdica" aparece **flutuando acima do bottom tab bar**, com ~120px de altura.

**Impacto cognitivo:**
- Tampa o último card legível da tela (no /dashboard tampa parte do mnemônico, no /sessao-estudo tampa os chips de tema, no /enaflix tampa o segundo card do carrossel).
- Cria **terceira camada visual** competindo com bottom nav (camada 1) e conteúdo (camada 2). Em mobile, três camadas empilhadas no fundo é fadiga garantida em sessão longa.
- O texto "Troponina Alta, Sintomas Atacam, Eletro Evidencia" fica truncado e ilegível.

**Origem suspeita:** algum `ResumeSessionBanner` (ver `mem://arquitetura/persistencia-sessao-universal`) sem `bottom-[calc(4rem+env(safe-area-inset-bottom))]` no breakpoint mobile.

**Recomendação:** ou (a) empurrar o banner para acima do bottom nav, ou (b) virar uma linha discreta dentro do header da Visão Geral em mobile, sem ocupar overlay.

---

### 🟠 P1 — Densidade de chips no header da Visão Geral

**Onde:** `/dashboard`, primeiro fold. "Modo recuperação ativo / Você tem 20 revisões atrasadas..." + "SUA MISSÃO DE HOJE" + chip "Revisão" + chip "10 min" + botão "Começar agora" + ícone refresh + texto "Alte..." truncado.

**Densidade no fold:** 7 elementos clicáveis/destacáveis em ~400px de altura.

**Impacto:**
- O CTA primário ("Começar agora") perde contraste contra os 6 elementos competidores.
- O botão "Alte..." truncado é ruído puro — o usuário não sabe se é "Alterar" ou "Alternativa".
- O badge "82" vermelho no Estudar (bottom nav) compete com a urgência do banner "Modo recuperação".

**Recomendação:** colapsar "Modo recuperação ativo" em uma faixa fina de 32px (sem ícone shield grande). Esconder o ícone refresh atrás de um menu kebab. Garantir que o CTA primário ocupe ≥ 50% da largura sem competidor adjacente.

---

### 🟠 P1 — `/sessao-estudo`: 4 KPIs grandes acima do CTA

**Onde:** `/dashboard/sessao-estudo`. Grid 2x2 de cards grandes (Revisões vencidas 62 / Tarefas 0/2 / Sequência 1d / Dias até banca —) **antes** do CTA "Iniciar".

**Impacto:**
- O aluno chega para estudar e vê **62** em vermelho antes de ver o botão de começar. Isso é gatilho de ansiedade, não de ação.
- "Dias até banca: —" (vazio) ocupa o mesmo peso visual de um KPI real. Card vazio é pior que card ausente.
- Para clicar em "Iniciar" o aluno scrolla ~400px abaixo do fold mobile.

**Recomendação:** mover os 4 KPIs para **abaixo** do CTA, ou colapsar em uma linha única "62 vencidas · 0/2 hoje · 1d streak" (16px de altura). O fold mobile deveria ser: título → CTA → contexto.

---

### 🟡 P2 — `/enaflix`: hero ocupa todo o fold sem CTA visível

**Onde:** `/enaflix`, primeira tela.

- Hero "Simulados — Provas completas no estilo das principais bancas" + troféu 3D ocupa **~620px de 844px** (74% da tela).
- "Começar agora" e "Saiba mais" aparecem só no scroll.
- Carrossel "Recomendados pela IA" começa a aparecer cortado no rodapé.

**Impacto cognitivo:** ENAFLIX é o módulo onde o aluno vai para "explorar". Forçar 1 scroll completo antes de qualquer ação é fricção sem propósito. O hero cinematográfico funciona em desktop; em mobile vira tela de espera.

**Recomendação:** no breakpoint `< 640px`, reduzir hero para 60vh máximo, garantindo que pelo menos 1 card do primeiro carrossel apareça no fold inicial.

---

### 🟡 P2 — Bottom nav: badge "99+" em Perfil

**Onde:** todas as rotas, bottom tab bar.

- "Perfil" mostra "99+" vermelho permanentemente (mensagens não lidas).
- Compete com o badge "82" vermelho de "Estudar" (que é a ação real).
- Dois badges vermelhos altos = ruído em vez de prioridade.

**Recomendação:** badge de mensagens em Perfil deveria ser **dot cinza** (não vermelho) acima de 99. Vermelho só para ação pedagógica pendente.

---

### 🟢 P3 — Top bar: 5 ícones competindo

**Onde:** todas as rotas. Header tem: hamburger, logo ENAZIZI, **botão play roxo grande com glow**, search, sino notificação, sun/moon.

- O botão play com glow roxo é o elemento mais chamativo da tela inteira — mais que o CTA "Começar agora".
- Em sessão longa, esse glow pulsando no topo é distração contínua.

**Recomendação:** reduzir o glow do botão play (manter cor, remover halo). Se o objetivo é destacar "modo cinema", fazer isso só na primeira visita do dia, não permanentemente.

---

## Resumo de prioridades

| # | Achado | Prioridade | Esforço | Impacto cognitivo |
|---|---|---|---|---|
| 1 | Resume banner cobre conteúdo | P0 | baixo | alto |
| 2 | Densidade de chips no fold | P1 | médio | alto |
| 3 | KPIs antes do CTA em Estudar | P1 | baixo | alto |
| 4 | Hero ENAFLIX ocupa fold inteiro | P2 | baixo | médio |
| 5 | Badge "99+" vermelho permanente | P2 | trivial | médio |
| 6 | Glow do botão play no header | P3 | trivial | baixo |

---

## O que **não** auditei (intencionalmente)

- Touch targets (tamanho real do tap) — exige device físico, não emulador.
- Performance de scroll real em mobile — exige profile em device.
- Fluxo de OAuth/login mobile — exige sessão limpa.

Essas três frentes ficam para uma futura sprint mobile-device, fora do escopo de viewport.

---

## Decisão recomendada

A Sprint 3 deveria atacar **apenas P0 + 2x P1** (achados 1, 2, 3). Os 3 pontos juntos provavelmente reduzem em 30-40% a fadiga visual do aluno em sessão longa, sem mexer em arquitetura nem em motion. É o tipo de mudança "silêncio visual" que o usuário pediu na fase Hardening.

P2 e P3 podem aguardar — são refinamento, não dor real.

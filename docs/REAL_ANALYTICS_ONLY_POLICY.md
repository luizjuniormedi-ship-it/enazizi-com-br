# 📊 Real Analytics Only — Policy ENAFLIX Studio 2.0

**Aplicação:** painel `AdminLessonRatingsPanel` e futuros painéis admin.
**Princípio:** widget só existe se houver dado real coletado. Nada de placeholder, nada de gráfico vazio, nada de métrica inventada.

---

## 🔍 Auditoria de Schema (executada)

Tabela única hoje: **`lesson_ratings`**

| Coluna | Tipo | Uso |
|---|---|---|
| `rating` | int (1–5, CHECK) | nota |
| `feedback` | text nullable | comentário textual |
| `watched_percentage` | numeric nullable | % assistida no momento da nota |
| `created_at` | timestamptz | série temporal |
| `lesson_id` | uuid → `tutor_lesson_memory` | **FK real (corrigido bug do join com `ai_video_lessons`)** |
| `user_id` | uuid → `auth.users` | autor |

View agregada: **`lesson_rating_stats`** → `total_ratings`, `average_rating`, `five_star_count`, `five_star_percentage`.

**Volume atual:** `0` registros. Painel renderiza empty-state único.

---

## ✅ Widgets habilitados (dado real existe)

| # | Widget | Fonte | Condição de render |
|---|---|---|---|
| 1 | Média geral | `AVG(rating)` | `total > 0` |
| 2 | Total avaliações | `COUNT(*)` | `total > 0` |
| 3 | Distribuição 1⭐→5⭐ | `rating` | `total > 0` |
| 4 | Comentários recentes | `feedback IS NOT NULL` | `comments.length > 0` |
| 5 | Top aulas | `lesson_rating_stats` ordenado por `average_rating DESC` | `stats.length > 0` |
| 6 | Aulas críticas | `average_rating < 3 AND total_ratings >= 2` | só se houver match |
| 7 | Watch % por nota | `AVG(watched_percentage) GROUP BY rating` | `n >= 10` ratings com watch% |

---

## ❌ Widgets NÃO renderizados (sem coleta real)

Removidos do escopo até existir tabela/coluna correspondente:

- **Heatmap de fricção x nota** → não há ligação `video_segment_events` ↔ `rating`.
- **Retenção temporal x nota** → sem snapshot diário de rating.
- **Evolução temporal de média** → sem agregação histórica (só `created_at` cru).
- **Watch% x nota com `n < 10`** → estatisticamente irrelevante, escondido.
- **Abandono x nota** → sem evento `lesson_abandoned` correlacionado.
- **Replay moments x nota** → sem ligação `replay_event` ↔ `rating`.
- **Insights IA** → sem pipeline ativo. Será habilitado quando edge function existir.

Esses blocos **não aparecem como “sem dados ainda”** — aparecem **zero**, mantendo o painel limpo.

---

## 🛠️ Bug corrigido nesta entrega

O painel anterior fazia `select ai_video_lessons:lesson_id (...)`, mas o FK real de `lesson_ratings.lesson_id` aponta para **`tutor_lesson_memory`**. O join silenciosamente retornava `null` em produção (título da aula sumia). Corrigido para `tutor_lesson_memory:lesson_id (title, subject)`.

---

## 🔮 Roadmap para habilitar mais analytics

Cada item exige **schema real + coleta com volume mínimo** antes do widget aparecer:

1. **Heatmap** → criar liga `video_segment_events.lesson_id` ↔ rating, agregar por segmento.
2. **Retenção temporal** → snapshot diário em `lesson_rating_daily`.
3. **Watch% completo** → expandir `watched_percentage` para coleta contínua, não só no momento da nota.
4. **Abandono x nota** → evento `lesson_abandoned` com `last_position_pct`.
5. **Replay moments** → evento `segment_replayed` somado por `lesson_id`.

Quando a coleta existir e atingir o volume mínimo, basta destravar a flag de render no componente.

---

## 📐 Regra de ouro

> Se você não pode apontar para a coluna real que alimenta o gráfico,
> o gráfico **não existe**. Empty-state honesto > dashboard inflado.

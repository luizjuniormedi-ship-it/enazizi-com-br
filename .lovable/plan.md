
# Plano: Ingestão Drive → RAG Corpus (Claude + Gemini)

## Decisões já travadas
- ✅ Materiais autorizados (responsabilidade do usuário)
- ✅ Reaproveitar `rag_documents` / `rag_chunks` / `rag_embeddings` (já com pgvector)
- ✅ Processamento via **eu-ai-v3-client (Claude)**
- ✅ Embedding via **google/gemini-embedding-001** (Claude não faz embedding)
- ✅ Isolar do RAG Global de 20 com flag `source_type='drive_corpus'`

## Arquitetura

```text
Google Drive (já conectado)
   │  list files (recursivo por pasta = especialidade)
   ▼
drive-corpus-scan (edge fn)  ──► drive_folders_scan + fila em drive_ingestion_log
   │
   ▼
drive-corpus-ingest (edge fn, chamada em lote de 5)
   │  1. Sign URL (Drive gateway, mode=read)
   │  2. Download PDF (até 50MB)
   │  3. PDF → texto (Gemini 2.5 Flash multimodal — aceita PDF nativo, melhor que pdf-parse em Deno)
   │  4. Claude (eu-ai) resume + estrutura por seção (especialidade vem da pasta-pai)
   │  5. Chunk 1200 chars c/ overlap 150
   │  6. Embed Gemini → grava rag_chunks + rag_embeddings
   │  7. Marca drive_ingestion_log.status='completed'
   │
   ▼
Tutor (tutor-v3-premium) — busca RAG continua igual; filtro
`source_type IN ('global_rag','drive_corpus')` com peso menor pro corpus
```

## Migration (única)

1. `ALTER TABLE rag_documents ADD COLUMN source_type TEXT DEFAULT 'global_rag'`
   (constraint check: 'global_rag' | 'drive_corpus')
2. `ALTER TABLE rag_documents ADD COLUMN drive_file_id TEXT UNIQUE` (dedupe)
3. `ALTER TABLE rag_documents ADD COLUMN specialty TEXT` (vem da pasta)
4. Índice `(source_type, specialty)` para filtro rápido
5. Atualizar função `match_rag_chunks` (se existir) p/ aceitar filtro `source_type[]`

Não cria tabela nova — usa a infra existente.

## Edge functions novas

### `drive-corpus-scan`
- Input: `{ folder_id: "1apsS3Jl..." }`
- Percorre recursivo, popula `drive_folders_scan` + insere PDFs como `pending` em `drive_ingestion_log`
- Output: `{ folders: N, files: M, total_size_mb: X }`

### `drive-corpus-ingest`
- Input: `{ batch_size: 5 }` (default)
- Pega 5 `pending` → processa em paralelo → atualiza status
- Idempotente: usa `drive_file_id` como chave única

### Admin UI (1 página nova: `/admin/drive-corpus`)
- Botão "Escanear pasta"
- Tabela: nome / pasta / status / tamanho / erro
- Botão "Processar próximos 5"
- Cards: total, pending, completed, failed

## Custos estimados (1000 PDFs, ~300 pág médias)
- Gemini Flash (PDF→texto): ~$15
- Claude Sonnet (resumo): ~$80
- Gemini embedding: ~$8
- **Total estimado: ~$100-150** (1x, não recorrente)

## Guard-rails
- Skip se `file_size > 50MB`
- Skip se nome contém: `harrison|nelson|sabiston|robbins|guyton|netter` (você confirmou autorização, mas mantenho lista visível p/ você desativar manualmente)
- Hard cap: processa 50 PDFs/dia (anti-runaway de custo)
- Logs completos em `drive_ingestion_log`

## Fora de escopo (não vou fazer)
- Não mexer no `tutor-v3-premium` (apenas o filtro RAG já vai puxar o corpus novo automaticamente)
- Não tocar em RAG Global de 20 (continua intocado)
- Não alterar UI do tutor

## Aprovação
Aprova esse plano? Se sim, eu já executo:
1. Migration (3 colunas + índice)
2. 2 edge functions
3. 1 página admin
4. Rodo o scan da pasta automaticamente após deploy


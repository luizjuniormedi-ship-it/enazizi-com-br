

# Plano: Painel de Upload de Arquivos até 2GB

## Problema
O painel atual limita uploads a 50MB. O usuário precisa enviar arquivos de até 2GB (ex: datasets HAM10000, PDFs grandes, coleções de imagens).

## Solução

### 1. Edge Function `upload-large-file` (chunked upload)
- Recebe chunks de ~5MB via multipart/form-data
- Reassembla no Storage usando upload resumível (TUS protocol do Supabase)
- Retorna progresso por chunk
- Validação: apenas admin pode usar

### 2. Componente `AdminLargeUploadPanel.tsx`
- Drag & drop com barra de progresso real (por chunk)
- Suporta arquivos até 2GB
- Divide o arquivo em chunks de 5MB no client-side
- Envia sequencialmente com retry automático (3 tentativas por chunk)
- Mostra: velocidade, tempo estimado, % completo
- Aceita: PDF, DOCX, ZIP, imagens (jpg/png/webp)
- Seletor de categoria: Material, Prova, Dataset de Imagens
- Lista de uploads recentes com status

### 3. Integração no Admin
- Nova aba "Upload 2GB" no painel Admin (ao lado de "Uploads" existente)
- Ou substituir o painel atual aumentando o limite

### 4. Migration: aumentar limite do bucket
- Atualizar `user-uploads` bucket para aceitar arquivos de até 2GB (`file_size_limit = 2147483648`)

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/admin/AdminLargeUploadPanel.tsx` | Criar — UI com chunked upload + progresso |
| `supabase/functions/upload-large-file/index.ts` | Criar — reassembla chunks no Storage |
| `src/pages/Admin.tsx` | Editar — adicionar nova aba |
| Migration SQL | Atualizar limite do bucket para 2GB |

## Fluxo técnico
```text
Browser                    Edge Function              Storage
  |                            |                        |
  |-- chunk 1 (5MB) --------->|                        |
  |                            |-- upload part 1 ----->|
  |<-- { progress: 5% } ------|                        |
  |                            |                        |
  |-- chunk 2 (5MB) --------->|                        |
  |                            |-- upload part 2 ----->|
  |<-- { progress: 10% } -----|                        |
  |        ...                 |        ...             |
  |-- chunk N (last) -------->|                        |
  |                            |-- finalize upload --->|
  |<-- { status: "done" } ----|                        |
```

## Alternativa mais simples (recomendada)
Usar o **upload resumível nativo do Supabase** (protocolo TUS) diretamente do client-side, sem edge function intermediária. O SDK do Supabase JS já suporta isso:

```typescript
const { data, error } = await supabase.storage
  .from('user-uploads')
  .upload(path, file, {
    upsert: false,
    // Supabase usa TUS automaticamente para arquivos grandes
  })
```

Neste caso, basta:
1. Aumentar o limite do bucket para 2GB
2. Criar o componente com progresso visual
3. Sem edge function necessária


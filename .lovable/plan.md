A execução seguirá a ordem solicitada para garantir a estabilidade e conformidade do projeto ENAZIZI:

### 1. Smoke Test Visual
- Verificação automatizada de todas as rotas críticas (Dashboard, Admin, Enaflix, Professor) para garantir que não existam erros 404.
- Validação visual dos componentes principais em cada rota.

### 2. Termos e Privacidade (LGPD)
- Criação das páginas `/terms` e `/privacy` com conteúdo jurídico padrão adaptado para plataformas educacionais médicas.
- Implementação de um modal ou banner de consentimento de cookies/LGPD no primeiro acesso.
- Linkagem desses documentos no rodapé do sistema.

### 3. Otimização de Performance
- Análise de chamadas ao Supabase para identificar gargalos no carregamento inicial.
- Implementação de carregamento preguiçoso (lazy loading) para rotas e componentes pesados.
- Otimização de queries e uso de cache local onde aplicável para reduzir o tempo de carregamento de 8-13s para menos de 3s.

### Detalhes Técnicos
- Utilização de `React.lazy` e `Suspense` para divisão de código (code splitting).
- Verificação de políticas de RLS para garantir que a segurança não impacte a performance.
- Padronização visual utilizando a biblioteca de componentes já existente (Shadcn + Tailwind).
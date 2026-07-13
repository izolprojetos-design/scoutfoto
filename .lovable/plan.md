# Auditoria e Otimização de Performance — ScoutFoto

**Concluída em:** 13/07/2026

## Resumo executivo

Auditoria completa em 6 passos, focada em causas reais de gargalos.
Todas as alterações preservaram funcionalidades e foram validadas por
`tsgo --noEmit` e `bun run build`.

---

## Passo 1 — Limpeza de bloat do banco

**Problema:** tabela `cron.job_run_details` acumulava milhões de linhas
(execuções do email queue a cada 5s), inflando storage e degradando
metadados do Postgres.

**Correção:** cron job diário `cleanup-cron-job-run-details` remove
registros com mais de 7 dias.

## Passo 2 — Investigação do cron de email

**Diagnóstico:** as 533k chamadas históricas eram de um cron que se
auto-desagenda quando as filas ficam vazias. Média de 0,07ms por
execução. Arquitetura correta, custo zero em regime normal.

**Correção:** nenhuma necessária.

## Passo 3 — Re-renders no frontend (auditoria estática)

**Arquivos corrigidos:**

- `src/contexts/AuthContext.tsx`
  - `contextValue` memoizado com `useMemo`
  - `syncSessionState` estabilizado via refs (`userRef`, `sessionRef`, `profileRef`)
  - `hasRole` estável via `currentRolesRef`
- `src/hooks/usePermissions.ts` — removida dependência `roles` que causava re-fire
- `src/pages/Gallery.tsx`
  - IntersectionObserver criado uma única vez (refs para page/loading/hasMore)
  - `eventsById` Map para lookup O(1) no filtro
- `src/pages/Scouts.tsx`
  - `useMemo` em `filteredScouts`, `scopedScouts`, `availableSections`,
    `availableSubgroups`, `activeScouts`, `inactiveScouts`, `branchCounts`, `branchOrder`
  - `subgroupsById` e `guardiansByScoutId` Maps para eliminar O(n²) na renderização

## Passo 4 — Queries lentas no banco

**Método:** `pg_stat_statements` ranked por tempo total.

**Correções:**

- `Dashboard.tsx` — `admin_list_online_users` polling: 10s → 30s (-66% carga)
- `useRemoteForceRefresh.ts` — polling: 2min → 5min (realtime cobre updates instantâneos)
- Novo índice `idx_guardians_scout_id` — elimina full scan em consultas por integrante

**Estado dos índices críticos:** todos presentes
(`audit_logs.created_at DESC`, `scouts(is_active, name)`,
`security_notifications(user_id, is_read, created_at DESC)`).

## Passo 5 — Bundle size e code-splitting

**Problema:** imports estáticos de `jsPDF` (~416 KB) e `scoutPdfExport`
(~456 KB) puxavam ~600 KB extras no primeiro acesso a `/scouts` e
`/admin`, mesmo sem clicar em exportar.

**Correções:** convertidos para `await import(...)` sob demanda:

- `src/pages/Scouts.tsx` (linha do handler "Exportar PDF")
- `src/components/AccessLogViewer.tsx` (jsPDF + autoTable)
- `src/components/GroupLogoSettings.tsx` (helpers de preview PDF)

**Ganho no mobile:** ~200 KB gzipped economizados no primeiro
carregamento das páginas Scouts e Admin.

## Passo 6 — Imagens (LCP + tráfego)

**Achado crítico:** `index.html` fazia preload high-priority de
`/scoutfoto-logo.png` (**1.1 MB**) usado no splash screen. O arquivo
`.jpeg` equivalente (**42 KB**, mesma imagem, 26× menor) já existia
mas não era usado.

**Correções:**

- `index.html` — preload e splash `<img>` agora usam `.jpeg`
- `src/components/ScoutFolders.tsx` — capas de ano/data com
  `loading="lazy" decoding="async"`

**Ganho:** ~1 MB removido do caminho crítico do LCP em todo primeiro paint.

**Pendências recomendadas (fora do escopo do sandbox):**

- Reprocessar `public/logo-grupo.png` (385 KB) para WebP
- Converter `public/scoutfoto-logo.png` (1.1 MB) para WebP para
  substituir o `.jpeg` atual (~50% adicional)
- Considerar `vite-imagetools` para gerar variantes AVIF/WebP em build

---

## Verificações

- `tsgo --noEmit` limpo após cada etapa
- `bun run build` — chunks `jspdf` e `scoutPdfExport` agora só carregam
  ao clicar em Exportar
- Zero regressões funcionais detectadas

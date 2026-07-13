## Objetivo

Adicionar os papéis **Diretor Presidente**, **Diretor Administrativo**, **Diretor Financeiro** e **Assistente** ao ScoutFoto, garantindo que apareçam tanto no formulário de criação de usuário quanto na tela "Papéis do Sistema", com permissões padrão já configuradas.

Abordagem escolhida: **manter o enum `app_role`** (baixo risco, sem quebrar RLS) e adicionar os novos valores. O formulário de criar usuário passa a ler os papéis dinamicamente da mesma fonte usada pela tela "Papéis do Sistema" (`role_descriptions` + enum), eliminando a lista hardcoded.

## Etapas

### 1. Migração de banco
- `ALTER TYPE app_role ADD VALUE` para: `diretor_presidente`, `diretor_administrativo`, `diretor_financeiro`, `assistente`.
- Inserir linhas em `role_descriptions` com nome/descrição em pt-BR para os 4 papéis.
- Inserir permissões padrão em `role_permissions`:
  - Diretor Presidente / Administrativo / Financeiro: gerenciar integrantes, gerenciar eventos, visualizar relatórios, visualizar fotos.
  - Assistente: visualizar integrantes, cadastrar/visualizar fotos, participar de eventos (mesmo nível do Voluntário, sem admin).
- Atualizar `ROLE_PRIORITY` no código para posicionar os novos papéis na hierarquia:
  `admin > diretor_presidente > diretor_administrativo > diretor_financeiro > dirigente_gestor > chefe > dirigente > voluntario > assistente > parent > viewer`.

### 2. Frontend — fonte única de papéis
- Criar hook `useAvailableRoles()` que lê `role_descriptions` (todos os papéis cadastrados) e retorna `{ value, label, description }`.
- Refatorar o formulário de criação/edição de usuário no `Admin.tsx` (e `InviteLinkPanel` se aplicável) para usar esse hook em vez da lista hardcoded.
- Atualizar `ROLE_LABELS` em `src/lib/userRoles.ts` com os 4 novos rótulos (fallback para quando `role_descriptions` ainda não carregou).
- Garantir que `SectionIndicator` e `usePermissions` reconheçam os novos papéis (mapeamento visual + herança de permissões via `has_permission`).

### 3. Tela "Papéis do Sistema"
- Como `RolePermissionsManager` já lê do enum via `role_descriptions`, os novos papéis aparecerão automaticamente após a migração.
- Adicionar contagem de usuários por papel (SELECT COUNT do `user_roles`) na listagem para dar visibilidade solicitada.

### 4. Validações
- Bloquear no frontend a remoção do último admin.
- Manter `admin` como papel especial (não editável/excluível pela UI).

### 5. Verificação
- Rodar `AccessLogViewerAdminGate.test.tsx` e testes existentes de permissões.
- Teste manual: criar usuário com cada novo papel e conferir permissões aplicadas.

## Detalhes técnicos

**Por que manter o enum:** todas as ~40 policies RLS e funções `has_role(uuid, 'x'::app_role)` dependem do tipo enum. Migrar para tabela `roles` dinâmica exigiria reescrever cada policy, regenerar tipos e testar toda a matriz de acesso — trabalho de dias com alto risco de brechas. `ALTER TYPE ADD VALUE` é atômico e transparente.

**Fonte única de verdade:** hoje o formulário tem array literal `['admin','voluntario',...]`. Passa a consultar `role_descriptions` (tabela que já existe e é editada pela tela "Papéis do Sistema"). Assim, adicionar/renomear um papel em um lugar reflete no outro.

**Limitação assumida:** criar/excluir papéis pela UI **não** será implementado nesta iteração (exigiria a migração enum→tabela). Novos papéis continuam sendo adicionados por migração — o que é adequado dado que papéis institucionais mudam raramente.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — enum + seeds
- `src/lib/userRoles.ts` — ROLE_PRIORITY, ROLE_LABELS
- `src/hooks/useAvailableRoles.ts` — novo
- `src/pages/Admin.tsx` — formulário de usuário
- `src/components/InviteLinkPanel.tsx` — dropdown de papel
- `src/components/RolePermissionsManager.tsx` — contagem de usuários
- `src/components/SectionIndicator.tsx` — mapeamento visual

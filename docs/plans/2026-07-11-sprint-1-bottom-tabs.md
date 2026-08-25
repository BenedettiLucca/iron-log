# Sprint 1 — Bottom Tabs Foundation

**Status:** [IN PROGRESS]

**Goal:** substituir o Drawer por uma bottom row de cinco destinos, preservar todos os paths públicos e manter detalhes/formulários no Stack raiz.

**Executor:** Antigravity para moves e implementação volumosa; Hermes revisa, simplifica, corrige e verifica.

## Escopo

### 1. Navegação principal
- [ ] Criar `app/(tabs)/_layout.tsx` com cinco tabs: Início, Treinos, Histórico, Biometria e Ajustes.
- [ ] Criar ícones locais em `components/navigation/TabIcon.tsx` usando `react-native-svg` já instalado.
- [ ] Aplicar cores/tamanho/safe area da bottom row do Open Design sem copiar chrome falso.
- [ ] Manter headers nativos do Expo Router.

### 2. Reorganização de rotas
- [ ] Mover as cinco telas principais para `app/(tabs)`.
- [ ] Mover telas secundárias de `(drawer)` para o Stack raiz.
- [ ] Atualizar imports relativos sem alterar lógica de domínio.
- [ ] Atualizar `app/_layout.tsx`: `(tabs)` sem header, secundárias com header/back nativo.
- [ ] Preservar URLs `/routines`, `/history`, `/bio`, `/settings`, `/programs/*`, `/session/*`.

### 3. Reachability
- [ ] Treinos oferece acesso visível a Programas e Templates.
- [ ] Biometria oferece acesso visível a Suplementos e Relatório Semanal.
- [ ] Ajustes oferece acesso visível a Sobre.
- [ ] Nenhum destino antigo do Drawer fica órfão.

### 4. Dependências e i18n
- [ ] Adicionar `@react-navigation/bottom-tabs` como dependência direta compatível com Expo.
- [ ] Remover `@react-navigation/drawer` após não haver imports.
- [ ] Adicionar labels `tabs.*` em PT/EN/ES/ZH com paridade exata.
- [ ] Atualizar documentação estrutural afetada.

## Non-goals

- Não redesenhar o conteúdo completo das telas nesta sprint.
- Não mudar schema, hooks, queries, serviços ou fluxo de sessão.
- Não mover `routine/[routineId]` nem `session/*` para dentro das tabs.
- Não adicionar biblioteca de ícones, fonte, blur ou navegação custom feita à mão.
- Não criar tabs invisíveis com `href: null`.
- Não renomear paths públicos.

## Acceptance criteria

- [ ] Exatamente cinco tabs visíveis.
- [ ] Tabs só aparecem nas cinco áreas principais.
- [ ] Detalhes/formulários/session abrem full-screen com back nativo.
- [ ] Android back volta corretamente e não cria dead ends.
- [ ] Todos os antigos destinos do Drawer ficam alcançáveis em até dois toques.
- [ ] Light/dark e safe area corretos.
- [ ] Novas labels presentes nos quatro idiomas.
- [ ] `npm run typecheck` passa.
- [ ] `npm run lint` passa sem issues.
- [ ] `npm test -- --runInBand` passa integralmente.
- [ ] `git diff --check` limpo.

## Verification matrix

1. Início → programa/detail → back → Início.
2. Treinos → templates → back → Treinos.
3. Treinos → programas → programa detail → back.
4. Histórico → summary de sessão → back.
5. Biometria → check-in/evolution/analytics/goals → back.
6. Biometria → suplementos e relatório → back.
7. Ajustes → Sobre → back.
8. Home → iniciar treino → session flow sem bottom row.
9. Sessão incompleta → retomar → session flow sem bottom row.
10. Alternar as cinco tabs repetidamente sem recriar estado ou quebrar scroll.

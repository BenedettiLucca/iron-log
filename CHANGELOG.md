# Changelog

All notable changes to Iron Log are documented here.

## [3.1.1] - 2026-04-26

### Added
- **Analytics Service** — Strength Score (0-100) com breakdown Volume/Intensidade/Consistência
- **Analytics Screen** — Gráfico de volume semanal, streaks, PRs, 1RM estimado, top exercícios
- **CSV Export Service** — Export de sessões e métricas corporais como CSV com share nativo
- **CSV por Sessão** — Export individual pelo Resumo de cada treino
- **Zod Validation** — Schemas para route params e form inputs em todas as telas críticas
- **Domain Hooks** — `useRoutines`, `useSessions`, `useSessionExercise`, `useBodyMetrics`
- **TypeScript Types** — Interfaces tipadas em `src/types/index.ts` (Routine, Session, Set, etc.)
- **Error Boundary** — Componente com fallback visual + stack trace em dev mode
- **Barrel Exports** — `services/index.ts`, `hooks/index.ts`, `src/utils/index.ts`
- **Logger Service** — Logging estruturado substituindo `console.log`
- **134 testes unitários** em 9 suites (utils, services, validators)

### Changed
- Eliminado todo `useState<any>` (10 ocorrências em 7 arquivos)
- Eliminado `as any` do Drawer layout
- PR count no finish agora consulta `personalRecords` ao invés de hardcoded `0`
- Consolidado `utils/` → `src/utils/` (calculations.ts)
- Skeleton loading substitui ActivityIndicator na tela de Analytics
- Telas refatoradas para usar hooks de domínio ao invés de DB direto

### Fixed
- `validateField` fallback para coercion errors sem `errors[0]`
- Hooks order violation no `exercise.tsx` ao integrar Zod (validação movida para depois dos hooks)

---

## [3.1.0] - 2026-04-16

### Added
- Photo Comparison — Galeria de fotos com comparação lado a lado
- Template Library — Biblioteca de rotinas pré-definidas com importação
- Enhanced Bio Check-in — Check-in mensal com mais medidas

### Changed
- UI refinements no fluxo de sessão

---

## [3.0.0] - 2026-03-XX

### Added
- Design System "Warm & Earthy" — Cartões arredondados, tipografia hierárquica
- Feedback tátil com Haptics
- Motion design com Reanimated
- Streak tracking de consistência
- Metas com data-alvo

### Changed
- Redesign completo da interface

---

## [2.0.0] - 2026-02-XX

### Added
- Drizzle ORM com SQLite
- Timer de descanso inteligente
- Stopwatch para exercícios de tempo
- Bio-tracking (peso, medidas, fotos)
- Backup local e Google Drive
- Importação JSON de rotinas
- Notificações de lembrete mensal

---

## [1.0.0] - 2026-01-XX

### Added
- MVP: Registro de treinos com séries e cargas
- Gestão de rotinas
- Histórico de sessões

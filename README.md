# Iron Log 🏋️‍♂️

> **Log de Treino de Atrito Zero, Bio-Tracking, Analytics & Exportação**

O **Iron Log** é uma plataforma completa de monitoramento fitness local-first. Projetado para quem leva o treino a sério — registro rápido de cargas, acompanhamento corporal, analytics de performance e exportação de dados.

**Versão:** 3.1.1 · **Expo SDK:** 54 · **Testes:** 134 passando

---

## 📱 Funcionalidades

### 💪 Treino & Performance
- **Gestão de Sessão** — Cronômetro persistente, controle de duração real, fluxo contínuo entre exercícios
- **Stopwatch Ativo** — Cronômetro dedicado para exercícios de tempo (Prancha, Dead Hang)
- **Timer Pro** — Timer de descanso inteligente que funciona em segundo plano
- **Histórico Instantâneo** — Consulte cargas anteriores sem sair da tela de exercício
- **Warmup Progression** — Cálculo automático de séries de aquecimento (40/60/80%)

### 🧬 Bio & Evolução
- **Bio-Tracking Completo** — Peso, medidas corporais e fotos comparativas
- **Gráficos de Evolução** — Média móvel (7 dias), galeria de fotos por data
- **Metas** — Objetivos para peso e medidas com data-alvo
- **Lembretes Mensais** — Notificações configuráveis para check-in

### 📊 Analytics (novo!)
- **Strength Score (0-100)** — Score composto de Volume + Intensidade + Consistência
- **Níveis:** Novato → Iniciante → Intermediário → Avançado → Elite
- **Consistência** — Streak de semanas, frequência semanal/mensal, total de sessões
- **Volume Trends** — Gráfico de volume semanal (últimas 12 semanas)
- **Top Exercícios** — Progressão de carga nos exercícios que mais evoluíram
- **1RM Estimado** — Fórmula Epley para os 10 exercícios mais pesados
- **Recordes Pessoais** — Tracking automático de PRs por exercício

### 📤 Exportação de Dados (novo!)
- **CSV Export** — Export completo de treinos e métricas corporais
- **CSV por Sessão** — Export individual pelo Resumo de cada treino
- **Share Nativo** — Compartilhamento via sistema (WhatsApp, Email, etc.)
- **Backup Local** — Export/import do banco SQLite completo (.db)
- **Backup em Nuvem** — Google Drive (opcional)

### 🛡️ Validação & Robustez
- **Zod Schemas** — Validação de route params e form inputs em todas as telas
- **Error Boundary** — Fallback visual para crashes inesperados
- **Type Safety** — Zero `as any` ou `useState<any>` no codebase
- **DB Hardening** — WAL mode, foreign keys, indexes, soft deletes

### 🎨 UX
- **Design System "Warm & Earthy"** — Cartões arredondados, tipografia hierárquica
- **Tema Dinâmico** — Adaptação automática claro/escuro
- **Skeleton Loading** — Placeholders animados durante carregamento
- **Haptics** — Feedback tátil em interações
- **Importação JSON** — Copie treinos estruturados e o app cria a rotina

---

## 🛠 Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| **Core** | React Native (Expo SDK 54) + TypeScript |
| **ORM** | Drizzle ORM + SQLite (expo-sqlite) |
| **UI** | NativeWind v4 (Tailwind), Reanimated |
| **Charts** | React Native Gifted Charts |
| **Validação** | Zod |
| **Testes** | Jest + ts-jest |
| **Lint** | ESLint (expo config) |

---

## 🚀 Como Rodar

```bash
# Instalar dependências
npm install

# Gerar migrações do banco
npx drizzle-kit generate

# Rodar testes
npx jest

# Lint
npx expo lint

# Desenvolvimento
npx expo start
```

### Build de Produção (Android)

```bash
cd android && ./gradlew assembleRelease
```

Para Google Login funcionar no APK, configure `EXPO_PUBLIC_GOOGLE_CLIENT_ID` no `.env` e adicione o SHA-1 da keystore no Google Cloud Console.

---

## 📂 Estrutura do Projeto

```
iron-log/
├── app/
│   ├── (drawer)/           # Menu lateral
│   │   ├── index.tsx       # Home
│   │   ├── bio/            # Bio-Tracking + Analytics
│   │   │   ├── index.tsx   # Peso e medidas
│   │   │   ├── evolution.tsx # Gráficos
│   │   │   ├── goals.tsx   # Metas
│   │   │   └── analytics.tsx # Strength Score, Volume, PRs
│   │   ├── routines/       # CRUD de rotinas + editor + templates
│   │   ├── history/        # Calendário + histórico de sessões
│   │   ├── settings.tsx    # Config, backup, export CSV
│   │   └── about.tsx       # Sobre o app
│   └── session/            # Fluxo de treino (Stack isolada)
│       ├── [routineId].tsx # Seleção de exercícios
│       ├── exercise.tsx    # Execução do exercício
│       ├── finish.tsx      # Finalizar treino (sRPE, peso, notas)
│       └── summary.tsx     # Resumo + export CSV individual
├── components/             # 17 componentes de UI reutilizáveis
│   ├── Button, Card, Input, Dialog, Toast
│   ├── Skeleton, EmptyState, ProgressBar
│   ├── RestTimer, Stopwatch, SetCard, SetEditor
│   ├── RoutinePreview, StrengthCurve, PhotoComparison
│   ├── DatePicker, ErrorBoundary
├── hooks/                  # Hooks de domínio
│   ├── use-routines.ts     # CRUD de rotinas
│   ├── use-sessions.ts     # Histórico de sessões
│   ├── use-session-exercise.ts # Lógica de séries
│   ├── use-body-metrics.ts # Métricas corporais
│   └── index.ts            # Barrel exports
├── services/               # Serviços de negócio
│   ├── AnalyticsService.ts # Strength Score, Volume Trends, 1RM, PRs
│   ├── CsvExportService.ts # Export CSV com share nativo
│   ├── DatabaseBackupService.ts # Backup/restore SQLite
│   ├── NotificationService.ts   # Lembretes
│   ├── logger.ts           # Logging estruturado
│   └── index.ts            # Barrel exports
├── src/
│   ├── db/                 # Drizzle ORM
│   │   ├── client.ts       # SQLite com WAL, FK, busy_timeout
│   │   └── schema.ts       # Tabelas + indexes + constraints
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Funções puras (exercise, timer, warmup, calculations)
│   └── validators/         # Zod schemas (routes + forms)
├── __tests__/              # 9 suites, 134 testes
│   ├── utils/              # exercise, timer, warmup, calculations
│   ├── services/           # analytics, csv-export
│   └── validators/         # routes, forms
├── constants/              # Cores e tipografia
└── drizzle/                # Migrações SQL
```

---

## 📋 Importação de Rotinas (JSON)

```json
{
  "name": "Upper A - Push Focus",
  "description": "Foco em carga",
  "exercises": [
    {
      "name": "Supino Reto",
      "target": "4x8",
      "rest": 180,
      "notes": "Barra Olímpica",
      "type": "strength"
    },
    {
      "name": "Prancha",
      "target": "3x60s",
      "rest": 60,
      "type": "duration"
    }
  ]
}
```

---

## ⚙️ Configuração Opcional

### Google Drive Backup

1. Crie um projeto no [Google Cloud Console](https://console.cloud.google.com/)
2. Habilite a **Google Drive API**
3. Crie credenciais OAuth 2.0
4. Adicione ao `.env`:
   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
   ```

---

*Desenvolvido como projeto MVP para portfolio de engenharia de software.*

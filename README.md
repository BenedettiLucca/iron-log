# Iron Log 🏋️‍♂️

> **Log de Treino de Atrito Zero, Bio-Tracking & Exportação Markdown**

O **Iron Log** é uma plataforma completa de monitoramento físico "local-first". Projetado para quem leva o treino a sério, ele une o registro rápido de cargas com o acompanhamento de evolução corporal.

**Versão Atual:** v2.4 (Final Release - Warm Adaptive)

---

## 📱 Funcionalidades Principais

### 💪 Treino & Performance
*   **Gestão de Sessão:** Cronômetro persistente e controle de duração real.
*   **Stopwatch Ativo (NOVO):** Para exercícios de Tempo (ex: Prancha), um cronômetro gigante substitui o input manual.
*   **Timer Pro:** Cronômetro de descanso inteligente que funciona em segundo plano.
*   **Fluxo Contínuo:** Botão "Próximo Exercício" elimina a necessidade de voltar ao menu.
*   **Planejamento:** Metas (`target`) e Notas Técnicas (`notes`) visíveis durante a execução.
*   **Histórico Instantâneo:** Consulte cargas anteriores sem sair da tela de exercício.
*   **Auto-Fill:** O app sugere a carga usada no último treino daquele exercício.

### 🧬 Bio & Evolução
*   **Bio-Tracking Completo:** Peso, Medidas e Fotos.
*   **Visualização de Evolução:** Gráficos de Média Móvel (7 dias) e Galeria de Fotos organizada por data.
*   **Sincronização:** O peso do treino alimenta a Bio e vice-versa.

### 🎨 Experiência de Uso
*   **Tema Dinâmico:** Visual "Warm & Earthy" (Terracota/Creme) que se adapta automaticamente ao modo Claro/Escuro do sistema.
*   **Importação Inteligente (JSON):** Copie treinos estruturados e o app cria a rotina automaticamente.

---

## 📋 Guia de Importação (JSON)

Para garantir precisão total, o Iron Log usa JSON para importação. Peça para sua IA gerar neste formato:

```json
{
  "name": "Treino A - Peito",
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

## 🛠 Tech Stack

*   **Core:** React Native (Expo SDK 54) + TypeScript.
*   **Data:** SQLite (Local) + Drizzle ORM.
*   **UI:** NativeWind v4 (Tailwind), React Native Calendars, Gifted Charts.
*   **Media:** Expo Image Picker, Expo File System.

---

## 🚀 Como Rodar

1.  **Instale as dependências:**
    ```bash
    npm install
    ```

2.  **Gere as tabelas do banco:**
    ```bash
    npx drizzle-kit generate
    ```

3.  **Execute (Dev):**
    ```bash
    npx expo start
    ```

4.  **Compile (Android Release):**
    ```bash
    cd android && ./gradlew assembleRelease
    ```

---

## 📂 Estrutura do Projeto

```
iron-log/
├── app/
│   ├── (drawer)/         # Menu Lateral (Home, Bio, Histórico, Rotinas)
│   └── session/          # Fluxo de Treino (Stack Isolada)
├── src/db/
│   ├── schema.ts         # Tabelas (Inclui body_metrics)
└── drizzle/              # Migrações SQL
```

---

*Desenvolvido como Projeto MVP para Portfolio de Engenharia de Software.*
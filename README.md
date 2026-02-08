# Iron Log 🏋️‍♂️

> **Log de Treino de Atrito Zero, Bio-Tracking & Exportação Markdown**

O **Iron Log** é uma plataforma completa de monitoramento físico "local-first". Projetado para quem leva o treino a sério, ele une o registro rápido de cargas com o acompanhamento de evolução corporal.

**Versão Atual:** v3.0 (Polished Edition)

---

## 📱 Funcionalidades Principais

### ✨ Nova Interface (v3.0)
*   **Design System "Warm & Earthy":** Estética refinada com cartões arredondados, tipografia hierárquica e paleta de cores acolhedora.
*   **Feedback Tátil:** Botões e interações com animações de escala para uma sensação física e responsiva.
*   **Motion Design:** Animações de entrada escalonadas e transições suaves.

### 💪 Treino & Performance
*   **Gestão de Sessão:** Cronômetro persistente e controle de duração real.
*   **Stopwatch Ativo:** Para exercícios de Tempo (ex: Prancha), um cronômetro gigante substitui o input manual.
*   **Timer Pro:** Cronômetro de descanso inteligente que funciona em segundo plano.
*   **Fluxo Contínuo:** Botão "Próximo Exercício" elimina a necessidade de voltar ao menu.
*   **Planejamento:** Metas (`target`) e Notas Técnicas (`notes`) visíveis durante a execução.
*   **Histórico Instantâneo:** Consulte cargas anteriores sem sair da tela de exercício.

### 🧬 Bio & Evolução
*   **Bio-Tracking Completo:** Peso, Medidas e Fotos.
*   **Visualização de Evolução:** Gráficos de Média Móvel (7 dias) e Galeria de Fotos organizada por data.
*   **Sincronização:** O peso do treino alimenta a Bio e vice-versa.

### 💾 Portabilidade de Dados
*   **Backup Local:** Exporte seu banco de dados completo (`.db`) para guardar ou transferir.
*   **Importação:** Restaure backups anteriores facilmente.
*   **Backup em Nuvem (Google Drive):** Sincronize seus dados com sua conta Google (Requer configuração).

### 🎨 Experiência de Uso
*   **Tema Dinâmico:** Adaptação automática ao modo Claro/Escuro do sistema.
*   **Importação Inteligente (JSON):** Copie treinos estruturados e o app cria a rotina automaticamente.

---

## ⚙️ Configuração (Opcional)

Para habilitar o backup no Google Drive:

1.  Crie um projeto no [Google Cloud Console](https://console.cloud.google.com/).
2.  Habilite a **Google Drive API**.
3.  Crie credenciais OAuth 2.0 (Web Client ou Android/iOS conforme o uso).
4.  Crie um arquivo `.env` na raiz do projeto:
    ```env
    EXPO_PUBLIC_GOOGLE_CLIENT_ID=seu-client-id-aqui.apps.googleusercontent.com
    ```

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
*   **UI:** NativeWind v4 (Tailwind), React Native Reanimated (Animações).
*   **Charts:** React Native Gifted Charts.
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
├── components/           # Componentes de UI Reutilizáveis (Button, Card, Input)
├── src/db/
│   ├── schema.ts         # Tabelas (Inclui body_metrics)
└── drizzle/              # Migrações SQL
```

---

*Desenvolvido como Projeto MVP para Portfolio de Engenharia de Software.*
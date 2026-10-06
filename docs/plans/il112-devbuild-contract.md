# #112 — Contrato de decisão: development build (A) vs upgrade SDK 54→57 (B)

- **Status:** ANÁLISE para aprovação do owner. Nenhuma dependência, config ou script foi alterado.
- **Base analisada:** `9c0b808d1c1e24ea9f3fbba611031cc5cfd5794b` (branch `epic/il-112-contract`).
- **Convenção:** **FATO** = lido/executado na árvore desta worktree · **EXTERNO** = doc/web, não
  verificado localmente · **INFERÊNCIA** = dedução minha · **OPINIÃO** = recomendação.

## 0. Recomendação

**OPINIÃO: Rota A (adicionar `expo-dev-client` ao projeto SDK 54 existente), build local via
`scripts/qa.sh`.** Não há bloqueio duro para A (seção 4). B continua possível depois, e fica
*menos urgente* depois de A (deixa de ser "perco o canal de QA" e passa a ser manutenção planejada).

## 1. Evidências da árvore

### 1a. `android/` contém um projeto nativo completo?

**FATO: não.**

- `.gitignore` tem `/android` e `/ios` ("generated native folders").
- `git ls-files android` retorna **um único arquivo**: `android/app/build.gradle`
  (último commit: `3bbfb78`, v3.15.0; rastreado apesar do ignore).
- Na worktree, `find android` retorna só `android/app/build.gradle`. **Não existem**
  `settings.gradle`, `build.gradle` raiz, `gradle.properties`, `gradlew`, `gradle/wrapper/`,
  `AndroidManifest.xml`, `debug.keystore`, `MainApplication.kt`.
- Logo `expo run:android` / `./gradlew assembleDebug` **não funcionam num clone/worktree limpo**
  sem antes gerar o projeto nativo. O projeto é CNG (Continuous Native Generation): precisa de
  `expo prebuild` (que `expo run:android` dispara sozinho quando `android/` não está completo).
- **FATO:** o `build.gradle` rastreado é uma versão **customizada** do template do Expo:
  `signingConfigs.release` lê `IRONLOG_RELEASE_STORE_FILE/_STORE_PASSWORD/_KEY_ALIAS/_KEY_PASSWORD`
  de `gradle.properties`, e tem `versionCode 10` (o `app.json` diz `android.versionCode: 9` →
  drift já existente entre os dois).
- **INFERÊNCIA (risco real):** `expo prebuild` sem `--clean` reaplica o template por cima de
  `android/`; o `build.gradle` rastreado provavelmente será **sobrescrito** (perde o bloco de
  assinatura release e o `versionCode 10`). Não executei prebuild (proibido nesta lane); precisa
  ser verificado na slice de build, com backup antes (seção 3).
- **INFERÊNCIA:** o checkout principal provavelmente tem um `android/` completo e não rastreado
  (`docs/agentic-android-qa.md` menciona `android/gradle.properties` e `local.properties`). Não
  verifiquei: o checkout principal está fora do escopo desta lane.

### 1b. O que `scripts/qa.sh` assume

**FATO** (`scripts/qa.sh`, `scripts/android-qa.env`):

| Comando | Premissa |
|---|---|
| `build` | `android/gradlew` existe: `cd android && ./gradlew assembleDebug -x lint --console=plain -q`. Sem `android/` gerado, falha. |
| `install` | Procura `android/app/build/outputs/apk/debug/*.apk` (o mais recente); se não achar, chama `build`. Instala com `adb install -r` em `DEVICE_SERIAL` (default `emulator-5554`; aceita serial USB). |
| `metro` | `npx expo start --dev-client --port 8081` em background; health em `:8081/status`. |
| `app` | exige app instalado (`APP_ID=com.lucca.ironlog`); sobe Metro, faz `adb reverse tcp:8081 tcp:8081`, lança via `monkey` LAUNCHER. |
| `smoke` | `maestro test .maestro/smoke-app-launch.yaml` (só esse flow; os outros dois flows existem em `.maestro/` mas não são chamados). |
| env | `JAVA_HOME=/usr/lib/jvm/java-17-openjdk`, `ANDROID_HOME=~/android-sdk`, AVD `ironlog-qa`. |

Observações **FATO**: a mensagem de `usage` do `qa.sh` não lista `build`/`metro` (existem no
`case`). O build assumido é **debug sem `expo-dev-client`**: `expo-dev-client` só é citado em
`scripts/qa.sh` e `docs/agentic-android-qa.md` e não está em `node_modules`.

**INFERÊNCIA importante:** o `assembleDebug` atual já é, na prática, um "dev build mínimo" do RN
(carrega JS do Metro via `adb reverse`). Isso cobre **emulador e device físico por USB**. O que
`expo-dev-client` acrescenta: launcher UI (trocar servidor/URL sem recompilar), dev menu do Expo,
conexão por LAN/QR sem USB e deep link `exp+iron-log://…` para o Maestro. Ou seja: parte do ganho
da Rota A para o treadmill já está disponível via `qa.sh`; o que **falta** é um procedimento de
device físico documentado e validado (e o projeto nativo reproduzível), não só a lib. O owner deve
saber disso ao decidir.

### 1c. `expo-dev-client` compatível com o SDK instalado

**FATO:**

- `node_modules/expo/package.json` → `version: 54.0.37`; `package.json` → `"expo": "~54.0.37"`,
  `react-native 0.81.5`, `react 19.1.0`.
- `node_modules/expo/bundledNativeModules.json` → `"expo-dev-client": "~6.0.21"`
  (também `expo-updates ~29.0.20`, `expo-notifications ~0.32.17`, `react-native 0.81.5`).
- **EXTERNO:** branch `sdk-54` do `expo/expo` → `packages/expo-dev-client/package.json`
  `version: 6.0.21`, dep `expo-updates-interface ~2.0.0` (já presente em `node_modules`).
- **Versão alvo: `expo-dev-client@~6.0.21`.** Instalar via `npx expo install expo-dev-client`
  (resolve pelo bundledNativeModules), nunca `npm i expo-dev-client@latest`.

**Mudanças de config/plugin necessárias:**

| Item | Estado atual (FATO) | Mudança |
|---|---|---|
| `package.json` | sem `expo-dev-client` | + `"expo-dev-client": "~6.0.21"` (e `package-lock.json`). Mudança de dependência → slice de build, **não** esta. |
| `app.json` `plugins` | `expo-router`, `expo-splash-screen`, `expo-font`, `@sentry/react-native` | **Opcional.** **EXTERNO** (docs SDK 54): a entrada `expo-dev-client` só é necessária para customizar `launchMode` (`most-recent` default \| `launcher`) e `addGeneratedScheme` (default `true`). Recomendo **não** adicionar na primeira slice. |
| URL scheme | `scheme: "ironlog"` | O dev-client registra adicionalmente `exp+iron-log` (`exp+<slug>`; **EXTERNO**/INFERÊNCIA). Não conflita com `ironlog`. |
| `eas.json` | perfil `development` já com `developmentClient: true`, `distribution: internal` | Nenhuma mudança (só relevante se usar EAS). Hoje esse perfil pede dev-client que não está instalado. |
| EAS | `app.json` **não** tem `extra.eas.projectId` nem `owner` | EAS exige `eas login` + `eas init`. Por isso build **local** é o default; EAS é opção. |
| `expo-updates` | instalado (`~29.0.20`), usado em `app/(tabs)/settings.tsx` (`Updates.reloadAsync`); `app.json` sem `updates`/`runtimeVersion` | Nenhuma mudança esperada (INFERÊNCIA). Validar que Ajustes não quebra em debug build. |
| `expo-notifications` | `~0.32.17`, usado em `services/NotificationService.ts` e `app/_layout.tsx` | Nenhuma. É o que passa a ser testável no pacote real `com.lucca.ironlog`. |
| Release | `eas.json production` / `assembleRelease` | **EXTERNO/INFERÊNCIA:** launcher/menu só ativos em debug; release permanece limpo. **Verificar** na slice (critério 3.4-3). |

## 2. Comparação das rotas

### Rota A — `expo-dev-client` no projeto atual (SDK 54 / RN 0.81.5)

**Risco para CI/verify** (FATO sobre o CI, INFERÊNCIA sobre o efeito):

- CI (`.github/workflows/quality.yml`, ubuntu-latest, 15 min): `npm ci` → `audit:high` →
  `typecheck` → `lint --max-warnings=0` → `test:coverage` (+ passe isolado de session-lifecycle) →
  `export:android` → `verify:android-export`. **Nenhum build nativo no CI.**
- Única mudança nos gates: `package.json` + `package-lock.json` ganham `expo-dev-client` e
  transitivas (launcher/menu/manifests). Riscos: (i) **`npm run audit:high`** (fail-closed) pode
  apontar vulnerabilidade transitiva nova — desconhecido até rodar; (ii) `npm ci` precisa continuar
  passando com Node/npm fixados — gerar o lock com npm 10.9.7.
- Nenhum código JS importa `expo-dev-client` → typecheck, lint, jest e `export:android`
  **não mudam** (INFERÊNCIA).
- Risco local (não CI): `expo prebuild` sobrescrever o `android/app/build.gradle` rastreado
  (seção 1a). Mitigação: backup + diff + restauração controlada.
- Risco no device: `applicationId` igual ao release (`com.lucca.ironlog`) mas assinatura diferente
  (`debug.keystore` vs release). Se o S23 já tiver o APK de release, `adb install -r` falha com
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE`; desinstalar apaga o banco local → **exportar backup antes**.
  O banco do Expo Go é outro sandbox: o dev build começa com DB vazio.

**Migração:** instalar dep → prebuild (com backup do gradle) → build debug → instalar → Metro +
`adb reverse` → Maestro com deep link. Detalhes na seção 3. Sem mudanças de código do app.

**Cenários #113/#114 destravados** (INFERÊNCIA, apoiada em
`docs/qa/2026-09-15-sprint-trust-closure-disposition.md`: "#114 requer build release/device — fora
de Expo Go"; `docs/plans/2026-09-06-night-digest.md`: #113 = permissão de notificação em build
nativa, #114 = cenário app morto):

| Cenário | Destravado por A? |
|---|---|
| #113 — permissão `POST_NOTIFICATIONS` (Android 13+) no pacote real do app | **Sim** (no Go a permissão pertence ao app Expo Go). |
| #114 — notificação de descanso com app morto (swipe-away) | **Sim, parcial:** debug build + Metro serve para o agendamento local. Para evidência final, repetir em variante **release** (sem Metro) — escopo da slice de #114. |
| Matar o app pelo OEM (Doze / battery killer Samsung) | Só em device físico; A viabiliza, não automatiza. |
| Canal de QA físico imune a major do Expo | **Sim, permanente.** |

### Rota B — upgrade SDK 54 → 57

**EXTERNO (resumo de busca web; confirmar nas release notes oficiais antes de decidir):** SDK 55
(fev/2026, RN 0.83) torna a **New Architecture obrigatória**; SDK 56 (mai/2026, RN 0.85); SDK 57
(30/jun/2026, RN 0.86, React 19.2) é um bump "calmo" de RN. No SDK 57 o Expo Go exige login no CLI
**e** no app.

**Risco para CI/verify** (INFERÊNCIA — nada foi executado):

- Reescreve a baseline: Expo + RN (0.81→0.86, 5 minors) + React (19.1→19.2) + reanimated/worklets,
  screens, safe-area-context, svg, gesture-handler, ~15 pacotes `expo-*`, `jest-expo`,
  `babel-preset-expo`, `@sentry/react-native`, `expo-notifications` (mudanças de API possíveis,
  **não verificadas**), `expo-sqlite`.
- Terceiros sem garantia de compatibilidade: `nativewind 4.2.1` + `tailwindcss 3`,
  `react-native-gifted-charts`, `react-native-calendars`, `drizzle-orm` + bundling de migrations
  (`babel-plugin-inline-import`, metro config).
- **FATO de higiene:** `package.json` já tem `@react-native/metro-config ^0.85.2` com RN `0.81.5`
  (drift pré-existente que o upgrade teria de resolver).
- Gates a re-baselinar: `audit:high`, typecheck, lint, thresholds de cobertura, `export:android` +
  `scripts/verify-android-export.js` (assume bundle `.hbc` em `_expo/static/js/android`) e **todo o
  QA do `app/session/`** (AGENTS.md exige regressão + smoke Android).
- Não resolve o treadmill: SDK 58 recria o problema (Go suporta só a SDK mais recente).
- Go no SDK 57 não destrava #113/#114 (identidade do pacote do Go ≠ `com.lucca.ironlog`).

**Cenários destravados por B:** apenas QA físico via Go novo (fluxo atual do Sprint 13);
**não** #113, **não** #114 de forma representativa.

### Matriz resumida

| Critério | A (dev-client, SDK 54) | B (SDK 57) |
|---|---|---|
| Esforço | pequeno: 1 dep + procedimento + 1 subflow | grande: 3 majors, sprint dedicada com QA completo |
| Risco CI | baixo (lock + audit) | alto (pipeline inteiro re-baselinado) |
| Imune ao treadmill | sim | não |
| #113 permissão nativa | sim | não |
| #114 app morto | sim (debug) / release na slice própria | não |
| Reversível | `git revert` de 2-3 arquivos | revert de mega-commit + lock |
| Pré-requisito | `expo prebuild` (CNG) + SDK/Java locais já documentados | idem + validar toda a árvore de deps |

## 3. Aceitação da futura slice de build (A)

Pré-condições: worktree limpa (`git status --short --branch`), Node 22.22.2 / npm 10.9.7, KVM ok
(`docs/agentic-android-qa.md`). Commit de plataforma separado de qualquer mudança de teste.

### 3.1 Comandos (nesta ordem)

```bash
# 0. baseline
git status --short --branch && npm run typecheck && npm run lint -- --max-warnings=0

# 1. dependência (único toque em package*.json)
npx expo install expo-dev-client            # esperado: ~6.0.21
git diff --stat -- package.json package-lock.json   # só expo-dev-client (+ transitivas no lock)
npm run audit:high                           # fail-closed; registrar saída literal

# 2. projeto nativo (CNG) — preservar o gradle rastreado
cp android/app/build.gradle <scratch-da-lane>/build.gradle.bak
npx expo prebuild --platform android --no-install
diff <scratch-da-lane>/build.gradle.bak android/app/build.gradle   # registrar (esperado: signing release / versionCode)
cp <scratch-da-lane>/build.gradle.bak android/app/build.gradle     # restaurar customização rastreada
git diff --exit-code -- android/app/build.gradle                   # exit 0

# 3. build + instalar + subir
scripts/qa.sh boot
scripts/qa.sh build                          # assembleDebug
sha256sum android/app/build/outputs/apk/debug/app-debug.apk
scripts/qa.sh install
scripts/qa.sh app                            # Metro --dev-client + adb reverse + launch

# 4. regressão
scripts/qa.sh smoke                          # 100% verde (AGENTS.md)
npm run verify                               # pipeline completo, inalterado
```

Device físico: `DEVICE_SERIAL=<serial de adb devices> scripts/qa.sh install` e `… app`
(USB + `adb reverse`); por LAN, abrir o launcher e informar `http://<ip>:8081` (liberar `8081/tcp`
no firewalld, ver `docs/qa/2026-07-30-sprint-5-android-runbook.md`).

### 3.2 Artefatos esperados

- APK: `android/app/build/outputs/apk/debug/app-debug.apk` (é o glob que `qa.sh install` já usa;
  `*.apk` está no `.gitignore` — **não commitar**).
- Registrar no relatório da slice: `sha256sum` do APK, SHA do commit usado, `versionName`/
  `versionCode` (`aapt2 dump badging <apk> | head -1`), serial/API do device. O hash **não é
  reprodutível bit-a-bit** entre máquinas; serve como identificador da evidência.
- Prova de que é dev build (a confirmar na slice): `aapt2 dump xmltree --file AndroidManifest.xml
  <apk> | grep -i 'exp+iron-log'` e `unzip -l <apk>` contendo classes/recursos do dev launcher.
- Diff do commit de plataforma: **somente** `package.json`, `package-lock.json` (+ subflow Maestro
  e doc). `android/` continua fora do git, exceto o `build.gradle` rastreado, **sem diff**.

### 3.3 Como o Maestro mira o dev build

- `appId: com.lucca.ironlog` permanece (mesmo `applicationId`).
- **INFERÊNCIA:** com dev-client, `launchApp` abre o **launcher** (ou o projeto "most-recent", se
  houver). Os flows atuais (`launchApp` + `assertVisible: "Início"`) ficam não-determinísticos.
- **Solução proposta:** subflow `.maestro/_dev-client-open.yaml` com
  `openLink: exp+iron-log://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`
  (emulador/USB com `adb reverse`; `10.0.2.2` sem reverse), chamado via `runFlow` antes das
  assertions. **EXTERNO (verificar na slice):** `__expo_disable_onboarding=1`,
  `__expo_disable_auto_launch=1`, `__expo_disable_fab=1` na URL suprimem onboarding, dev menu
  automático e FAB; sem isso o primeiro launch mostra overlay de onboarding.
- Regras: não afrouxar assertions existentes (AGENTS.md); `qa.sh app` já sobe Metro com
  `--dev-client`.

### 3.4 Critérios de aceitação (todos obrigatórios)

1. `package.json` diff = `expo-dev-client ~6.0.21` apenas; `npm ci` limpo; `audit:high` exit 0
   (ou falha preexistente registrada verbatim).
2. `npm run verify` exit 0, sem mudança em cobertura/export vs. baseline.
3. Release não afetado: `assembleRelease` (ou inspeção do manifest/bundle de release) **não**
   expõe launcher/menu ativo — verificação registrada.
4. APK debug instala no AVD **e** no device físico, abre o app, `qa.sh smoke` 100% verde.
5. `adb shell dumpsys package com.lucca.ironlog | grep -i versionName` bate com `app.json`.
6. #113: prompt de `POST_NOTIFICATIONS` aparece no pacote real (screenshot + logcat). #114 fica
   para a slice seguinte, com evidência em release.
7. `git status --short` final lista só os arquivos pretendidos; `android/app/build.gradle` sem diff.

### 3.5 Rollback

- **Repo:** `git revert <sha-do-commit-de-plataforma>` (restaura `package.json`/lock/subflow).
  Verificação: `git diff 9c0b808 -- package.json package-lock.json app.json` vazio e
  `npm ci && npm ls expo-dev-client` sem resultado.
- **Local (não rastreado):** `(cd android && ./gradlew clean)`, restaurar o backup do
  `build.gradle`, `adb uninstall com.lucca.ironlog` no AVD (no device físico: só após backup do
  banco) e voltar a QA via Expo Go 54.0.8 sideload (workaround vigente).
- Como `android/` é gitignored e o autolinking lê o `package.json`, o revert da dependência remove
  o dev-client do próximo build. Nenhuma migration de DB está envolvida.

## 4. Bloqueios explícitos

**Bloqueio duro para A: nenhum identificado.**

Pontos que exigem decisão/atenção (não bloqueiam, mas não podem ser ignorados):

1. `/android` é gitignored: o build não é reproduzível a partir do repo sem `expo prebuild`; o
   `build.gradle` rastreado pode ser sobrescrito (customização de signing release).
2. `audit:high` pode falhar por dependência transitiva nova — só se sabe rodando.
3. Mesmo `applicationId` com assinatura diferente do release no device físico → conflito de
   instalação / perda de dados locais (exigir backup).
4. `.maestro/*` precisam de subflow de abertura do dev client (seção 3.3).
5. Dev build debug não é evidência de comportamento de release (#114 final).
6. B (se escolhida no futuro): New Arch obrigatória + 3 majors + deps de terceiros não verificadas;
   exige sprint dedicada.

## 5. Perguntas abertas para o owner

1. Aprova Rota A com build **local** (default) ou prefere **EAS** (exige conta, `eas init`,
   `projectId`)?
2. Aceita `adb install` sobre o APK de release no S23 (pede backup) ou prefere `applicationIdSuffix`
   `.dev` (pequena mudança de config, fora desta lane)?
3. `versionCode` 10 (gradle) vs 9 (`app.json`) é intencional? A slice de build deve alinhar?
4. Manter B como backlog planejado após A?

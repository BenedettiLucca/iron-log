# Iron Log 🏋️‍♂️

> **Registro de Entrenamiento Sin Fricción, Bio-Tracking, Analytics y Exportación**

**Iron Log** es una plataforma completa de monitoreo fitness local-first. Diseñado para quienes se toman el entrenamiento en serio — registro rápido de cargas, seguimiento corporal, análisis de rendimiento y exportación de datos.

**Versión:** 3.5.0 · **Expo SDK:** 54 · **Tests:** 281 pasando

---

## 🌍 Idiomas Soportados

- 🇧🇷 **Português** (predeterminado)
- 🇺🇸 **English**
- 🇪🇸 **Español**
- 🇨🇳 **简体中文**

El idioma se puede cambiar en cualquier momento desde **Configuración**.

---

## 📱 Funcionalidades

### 💪 Entrenamiento & Rendimiento
- **Gestión de Sesión** — Cronómetro persistente, control de duración real, flujo continuo entre ejercicios
- **Stopwatch Activo** — Cronómetro dedicado para ejercicios basados en tiempo (Plancha, Dead Hang)
- **Timer Pro** — Temporizador de descanso inteligente que funciona en segundo plano
- **Historial Instantáneo** — Consulta cargas anteriores sin salir de la pantalla de ejercicio
- **Warmup Progression** — Cálculo automático de series de calentamiento (40/60/80%)

### 🧬 Bio & Evolución
- **Bio-Tracking Completo** — Peso, medidas corporales y fotos comparativas
- **Gráficos de Evolución** — Media móvil (7 días), galería de fotos por fecha
- **Metas** — Objetivos para peso y medidas con fecha objetivo
- **Recordatorios Mensuales** — Notificaciones configurables para check-in

### 📊 Analytics
- **Strength Score (0-100)** — Puntaje compuesto de Volumen + Intensidad + Consistencia
- **Niveles:** Novato → Principiante → Intermedio → Avanzado → Elite
- **Consistencia** — Racha de semanas, frecuencia semanal/mensual, total de sesiones
- **Volume Trends** — Gráfico de volumen semanal (últimas 12 semanas)
- **Top Ejercicios** — Progresión de carga en los ejercicios que más evolucionaron
- **1RM Estimado** — Fórmula Epley para los 10 ejercicios más pesados
- **Récords Personales** — Seguimiento automático de PRs por ejercicio

### 📤 Exportación de Datos
- **CSV Export** — Exportación completa de entrenamientos y métricas corporales
- **CSV por Sesión** — Exportación individual desde el Resumen de cada entrenamiento
- **Share Nativo** — Compartir vía sistema (WhatsApp, Email, etc.)
- **Backup Local** — Export/import de la base SQLite completa (.db)
- **Backup en la Nube** — Google Drive (opcional)

### 🛡️ Validación & Robustez
- **Zod Schemas** — Validación de route params y form inputs en todas las pantallas
- **Error Boundary** — Fallback visual para crashes inesperados
- **Type Safety** — Zero `as any` o `useState<any>` en el codebase
- **DB Hardening** — WAL mode, foreign keys, indexes, soft deletes

### 🎨 UX
- **Design System "Warm & Earthy"** — Tarjetas redondeadas, tipografía jerárquica
- **Tema Dinámico** — Adaptación automática claro/oscuro
- **Skeleton Loading** — Placeholders animados durante la carga
- **Haptics** — Feedback táctil en interacciones
- **Importación JSON** — Pega entrenamientos estructurados y la app crea la rutina

---

## 🛠 Tech Stack

| Capa | Tecnología |
|------|-----------|
| **Core** | React Native (Expo SDK 54) + TypeScript |
| **ORM** | Drizzle ORM + SQLite (expo-sqlite) |
| **UI** | NativeWind v4 (Tailwind), Reanimated |
| **Charts** | React Native Gifted Charts |
| **Validación** | Zod |
| **Tests** | Jest + ts-jest |
| **Lint** | ESLint (expo config) |

---

## 🚀 Cómo Ejecutar

```bash
# Instalar dependencias
npm install

# Generar migraciones de base de datos
npx drizzle-kit generate

# Ejecutar tests
npx jest

# Lint
npx expo lint

# Desarrollo
npx expo start
```

### Build de Producción (Android)

Como el directorio `android/` está en `.gitignore` (no versionamos código nativo), usa el workflow de Expo:

```bash
# Generar código nativo localmente (para debug)
npx expo prebuild --platform android

# Build vía EAS (recomendado)
npx eas build --platform android --profile production
```

Para que Google Drive Backup funcione en release, configura `EXPO_PUBLIC_GOOGLE_CLIENT_ID` en `.env` y añade el SHA-1 de la keystore en Google Cloud Console.

---

## 📂 Estructura del Proyecto

```
iron-log/
├── app/
│   ├── (drawer)/           # Menú lateral
│   │   ├── index.tsx       # Home
│   │   ├── bio/            # Bio-Tracking + Analytics
│   │   ├── routines/       # CRUD de rutinas + editor + templates
│   │   ├── history/        # Calendario + historial de sesiones
│   │   ├── settings.tsx    # Config, backup, export CSV, idioma
│   │   └── about.tsx       # Sobre la app
│   └── session/            # Flujo de entrenamiento (Stack aislada)
├── components/             # 17+ componentes de UI reutilizables
├── hooks/                  # Hooks de dominio
├── services/               # Servicios de negocio
├── src/
│   ├── db/                 # Drizzle ORM
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Funciones puras
│   ├── validators/         # Zod schemas
│   └── i18n/               # Sistema de traducción (pt/en/es/zh)
├── __tests__/              # 16 suites, 281 tests
├── constants/              # Colores y tipografía
└── drizzle/                # Migraciones SQL
```

---

## 📋 Importación de Rutinas (JSON)

```json
{
  "name": "Upper A - Push Focus",
  "description": "Foco en carga",
  "exercises": [
    {
      "name": "Press de Banca",
      "target": "4x8",
      "rest": 180,
      "notes": "Barra Olímpica",
      "type": "strength"
    },
    {
      "name": "Plancha",
      "target": "3x60s",
      "rest": 60,
      "type": "duration"
    }
  ]
}
```

---

## ⚙️ Configuración Opcional

### Google Drive Backup

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/)
2. Habilita la **Google Drive API**
3. Crea credenciales OAuth 2.0
4. Añade a `.env`:
   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
   ```

---

## 📄 Documentación

- [Português](../README.md)
- [English](README.en.md)
- [简体中文](README.zh.md)

---

**Licencia:** MIT · **Autor:** Lucca Benedetti

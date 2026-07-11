# Iron Log 🏋️‍♂️

> **Registro de Entrenamiento Sin Fricción, Bio-Tracking, Analytics y Exportación**

**Iron Log** es una plataforma completa de monitoreo fitness local-first. Diseñado para quienes se toman el entrenamiento en serio — registro rápido de cargas, seguimiento corporal, análisis de rendimiento y exportación de datos.

**Versión:** 3.13.0 · **Expo SDK:** 54 · **Tests:** 385 pasando

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

### 🏋️ Programas & Periodización
- **Dashboard de Programas** — Tarjeta activa en inicio con volumen semanal, sRPE promedio y key lifts con indicadores de tendencia
- **Grade Semanal** — Visualización de conclusión por semana (✅ hecho / ❌ perdido / 💚 deload)
- **Detalle de la Semana** — Toca cualquier semana para ver las sesiones del período
- **Progresión Doble** — Seguimiento automático de progresión de carga/reps cuando se alcanzan los objetivos
- **Cuenta Regresiva Deload** — Banner en el dashboard mostrando semanas hasta la semana de deload

### 🧬 Bio & Evolución
- **Bio-Tracking Completo** — Peso, medidas corporales y fotos comparativas
- **Gráficos de Evolución** — Media móvil (7 días), galería de fotos por fecha
- **Metas** — Objetivos para peso y medidas con fecha objetivo
- **Recordatorios Mensuales** — Notificaciones configurables para check-in
- **Check-in Mensual** — Comparación lado a lado de fotos (frente/espalda/lateral) con superposición de medidas

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
- **Notion Markdown Export** — Exportación de sesiones individuales con YAML frontmatter + tablas de ejercicios
- **Reporte Semanal** — Pantalla dedicada con agregación de sesiones de la semana, tarjetas de stats y vista previa Markdown
- **Share Nativo** — Compartir vía sistema (WhatsApp, Email, etc.)
- **Backup Local** — Export/import de la base SQLite completa (.db)
- **Backup en la Nube** — Google Drive (opcional)

### 💊 Suplementos
- **Checklist Diario** — Toggle de suplementos con contador de racha y adherencia semanal
- **Stack Predeterminado** — Seed con un toque de Creatina, Cafeína+L-Theanine, D3, Omega 3, Mg Bisglicinato, Ashwagandha
- **Gestión Personalizada** — Agrega/edita/elimina suplementos con dosificación, horario, frecuencia y emoji

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
│   ├── (tabs)/             # Navegación principal (bottom tabs)
│   │   ├── index.tsx       # Home / Dashboard
│   │   ├── routines.tsx    # CRUD de rutinas + atajos (programas/plantillas)
│   │   ├── history.tsx     # Calendario + historial de sesiones
│   │   ├── bio.tsx         # Bio-Tracking (peso/medidas/fotos)
│   │   └── settings.tsx    # Config, backup, export CSV, idioma
│   ├── bio/                # Biometría (Stack raíz)
│   │   ├── evolution.tsx   # Gráficos
│   │   ├── goals.tsx       # Metas
│   │   ├── analytics.tsx   # Strength Score, Volumen, PRs
│   │   └── checkin.tsx     # Check-in mensual con comparación de fotos
│   ├── programs/           # Programas de entrenamiento (Stack raíz)
│   │   ├── index.tsx       # Lista de programas
│   │   ├── create.tsx      # Asistente de creación
│   │   ├── detail.tsx      # Detalle + grade semanal
│   │   └── week-detail.tsx # Sesiones de la semana
│   ├── routines/           # Editor y plantillas (Stack raíz)
│   │   ├── editor.tsx      # Crear/editar rutinas
│   │   └── templates.tsx   # Biblioteca de plantillas
│   ├── supplements/        # Checklist de suplementos
│   │   └── index.tsx       # Checklist diario + gestión
│   ├── reports/            # Reportes
│   │   └── weekly.tsx      # Reporte semanal Markdown
│   ├── about.tsx           # Sobre la app
│   └── session/            # Flujo de entrenamiento (Stack aislada)
├── components/             # 22 componentes de UI reutilizables
├── hooks/                  # Hooks de dominio
├── services/               # Servicios de negocio
├── src/
│   ├── db/                 # Drizzle ORM
│   ├── types/              # TypeScript interfaces
│   ├── utils/              # Funciones puras
│   ├── validators/         # Zod schemas
│   └── i18n/               # Sistema de traducción (pt/en/es/zh)
├── __tests__/              # 29 suites, 385 tests
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


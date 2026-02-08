# Session Flow UX Overhaul - Testing Checklist

## 🚀 Setup

1. **Dependencies installed** ✅
2. **Start development server:**
   ```bash
   npm start
   ```
3. **Run on device/emulator:**
   - Android: `npm run android` or Press `a` in Expo CLI
   - iOS: `npm run ios` or Press `i` in Expo CLI
   - Web: `npm run web` or Press `w` in Expo CLI

---

## 📱 Test Scenarios

### Prerequisites
- [ ] Have at least 1 routine created with 3+ exercises
- [ ] Include both strength and duration exercise types
- [ ] Set targets (e.g., "3x8-12") and rest times for exercises

---

## 1️⃣ Exercise Selection Screen (`[routineId].tsx`)

### Visual Elements
- [ ] **Progress bar displays** at top showing completed/total exercises
- [ ] **Routine name** displayed prominently
- [ ] **Session timer** updates in real-time in header
- [ ] **"FIM" button** is visible in header

### Exercise Cards
- [ ] **Empty state**: Cards show "Toque para iniciar" when no sets done
- [ ] **Active state**: Cards show "X séries feitas" when exercises started
- [ ] **Visual distinction**: Active cards have primary border and shadow
- [ ] **Target badges**: Show "Meta: 3x8-12" format
- [ ] **Notes display**: Show notes with emoji prefix
- [ ] **Completion indicator**: Green dot appears when sets logged
- [ ] **Tap feedback**: Cards have active state on press

### Navigation & Actions
- [ ] **Tap exercise**: Navigates to exercise tracking screen
- [ ] **"FIM" button**: Shows confirmation dialog
- [ ] **Confirmation dialog**: Displays "Sair do Treino?" message
- [ ] **Stay button**: Returns to session (closes dialog)
- [ ] **Exit button**: Returns to home screen

### Progress Bar
- [ ] **Initial state**: Shows "0 de X exercises"
- [ ] **Updates**: Increments as exercises are completed
- [ ] **Animation**: Smooth fill transition

---

## 2️⃣ Exercise Tracking Screen (`exercise.tsx`)

### Header Section
- [ ] **Progress bar**: Shows "Exercise X of Y" at top
- [ ] **Session timer**: Displays and updates
- [ ] **History button**: Opens history modal
- [ ] **Exercise name**: Large, bold title
- [ ] **Set counter**: Shows "Série X de Y" format
- [ ] **Rest timer**: Shows configured rest time (e.g., "⏱ 90s")
- [ ] **Target display**: Shows "🎯 Meta: 3x8-12" if set
- [ ] **Notes display**: Shows "📝 Note text" if present

### Strength Exercises (Weight/Reps)
- [ ] **Weight input**: Large, centered text field
- [ ] **Reps input**: Large, centered text field
- [ ] **RIR slider**: Interactive slider 0-5
- [ ] **RIR display**:
  - 0-1: Red color ("FALHA" text for 0)
  - 2-3: Green color
  - 4-5: Blue color
- [ ] **Save button**: "SALVAR SÉRIE" button
- [ ] **Validation**: Shows alert if weight/reps empty
- [ ] **Loading state**: Button shows "SALVANDO..." during save
- [ ] **Saved sets**: Display in scrollable list below

### Duration Exercises (Time-based)
- [ ] **Timer display**: Large monospace font (MM:SS)
- [ ] **Start button**: "INICIAR SÉRIE" (green)
- [ ] **Stop button**: "PARAR" (red) when timer running
- [ ] **Weight input**: Available before start
- [ ] **Save button**: "SALVAR SÉRIE" appears after stop
- [ ] **No auto-save**: Requires explicit button press
- [ ] **Timer updates**: Increments every second when running

### Saved Sets Display
- [ ] **Empty state**: "Nenhuma série registrada ainda"
- [ ] **Set cards**: Show set number, weight, reps/duration, RIR
- [ ] **RIR color**: Matches input color (red/green/blue)
- [ ] **Delete swipe**: Swipe left shows delete option
- [ ] **Delete confirmation**: Alert dialog before deleting
- [ ] **List updates**: Refreshes after add/delete

### Undo Feature
- [ ] **Undo banner**: Appears after saving set (10 second window)
- [ ] **Banner text**: "↩ Desfazer última série (10s)"
- [ ] **Tap undo**: Removes last saved set
- [ ] **Confirmation**: Alert "Desfeito" message
- [ ] **Auto-dismiss**: Banner disappears after 10 seconds
- [ ] **Re-save**: Can save again after undo

### Rest Timer (Bottom Sheet)
- [ ] **Trigger**: Appears automatically after saving strength set
- [ ] **Bottom sheet**: Slides up from bottom (not full screen)
- [ ] **Backdrop**: Dark overlay behind timer
- [ ] **Countdown**: Large timer display (MM:SS)
- [ ] **Status text**: "Descansando..." or "✓ Pronto para próxima série"
- [ ] **Quick actions**:
  - [+30s]: Adds 30 seconds
  - [-10s]: Subtracts 10 seconds
  - [Pular]: Closes timer
- [ ] **Next exercise**: Shows "Próximo: ExerciseName" if available
- [ ] **Finish state**: When timer reaches 0:00, shows ready state
- [ ] **Close on backdrop**: Tapping backdrop closes timer

### History Modal
- [ ] **Open**: Tapping "Histórico" button opens modal
- [ ] **Display**: Shows last 20 sessions
- [ ] **Format**: Date | Weight × Reps | RIR
- [ ] **Close button**: "Fechar" button works
- [ ] **Scrollable**: Can scroll through all history

### Navigation
- [ ] **Next button**: Shows "PRÓXIMO: ExerciseName" if more exercises
- [ ] **Finish button**: Shows "FINALIZAR TREINO" if last exercise
- [ ] **Navigation**: Goes to next exercise or finish screen

---

## 3️⃣ Session Finish Screen (`finish.tsx`)

### Visual Elements
- [ ] **Title**: "Finalizar Treino" with subtitle
- [ ] **Stats card**: Shows sets, exercises, volume
- [ ] **Session timer**: Displays total duration
- [ ] **Weight input**: Large, centered field
- [ ] **Previous weight**: Shows last recorded weight
- [ ] **Weight comparison**: ↑/↓ indicator with color
- [ ] **sRPE slider**: Interactive 1-10 slider
- [ ] **sRPE display**: Large badge with current value
- [ ] **sRPE description**: Shows intensity level
- [ ] **Recovery guidance**: Text based on sRPE value

### Weight Input
- [ ] **Pre-filled**: Shows last weight from bio
- [ ] **Increment buttons**: +0.5 and -0.5 buttons work
- [ ] **Comparison**: Shows diff from previous weight
- [ ] **Green indicator**: ↑ for weight gain
- [ ] **Red indicator**: ↓ for weight loss
- [ ] **Date display**: Shows "Último: DD/MM/YYYY"

### sRPE Selection
- [ ] **Slider**: Works 1-10 range
- [ ] **Descriptions**:
  - 1-4: "Recuperação" to "Moderado"
  - 5-6: "Moderado" to "Intenso"
  - 7-8: "Muito Intenso" to "Extremo"
  - 9-10: "Máximo" to "Falha"
- [ ] **Recovery text**:
  - ≤4: "pode treinar novamente amanhã"
  - ≤6: "recuperação normal"
  - ≤8: "precisa de descanso"
  - >8: "descanse bem"

### Note Templates
- [ ] **Quick insert buttons**: 4 template buttons visible
- [ ] **Templates**:
  - 🍽️ Jejum → "Treino feito em jejum"
  - 😴 Ruim → "Dia ruim, baixa energia"
  - 🏆 PR! → "Recorde pessoal batido!"
  - ❤️ Cardio → "Incluí cardio extra"
- [ ] **Insert action**: Tapping adds text to notes field
- [ ] **Multiple inserts**: Can add multiple templates
- [ ] **Notes field**: Expandable textarea
- [ ] **Character count**: Shows "X caracteres"

### Confirmation
- [ ] **Finish button**: "GERAR RELATÓRIO" button
- [ ] **Confirmation dialog**: Shows summary:
  - Total sets count
  - Total exercises count
  - Total volume in tonnes
  - Body weight
  - sRPE value
- [ ] **Voltar option**: Cancels and returns to screen
- [ ] **Confirm option**: Proceeds to summary
- [ ] **Loading state**: Shows "FINALIZANDO..." during save

---

## 4️⃣ Summary Screen (`summary.tsx`)

### Header
- [ ] **Celebration**: 🎉 emoji displayed
- [ ] **Title**: "Treino Concluído!"
- [ ] **Motivational message**:
  - ≤4: "💪 Ótimo treino leve!"
  - ≤6: "🔥 Treino consistente!"
  - ≤8: "⚡ Trabalho duro!"
  - >8: "🏆 Esforço hercúleo!"

### Stats Dashboard
- [ ] **Stat cards**: 4 cards in grid layout
- [ ] **Sets card**: Shows total sets
- [ ] **Volume card**: Shows volume (k format if >1000)
- [ ] **sRPE card**: Shows final sRPE
- [ ] **Minutes card**: Shows session duration
- [ ] **Card styling**: White background, rounded corners

### Best Performance
- [ ] **PR card**: Visible if sets logged
- [ ] **Title**: "🏆 Melhor Série"
- [ ] **Display**: Shows "Xkg × Y reps"
- [ ] **Exercise name**: Shows which exercise
- [ ] **Golden styling**: Special background color

### Report Section
- [ ] **Title**: "📄 Relatório Completo"
- [ ] **Content**: Scrollable markdown report
- [ ] **Emojis**: Uses 💪, ⚖️, ⏱️, 🔥, 📝
- [ ] **Selectable**: Can select and copy text
- [ ] **Format**: Monospace font, aligned

### Actions
- [ ] **Copy button**: "📋 Copiar Texto" button
- [ ] **Copy feedback**: Changes to "✓ Copiado" briefly
- [ ] **Alert**: Shows "Copiado!" confirmation
- [ ] **Share button**: "📤 Compartilhar" button
- [ ] **Share sheet**: Opens native share dialog
- [ ] **Home button**: "🏠 Voltar ao Início" works
- [ ] **Navigation**: Returns to home screen

---

## 🔧 Technical Tests

### Database Operations
- [ ] **Save set**: Records persist after screen close
- [ ] **Delete set**: Removes from database
- [ ] **Undo save**: Removes last inserted record
- [ ] **Session data**: Persists through all screens
- [ ] **Weight sync**: Saved to body_metrics table

### State Management
- [ ] **Live queries**: Set counts update reactively
- [ ] **Progress bars**: Reflect current state
- [ ] **Timer states**: Clean up on unmount
- [ ] **Undo timeout**: Clears after 10 seconds

### Performance
- [ ] **Smooth animations**: Progress bars, rest timer
- [ ] **No lag**: Lists scroll smoothly
- [ ] **Quick saves**: No UI freeze during database ops
- [ ] **Memory**: No obvious leaks (check after multiple sessions)

---

## 🎨 UI/UX Tests

### Accessibility
- [ ] **Touch targets**: All buttons ≥44pt height
- [ ] **Contrast**: Text readable in both light/dark mode
- [ ] **Color coding**: RIR colors distinguishable
- [ ] **Feedback**: All actions have visual response

### Consistency
- [ ] **Button styles**: Same across all screens
- [ ] **Typography**: Consistent sizing
- [ ] **Spacing**: Consistent padding/margins
- [ ] **Colors**: Theme colors used consistently

### Error Handling
- [ ] **Validation messages**: Clear and helpful
- [ ] **Empty states**: Informative messages
- [ ] **Confirmations**: Destructive actions require confirmation
- [ ] **Recovery**: Can undo mistakes

---

## 🐛 Edge Cases to Test

### Errors
- [ ] **Empty inputs**: Validation prevents save
- [ ] **Negative numbers**: Input validation works
- [ ] **Network offline**: App works without connection
- [ ] **Database errors**: Graceful error handling

### Navigation
- [ ] **Back button**: Hardware back works correctly
- [ ] **Screen rotation**: UI adapts to orientation
- [ ] **App background**: Timer continues when app backgrounded
- [ ] **App close/reopen**: Session state persists

### Data Scenarios
- [ ] **No exercises**: Routine with 0 exercises
- [ ] **Single exercise**: Routine with 1 exercise
- [ ] **Many exercises**: Routine with 10+ exercises
- [ ] **No targets**: Exercises without targets
- [ ] **Long notes**: Notes with 200+ characters

---

## ✅ Completion Criteria

All items in each section must pass for the section to be considered complete:

- [ ] **Exercise Selection**: 100% pass
- [ ] **Exercise Tracking**: 100% pass
- [ ] **Session Finish**: 100% pass
- [ ] **Summary**: 100% pass
- [ ] **Technical**: 100% pass
- [ ] **UI/UX**: 100% pass

---

## 📝 Test Notes

Use this section to document any issues found:

**Date**: ___________
**Tester**: ___________
**Device/Platform**: ___________

**Issues Found**:
1.
2.
3.

**Overall Rating**: ⭐⭐⭐⭐⭐ / 5

**Ready for Merge**: [ ] Yes [ ] No

---

## 🚀 Quick Test Path

For rapid testing, focus on these critical flows:

1. **Create a routine** with 3 exercises (2 strength, 1 duration)
2. **Start session** → verify progress bar shows "0 de 3"
3. **Complete exercise 1** → save 3 sets, verify undo works
4. **Check rest timer** → verify quick actions work
5. **Complete exercise 2** → test swipe-to-delete
6. **Complete exercise 3** → verify duration exercise save
7. **Finish session** → verify stats, weight, sRPE
8. **Check summary** → verify all data displays correctly
9. **Test share** → verify native share works
10. **Return home** → verify session saved properly

This should take ~10-15 minutes and cover all major functionality.

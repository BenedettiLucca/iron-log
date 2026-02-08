# 🧪 Testing Guide - Session Flow UX Overhaul

## ✅ Pre-Flight Checks

All checks passed!

- ✅ **Dependencies installed** (1026 packages)
- ✅ **No TypeScript errors** in new code
- ✅ **Branch pushed** to `feature/session-flow-ux-overhaul`
- ✅ **Commit**: `7156fec`

---

## 🚀 Starting the Development Server

### Option 1: Start Server (Recommended)
```bash
npm start
```
Then in another terminal:
- **Android**: `npm run android`
- **iOS**: `npm run ios`
- **Web**: Press `w` in Expo CLI

### Option 2: Direct Platform Launch
```bash
# Android
npm run android

# iOS (macOS only)
npm run ios

# Web
npm run web
```

---

## 📱 Quick Smoke Test (10 minutes)

### 1. Launch & Setup
- [ ] App launches successfully
- [ ] Navigate to **Rotinas** tab
- [ ] Select an existing routine (or create one with 3+ exercises)

### 2. Exercise Selection Screen
- [ ] Progress bar shows "0 de X exercises"
- [ ] Exercise cards display correctly
- [ ] Tap first exercise → navigates to tracking screen

### 3. Exercise Tracking Screen
**Strength Exercise:**
- [ ] Enter weight (e.g., 60kg)
- [ ] Enter reps (e.g., 12)
- [ ] Adjust RIR slider (should change color)
- [ ] Tap "SALVAR SÉRIE"
- [ ] **Undo banner appears** (10s window)
- [ ] Rest timer slides up as bottom sheet
- [ ] Tap [+30s] → time increases
- [ ] Tap [Pular] → timer closes

**Duration Exercise:**
- [ ] Tap "INICIAR SÉRIE"
- [ ] Timer counts up
- [ ] Tap "PARAR"
- [ ] **Save button appears** (not auto-save!)
- [ ] Tap "SALVAR SÉRIE"

**Set Management:**
- [ ] Saved sets appear in list
- [ ] Swipe left on set → delete option
- [ ] Tap delete → confirmation → set removed

### 4. Finish Screen
- [ ] Stats card shows correct numbers
- [ ] Weight field pre-filled
- [ ] Tap [+0.5] → weight increases
- [ ] sRPE slider works
- [ ] Tap note template (e.g., 🏆 PR!)
- [ ] Text appears in notes field
- [ ] Tap "GERAR RELATÓRIO"
- [ ] **Confirmation dialog appears**
- [ ] Tap "Confirmar"

### 5. Summary Screen
- [ ] 🎉 Celebration visible
- [ ] Stats grid displays correctly
- [ ] Best set card shows (if applicable)
- [ ] Tap "📋 Copiar Texto" → becomes "✓ Copiado"
- [ ] Tap "📤 Compartilhar" → share sheet opens
- [ ] Tap "🏠 Voltar ao Início" → returns home

---

## 🔍 Detailed Testing

For comprehensive testing, see: **TESTING_CHECKLIST.md**

The checklist includes:
- ✅ 150+ individual test cases
- ✅ All 4 session screens covered
- ✅ Technical tests (DB, state, performance)
- ✅ UI/UX tests (accessibility, consistency)
- ✅ Edge cases and error scenarios

---

## 🐛 Known Issues (Pre-existing)

These exist in the codebase but are **NOT related** to our changes:

```
app/(drawer)/bio/index.tsx(128,62): JSX token error
app/(drawer)/index.tsx(133,66): JSX token error
```

These are `>` character issues in existing files and don't affect the session flow.

---

## 📊 Test Results Template

```
Date: ___________
Platform: [ ] Android [ ] iOS [ ] Web
Device: ___________

PASS/FAIL Results:
[ ] Exercise Selection Screen
[ ] Exercise Tracking Screen
[ ] Session Finish Screen
[ ] Summary Screen
[ ] Overall UX

Issues Found:
1.
2.

Rating: ⭐⭐⭐⭐⭐ / 5
Ready for Merge: [ ] YES [ ] NO
```

---

## 🎯 Critical Path Testing

Focus on these **MUST-HAVE** features:

1. ✅ **No auto-save on duration exercises** - explicit button required
2. ✅ **Undo functionality** - 10s window works
3. ✅ **Bottom sheet rest timer** - not full screen
4. ✅ **Progress indicators** - visible throughout
5. ✅ **Swipe-to-delete** - works on saved sets
6. ✅ **Confirmation dialogs** - on finish and delete
7. ✅ **Native share** - opens system share sheet

If all 7 pass → **Ready to merge!** ✅

---

## 🚨 Common Issues & Solutions

**Issue**: "Module not found" error
**Solution**: Run `npm install` again

**Issue**: Metro bundler cache
**Solution**: Run `npx expo start -c`

**Issue**: Android build fails
**Solution**: Run `cd android && ./gradlew clean`

**Issue**: Type errors appear
**Solution**: These are pre-existing, ignore for session flow testing

---

## 📝 After Testing

1. **Document results** in TESTING_CHECKLIST.md
2. **Create GitHub issue** for any bugs found
3. **Update PR** with test results
4. **Request review** if all tests pass
5. **Merge to master** when approved

---

## ✨ Success Criteria

The Session Flow UX Overhaul is successful when:

- ✅ All critical path features work
- ✅ No new regressions introduced
- ✅ UX improvements are noticeable
- ✅ Performance is acceptable
- ✅ Code quality is maintained

**Current Status**: 🟢 Ready for Testing

Good luck! 🚀

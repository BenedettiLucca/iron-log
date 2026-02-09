# Manual Testing Guide

## Quick Start

The development server is running! You can now:

1. **Scan the QR code** in the terminal with Expo Go app (iOS)
2. **Press `a`** to run on Android emulator/device
3. **Press `i`** to run on iOS simulator
4. **Press `w`** to open in web browser

---

## Priority Testing Order

If you're short on time, test these **critical features first** (30 minutes):

### ✅ Phase 1 - Top Priority (15 min)

#### 1. Monthly Notifications (5 min)
- [ ] Open Settings screen
- [ ] Verify "Lembretes de Check-in" section exists
- [ ] Toggle "Ativar Lembretes" to ON
- [ ] Tap "Testar Notificação" button
- [ ] Verify notification appears
- [ ] Tap notification
- [ ] Verify app opens to bio screen

**Expected:** Notification appears, tapping opens bio screen

#### 2. Haptic Feedback (3 min)
- [ ] Press various buttons throughout app
- [ ] Feel tactile response on button press
- [ ] Test danger buttons (delete, clear) - stronger feedback
- [ ] Swipe on SetCard - feedback on swipe actions

**Expected:** All button presses provide haptic feedback

#### 3. Pull-to-Refresh (4 min)
- [ ] Go to Home screen → Pull down to refresh
- [ ] Go to Routines → Pull down to refresh
- [ ] Go to Bio → Pull down to refresh
- [ ] Go to History → Pull down to refresh

**Expected:** Refresh spinner appears, data updates

#### 4. Enhanced Inputs (3 min)
- [ ] Go to any screen with Input fields
- [ ] Tap into input field
- [ ] Verify border animates to primary color (#E07A5F)
- [ ] Verify border returns to normal on blur

**Expected:** Focus animations work smoothly

---

### ✅ Phase 3 - Bio Enhancements (10 min)

#### 5. Streak Tracking (5 min)
- [ ] Go to Bio screen
- [ ] Enter daily weight for 3 consecutive days
- [ ] Check if streak counter shows "3"
- [ ] Skip a day, check if streak resets

**Expected:** Streaks update correctly based on consecutive days

#### 6. Analytics Dashboard (5 min)
- [ ] Go to Bio → Evolution → Analytics (new screens)
- [ ] Check weight change rate calculation
- [ ] Verify trend indicator (📈/📉/➡️)
- [ ] Check average weight display

**Expected:** Analytics calculations are accurate

---

## Full Test Plan Execution

For thorough testing, follow **TEST_PLAN.md** which contains:

- 40+ detailed test cases
- Step-by-step instructions
- Expected results for each test
- Checkbox tracking
- Bug reporting template

---

## Test Tracking

Use this checklist as you test:

### Phase 1: Foundation & Quick Wins
- [ ] 1.1.1 Notification permission request
- [ ] 1.1.2 Notification scheduling
- [ ] 1.1.3 Notification tap deep link
- [ ] 1.1.4 Notification persistence
- [ ] 1.1.5 Notification disabling
- [ ] 1.2.1 Button press haptics
- [ ] 1.2.2 Swipe action haptics
- [ ] 1.2.3 Input focus haptics
- [ ] 1.3.1 Home screen refresh
- [ ] 1.3.2 Routines screen refresh
- [ ] 1.3.3 Bio screen refresh
- [ ] 1.3.4 History calendar refresh
- [ ] 1.4.1 Focus animation
- [ ] 1.4.2 Character counter
- [ ] 1.4.3 Success state

### Phase 2: UI Polish
- [ ] 2.1.1 Card skeleton display
- [ ] 2.1.2 List skeleton
- [ ] 2.2.1 Home screen empty state
- [ ] 2.2.2 Inline empty state
- [ ] 2.3.1 Standard spring animation
- [ ] 2.3.2 Fade duration

### Phase 3: Bio Enhancements
- [ ] 3.1.1 Daily streak calculation
- [ ] 3.1.2 Monthly streak calculation
- [ ] 3.1.3 Average weight display
- [ ] 3.2.1 Create weight goal
- [ ] 3.2.2 Goal progress display
- [ ] 3.2.3 Delete goal
- [ ] 3.3.1 Weight change rate
- [ ] 3.3.2 Trend analysis
- [ ] 3.3.3 Period calculation

### Phase 4: Workout Analytics
- [ ] 4.1.1 Weight PR detection
- [ ] 4.1.2 Reps PR detection
- [ ] 4.1.3 Volume PR detection
- [ ] 4.2.1 Epley formula
- [ ] 4.2.2 Brzycki formula
- [ ] 4.2.3 Average formula
- [ ] 4.3.1 Daily volume calculation
- [ ] 4.3.2 Volume chart display
- [ ] 4.3.3 Volume stats row

---

## Bug Report Template

If you find any issues, use this template:

```markdown
**Bug Title:** [Brief description]

**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Environment:**
- Platform: [iOS/Android/Web]
- Branch: feature/app-elevation
- Device: [Your device]

**Screenshots:** [Attach if applicable]
```

---

## Tips for Efficient Testing

1. **Start Critical:** Test monthly notifications first (your top request)
2. **Use Simulator/Emulator:** Faster than physical device
3. **Test One Phase at a Time:** Complete Phase 1 before moving to Phase 3
4. **Document Issues:** Take screenshots of bugs
5. **Test Happy Paths:** Focus on making sure core features work
6. **Edge Cases:** If time permits, test edge cases (empty data, extreme values)

---

## Success Criteria

The implementation is successful when:

✅ Monthly notifications fire correctly
✅ All haptic feedback works
✅ Pull-to-refresh works on all screens
✅ Input animations are smooth
✅ Streaks calculate accurately
✅ Analytics display correct data
✅ No crashes or major bugs

---

## Current Server Status

**Server:** Running in background (task ID: b14fcd1)
**Status:** Starting Metro Bundler...
**Ready to test:** Yes ✅

---

**Ready when you are!** Let me know if you encounter any bugs or need help testing specific features.

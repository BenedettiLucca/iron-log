# Iron Log - App Elevation Test Plan

## Overview

This document provides a comprehensive testing guide for Phases 1-4 of the Iron Log app elevation implementation.

**Branch:** `feature/app-elevation`
**Test Environment:** Development/Staging
**Target Platforms:** iOS, Android, Web (if applicable)

---

## Pre-Test Setup

### 1. Environment Setup

```bash
# Checkout the feature branch
git checkout feature/app-elevation

# Install dependencies
npm install

# Run database migrations
npx drizzle-kit push

# Start development server
npm start
```

### 2. Test Data Setup

Create test data for comprehensive testing:

**Routines:**
- At least 2 different routines with 3-5 exercises each
- Include different exercise types (strength, duration)

**Historical Sessions:**
- 10+ past sessions spread over 2-3 months
- Varying durations and volumes
- Some with high RPE values

**Body Metrics:**
- Daily weight entries for 30+ days (some gaps)
- At least 3 monthly check-ins with photos
- Varying weights to test trend calculation

### 3. Device Requirements

- **iOS:** iPhone 12 or later (iOS 15+)
- **Android:** Device with Android 8+
- **Permissions:** Notifications, Photos, Camera (for testing)

---

## Phase 1: Foundation & Quick Wins Tests

### 1.1 Monthly Notification System

#### Test Case 1.1.1: Notification Permission Request
**Steps:**
1. Fresh install the app (or clear app data)
2. Launch the app
3. Complete initial setup/migrations

**Expected Result:**
- Notification permission request appears on first launch
- Can allow or deny permissions
- Settings screen reflects permission status

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.1.2: Notification Scheduling
**Steps:**
1. Go to Settings screen
2. Verify "Lembretes de Check-in" section exists
3. Toggle "Ativar Lembretes" to ON
4. Change check-in day to current date (if possible)
5. Change check-in hour to 1 minute from now
6. Wait for notification

**Expected Result:**
- Toggle switch works smoothly
- Settings persist after closing/reopening app
- Notification appears at scheduled time
- Notification title: "📊 Check-in Mensal"
- Notification body: "Hora de registrar suas métricas e progresso!"

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.1.3: Notification Tap Deep Link
**Steps:**
1. Trigger a test notification (use "Testar Notificação" button)
2. Tap the notification when it appears
3. Observe app behavior

**Expected Result:**
- App opens to bio screen
- No errors or crashes
- Smooth transition

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.1.4: Notification Persistence
**Steps:**
1. Set up notification for specific day/time
2. Force close the app completely
3. Restart the app
4. Verify notification settings are retained
5. Check if notification still fires at scheduled time

**Expected Result:**
- All settings preserved
- Notification fires as scheduled

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.1.5: Notification Disabling
**Steps:**
1. Go to Settings
2. Toggle "Ativar Lembretes" to OFF
3. Try to schedule a test notification
4. Verify no notification appears

**Expected Result:**
- Toggle animates smoothly
- All scheduled notifications cancelled
- No notifications fire when disabled

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 1.2 Haptic Feedback System

#### Test Case 1.2.1: Button Press Haptics
**Steps:**
1. Press various buttons throughout the app:
   - Primary buttons (Save, Confirm)
   - Secondary buttons (Cancel, Back)
   - Danger buttons (Delete, Clear)

**Expected Result:**
- Primary buttons: Medium haptic feedback
- Danger buttons: Warning haptic feedback
- Feedback is immediate and feels premium
- All button presses provide tactile response

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.2.2: Swipe Action Haptics
**Steps:**
1. Go to a screen with SetCard (during active workout)
2. Swipe left on a saved set
3. Tap "Editar" button
4. Swipe again
5. Tap "Excluir" button

**Expected Result:**
- Swipe reveals actions smoothly
- Edit button: Medium haptic
- Delete button: Warning haptic
- Actions feel responsive

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.2.3: Input Focus Haptics
**Steps:**
1. Navigate to any screen with Input fields
2. Tap into various input fields
3. Notice haptic feedback

**Expected Result:**
- Selection haptic on focus
- Subtle but noticeable
- Helps confirm field is active

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 1.3 Pull-to-Refresh Functionality

#### Test Case 1.3.1: Home Screen Refresh
**Steps:**
1. Go to Home screen
2. Pull down from top of list
3. Observe refresh indicator
4. Wait for refresh to complete

**Expected Result:**
- Refresh spinner appears in brand color (#E07A5F)
- Smooth loading animation
- Data updates after refresh
- No visual glitches

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.3.2: Routines Screen Refresh
**Steps:**
1. Go to Routines screen
2. Pull down to refresh
3. Verify routine list updates

**Expected Result:**
- Refresh works smoothly
- New routines appear (if added elsewhere)
- No crashes or errors

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.3.3: Bio Screen Refresh
**Steps:**
1. Go to Bio screen
2. Pull down to refresh
3. Verify metrics update

**Expected Result:**
- Refresh indicator appears
- Latest metrics load
- Chart data updates (if visible)

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.3.4: History Calendar Refresh
**Steps:**
1. Go to History screen
2. Pull down to refresh
3. Observe calendar update

**Expected Result:**
- Calendar refreshes smoothly
- Marked dates update
- Session list refreshes

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 1.4 Enhanced Input Component

#### Test Case 1.4.1: Focus Animation
**Steps:**
1. Navigate to any form (e.g., bio check-in)
2. Tap into an input field
3. Observe border color change
4. Tap outside to dismiss
5. Observe border color return to normal

**Expected Result:**
- Border animates to primary color (#E07A5F) on focus
- Transition is smooth (0.2s ease)
- Border returns to normal on blur
- Success state appears if valid

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.4.2: Character Counter
**Steps:**
1. Find an input with maxLength
2. Type characters until limit
3. Observe counter

**Expected Result:**
- Counter shows "X/Y" format
- Updates in real-time
- Positioned in top-right of input
- Visible but not obtrusive

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 1.4.3: Success State
**Steps:**
1. Enter valid data in a required field
2. Observe border color
3. Note any success indicator

**Expected Result:**
- Border turns green (#10B981) when valid
- Success message appears below field
- Clear visual feedback

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Phase 2: UI Polish & Consistency Tests

### 2.1 Skeleton Loaders

#### Test Case 2.1.1: Card Skeleton Display
**Steps:**
1. Create a slow-loading condition (or mock slow data)
2. Navigate to Home screen
3. Observe loading state

**Expected Result:**
- Skeleton cards appear immediately
- Animation is smooth (fade effect)
- Skeleton matches actual card dimensions
- No layout shift when data loads

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 2.1.2: List Skeleton
**Steps:**
1. View Routines list during load
2. Observe skeleton items

**Expected Result:**
- 3 skeleton items show
- Proper spacing
- Smooth animation
- Real data replaces seamlessly

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 2.2 Empty States

#### Test Case 2.1.1: Home Screen Empty State
**Steps:**
1. Clear all routines from database
2. Navigate to Home screen

**Expected Result:**
- Empty state appears with 🏋️ icon
- Title: "Nenhuma rotina encontrada"
- Description provides guidance
- CTA button visible and tappable
- Button leads to routine creation

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 2.2.2: Inline Empty State
**Steps:**
1. Clear all session history
2. Navigate to Home screen

**Expected Result:**
- Inline empty state in "Última Sessão" card
- Icon and brief message
- Less prominent than full-screen empty state

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 2.3 Animation Consistency

#### Test Case 2.3.1: Standard Spring Animation
**Steps:**
1. Trigger various animations throughout app
2. Observe timing and feel

**Expected Result:**
- All spring animations use consistent damping (15)
- Consistent stiffness (150)
- Feel natural and responsive
- No jarring or too-slow animations

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 2.3.2: Fade Duration
**Steps:**
1. Observe fade transitions (screen changes, modal appearances)
2. Note duration

**Expected Result:**
- All fades use 300ms duration
- Consistent across app
- Not too fast or slow

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Phase 3: Bio Tracking Enhancements Tests

### 3.1 Streak Tracking

#### Test Case 3.1.1: Daily Streak Calculation
**Steps:**
1. Enter daily weight for 5 consecutive days
2. Check streak display
3. Skip 2 days
4. Check streak again
5. Enter weight again
6. Verify streak restarts at 1

**Expected Result:**
- Streak shows 5 after consecutive days
- Streak resets to 0 after 2-day gap
- New entry starts streak at 1
- Fire icon (🔥) displays correctly

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 3.1.2: Monthly Streak Calculation
**Steps:**
1. Have at least 3 months of data
2. Ensure consecutive months have entries
3. Check monthly streak

**Expected Result:**
- Correct consecutive month count
- Calendar icon (📅) displays
- Streak updates when month gap exists

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 3.1.3: Average Weight Display
**Steps:**
1. Enter various weights over time
2. Check if average calculates correctly

**Expected Result:**
- Average matches manual calculation
- Displays with 1 decimal place
- Updates in real-time

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 3.2 Goal Setting

#### Test Case 3.2.1: Create Weight Goal
**Steps:**
1. Go to Bio > Goals screen
2. Tap "Nova Meta"
3. Select "Peso (kg)" type
4. Enter target weight (e.g., 75.5)
5. Enter target date (future)
6. Tap "Criar Meta"

**Expected Result:**
- Modal opens smoothly
- Type selection works
- Inputs validate properly
- Goal appears in list
- All data saved correctly

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 3.2.2: Goal Progress Display
**Steps:**
1. Create a weight goal
2. Enter current weight
3. Check goal progress bar

**Expected Result:**
- Progress bar shows completion percentage
- Days remaining calculates correctly
- Visual indicator is accurate

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 3.2.3: Delete Goal
**Steps:**
1. Long-press or swipe a goal
2. Confirm deletion
3. Verify goal removed

**Expected Result:**
- Confirmation dialog appears
- Goal deleted successfully
- List updates immediately

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 3.3 Analytics Dashboard

#### Test Case 3.3.1: Weight Change Rate
**Steps:**
1. Go to Bio > Analytics
2. Check "Variação de Peso" card
3. Compare with manual calculation

**Expected Result:**
- Rate shows in kg/week
- Color-coded (green for gain, red for loss)
- Matches actual data
- Shows + for gains, - for losses

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 3.3.2: Trend Analysis
**Steps:**
1. Review trend section
2. Verify indicator matches rate

**Expected Result:**
- 📈 for gaining weight (>0.1 kg/week)
- 📉 for losing weight (<-0.1 kg/week)
- ➡️ for stable (-0.1 to 0.1 kg/week)
- Description text is accurate

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 3.3.3: Period Calculation
**Steps:**
1. Check "Período" stat
2. Verify month count

**Expected Result:**
- Correct months since first entry
- Updates as data ages

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Phase 4: Workout Analytics Tests

### 4.1 Personal Records

#### Test Case 4.1.1: Weight PR Detection
**Steps:**
1. Complete a workout with heavier weight than usual
2. Finish the session
3. Check if PR badge appears

**Expected Result:**
- PR badge appears on new record set
- Badge shows "PR" with accent color
- Badge animates in
- Record saved to database

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 4.1.2: Reps PR Detection
**Steps:**
1. Complete a set with more reps than previous best
2. Verify REP PR badge appears

**Expected Result:**
- Different badge for rep PR
- Shows "REP PR"
- Correct color (green)

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 4.1.3: Volume PR Detection
**Steps:**
1. Calculate volume (weight × reps)
2. Exceed previous best volume
3. Check for VOL PR badge

**Expected Result:**
- Volume PR detected
- Badge shows "VOL PR"
- Proper color (blue)

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 4.2 1RM Calculator

#### Test Case 4.2.1: Epley Formula
**Steps:**
1. Use calculator with known values:
   - 100kg for 5 reps
   - Expected: ~116.7kg

**Expected Result:**
- Calculation matches Epley formula
- Result displays with 1 decimal
- Used for heavy sets (≤8 reps)

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 4.2.2: Brzycki Formula
**Steps:**
1. Test with lighter weights, higher reps:
   - 60kg for 10 reps
   - Expected: ~78.9kg

**Expected Result:**
- Calculation matches Brzycki
- Appropriate for rep ranges >8

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 4.2.3: Average Formula
**Steps:**
1. Compare average formula result
2. Verify it's between Epley and Brzycki

**Expected Result:**
- Average of both formulas
- More accurate estimation
- Default calculation method

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### 4.3 Volume Tracking

#### Test Case 4.3.1: Daily Volume Calculation
**Steps:**
1. Complete a workout
2. Check volume stats
3. Manually calculate: Σ(weight × reps)

**Expected Result:**
- Volume matches manual calculation
- Updates in real-time
- Displays with comma separators

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 4.3.2: Volume Chart Display
**Steps:**
1. Navigate to analytics/volume section
2. Observe line chart
3. Check data points

**Expected Result:**
- Chart displays 30 days of data
- Smooth line with gradient fill
- Proper Y-axis scaling
- X-axis shows dates
- Tappable data points

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Test Case 4.3.3: Volume Stats Row
**Steps:**
1. Check VolumeStatsRow display
2. Verify all three metrics

**Expected Result:**
- Volume Total: correct sum
- Média Diária: total ÷ days
- Total Séries: count of all sets
- All numbers formatted nicely

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Cross-Feature Integration Tests

### Integration Test 1: Notification → Bio Check-in Flow

**Steps:**
1. Receive monthly check-in notification
2. Tap notification
3. Verify opens to bio screen
4. Complete check-in
5. Verify streak updates

**Expected Result:**
- Smooth flow from notification to action
- All features work together
- Data persists correctly

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Integration Test 2: Workout → PR → Analytics

**Steps:**
1. Complete a workout
2. Set a new PR
3. Finish session
4. Check analytics
5. Verify PR reflected in stats

**Expected Result:**
- PR detected and saved
- Analytics include new data
- Volume chart updates
- All data consistent

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Integration Test 3: Bio Check-in → Streak → Goal Progress

**Steps:**
1. Set a weight goal
2. Complete daily check-in for 5 days
3. Verify streak: 5
4. Check goal progress updates

**Expected Result:**
- Streak increments correctly
- Goal progress calculates
- Both features stay in sync

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Performance Tests

### Performance Test 1: Animation Frame Rate

**Steps:**
1. Use performance monitoring tools
2. Trigger various animations
3. Check frame rate

**Expected Result:**
- All animations run at 60fps
- No dropped frames
- Smooth motion throughout

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Performance Test 2: Large Dataset Handling

**Steps:**
1. Create 100+ sessions
2. Navigate to History screen
3. Check calendar performance
4. Filter by date

**Expected Result:**
- Calendar loads quickly
- Smooth scrolling
- No lag or crashes

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Performance Test 3: Database Query Speed

**Steps:**
1. Time database queries
2. Check: PR detection, volume calculation, streak analysis

**Expected Result:**
- All queries <500ms
- UI remains responsive
- No blocking operations

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Platform-Specific Tests

### iOS-Specific Tests

#### iOS Test 1: Notification Permissions
**Steps:**
1. Test on iOS device
2. Verify permission dialog
3. Test in Settings app

**Expected Result:**
- Native iOS permission dialog
- Can be toggled in iOS Settings
- Works with iOS notification center

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### iOS Test 2: Haptic Feedback
**Steps:**
1. Test various haptics on iPhone
2. Verify feel and intensity

**Expected Result:**
- Uses Taptic Engine appropriately
- Feedback feels premium
- Not too strong or weak

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Android-Specific Tests

#### Android Test 1: Notification Channels
**Steps:**
1. Test on Android device
2. Check notification channel settings
3. Verify notification appearance

**Expected Result:**
- Proper notification channel created
- Notification styled correctly
- Works with Android notification shade

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

#### Android Test 2: Back Button Behavior
**Steps:**
1. Navigate through various screens
2. Use Android back button
3. Verify proper navigation

**Expected Result:**
- Back button works correctly
- No unexpected exits
- Proper stack navigation

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Accessibility Tests

### Accessibility Test 1: Screen Reader Support

**Steps:**
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate through new features
3. Verify labels and hints

**Expected Result:**
- All interactive elements labeled
- PR badges announced
- Charts have descriptions
- Notifications read correctly

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Accessibility Test 2: Color Contrast

**Steps:**
1. Check all new UI elements
2. Verify contrast ratios
3. Test in dark/light mode

**Expected Result:**
- All text WCAG AA compliant
- Good contrast in both themes
- PR badges readable
- Chart lines visible

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Accessibility Test 3: Touch Target Sizes

**Steps:**
1. Measure all interactive elements
2. Verify minimum sizes

**Expected Result:**
- All buttons ≥44px height
- Toggles ≥44px
- Badge tappable areas adequate

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Regression Tests

### Regression Test 1: Existing Functionality

**Steps:**
1. Test all pre-existing features
2. Create/edit/delete routines
3. Complete full workout sessions
4. Use rest timers
5. View history

**Expected Result:**
- All existing features work
- No breaking changes
- Data integrity maintained

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Regression Test 2: Data Migration

**Steps:**
1. Use database from previous version
2. Run migrations
3. Verify all data intact

**Expected Result:**
- All data preserved
- No corruption
- Migrations run smoothly

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Regression Test 3: Backup/Restore

**Steps:**
1. Create database backup
2. Restore from backup
3. Verify all new data types preserved

**Expected Result:**
- New tables included in backup
- Restore works correctly
- No data loss

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Edge Cases

### Edge Case 1: Missing Data

**Steps:**
1. Use app with minimal data
2. Test all new features
3. Verify graceful handling

**Expected Result:**
- No crashes with empty states
- Calculations handle null/undefined
- Proper empty states shown

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Edge Case 2: Extreme Values

**Steps:**
1. Enter extreme weights (0kg, 500kg)
2. Enter extreme rep ranges
3. Test calculations

**Expected Result:**
- Validates input ranges
- Handles gracefully
- No infinite results

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

### Edge Case 3: Time Zones

**Steps:**
1. Change device time zone
2. Test notifications
3. Check date-based calculations

**Expected Result:**
- Notifications fire at correct local time
- Date calculations accurate
- Streaks calculate correctly

**Actual Result:** ☐ Pass / ☐ Fail

**Notes:**

---

## Bug Reporting Template

When reporting bugs, include:

```
**Bug Title:**
[Concise description]

**Steps to Reproduce:**
1.
2.
3.

**Expected Result:**

**Actual Result:**

**Environment:**
- Platform: [iOS/Android/Web]
- OS Version:
- App Version:
- Branch: feature/app-elevation

**Screenshots/Video:**
[Attach if applicable]

**Additional Notes:**
```

---

## Test Execution Log

### Tester: _______________
**Date:** _______________
**Device:** _______________

**Phase 1 Results:**
- Notifications: ☐ Pass ☐ Fail
- Haptics: ☐ Pass ☐ Fail
- Pull-to-Refresh: ☐ Pass ☐ Fail
- Enhanced Inputs: ☐ Pass ☐ Fail

**Phase 2 Results:**
- Skeletons: ☐ Pass ☐ Fail
- Empty States: ☐ Pass ☐ Fail
- Animations: ☐ Pass ☐ Fail

**Phase 3 Results:**
- Streaks: ☐ Pass ☐ Fail
- Goals: ☐ Pass ☐ Fail
- Analytics: ☐ Pass ☐ Fail

**Phase 4 Results:**
- PRs: ☐ Pass ☐ Fail
- 1RM: ☐ Pass ☐ Fail
- Volume: ☐ Pass ☐ Fail

**Overall Result:** ☐ Pass ☐ Fail

**Critical Bugs Found:** _____

**Recommendations:**

______________________

---

## Sign-Off Criteria

✅ All Phase 1-4 test cases pass
✅ No critical bugs
✅ Performance acceptable (60fps animations, <500ms queries)
✅ Platform-specific tests pass
✅ Accessibility requirements met
✅ Regression tests pass
✅ Documentation complete

**Ready for Merge:** ☐ Yes ☐ No

**Approved By:** _______________
**Date:** _______________

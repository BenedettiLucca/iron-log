/**
 * Check-in dirty state detection.
 *
 * Determines whether the user has unsaved changes in the monthly check-in
 * modal so the UI can warn before discarding.
 */

export interface CheckinFormState {
  photos: Record<string, string | null>;
  monthlyData: Record<string, string>;
  photoNotes: Record<string, string>;
}

/** Initial/empty state constants */
const EMPTY_PHOTOS: Record<string, string | null> = {
  front: null,
  back: null,
  side: null,
};

const EMPTY_MEASURES: Record<string, string> = {
  waist: '',
  armRight: '',
  thighRight: '',
  chest: '',
  calf: '',
};

const EMPTY_NOTES: Record<string, string> = {
  front: '',
  back: '',
  side: '',
};

/**
 * Returns true if the form has any user-entered data that hasn't been saved.
 */
export function isCheckinDirty(state: CheckinFormState): boolean {
  // Check photos — any non-null value means user picked something
  for (const key of Object.keys(EMPTY_PHOTOS)) {
    if (state.photos[key] !== null && state.photos[key] !== undefined) {
      return true;
    }
  }

  // Check measurements — any non-empty trimmed string
  for (const key of Object.keys(EMPTY_MEASURES)) {
    const val = state.monthlyData[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return true;
    }
  }

  // Check photo notes — any non-empty trimmed string
  for (const key of Object.keys(EMPTY_NOTES)) {
    const val = state.photoNotes[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return true;
    }
  }

  return false;
}

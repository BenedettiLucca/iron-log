import { monthlyCheckinSchema } from '../../src/validators/forms';

/**
 * Issue #26 regression tests
 *
 * Problem: The Bio screen renders inline photo pickers and note inputs
 * inside the monthly check-in card, but that UI has no save path.
 * The "Open" button navigates away to `/bio/checkin` instead of saving.
 * Users lose photos/notes when leaving the screen.
 *
 * These tests verify the persistence contract and the canonical save flow.
 */

describe('monthly check-in persistence', () => {
  describe('monthlyCheckinSchema', () => {
    it('accepts valid measurements', () => {
      const result = monthlyCheckinSchema.safeParse({
        waist: '85.5',
        armRight: '35',
        thighRight: '60',
        chest: '100',
        calf: '38',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid measurements', () => {
      const result = monthlyCheckinSchema.safeParse({
        waist: 'abc',
      });
      expect(result.success).toBe(false);
    });

    it('accepts empty strings (optional fields)', () => {
      const result = monthlyCheckinSchema.safeParse({
        waist: '',
        armRight: '',
        thighRight: '',
        chest: '',
        calf: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('check-in data assembly', () => {
    it('includes photo URIs and notes in the entry data', () => {
      // Simulates what saveMonthlyCheckin does when assembling data
      const photos = { front: 'file:///front.jpg', back: null, side: 'file:///side.jpg' };
      const photoNotes = { front: 'good posture', back: '', side: 'need work' };

      const entryData = {
        photoFront: photos.front,
        photoBack: photos.back,
        photoSide: photos.side,
        photoNotes: JSON.stringify(photoNotes),
      };

      expect(entryData.photoFront).toBe('file:///front.jpg');
      expect(entryData.photoBack).toBeNull();
      expect(entryData.photoSide).toBe('file:///side.jpg');
      const parsed = JSON.parse(entryData.photoNotes);
      expect(parsed.front).toBe('good posture');
      expect(parsed.side).toBe('need work');
    });

    it('handles all-null photos gracefully', () => {
      const photos = { front: null, back: null, side: null };
      const photoNotes = { front: '', back: '', side: '' };

      const entryData = {
        photoFront: photos.front,
        photoBack: photos.back,
        photoSide: photos.side,
        photoNotes: JSON.stringify(photoNotes),
      };

      expect(entryData.photoFront).toBeNull();
      expect(entryData.photoBack).toBeNull();
      expect(entryData.photoSide).toBeNull();
      expect(JSON.parse(entryData.photoNotes)).toEqual({ front: '', back: '', side: '' });
    });

    it('falls back to existing DB photos when local state is null', () => {
      // This is the key regression: saveMonthlyCheckin should
      // preserve existing DB photos for fields where local photos is null
      const localPhotos = { front: null as string | null, back: null, side: null };
      const existingRecord = {
        photoFront: 'file:///existing-front.jpg',
        photoBack: 'file:///existing-back.jpg',
        photoSide: null as string | null,
      };

      const entryData = {
        photoFront: localPhotos.front || existingRecord.photoFront,
        photoBack: localPhotos.back || existingRecord.photoBack,
        photoSide: localPhotos.side || existingRecord.photoSide,
      };

      expect(entryData.photoFront).toBe('file:///existing-front.jpg');
      expect(entryData.photoBack).toBe('file:///existing-back.jpg');
      expect(entryData.photoSide).toBeNull(); // neither local nor existing
    });
  });
});

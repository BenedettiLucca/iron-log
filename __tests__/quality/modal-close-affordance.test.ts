import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Modal header close affordance contracts (Sprint 11)', () => {
  it('app/(tabs)/bio.tsx modal header close button has explicit visible button affordance', () => {
    const source = read('app/(tabs)/bio.tsx');
    expect(source).toMatch(
      /<Button[\s\S]*?title=\{t\("common\.close"\)\}[\s\S]*?onPress=\{handleCloseModal\}[\s\S]*?variant="secondary"[\s\S]*?size="sm"[\s\S]*?\/>/
    );
  });

  it('app/supplements/index.tsx modal header close button has explicit visible button affordance', () => {
    const source = read('app/supplements/index.tsx');
    expect(source).toMatch(
      /<Button[\s\S]*?title=\{t\('common\.close'\)\}[\s\S]*?onPress=\{requestCloseModal\}[\s\S]*?variant="secondary"[\s\S]*?size="sm"[\s\S]*?disabled=\{isSaving \|\| isDeleting\}[\s\S]*?\/>/
    );
  });

  it('app/bio/goals.tsx modal header close button has explicit visible button affordance', () => {
    const source = read('app/bio/goals.tsx');
    expect(source).toMatch(
      /<Button[\s\S]*?title=\{t\("common\.close"\)\}[\s\S]*?onPress=\{requestCloseModal\}[\s\S]*?variant="secondary"[\s\S]*?size="sm"[\s\S]*?disabled=\{isSaving\}[\s\S]*?\/>/
    );
  });

  it('app/routines/editor.tsx ExercisePickerModal header close button has explicit visible button affordance', () => {
    const source = read('app/routines/editor.tsx');
    expect(source).toMatch(
      /<Button[\s\S]*?title=\{t\("common\.close"\)\}[\s\S]*?onPress=\{onClose\}[\s\S]*?variant="secondary"[\s\S]*?size="sm"[\s\S]*?\/>/
    );
  });

  it('components/RoutinePreview.tsx modal header close button has explicit visible button affordance', () => {
    const source = read('components/RoutinePreview.tsx');
    expect(source).toMatch(
      /<Button[\s\S]*?title=\{t\('common\.close'\)\}[\s\S]*?onPress=\{onClose\}[\s\S]*?variant="secondary"[\s\S]*?size="sm"[\s\S]*?\/>/
    );
  });

  it('preserves ordinary ghost actions without injecting modal close border styling', () => {
    const goalsSource = read('app/bio/goals.tsx');
    const editorSource = read('app/routines/editor.tsx');
    const supplementsSource = read('app/supplements/index.tsx');

    // Goals screen edit action inside card
    const editButtonMatch = goalsSource.match(/<Button[\s\S]*?title=\{t\("common\.edit"\)\}[\s\S]*?\/>/);
    expect(editButtonMatch).not.toBeNull();
    expect(editButtonMatch![0]).toContain('variant="ghost"');
    expect(editButtonMatch![0]).not.toContain('className="bg-background border border-border"');

    // Routine editor add exercise action
    const addExButtonMatch = editorSource.match(/<Button[\s\S]*?title=\{t\("routines\.addExercise"\)\}[\s\S]*?\/>/);
    expect(addExButtonMatch).not.toBeNull();
    expect(addExButtonMatch![0]).toContain('variant="ghost"');
    expect(addExButtonMatch![0]).not.toContain('className="bg-background border border-border"');

    // Supplements delete action
    const deleteButtonMatch = supplementsSource.match(/<Button[\s\S]*?title=\{t\('supplements\.deleteSupplement'\)\}[\s\S]*?\/>/);
    expect(deleteButtonMatch).not.toBeNull();
    expect(deleteButtonMatch![0]).toContain('variant="ghost"');
    expect(deleteButtonMatch![0]).not.toContain('className="bg-background border border-border"');
  });
});

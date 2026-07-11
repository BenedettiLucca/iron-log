import {
  buildRoutineExerciseRows,
  buildRoutineRowsFromTemplate,
  buildSaveAsTemplateValues,
  mapTemplateExercise,
  type TemplateExercise,
} from '@/src/utils/routine-template-integrity';

describe('routine/template integrity helpers', () => {
  it('builds ordered rows from the current editor state', () => {
    expect(buildRoutineExerciseRows(42, [
      { id: 10, target: '3x8-12', notes: 'depth', restSeconds: 120 },
      { id: 20, target: '4x6', notes: 'pause', restSeconds: 90 },
    ])).toEqual([
      {
        routineId: 42,
        exerciseId: 10,
        orderIndex: 1,
        target: '3x8-12',
        notes: 'depth',
        restSeconds: 120,
      },
      {
        routineId: 42,
        exerciseId: 20,
        orderIndex: 2,
        target: '4x6',
        notes: 'pause',
        restSeconds: 90,
      },
    ]);
  });

  it('builds the save-as-template update from current form fields', () => {
    expect(buildSaveAsTemplateValues('Upper Body', 'Push + pull')).toEqual({
      name: 'Upper Body',
      description: 'Push + pull',
      isTemplate: true,
    });
  });

  it('maps the real joined exercise name and nullable metadata', () => {
    expect(mapTemplateExercise({
      exerciseId: 7,
      name: 'Bench Press',
      target: null,
      notes: 'pause',
      restSeconds: null,
      orderIndex: 3,
    })).toEqual({
      exerciseId: 7,
      name: 'Bench Press',
      target: '',
      notes: 'pause',
      restSeconds: null,
      orderIndex: 3,
    });
  });

  it('preserves template exercise order and fields when creating a routine', () => {
    const templateExercises: TemplateExercise[] = [
      {
        exerciseId: 10,
        name: 'Squat',
        target: '3x8',
        notes: 'depth',
        restSeconds: 120,
        orderIndex: 4,
      },
      {
        exerciseId: 20,
        name: 'Bench',
        target: '4x6',
        notes: '',
        restSeconds: 90,
        orderIndex: 9,
      },
    ];

    expect(buildRoutineRowsFromTemplate(99, templateExercises)).toEqual([
      {
        routineId: 99,
        exerciseId: 10,
        orderIndex: 1,
        target: '3x8',
        notes: 'depth',
        restSeconds: 120,
      },
      {
        routineId: 99,
        exerciseId: 20,
        orderIndex: 2,
        target: '4x6',
        notes: '',
        restSeconds: 90,
      },
    ]);
  });
});

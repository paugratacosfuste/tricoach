import { describe, it, expect } from 'vitest';
import { mapWeekFeedbackRows } from '../loadPlanHelpers';

describe('mapWeekFeedbackRows', () => {
  it('returns empty map when given an empty list', () => {
    expect(mapWeekFeedbackRows([])).toEqual({});
  });

  it('maps a single row keyed by week_id', () => {
    const rows = [
      {
        week_id: 'week-1',
        overall_feeling: 'good',
        physical_issues: ['knee'],
        notes: 'felt strong on long ride',
        next_week_constraints: 'travel Wed-Fri',
      },
    ];
    expect(mapWeekFeedbackRows(rows)).toEqual({
      'week-1': {
        overallFeeling: 'good',
        physicalIssues: ['knee'],
        notes: 'felt strong on long ride',
        nextWeekConstraints: 'travel Wed-Fri',
      },
    });
  });

  it('coerces null physical_issues / notes / constraints to safe defaults', () => {
    const rows = [
      {
        week_id: 'week-2',
        overall_feeling: 'tired',
        physical_issues: null,
        notes: null,
        next_week_constraints: null,
      },
    ];
    const result = mapWeekFeedbackRows(rows);
    expect(result['week-2']).toEqual({
      overallFeeling: 'tired',
      physicalIssues: [],
      notes: '',
      nextWeekConstraints: undefined,
    });
  });

  it('falls back to overallFeeling="okay" when row stores an unexpected value', () => {
    const rows = [
      {
        week_id: 'week-3',
        overall_feeling: 'mediocre', // not in WeekFeeling union
        physical_issues: [],
        notes: '',
        next_week_constraints: null,
      },
    ];
    expect(mapWeekFeedbackRows(rows)['week-3'].overallFeeling).toBe('okay');
  });

  it('keeps the latest row when multiple feedback rows share a week_id', () => {
    const rows = [
      {
        week_id: 'week-4',
        overall_feeling: 'okay',
        physical_issues: [],
        notes: 'first',
        next_week_constraints: null,
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        week_id: 'week-4',
        overall_feeling: 'great',
        physical_issues: [],
        notes: 'second',
        next_week_constraints: null,
        created_at: '2026-01-02T00:00:00Z',
      },
    ];
    const result = mapWeekFeedbackRows(rows);
    expect(result['week-4'].overallFeeling).toBe('great');
    expect(result['week-4'].notes).toBe('second');
  });
});

import type { WeekFeedback, WeekFeeling } from '@/types/training';

const VALID_FEELINGS: readonly WeekFeeling[] = ['struggling', 'tired', 'okay', 'good', 'great'];

interface WeekFeedbackRow {
  week_id: string;
  overall_feeling: string | null;
  physical_issues: string[] | null;
  notes: string | null;
  next_week_constraints: string | null;
  created_at?: string | null;
}

function isValidFeeling(value: unknown): value is WeekFeeling {
  return typeof value === 'string' && (VALID_FEELINGS as readonly string[]).includes(value);
}

function rowToFeedback(row: WeekFeedbackRow): WeekFeedback {
  return {
    overallFeeling: isValidFeeling(row.overall_feeling) ? row.overall_feeling : 'okay',
    physicalIssues: Array.isArray(row.physical_issues) ? row.physical_issues : [],
    notes: row.notes ?? '',
    nextWeekConstraints: row.next_week_constraints ?? undefined,
  };
}

/**
 * Build a `week_id -> WeekFeedback` lookup from raw `week_feedback` Supabase
 * rows. When multiple rows share a `week_id`, the latest by `created_at` wins
 * (rows without `created_at` are treated as oldest). Used by
 * `loadPlanFromSupabase` to rehydrate real feedback instead of hardcoded
 * defaults — see Discovered debt D6.
 */
export function mapWeekFeedbackRows(rows: WeekFeedbackRow[]): Record<string, WeekFeedback> {
  const latestByWeekId: Record<string, WeekFeedbackRow> = {};
  for (const row of rows) {
    const existing = latestByWeekId[row.week_id];
    if (!existing) {
      latestByWeekId[row.week_id] = row;
      continue;
    }
    const existingTime = existing.created_at ? Date.parse(existing.created_at) : 0;
    const candidateTime = row.created_at ? Date.parse(row.created_at) : 0;
    if (candidateTime >= existingTime) {
      latestByWeekId[row.week_id] = row;
    }
  }

  const result: Record<string, WeekFeedback> = {};
  for (const [weekId, row] of Object.entries(latestByWeekId)) {
    result[weekId] = rowToFeedback(row);
  }
  return result;
}

export const DEFAULT_REHYDRATED_FEEDBACK: WeekFeedback = {
  overallFeeling: 'okay',
  physicalIssues: [],
  notes: '',
};

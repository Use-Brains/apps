import type { StudyMode } from '@/types/api';

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  flip: 'Flip Cards',
  multiple_choice: 'Multiple Choice',
  type_answer: 'Type Answer',
  match: 'Match',
};

export const STUDY_MODE_MIN_CARDS: Record<StudyMode, number> = {
  flip: 1,
  multiple_choice: 4,
  type_answer: 1,
  match: 6,
};

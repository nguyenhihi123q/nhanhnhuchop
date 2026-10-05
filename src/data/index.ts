// Điểm vào dữ liệu: gộp các bộ mẫu thành QuestionSet để seed lần đầu.
import type { Question, QuestionSet } from '../domain/types';
import { makeSet, type SeedRow } from './seed-format';
import { SET_1_ROWS } from './seeds-set1';
import { SET_2_ROWS } from './seeds-set2';
import { SET_3_ROWS } from './seeds-set3';
import { SET_4_ROWS } from './seeds-set4';
import { SET_TIEBREAK_ROWS } from './seeds-set5';

export type SeedSetDefinition = {
  key: string;
  title: string;
  description: string;
  rows: SeedRow[];
};

/** Bốn bộ chính: gộp lại đủ ≥120 câu, mỗi đội có thể nhận 30 câu. */
export const MAIN_SET_DEFS: SeedSetDefinition[] = [
  {
    key: 'set-1',
    title: 'Nhanh như chớp — Bộ 1 (Tổng hợp xanh)',
    description: 'Câu hỏi nền tảng về sống xanh, tiết kiệm tài nguyên và ứng phó thiên tai.',
    rows: SET_1_ROWS,
  },
  {
    key: 'set-2',
    title: 'Nhanh như chớp — Bộ 2 (Rác thải và tái chế)',
    description: 'Phân loại rác, tái chế, giảm rác nhựa và tiêu dùng bền vững.',
    rows: SET_2_ROWS,
  },
  {
    key: 'set-3',
    title: 'Nhanh như chớp — Bộ 3 (Năng lượng và khí hậu)',
    description: 'Tiết kiệm năng lượng, năng lượng tái tạo và biến đổi khí hậu.',
    rows: SET_3_ROWS,
  },
  {
    key: 'set-4',
    title: 'Nhanh như chớp — Bộ 4 (Hành động học sinh)',
    description: 'Việc làm cụ thể của học sinh ở lớp, ở nhà và ngoài cộng đồng.',
    rows: SET_4_ROWS,
  },
];

/** Bộ phụ dùng phân định đồng hạng; tách riêng khỏi bộ chính. */
export const TIEBREAK_SET_DEF: SeedSetDefinition = {
  key: 'set-tiebreak',
  title: 'Câu phụ — Phân định đồng hạng',
  description: 'Bộ câu khó dùng khi hai hay nhiều đội đồng điểm; không dùng cho vòng chính.',
  rows: SET_TIEBREAK_ROWS,
};

export const TOTAL_MAIN_QUESTIONS = MAIN_SET_DEFS.reduce((sum, d) => sum + d.rows.length, 0);

function defToSet(def: SeedSetDefinition): QuestionSet {
  return makeSet(def.title, def.description, def.rows);
}

/** Tạo đủ các bộ mẫu (chính + phụ) để seed một lần vào IndexedDB. */
export function buildSeedSets(): QuestionSet[] {
  return [...MAIN_SET_DEFS.map(defToSet), defToSet(TIEBREAK_SET_DEF)];
}

/** Trả về bộ câu phụ đã seed (dò theo tiêu đề) nếu có, nếu không thì tạo mới. */
export function findTiebreakSet(sets: QuestionSet[]): QuestionSet | null {
  return sets.find((s) => s.title === TIEBREAK_SET_DEF.title) ?? null;
}

/** Gộp câu hỏi của mọi bộ chính (trừ bộ phụ) để chia chung. */
export function collectMainQuestions(sets: QuestionSet[]): Question[] {
  const tieTitle = TIEBREAK_SET_DEF.title;
  return sets.filter((s) => s.title !== tieTitle).flatMap((s) => s.questions);
}

import { uid } from '../domain/ids';
import {
  DEFAULT_TOPIC,
  SCHEMA_VERSION,
  type Difficulty,
  type Question,
  type QuestionSet,
} from '../domain/types';

/**
 * Định dạng rút gọn cho câu hỏi mẫu: [nội dung, A, B, C, D, đáp án, giải thích, chủ đề, độ khó].
 * Đáp án là chỉ số 0–3. Giúp nguồn dữ liệu gọn và dễ rà soát.
 */
export type SeedRow = [
  string,
  string,
  string,
  string,
  string,
  0 | 1 | 2 | 3,
  string,
  string,
  Difficulty,
];

export function rowsToQuestions(rows: SeedRow[]): Question[] {
  return rows.map((row) => {
    const options = [row[1], row[2], row[3], row[4]].map((text) => ({ id: uid('opt'), text }));
    return {
      id: uid('q'),
      text: row[0],
      options: [options[0], options[1], options[2], options[3]],
      correctOptionId: options[row[5]].id,
      explanation: row[6],
      topic: row[7] || DEFAULT_TOPIC,
      difficulty: row[8],
    } as Question;
  });
}

export function makeSet(
  title: string,
  description: string,
  rows: SeedRow[],
): QuestionSet {
  const now = new Date().toISOString();
  return {
    id: uid('set'),
    schemaVersion: SCHEMA_VERSION,
    title,
    description,
    questions: rowsToQuestions(rows),
    createdAt: now,
    updatedAt: now,
  };
}

import {
  compareKey,
  normalizeText,
} from './ids';
import {
  DEFAULT_TOPIC,
  DIFFICULTIES,
  LIMITS,
  type Difficulty,
  type Option,
  type Question,
  type QuestionSet,
  SCHEMA_VERSION,
} from './types';
import { uid } from './ids';

export type FieldIssue = { field: string; message: string };

export type QuestionDraft = {
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  topic: string;
  difficulty: Difficulty;
};

export type ValidationResult =
  | { ok: true; question: Question }
  | { ok: false; issues: FieldIssue[] };

/** Kiểm tra một bản nháp câu hỏi. Trả về câu đã chuẩn hóa hoặc danh sách lỗi. */
export function validateDraft(draft: QuestionDraft, existingId?: string): ValidationResult {
  const issues: FieldIssue[] = [];
  const text = normalizeText(draft.text);
  if (!text) issues.push({ field: 'text', message: 'Nội dung câu hỏi không được để trống.' });
  else if (text.length > LIMITS.questionText)
    issues.push({ field: 'text', message: `Nội dung tối đa ${LIMITS.questionText} ký tự.` });

  const normalizedOptions = draft.options.map((o) => normalizeText(o));
  const seen = new Map<string, number>();
  normalizedOptions.forEach((opt, index) => {
    const field = `option${index}`;
    if (!opt) {
      issues.push({ field, message: 'Đáp án không được để trống.' });
      return;
    }
    if (opt.length > LIMITS.optionText)
      issues.push({ field, message: `Đáp án tối đa ${LIMITS.optionText} ký tự.` });
    const key = compareKey(opt);
    if (seen.has(key)) {
      issues.push({ field, message: 'Đáp án trùng với một lựa chọn khác.' });
    } else {
      seen.set(key, index);
    }
  });

  if (draft.correctIndex < 0 || draft.correctIndex > 3)
    issues.push({ field: 'correctIndex', message: 'Phải chọn một đáp án đúng.' });

  const explanation = normalizeText(draft.explanation);
  if (explanation.length > LIMITS.explanation)
    issues.push({ field: 'explanation', message: `Giải thích tối đa ${LIMITS.explanation} ký tự.` });

  const topic = normalizeText(draft.topic) || DEFAULT_TOPIC;
  if (topic.length > LIMITS.topic)
    issues.push({ field: 'topic', message: `Chủ đề tối đa ${LIMITS.topic} ký tự.` });

  if (!DIFFICULTIES.includes(draft.difficulty))
    issues.push({ field: 'difficulty', message: 'Độ khó không hợp lệ.' });

  if (issues.length > 0) return { ok: false, issues };

  const options: [Option, Option, Option, Option] = [
    { id: uid('opt'), text: normalizedOptions[0] },
    { id: uid('opt'), text: normalizedOptions[1] },
    { id: uid('opt'), text: normalizedOptions[2] },
    { id: uid('opt'), text: normalizedOptions[3] },
  ];

  return {
    ok: true,
    question: {
      id: existingId ?? uid('q'),
      text,
      options,
      correctOptionId: options[draft.correctIndex].id,
      explanation,
      topic,
      difficulty: draft.difficulty,
    },
  };
}

export function emptyDraft(): QuestionDraft {
  return {
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
    topic: DEFAULT_TOPIC,
    difficulty: 'vua',
  };
}

export function draftFromQuestion(q: Question): QuestionDraft {
  const idx = q.options.findIndex((o) => o.id === q.correctOptionId);
  return {
    text: q.text,
    options: [
      q.options[0].text,
      q.options[1].text,
      q.options[2].text,
      q.options[3].text,
    ],
    correctIndex: (idx >= 0 ? idx : 0) as 0 | 1 | 2 | 3,
    explanation: q.explanation,
    topic: q.topic,
    difficulty: q.difficulty,
  };
}

export function createQuestionSet(title: string, description = ''): QuestionSet {
  const now = new Date().toISOString();
  return {
    id: uid('set'),
    schemaVersion: SCHEMA_VERSION,
    title: normalizeText(title),
    description: normalizeText(description),
    questions: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Chuẩn hóa tên đáp án theo chữ cái A/B/C/D. */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

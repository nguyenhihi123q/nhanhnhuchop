// Đọc/ghi dữ liệu qua repository; validate trước khi dùng; seed một lần.
import { SCHEMA_VERSION, type Question, type QuestionSet } from '../../domain/types';
import { normalizeText } from '../../domain/ids';
import {
  deleteSession,
  deleteSet,
  getAllSessions,
  getAllSets,
  getMeta,
  putSession,
  putSet,
  replaceAllSets,
  setMeta,
} from './db';
import { migrateAllSets } from './migrations';

const SEED_FLAG = 'seeded-master-set';

export type ValidationOutcome =
  | { status: 'valid' }
  | { status: 'fixed'; set: QuestionSet; notes: string[] }
  | { status: 'invalid'; reason: string };

/** Kiểm tra cấu trúc một bộ câu hỏi; sửa nhẹ khi thiếu trường không bắt buộc. */
export function validateSet(raw: unknown): ValidationOutcome {
  if (!raw || typeof raw !== 'object') return { status: 'invalid', reason: 'Dữ liệu không phải đối tượng.' };
  const obj = raw as Partial<QuestionSet>;
  if (typeof obj.title !== 'string' || normalizeText(obj.title) === '')
    return { status: 'invalid', reason: 'Thiếu tên bộ câu hỏi.' };
  if (!Array.isArray(obj.questions)) return { status: 'invalid', reason: 'Danh sách câu hỏi không hợp lệ.' };

  const notes: string[] = [];
  const questions: Question[] = [];
  for (const q of obj.questions) {
    const candidate = q as Partial<Question>;
    if (
      !candidate ||
      typeof candidate.id !== 'string' ||
      typeof candidate.text !== 'string' ||
      !Array.isArray(candidate.options) ||
      candidate.options.length !== 4 ||
      typeof candidate.correctOptionId !== 'string'
    ) {
      notes.push('Bỏ qua một câu hỏi thiếu trường bắt buộc.');
      continue;
    }
    const optionIds = candidate.options.map((o) => o.id);
    if (!optionIds.includes(candidate.correctOptionId)) {
      notes.push('Bỏ qua một câu hỏi có đáp án đúng không nằm trong lựa chọn.');
      continue;
    }
    questions.push({
      id: candidate.id,
      text: candidate.text,
      options: candidate.options as Question['options'],
      correctOptionId: candidate.correctOptionId,
      explanation: typeof candidate.explanation === 'string' ? candidate.explanation : '',
      topic: typeof candidate.topic === 'string' && candidate.topic ? candidate.topic : 'Chung',
      difficulty:
        candidate.difficulty === 'de' || candidate.difficulty === 'kho' ? candidate.difficulty : 'vua',
    });
  }

  const now = new Date().toISOString();
  const set: QuestionSet = {
    id: typeof obj.id === 'string' ? obj.id : `set_${Date.now()}`,
    schemaVersion: typeof obj.schemaVersion === 'number' ? obj.schemaVersion : SCHEMA_VERSION,
    title: normalizeText(obj.title),
    description: typeof obj.description === 'string' ? obj.description : '',
    questions,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
  };

  return notes.length > 0 ? { status: 'fixed', set, notes } : { status: 'valid' };
}

export async function listSets(): Promise<QuestionSet[]> {
  const raw = await getAllSets();
  return migrateAllSets(raw).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveSet(set: QuestionSet): Promise<void> {
  const next: QuestionSet = { ...set, schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString() };
  await putSet(next);
}

export async function removeSet(id: string): Promise<void> {
  await deleteSet(id);
}

export async function overwriteSets(sets: QuestionSet[]): Promise<void> {
  await replaceAllSets(sets.map((s) => ({ ...s, schemaVersion: SCHEMA_VERSION })));
}

export async function listSessions() {
  return (await getAllSessions()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveSession(session: import('../../domain/session').Session): Promise<void> {
  await putSession(session);
}

export async function removeSession(id: string): Promise<void> {
  await deleteSession(id);
}

export async function hasSeeded(): Promise<boolean> {
  return (await getMeta<boolean>(SEED_FLAG)) === true;
}

export async function markSeeded(): Promise<void> {
  await setMeta(SEED_FLAG, true);
}

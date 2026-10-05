// Nhanh như chớp – Vòng tinh hoa
// Mô hình dữ liệu cốt lõi (schema).
// Xem mục 9 trong HUONG_DAN_AGENT_XAY_DUNG_NHANH_NHU_CHOP_TINH_HOA.md

export const SCHEMA_VERSION = 1;

export type Difficulty = 'de' | 'vua' | 'kho';

export type Option = { id: string; text: string };

/** Đúng 4 lựa chọn, 1 đáp án đúng tham chiếu theo id ổn định. */
export type Question = {
  id: string;
  text: string;
  options: [Option, Option, Option, Option];
  correctOptionId: string;
  explanation: string;
  topic: string;
  difficulty: Difficulty;
};

export type QuestionSet = {
  id: string;
  schemaVersion: number;
  title: string;
  description: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  de: 'Dễ',
  vua: 'Vừa',
  kho: 'Khó',
};

export const DIFFICULTIES: Difficulty[] = ['de', 'vua', 'kho'];

export const DEFAULT_TOPIC = 'Chung';

// Giới hạn theo đặc tả (mục 8).
export const LIMITS = {
  questionText: 240,
  optionText: 120,
  explanation: 500,
  topic: 80,
  maxQuestionsPerImport: 2000,
  maxImportFileBytes: 5 * 1024 * 1024,
  minQuestionsPerTeam: 10,
  recommendedQuestionsPerTeam: 30,
} as const;

export type GameConfig = {
  durationSeconds: number;
  pointsPerCorrect: number;
};

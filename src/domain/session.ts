// Cấu hình phiên thi, đội, phân bổ câu hỏi và kết quả.
import { uid } from './ids';
import { mulberry32, randomSeed, shuffle, type Rng } from './shuffle';
import type { Difficulty, Question } from './types';

export type TeamColor = 'green' | 'blue' | 'orange' | 'purple' | 'teal' | 'pink' | 'red' | 'amber';

export const TEAM_COLOR_PALETTE: { value: TeamColor; label: string; hex: string }[] = [
  { value: 'green', label: 'Xanh lá', hex: '#16a34a' },
  { value: 'blue', label: 'Xanh dương', hex: '#2563eb' },
  { value: 'orange', label: 'Cam', hex: '#ea580c' },
  { value: 'purple', label: 'Tím', hex: '#7c3aed' },
  { value: 'teal', label: 'Xanh ngọc', hex: '#0d9488' },
  { value: 'pink', label: 'Hồng', hex: '#db2777' },
  { value: 'red', label: 'Đỏ', hex: '#dc2626' },
  { value: 'amber', label: 'Hổ phách', hex: '#d97706' },
];

export type Team = {
  id: string;
  name: string;
  color: TeamColor;
  representatives: string[];
  /** Bộ câu hỏi riêng cho đội này (null nếu dùng phân bổ). */
  setId: string | null;
  /** Danh sách câu đã phân cho đội (thứ tự có thể đã/không đảo). */
  questionIds: string[];
};

export type SessionConfig = {
  id: string;
  name: string;
  durationSeconds: number;
  /** Điểm cộng cho mỗi câu trả lời đúng (mặc định 10). */
  pointsPerCorrect: number;
  teams: Team[];
  /** Bản snapshot câu hỏi tách biệt khỏi thư viện để sửa thư viện không ảnh hưởng phiên. */
  questionSnapshot: Record<string, Question>;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  seed: number;
  createdAt: string;
};

export type AnswerOutcome = 'correct' | 'wrong';

export type AnswerLogEntry = {
  id: string;
  roundId: string;
  questionInstanceId: string;
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  outcome: AnswerOutcome;
  atMs: number;
  elapsedMs: number;
};

export type RoundResult = {
  roundId: string;
  teamId: string;
  teamName: string;
  score: number;
  correctCount: number;
  wrongCount: number;
  cancelledCount: number;
  answeredCount: number;
  endedReason: 'time' | 'exhausted' | 'manual';
  actualDurationMs: number;
  remainingMs: number;
  logs: AnswerLogEntry[];
  /** Điểm có được tính vào xếp hạng hay không (chơi lại làm bản cũ không tính). */
  counted: boolean;
};

export type TiebreakOutcome = {
  id: string;
  questionId: string;
  attempts: { teamId: string; selectedOptionId: string | null; correct: boolean }[];
  atMs: number;
};

export type Session = {
  id: string;
  name: string;
  createdAt: string;
  config: SessionConfig;
  rounds: RoundResult[];
  tiebreaks: TiebreakOutcome[];
  finalized: boolean;
};

export function createTeam(index: number): Team {
  const color = TEAM_COLOR_PALETTE[index % TEAM_COLOR_PALETTE.length];
  return {
    id: uid('team'),
    name: `Đội ${index + 1}`,
    color: color.value,
    representatives: [''],
    setId: null,
    questionIds: [],
  };
}

export function defaultTeams(): Team[] {
  const names = ['Xanh', 'Nước', 'Lá', 'Mặt Trời'];
  const colors: TeamColor[] = ['green', 'blue', 'teal', 'amber'];
  return Array.from({ length: 4 }, (_, i) => ({
    id: uid('team'),
    name: `Đội ${names[i]}`,
    color: colors[i],
    representatives: [''],
    setId: null,
    questionIds: [],
  }));
}

export function createSessionConfig(
  name: string,
  teams: Team[],
  durationSeconds: number,
  snapshot: Record<string, Question>,
  shuffleQuestions: boolean,
  shuffleOptions: boolean,
  pointsPerCorrect = 10,
  seed = randomSeed(),
): SessionConfig {
  return {
    id: uid('session'),
    name,
    durationSeconds,
    pointsPerCorrect,
    teams,
    questionSnapshot: snapshot,
    shuffleQuestions,
    shuffleOptions,
    seed,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Phân bổ câu hỏi cho các đội theo nhóm chủ đề/độ khó để cân đối.
 * Số câu mỗi đội bằng nhau; lưu seed để truy vết và tái lập.
 */
export type AllocationInput = {
  teams: Team[];
  questionsBySet: Record<string, Question[]>;
  useShared: boolean;
  sharedSetId: string | null;
  distributeFromShared: boolean;
  questionsPerTeam: number;
  seed: number;
};

export type AllocationResult = {
  teamQuestionIds: Record<string, string[]>;
  /** Phần dư chưa dùng khi chia từ một bộ chung. */
  leftover: Question[];
  snapshot: Record<string, Question>;
  seed: number;
};

function sortByStratum(questions: Question[], rng: Rng): Question[] {
  // Nhóm theo topic|difficulty để phân tầng đều, rồi xáo trong từng nhóm.
  const buckets = new Map<string, Question[]>();
  for (const q of questions) {
    const key = `${q.topic}::${q.difficulty}`;
    const arr = buckets.get(key) ?? [];
    arr.push(q);
    buckets.set(key, arr);
  }
  const ordered: Question[] = [];
  // Lấy luân phiên từng nhóm (round-robin) để tạo phân tầng ổn định.
  const groups = shuffle([...buckets.values()], rng).map((g) => shuffle(g, rng));
  let more = true;
  while (more) {
    more = false;
    for (const group of groups) {
      const next = group.shift();
      if (next) {
        ordered.push(next);
        more = true;
      }
    }
  }
  return ordered;
}

export function allocateQuestions(input: AllocationInput): AllocationResult {
  const rng = mulberry32(input.seed);
  const snapshot: Record<string, Question> = {};
  const teamQuestionIds: Record<string, string[]> = {};
  let leftover: Question[] = [];

  if (input.distributeFromShared && input.sharedSetId) {
    const pool = input.questionsBySet[input.sharedSetId] ?? [];
    for (const q of pool) snapshot[q.id] = q;
    const ordered = sortByStratum(pool, rng);
    const perTeam = input.questionsPerTeam;
    let cursor = 0;
    for (const team of input.teams) {
      const slice = ordered.slice(cursor, cursor + perTeam);
      cursor += perTeam;
      teamQuestionIds[team.id] = slice.map((q) => q.id);
    }
    leftover = ordered.slice(cursor);
  } else {
    const usedAcrossTeams = new Set<string>();
    for (const team of input.teams) {
      const set = team.setId ? input.questionsBySet[team.setId] ?? [] : [];
      const fresh = set.filter((q) => !usedAcrossTeams.has(q.id));
      // Nếu cùng bộ được dùng cho nhiều đội, cắt theo số câu nhưng không lặp lại.
      const picked = fresh.slice(0, input.questionsPerTeam);
      for (const q of picked) {
        usedAcrossTeams.add(q.id);
        snapshot[q.id] = q;
      }
      teamQuestionIds[team.id] = picked.map((q) => q.id);
    }
  }

  return { teamQuestionIds, leftover, snapshot, seed: input.seed };
}

/** Thống kê nhanh một danh sách câu để hiển thị cảnh báo chất lượng. */
export function summarizeQuestions(questions: Question[]) {
  const byDifficulty: Record<Difficulty, number> = { de: 0, vua: 0, kho: 0 };
  const byTopic = new Map<string, number>();
  for (const q of questions) {
    byDifficulty[q.difficulty] += 1;
    byTopic.set(q.topic, (byTopic.get(q.topic) ?? 0) + 1);
  }
  return { total: questions.length, byDifficulty, topics: [...byTopic.entries()] };
}



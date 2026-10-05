// Bộ máy lượt thi (engine) — thuần khiết, tách khỏi UI.
// Thời gian lấy từ ngoài (nowMs) để kiểm thử bằng đồng hồ giả.
// Xem mục 6 trong đặc tả: trạng thái, đồng hồ/input, hết câu, câu lỗi, chơi lại.
import { uid } from '../../domain/ids';
import { mulberry32, shuffle } from '../../domain/shuffle';
import type {
  AnswerLogEntry,
  RoundResult,
  SessionConfig,
  Team,
  TiebreakOutcome,
} from '../../domain/session';
import type { Question } from '../../domain/types';

export type EnginePhase =
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'feedback'
  | 'paused'
  | 'roundResult'
  | 'finalResult'
  | 'tiebreak';

export const FEEDBACK_MS = 450;
export const COUNTDOWN_MS = 3000;
export const TIMEBREAK_DISCUSS_MS = 10000;

export type QuestionInstance = {
  id: string;
  questionId: string;
  /** Thứ tự đáp án đang hiển thị (theo id ổn định, không theo A/B/C/D). */
  optionOrder: string[];
  correctOptionId: string;
  answered: boolean;
};

export type RoundEndReason = 'time' | 'exhausted' | 'manual';

export type TiebreakState = {
  questionId: string;
  participatingTeamIds: string[];
  /** Đáp án giáo viên nhập cho từng đội (null = "Không trả lời"). */
  selections: Record<string, string | null>;
  deadlineMs: number;
  resolved: boolean;
  winners: string[];
  eliminated: string[];
};

export type ScoreAdjustment = {
  id: string;
  delta: number;
  reason: string;
  atMs: number;
};

export type EngineState = {
  phase: EnginePhase;
  /** Trạng thái trước khi tạm dừng (null nếu không tạm dừng). */
  pausedFrom: EnginePhase | null;
  config: SessionConfig;
  nowMs: number;

  // Lượt hiện tại
  roundIndex: number;
  roundId: string;
  team: Team;
  instanceIds: string[];
  instances: Record<string, QuestionInstance>;
  currentIndex: number;
  score: number;
  correctCount: number;
  wrongCount: number;
  cancelledCount: number;
  answeredCurrent: boolean;
  roundStarted: boolean;

  // Đồng hồ
  countdownStartedMs: number | null;
  startedAtMs: number | null;
  deadlineMs: number | null;
  remainingMs: number;
  feedbackStartedMs: number | null;

  logs: AnswerLogEntry[];
  adjustments: ScoreAdjustment[];
  /** Chống trùng sự kiện (double click / gửi lặp). */
  processedEventIds: string[];

  rounds: RoundResult[];
  tiebreak: TiebreakState | null;
  tiebreaks: TiebreakOutcome[];
  message: string | null;
};

export type EngineAction =
  | { type: 'INIT_ROUND'; nowMs: number; team: Team }
  | { type: 'START_ROUND'; nowMs: number }
  | { type: 'TICK'; nowMs: number }
  | { type: 'ANSWER'; nowMs: number; optionId: string; eventId: string }
  | { type: 'FEEDBACK_DONE'; nowMs: number }
  | { type: 'PAUSE'; nowMs: number }
  | { type: 'RESUME'; nowMs: number }
  | { type: 'CANCEL_QUESTION'; nowMs: number }
  | { type: 'ADJUST_SCORE'; nowMs: number; delta: number; reason: string }
  | { type: 'END_ROUND_MANUAL'; nowMs: number }
  | { type: 'ACK_ROUND_RESULT' }
  | { type: 'REPLAY_ROUND'; nowMs: number }
  | { type: 'START_TIEBREAK'; nowMs: number; teamIds: string[]; questionId: string }
  | { type: 'TIEBREAK_SELECT'; teamId: string; optionId: string | null }
  | { type: 'TIEBREAK_SCORE'; nowMs: number }
  | { type: 'TIEBREAK_NEXT_QUESTION'; nowMs: number; questionId: string }
  | { type: 'FINALIZE' };

export function isAdvancingTime(phase: EnginePhase, paused: boolean): boolean {
  if (paused) return false;
  return phase === 'playing' || phase === 'feedback';
}

function seedForRound(seed: number, roundIndex: number): number {
  return (seed ^ Math.imul(roundIndex + 1, 0x9e3779b9)) >>> 0;
}

export function buildRoundInstances(
  config: SessionConfig,
  team: Team,
  roundIndex: number,
): { instanceIds: string[]; instances: Record<string, QuestionInstance> } {
  const rng = mulberry32(seedForRound(config.seed, roundIndex));
  const baseIds = config.shuffleQuestions
    ? shuffle(team.questionIds, rng)
    : team.questionIds.slice();
  const instances: Record<string, QuestionInstance> = {};
  const instanceIds: string[] = [];
  for (const qid of baseIds) {
    const q = config.questionSnapshot[qid];
    if (!q) continue;
    const ids = q.options.map((o) => o.id);
    const order = config.shuffleOptions ? shuffle(ids, rng) : ids;
    const instance: QuestionInstance = {
      id: uid('inst'),
      questionId: q.id,
      optionOrder: order,
      correctOptionId: q.correctOptionId,
      answered: false,
    };
    instances[instance.id] = instance;
    instanceIds.push(instance.id);
  }
  return { instanceIds, instances };
}

export function currentInstance(state: EngineState): QuestionInstance | null {
  const id = state.instanceIds[state.currentIndex];
  return id ? state.instances[id] ?? null : null;
}

export function currentQuestion(state: EngineState): Question | null {
  const inst = currentInstance(state);
  if (!inst) return null;
  return state.config.questionSnapshot[inst.questionId] ?? null;
}

export function initialEngineState(config: SessionConfig, nowMs = 0): EngineState {
  const emptyTeam: Team = {
    id: '',
    name: '',
    color: 'green',
    representatives: [],
    setId: null,
    questionIds: [],
  };
  return {
    phase: 'ready',
    pausedFrom: null,
    config,
    nowMs,
    roundIndex: 0,
    roundId: '',
    team: emptyTeam,
    instanceIds: [],
    instances: {},
    currentIndex: 0,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    cancelledCount: 0,
    answeredCurrent: false,
    roundStarted: false,
    countdownStartedMs: null,
    startedAtMs: null,
    deadlineMs: null,
    remainingMs: config.durationSeconds * 1000,
    feedbackStartedMs: null,
    logs: [],
    adjustments: [],
    processedEventIds: [],
    rounds: [],
    tiebreak: null,
    tiebreaks: [],
    message: null,
  };
}

/** Số mili-giây còn lại suy ra từ deadline, không đếm lùi bằng interval. */
export function computeRemaining(state: EngineState): number {
  if (state.deadlineMs == null) return state.config.durationSeconds * 1000;
  return Math.max(0, state.deadlineMs - state.nowMs);
}

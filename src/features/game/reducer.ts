// Reducer của bộ máy lượt thi.
// Mọi chuyển trạng thái tập trung ở đây; UI chỉ bắn action.
import { uid } from '../../domain/ids';
import type {
  AnswerLogEntry,
  RoundResult,
  TiebreakOutcome,
} from '../../domain/session';
import {
  buildRoundInstances,
  computeRemaining,
  COUNTDOWN_MS,
  currentInstance,
  FEEDBACK_MS,
  isAdvancingTime,
  TIMEBREAK_DISCUSS_MS,
  type EngineAction,
  type EngineState,
  type TiebreakState,
} from './engine';

function emptyResult(state: EngineState, counted: boolean, endedReason: RoundResult['endedReason']): RoundResult {
  const elapsed = state.startedAtMs != null ? state.nowMs - state.startedAtMs : 0;
  return {
    roundId: state.roundId,
    teamId: state.team.id,
    teamName: state.team.name,
    score: state.score,
    correctCount: state.correctCount,
    wrongCount: state.wrongCount,
    cancelledCount: state.cancelledCount,
    answeredCount: state.correctCount + state.wrongCount,
    endedReason,
    actualDurationMs: elapsed,
    remainingMs: computeRemaining(state),
    logs: state.logs,
    counted,
  };
}

function initRound(state: EngineState, nowMs: number, team: EngineState['team']): EngineState {
  const { instanceIds, instances } = buildRoundInstances(state.config, team, state.roundIndex);
  return {
    ...state,
    phase: 'ready',
    pausedFrom: null,
    nowMs,
    roundId: uid('round'),
    team,
    instanceIds,
    instances,
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
    remainingMs: state.config.durationSeconds * 1000,
    feedbackStartedMs: null,
    logs: [],
    processedEventIds: [],
    tiebreak: null,
    message: null,
  };
}

function beginCountdown(state: EngineState, nowMs: number): EngineState {
  return {
    ...state,
    phase: 'countdown',
    countdownStartedMs: nowMs,
    nowMs,
  };
}

function beginPlaying(state: EngineState, nowMs: number): EngineState {
  // Điểm mốc bắt đầu chạy sau countdown; deadline tính từ đây.
  return {
    ...state,
    phase: 'playing',
    countdownStartedMs: null,
    startedAtMs: nowMs,
    deadlineMs: nowMs + state.config.durationSeconds * 1000,
    remainingMs: state.config.durationSeconds * 1000,
    nowMs,
  };
}

function finishRound(
  state: EngineState,
  nowMs: number,
  endedReason: RoundResult['endedReason'],
  counted: boolean,
  message: string | null,
): EngineState {
  const next = { ...state, nowMs };
  const result = emptyResult(next, counted, endedReason);
  return {
    ...next,
    phase: 'roundResult',
    deadlineMs: null,
    remainingMs: endedReason === 'time' ? 0 : computeRemaining(next),
    message,
    rounds: [...state.rounds, result],
  };
}

/** Chuyển sang câu kế tiếp; trả về null nếu đã hết câu. */
function advanceQuestion(state: EngineState): EngineState | null {
  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.instanceIds.length) return null;
  return {
    ...state,
    phase: 'playing',
    currentIndex: nextIndex,
    answeredCurrent: false,
    feedbackStartedMs: null,
  };
}

export function engineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case 'INIT_ROUND':
      return initRound(state, action.nowMs, action.team);

    case 'START_ROUND':
      if (state.phase !== 'ready') return state;
      return beginCountdown(state, action.nowMs);

    case 'TICK': {
      const nowMs = action.nowMs;
      // Trong countdown: đếm 3–2–1 rồi bắt đầu chạy đồng hồ.
      if (state.phase === 'countdown' && state.countdownStartedMs != null) {
        if (nowMs - state.countdownStartedMs >= COUNTDOWN_MS) return beginPlaying(state, nowMs);
        return { ...state, nowMs };
      }
      // Trong feedback 450ms: hết thời gian thì sang câu mới hoặc kết thúc.
      if (state.phase === 'feedback' && state.feedbackStartedMs != null) {
        const elapsed = nowMs - state.feedbackStartedMs;
        // Nếu hết giờ trong lúc feedback, kết thúc lượt theo thời gian.
        if (state.deadlineMs != null && nowMs >= state.deadlineMs) {
          return finishRound(state, nowMs, 'time', true, 'Hết giờ');
        }
        if (elapsed >= FEEDBACK_MS) {
          const advanced = advanceQuestion({ ...state, nowMs });
          if (!advanced)
            return finishRound(state, nowMs, 'exhausted', true, 'Đã hoàn thành bộ câu hỏi');
          return { ...advanced, nowMs };
        }
        return { ...state, nowMs };
      }
      // Trong playing: cập nhật remaining và tự kết thúc khi hết giờ.
      if (state.phase === 'playing') {
        if (state.deadlineMs != null && nowMs >= state.deadlineMs) {
          return finishRound(state, nowMs, 'time', true, 'Hết giờ');
        }
        return { ...state, nowMs, remainingMs: computeRemaining({ ...state, nowMs }) };
      }
      return { ...state, nowMs };
    }

    case 'ANSWER': {
      // Chỉ nhận khi đang playing, chưa trả lời câu này, còn thời gian, không lặp sự kiện.
      if (state.phase !== 'playing' || state.answeredCurrent) return state;
      if (state.processedEventIds.includes(action.eventId)) return state;
      if (state.deadlineMs != null && action.nowMs >= state.deadlineMs) {
        return finishRound(state, action.nowMs, 'time', true, 'Hết giờ');
      }
      const inst = currentInstance(state);
      if (!inst || inst.answered) return state;
      const q = state.config.questionSnapshot[inst.questionId];
      if (!q) return state;
      if (!inst.optionOrder.includes(action.optionId)) return state;

      const isCorrect = action.optionId === inst.correctOptionId;
      const elapsed = state.startedAtMs != null ? action.nowMs - state.startedAtMs : 0;
      const log: AnswerLogEntry = {
        id: uid('log'),
        roundId: state.roundId,
        questionInstanceId: inst.id,
        questionId: inst.questionId,
        selectedOptionId: action.optionId,
        correctOptionId: inst.correctOptionId,
        outcome: isCorrect ? 'correct' : 'wrong',
        atMs: action.nowMs,
        elapsedMs: elapsed,
      };
      return {
        ...state,
        phase: 'feedback',
        answeredCurrent: true,
        feedbackStartedMs: action.nowMs,
        nowMs: action.nowMs,
        instances: { ...state.instances, [inst.id]: { ...inst, answered: true } },
        score: isCorrect ? state.score + state.config.pointsPerCorrect : state.score,
        correctCount: isCorrect ? state.correctCount + 1 : state.correctCount,
        wrongCount: isCorrect ? state.wrongCount : state.wrongCount + 1,
        logs: [...state.logs, log],
        processedEventIds: [...state.processedEventIds, action.eventId],
      };
    }

    case 'FEEDBACK_DONE': {
      if (state.phase !== 'feedback') return state;
      const advanced = advanceQuestion({ ...state, nowMs: action.nowMs });
      if (!advanced)
        return finishRound(state, action.nowMs, 'exhausted', true, 'Đã hoàn thành bộ câu hỏi');
      return { ...advanced, nowMs: action.nowMs };
    }

    case 'PAUSE': {
      if (!isAdvancingTime(state.phase, false)) return state;
      const nowMs = action.nowMs;
      // Lưu lại thời gian còn lại; dịch deadline khi resume.
      return {
        ...state,
        phase: 'paused',
        pausedFrom: state.phase,
        nowMs,
        remainingMs: computeRemaining({ ...state, nowMs }),
      };
    }

    case 'RESUME': {
      if (state.phase !== 'paused' || !state.pausedFrom) return state;
      const nowMs = action.nowMs;
      // Dời deadline theo thời gian đã tạm dừng để đồng hồ không trôi.
      const pausedDuration = nowMs - state.nowMs;
      return {
        ...state,
        phase: state.pausedFrom,
        pausedFrom: null,
        nowMs,
        deadlineMs: state.deadlineMs != null ? state.deadlineMs + pausedDuration : null,
        feedbackStartedMs:
          state.feedbackStartedMs != null ? state.feedbackStartedMs + pausedDuration : null,
      };
    }

    case 'CANCEL_QUESTION': {
      // Hủy câu hiện hành chưa chấm: không cộng/trừ điểm, chuyển câu trong trạng thái pause.
      if (state.phase !== 'playing' || state.answeredCurrent) return state;
      const nowMs = action.nowMs;
      const advanced = advanceQuestion({ ...state, nowMs });
      const cancelledCount = state.cancelledCount + 1;
      if (!advanced) {
        return finishRound(
          { ...state, cancelledCount },
          nowMs,
          'exhausted',
          true,
          'Đã hoàn thành bộ câu hỏi',
        );
      }
      return {
        ...advanced,
        cancelledCount,
        phase: 'paused',
        pausedFrom: 'playing',
        nowMs,
        message: 'Đã hủy câu lỗi. Bấm Tiếp tục để chơi tiếp.',
      };
    }

    case 'ADJUST_SCORE': {
      const nextScore = Math.max(0, state.score + action.delta);
      // Điều chỉnh âm không cho tổng điểm âm.
      const appliedDelta = nextScore - state.score;
      const adjustment = {
        id: uid('adj'),
        delta: appliedDelta,
        reason: action.reason,
        atMs: action.nowMs,
      };
      return {
        ...state,
        score: nextScore,
        adjustments: [...state.adjustments, adjustment],
      };
    }

    case 'END_ROUND_MANUAL': {
      if (state.phase === 'roundResult' || state.phase === 'ready') return state;
      return finishRound(state, action.nowMs, 'manual', true, 'Giáo viên kết thúc lượt');
    }

    case 'ACK_ROUND_RESULT': {
      if (state.phase !== 'roundResult') return state;
      return { ...state, phase: 'finalResult', message: null };
    }

    case 'REPLAY_ROUND': {
      // Đánh dấu kết quả cũ của lượt không tính xếp hạng rồi chơi lại.
      const rounds = state.rounds.map((r) =>
        r.roundId === state.roundId ? { ...r, counted: false } : r,
      );
      const reset = initRound({ ...state, rounds }, action.nowMs, state.team);
      return beginCountdown(reset, action.nowMs);
    }

    case 'START_TIEBREAK': {
      const tiebreak: TiebreakState = {
        questionId: action.questionId,
        participatingTeamIds: action.teamIds,
        selections: {},
        deadlineMs: action.nowMs + TIMEBREAK_DISCUSS_MS,
        resolved: false,
        winners: [],
        eliminated: [],
      };
      return { ...state, phase: 'tiebreak', nowMs: action.nowMs, tiebreak };
    }

    case 'TIEBREAK_SELECT': {
      if (!state.tiebreak) return state;
      return {
        ...state,
        tiebreak: {
          ...state.tiebreak,
          selections: { ...state.tiebreak.selections, [action.teamId]: action.optionId },
        },
      };
    }

    case 'TIEBREAK_SCORE': {
      if (!state.tiebreak || state.tiebreak.resolved) return state;
      const tb = state.tiebreak;
      const q = state.config.questionSnapshot[tb.questionId];
      if (!q) return state;
      const attempts = tb.participatingTeamIds.map((teamId) => {
        const selectedOptionId = tb.selections[teamId] ?? null;
        return {
          teamId,
          selectedOptionId,
          correct: selectedOptionId != null && selectedOptionId === q.correctOptionId,
        };
      });
      const correctTeams = attempts.filter((a) => a.correct).map((a) => a.teamId);
      const wrongTeams = attempts.filter((a) => !a.correct).map((a) => a.teamId);
      // Chỉ một đội đúng thì phân định xong; nhiều đội đúng thì tiếp tục.
      const resolved = correctTeams.length === 1;
      const outcome: TiebreakOutcome = {
        id: uid('tb'),
        questionId: tb.questionId,
        attempts,
        atMs: action.nowMs,
      };
      const nextTb: TiebreakState = {
        ...tb,
        resolved,
        winners: resolved ? correctTeams : [],
        eliminated: resolved ? [...tb.eliminated, ...wrongTeams] : tb.eliminated,
      };
      return {
        ...state,
        tiebreak: nextTb,
        tiebreaks: [...state.tiebreaks, outcome],
        message: resolved
          ? 'Đã phân định'
          : 'Chưa phân định: các đội đúng tiếp tục, đội sai bị loại. Chuyển câu phụ mới.',
      };
    }

    case 'TIEBREAK_NEXT_QUESTION': {
      if (!state.tiebreak) return state;
      const eliminated = state.tiebreak.eliminated;
      const remaining = state.tiebreak.participatingTeamIds.filter(
        (id) => !eliminated.includes(id),
      );
      const tb: TiebreakState = {
        questionId: action.questionId,
        participatingTeamIds:
          remaining.length > 0 ? remaining : state.tiebreak.participatingTeamIds,
        selections: {},
        deadlineMs: action.nowMs + TIMEBREAK_DISCUSS_MS,
        resolved: false,
        winners: [],
        eliminated,
      };
      return { ...state, nowMs: action.nowMs, tiebreak: tb, message: null };
    }

    case 'FINALIZE':
      return { ...state, phase: 'finalResult', message: null };

    default:
      return state;
  }
}




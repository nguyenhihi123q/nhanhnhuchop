import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_MS,
  FEEDBACK_MS,
  currentInstance,
  engineReducer,
  initialEngineState,
  type EngineState,
} from '../src/features/game';
import { createSessionConfig, createTeam, type RoundResult, type Session, type Team } from '../src/domain/session';
import { computeStandings } from '../src/domain/ranking';
import { OPTION_LETTERS } from '../src/domain/question';
import type { Question } from '../src/domain/types';

function makeQuestion(id: string, correctIndex = 0, difficulty: Question['difficulty'] = 'vua'): Question {
  const options = [0, 1, 2, 3].map((i) => ({
    id: `${id}_o${i}`,
    text: `Đáp án ${OPTION_LETTERS[i]} của ${id}`,
  })) as Question['options'];
  return {
    id,
    text: `Câu hỏi ${id}?`,
    options,
    correctOptionId: options[correctIndex].id,
    explanation: '',
    topic: 'Chung',
    difficulty,
  };
}

function makeTeamConfig(extraTeams = 0) {
  const questions = [makeQuestion('q0'), makeQuestion('q1'), makeQuestion('q2')];
  const snapshot: Record<string, Question> = {};
  for (const q of questions) snapshot[q.id] = q;
  const team: Team = { ...createTeam(0), id: 'team-1', name: 'Đội 1', questionIds: questions.map((q) => q.id) };
  const teams: Team[] = [team];
  for (let i = 0; i < extraTeams; i += 1) {
    teams.push({
      ...createTeam(i + 1),
      id: `team-${i + 2}`,
      name: `Đội ${i + 2}`,
      questionIds: questions.map((q) => q.id),
    });
  }
  return { questions, snapshot, team, teams };
}

function startPlaying(pointsPerCorrect = 10): EngineState {
  const { snapshot, team } = makeTeamConfig();
  const config = createSessionConfig('Thử', [team], 60, snapshot, false, false, pointsPerCorrect, 123);
  let state = initialEngineState(config, 0);
  state = engineReducer(state, { type: 'INIT_ROUND', nowMs: 0, team: state.config.teams[0] });
  state = engineReducer(state, { type: 'START_ROUND', nowMs: 0 });
  state = engineReducer(state, { type: 'TICK', nowMs: COUNTDOWN_MS });
  return state;
}

describe('engine reducer — vòng đời lượt thi', () => {
  it('đi qua ready → countdown → playing', () => {
    const { snapshot, team } = makeTeamConfig();
    const config = createSessionConfig('Thử', [team], 60, snapshot, false, false, 10, 1);
    let state = initialEngineState(config, 0);
    expect(state.phase).toBe('ready');

    state = engineReducer(state, { type: 'INIT_ROUND', nowMs: 0, team: state.config.teams[0] });
    expect(state.phase).toBe('ready');
    expect(state.instanceIds).toHaveLength(3);

    state = engineReducer(state, { type: 'START_ROUND', nowMs: 0 });
    expect(state.phase).toBe('countdown');
    expect(state.countdownStartedMs).toBe(0);

    state = engineReducer(state, { type: 'START_ROUND', nowMs: 1 });
    expect(state.phase).toBe('countdown');

    state = engineReducer(state, { type: 'TICK', nowMs: COUNTDOWN_MS });
    expect(state.phase).toBe('playing');
    expect(state.deadlineMs).toBe(COUNTDOWN_MS + 60_000);
  });

  it('cộng điểm khi trả lời đúng rồi chuyển câu', () => {
    let state = startPlaying(10);
    const inst = currentInstance(state)!;
    state = engineReducer(state, {
      type: 'ANSWER',
      nowMs: COUNTDOWN_MS + 100,
      optionId: inst.correctOptionId,
      eventId: 'e1',
    });
    expect(state.phase).toBe('feedback');
    expect(state.score).toBe(10);
    expect(state.correctCount).toBe(1);
    expect(state.logs).toHaveLength(1);
    expect(state.logs[0].outcome).toBe('correct');

    state = engineReducer(state, { type: 'TICK', nowMs: COUNTDOWN_MS + 100 + FEEDBACK_MS });
    expect(state.phase).toBe('playing');
    expect(state.currentIndex).toBe(1);
    expect(state.answeredCurrent).toBe(false);
  });

  it('ghi nhận sai và không cộng điểm', () => {
    let state = startPlaying(10);
    const inst = currentInstance(state)!;
    const wrongId = inst.optionOrder.find((id) => id !== inst.correctOptionId)!;
    state = engineReducer(state, {
      type: 'ANSWER',
      nowMs: COUNTDOWN_MS + 100,
      optionId: wrongId,
      eventId: 'e1',
    });
    expect(state.score).toBe(0);
    expect(state.wrongCount).toBe(1);
    expect(state.logs[0].outcome).toBe('wrong');
  });

  it('bỏ qua câu trả lời lặp lại cùng eventId', () => {
    let state = startPlaying(10);
    const inst = currentInstance(state)!;
    state = engineReducer(state, {
      type: 'ANSWER',
      nowMs: COUNTDOWN_MS + 50,
      optionId: inst.correctOptionId,
      eventId: 'dup',
    });
    state = engineReducer(state, {
      type: 'ANSWER',
      nowMs: COUNTDOWN_MS + 60,
      optionId: inst.correctOptionId,
      eventId: 'dup',
    });
    expect(state.score).toBe(10);
    expect(state.logs).toHaveLength(1);
  });

  it('không nhận trả lời khi chưa tới lượt chơi', () => {
    const { snapshot, team } = makeTeamConfig();
    const config = createSessionConfig('Thử', [team], 60, snapshot, false, false, 10, 1);
    let state = initialEngineState(config, 0);
    state = engineReducer(state, { type: 'INIT_ROUND', nowMs: 0, team: state.config.teams[0] });
    const inst = currentInstance(state)!;
    const before = state;
    state = engineReducer(state, { type: 'ANSWER', nowMs: 0, optionId: inst.correctOptionId, eventId: 'x' });
    expect(state).toBe(before);
  });

  it('kết thúc lượt khi hết giờ', () => {
    let state = startPlaying(10);
    const deadline = state.deadlineMs!;
    state = engineReducer(state, { type: 'TICK', nowMs: deadline });
    expect(state.phase).toBe('roundResult');
    expect(state.rounds).toHaveLength(1);
    expect(state.rounds[0].endedReason).toBe('time');
    expect(state.rounds[0].counted).toBe(true);
  });

  it('tạm dừng rồi tiếp tục dịch deadline theo thời gian dừng', () => {
    let state = startPlaying(10);
    const deadline = state.deadlineMs!;
    state = engineReducer(state, { type: 'PAUSE', nowMs: COUNTDOWN_MS + 1000 });
    expect(state.phase).toBe('paused');
    expect(state.pausedFrom).toBe('playing');
    state = engineReducer(state, { type: 'RESUME', nowMs: COUNTDOWN_MS + 6000 });
    expect(state.phase).toBe('playing');
    expect(state.deadlineMs).toBe(deadline + 5000);
  });

  it('hủy câu lỗi tăng cancelledCount và chuyển sang tạm dừng', () => {
    let state = startPlaying(10);
    state = engineReducer(state, { type: 'CANCEL_QUESTION', nowMs: COUNTDOWN_MS + 500 });
    expect(state.cancelledCount).toBe(1);
    expect(state.phase).toBe('paused');
    expect(state.currentIndex).toBe(1);
  });

  it('điều chỉnh điểm không xuống dưới 0', () => {
    let state = startPlaying(10);
    state = engineReducer(state, { type: 'ADJUST_SCORE', nowMs: 0, delta: -50, reason: 'test' });
    expect(state.score).toBe(0);
    expect(state.adjustments[0].delta).toBe(0);
    state = engineReducer(state, { type: 'ADJUST_SCORE', nowMs: 0, delta: 25, reason: 'test' });
    expect(state.score).toBe(25);
  });

  it('kết thúc lượt thủ công và chơi lại làm bản cũ không tính', () => {
    let state = startPlaying(10);
    state = engineReducer(state, { type: 'END_ROUND_MANUAL', nowMs: COUNTDOWN_MS + 1000 });
    expect(state.phase).toBe('roundResult');
    expect(state.rounds[0].endedReason).toBe('manual');
    state = engineReducer(state, { type: 'REPLAY_ROUND', nowMs: COUNTDOWN_MS + 2000 });
    expect(state.rounds[0].counted).toBe(false);
    expect(state.phase).toBe('countdown');
  });

  it('ACK_ROUND_RESULT chuyển sang finalResult', () => {
    let state = startPlaying(10);
    state = engineReducer(state, { type: 'END_ROUND_MANUAL', nowMs: COUNTDOWN_MS + 1000 });
    state = engineReducer(state, { type: 'ACK_ROUND_RESULT' });
    expect(state.phase).toBe('finalResult');
  });
});

function round(teamId: string, name: string, score: number, counted = true): RoundResult {
  return {
    roundId: `r-${teamId}-${score}`,
    teamId,
    teamName: name,
    score,
    correctCount: 0,
    wrongCount: 0,
    cancelledCount: 0,
    answeredCount: 0,
    endedReason: 'exhausted',
    actualDurationMs: 1000,
    remainingMs: 0,
    logs: [],
    counted,
  };
}

function sessionWithRounds(rounds: RoundResult[]): Session {
  const { snapshot, teams } = makeTeamConfig(1);
  const config = createSessionConfig('Xếp hạng', teams, 60, snapshot, false, false, 10, 5);
  return {
    id: 's1',
    name: 'Xếp hạng',
    createdAt: new Date().toISOString(),
    config,
    rounds,
    tiebreaks: [],
    finalized: false,
  };
}

describe('computeStandings', () => {
  it('xếp hạng theo tổng điểm các lượt được tính', () => {
    const session = sessionWithRounds([round('team-1', 'Đội 1', 30), round('team-2', 'Đội 2', 10)]);
    const standings = computeStandings(session);
    expect(standings.ranked[0].teamId).toBe('team-1');
    expect(standings.ranked[0].score).toBe(30);
    expect(standings.hasTie).toBe(false);
  });

  it('phát hiện đồng hạng', () => {
    const session = sessionWithRounds([round('team-1', 'Đội 1', 20), round('team-2', 'Đội 2', 20)]);
    const standings = computeStandings(session);
    expect(standings.hasTie).toBe(true);
    expect([...standings.tieGroups[0].teamIds].sort()).toEqual(['team-1', 'team-2']);
  });

  it('bỏ qua lượt không được tính (chơi lại)', () => {
    const session = sessionWithRounds([
      round('team-1', 'Đội 1', 50, false),
      round('team-1', 'Đội 1', 10, true),
      round('team-2', 'Đội 2', 5),
    ]);
    const standings = computeStandings(session);
    const first = standings.ranked.find((r) => r.teamId === 'team-1')!;
    expect(first.score).toBe(10);
    expect(standings.ranked[0].teamId).toBe('team-1');
  });
});


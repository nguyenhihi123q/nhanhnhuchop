import { describe, expect, it } from 'vitest';
import { mulberry32, shuffle, seedFromString } from '../src/domain/shuffle';
import { compareKey, normalizeText } from '../src/domain/ids';
import {
  emptyDraft,
  draftFromQuestion,
  OPTION_LETTERS,
  validateDraft,
  createQuestionSet,
} from '../src/domain/question';
import { allocateQuestions, createTeam, summarizeQuestions } from '../src/domain/session';
import type { Difficulty, Question } from '../src/domain/types';

function makeQuestion(id: string, correctIndex = 0, difficulty: Difficulty = 'vua'): Question {
  const options = [0, 1, 2, 3].map((i) => ({
    id: `${id}_o${i}`,
    text: `Đáp án ${OPTION_LETTERS[i]}`,
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

describe('shuffle', () => {
  it('is deterministic for the same seed and keeps all items', () => {
    const a = shuffle([1, 2, 3, 4, 5], mulberry32(7));
    const b = shuffle([1, 2, 3, 4, 5], mulberry32(7));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
  });

  it('does not mutate the input array', () => {
    const input = [1, 2, 3];
    shuffle(input, mulberry32(1));
    expect(input).toEqual([1, 2, 3]);
  });

  it('hashes strings to a stable unsigned seed', () => {
    expect(seedFromString('abc')).toBe(seedFromString('abc'));
    expect(seedFromString('abc')).not.toBe(seedFromString('abd'));
  });
});

describe('text helpers', () => {
  it('normalizes whitespace and comparison keys', () => {
    expect(normalizeText('  a   b  ')).toBe('a b');
    expect(compareKey('  Đáp   Án ')).toBe(compareKey('đáp án'));
  });
});

describe('validateDraft', () => {
  it('accepts a complete draft and picks the correct option', () => {
    const draft = {
      ...emptyDraft(),
      text: 'Câu hỏi hợp lệ?',
      options: ['A', 'B', 'C', 'D'] as [string, string, string, string],
      correctIndex: 1 as const,
    };
    const result = validateDraft(draft);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.question.options[1].id).toBe(result.question.correctOptionId);
      expect(result.question.options).toHaveLength(4);
    }
  });

  it('rejects duplicated options and blank questions', () => {
    const draft = {
      ...emptyDraft(),
      text: '',
      options: ['A', 'A', 'C', 'D'] as [string, string, string, string],
      correctIndex: 0 as const,
    };
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = result.issues.map((i) => i.field);
      expect(fields).toContain('text');
      expect(fields).toContain('option1');
    }
  });

  it('round-trips through draftFromQuestion', () => {
    const q = makeQuestion('q1', 2);
    const draft = draftFromQuestion(q);
    const result = validateDraft(draft, q.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.question.id).toBe('q1');
  });

  it('creates a well-formed empty question set', () => {
    const set = createQuestionSet('Bộ thử', 'mô tả');
    expect(set.title).toBe('Bộ thử');
    expect(set.questions).toEqual([]);
    expect(set.schemaVersion).toBeGreaterThan(0);
  });
});

describe('allocateQuestions', () => {
  it('splits a shared pool evenly without overlaps', () => {
    const teams = [createTeam(0), createTeam(1)];
    const pool = Array.from({ length: 6 }, (_, i) => makeQuestion(`q${i}`));
    const result = allocateQuestions({
      teams,
      questionsBySet: { s1: pool },
      useShared: true,
      sharedSetId: 's1',
      distributeFromShared: true,
      questionsPerTeam: 3,
      seed: 42,
    });
    const first = result.teamQuestionIds[teams[0].id];
    const second = result.teamQuestionIds[teams[1].id];
    expect(first).toHaveLength(3);
    expect(second).toHaveLength(3);
    const overlap = first.filter((id) => second.includes(id));
    expect(overlap).toEqual([]);
    expect(Object.keys(result.snapshot)).toHaveLength(6);
  });

  it('summarizes counts by difficulty and topic', () => {
    const pool = [makeQuestion('a', 0, 'de'), makeQuestion('b', 0, 'kho'), makeQuestion('c', 0, 'de')];
    const summary = summarizeQuestions(pool);
    expect(summary.total).toBe(3);
    expect(summary.byDifficulty.de).toBe(2);
    expect(summary.byDifficulty.kho).toBe(1);
  });
});

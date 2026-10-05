// Thiết lập phiên thi: tên phiên, đội, thời lượng, phân bổ câu hỏi rồi bắt đầu chơi.
import { useMemo, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { navigate } from '../../app/useRoute';
import { useToast } from '../../components/Toast';
import {
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  EmptyState,
} from '../../components/ui';
import { IconPlus, IconTrash } from '../../components/icons';
import {
  createSessionConfig,
  createTeam,
  defaultTeams,
  allocateQuestions,
  summarizeQuestions,
  TEAM_COLOR_PALETTE,
  type Session,
  type Team,
} from '../../domain/session';
import { LIMITS } from '../../domain/types';
import { uid } from '../../domain/ids';
import { randomSeed } from '../../domain/shuffle';
import { collectMainQuestions, TIEBREAK_SET_DEF } from '../../data';

const MIN_TEAMS = 2;
const MAX_TEAMS = 8;

export function SetupPage() {
  const { ready, sets, upsertSession } = useApp();
  const toast = useToast();

  const mainSets = useMemo(() => sets.filter((s) => s.title !== TIEBREAK_SET_DEF.title), [sets]);

  const [name, setName] = useState('Phiên thi Nhanh như chớp');
  const [teams, setTeams] = useState<Team[]>(() => defaultTeams());
  const [durationSeconds, setDurationSeconds] = useState(60);
  const [pointsPerCorrect, setPointsPerCorrect] = useState(10);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [mode, setMode] = useState<'shared' | 'per-team'>('shared');
  const [questionsPerTeam, setQuestionsPerTeam] = useState<number>(LIMITS.recommendedQuestionsPerTeam);
  const [seed, setSeed] = useState<number>(() => randomSeed());

  const sharedQuestions = useMemo(
    () => (mode === 'shared' ? collectMainQuestions(mainSets) : []),
    [mode, mainSets],
  );

  const sharedStats = useMemo(() => summarizeQuestions(sharedQuestions), [sharedQuestions]);

  const questionsBySet = useMemo(() => {
    const map: Record<string, import('../../domain/types').Question[]> = {};
    for (const s of mainSets) map[s.id] = s.questions;
    return map;
  }, [mainSets]);

  function updateTeam(id: string, patch: Partial<Team>) {
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function addTeam() {
    if (teams.length >= MAX_TEAMS) {
      toast.error(`Tối đa ${MAX_TEAMS} đội.`);
      return;
    }
    setTeams((prev) => [...prev, createTeam(prev.length)]);
  }

  function removeTeam(id: string) {
    if (teams.length <= MIN_TEAMS) {
      toast.error(`Cần ít nhất ${MIN_TEAMS} đội.`);
      return;
    }
    setTeams((prev) => prev.filter((t) => t.id !== id));
  }

  const readyTeams = useMemo(() => {
    const names = new Set<string>();
    for (const t of teams) {
      const trimmed = t.name.trim();
      if (!trimmed) return { ok: false, reason: 'Tên đội không được để trống.' };
      if (names.has(trimmed.toLowerCase())) return { ok: false, reason: 'Tên đội bị trùng.' };
      names.add(trimmed.toLowerCase());
    }
    return { ok: true, reason: '' };
  }, [teams]);

  async function handleStart() {
    if (!readyTeams.ok) {
      toast.error(readyTeams.reason);
      return;
    }
    if (mode === 'shared' && sharedQuestions.length < teams.length * questionsPerTeam) {
      toast.error('Không đủ câu hỏi để chia cho các đội. Giảm số câu mỗi đội hoặc thêm bộ.');
      return;
    }
    if (mode === 'per-team' && teams.some((t) => !t.setId)) {
      toast.error('Mỗi đội cần chọn một bộ câu hỏi.');
      return;
    }

    const teamQuestionIds: Record<string, string[]> = {};
    if (mode === 'shared') {
      // Chia đều từ một bộ chung; nguồn là tất cả câu của các bộ chính.
      const merged: Record<string, import('../../domain/types').Question[]> = {
        __shared__: sharedQuestions,
      };
      const allocation = allocateQuestions({
        teams,
        questionsBySet: merged,
        useShared: true,
        sharedSetId: '__shared__',
        distributeFromShared: true,
        questionsPerTeam,
        seed,
      });
      Object.assign(teamQuestionIds, allocation.teamQuestionIds);
      const snapshot = allocation.snapshot;
      const finalizedTeams = teams.map((t) => ({ ...t, questionIds: teamQuestionIds[t.id] ?? [] }));
      await startSession(finalizedTeams, snapshot);
      return;
    }

    const allocation = allocateQuestions({
      teams,
      questionsBySet,
      useShared: false,
      sharedSetId: null,
      distributeFromShared: false,
      questionsPerTeam,
      seed,
    });
    Object.assign(teamQuestionIds, allocation.teamQuestionIds);
    const finalizedTeams = teams.map((t) => ({ ...t, questionIds: teamQuestionIds[t.id] ?? [] }));
    await startSession(finalizedTeams, allocation.snapshot);
  }

  async function startSession(finalizedTeams: Team[], snapshot: Record<string, import('../../domain/types').Question>) {
    try {
      const config = createSessionConfig(
        name.trim() || 'Phiên thi Nhanh như chớp',
        finalizedTeams,
        durationSeconds,
        snapshot,
        shuffleQuestions,
        shuffleOptions,
        pointsPerCorrect,
        seed,
      );
      const session: Session = {
        id: uid('session-rec'),
        name: config.name,
        createdAt: new Date().toISOString(),
        config,
        rounds: [],
        tiebreaks: [],
        finalized: false,
      };
      await upsertSession(session);
      toast.success('Đã tạo phiên thi. Bắt đầu lượt đầu tiên!');
      navigate(`/play/${session.id}`);
    } catch {
      toast.error('Không tạo được phiên thi. Hãy thử lại.');
    }
  }

  if (!ready) {
    return (
      <main className="page">
        <div className="container">
          <Card>Đang tải dữ liệu…</Card>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Thiết lập phiên thi</h1>
            <p>Chọn đội chơi, thời lượng và cách chia câu hỏi trước khi vào sân khấu.</p>
          </div>
          <Button onClick={() => navigate('/')}>Về thư viện</Button>
        </div>

        <div className="grid grid--cards">
          <Card as="section">
            <h2 className="card__title">1. Thông tin phiên</h2>
            <Field label="Tên phiên" htmlFor="session-name">
              <input
                id="session-name"
                type="text"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Thời lượng mỗi lượt (giây)" htmlFor="duration">
              <select
                id="duration"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
              >
                {[30, 45, 60, 90, 120].map((d) => (
                  <option key={d} value={d}>
                    {d} giây
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Điểm mỗi câu đúng" htmlFor="points">
              <select
                id="points"
                value={pointsPerCorrect}
                onChange={(e) => setPointsPerCorrect(Number(e.target.value))}
              >
                {[5, 10, 15, 20].map((p) => (
                  <option key={p} value={p}>
                    {p} điểm
                  </option>
                ))}
              </select>
            </Field>
          </Card>

          <Card as="section">
            <h2 className="card__title">2. Đội chơi</h2>
            <ul className="list-plain">
              {teams.map((team, index) => (
                <li key={team.id} className="list-row">
                  <span className="stepper__num">{index + 1}</span>
                  <div className="list-row__main">
                    <input
                      type="text"
                      value={team.name}
                      aria-label={`Tên đội ${index + 1}`}
                      onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                    />
                    <div className="actions-inline" style={{ marginTop: 6 }}>
                      {TEAM_COLOR_PALETTE.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          aria-label={c.label}
                          title={c.label}
                          className="team-dot"
                          style={{
                            background: c.hex,
                            cursor: 'pointer',
                          }}
                          onClick={() => updateTeam(team.id, { color: c.value })}
                        />
                      ))}
                    </div>
                  </div>
                  <IconButton label="Xóa đội" onClick={() => removeTeam(team.id)}>
                    <IconTrash />
                  </IconButton>
                </li>
              ))}
            </ul>
            <Button onClick={addTeam} disabled={teams.length >= MAX_TEAMS}>
              <IconPlus size={18} /> Thêm đội
            </Button>
          </Card>

          <Card as="section">
            <h2 className="card__title">3. Câu hỏi</h2>
            <div className="actions-inline" style={{ marginBottom: 12 }}>
              <Button
                variant={mode === 'shared' ? 'primary' : 'secondary'}
                onClick={() => setMode('shared')}
              >
                Chia từ bộ chung
              </Button>
              <Button
                variant={mode === 'per-team' ? 'primary' : 'secondary'}
                onClick={() => setMode('per-team')}
              >
                Mỗi đội một bộ
              </Button>
            </div>

            {mode === 'shared' ? (
              <>
                <Field label="Số câu mỗi đội" htmlFor="per-team-count">
                  <input
                    id="per-team-count"
                    type="number"
                    min={LIMITS.minQuestionsPerTeam}
                    max={Math.max(LIMITS.minQuestionsPerTeam, sharedQuestions.length)}
                    value={questionsPerTeam}
                    onChange={(e) => setQuestionsPerTeam(Number(e.target.value))}
                  />
                </Field>
                <p className="list-row__hint">
                  Kho chung có {sharedStats.total} câu · khuyến nghị{' '}
                  {LIMITS.recommendedQuestionsPerTeam} câu/đội · tối thiểu {LIMITS.minQuestionsPerTeam}.
                </p>
                {sharedQuestions.length < teams.length * questionsPerTeam ? (
                  <p className="field__error" role="alert">
                    Không đủ câu: cần {teams.length * questionsPerTeam} nhưng chỉ có{' '}
                    {sharedQuestions.length}.
                  </p>
                ) : null}
              </>
            ) : (
              <ul className="list-plain">
                {teams.map((team) => (
                  <li key={team.id} className="list-row">
                    <div className="list-row__main">
                      <strong>{team.name || '(chưa đặt tên)'}</strong>
                      <Field label="Bộ câu hỏi" htmlFor={`set-${team.id}`}>
                        <select
                          id={`set-${team.id}`}
                          value={team.setId ?? ''}
                          onChange={(e) => updateTeam(team.id, { setId: e.target.value || null })}
                        >
                          <option value="">— Chọn bộ —</option>
                          {mainSets.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title} ({s.questions.length} câu)
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="actions-inline" style={{ marginTop: 12 }}>
              <label className="actions-inline" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                />
                Đảo thứ tự câu
              </label>
              <label className="actions-inline" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                />
                Đảo thứ tự đáp án
              </label>
            </div>
            <p className="list-row__hint">
              Seed phân bổ: <code>{seed}</code>{' '}
              <Button className="btn--sm" onClick={() => setSeed(randomSeed())}>
                Đổi seed
              </Button>
            </p>
          </Card>

        </div>

        {mainSets.length === 0 ? (
          <EmptyState
            title="Chưa có bộ câu hỏi"
            description="Hãy tạo hoặc nhập bộ câu hỏi trong thư viện trước khi thiết lập phiên."
            action={
              <Button variant="primary" onClick={() => navigate('/')}>
                Đến thư viện
              </Button>
            }
          />
        ) : null}

        <div className="toolbar" style={{ marginTop: 'calc(var(--space) * 3)' }}>
          <Badge tone="brand">{teams.length} đội</Badge>
          <Badge tone="neutral">
            {mode === 'shared' ? `${questionsPerTeam} câu/đội` : 'Bộ riêng theo đội'}
          </Badge>
          {!readyTeams.ok ? (
            <span className="field__error" role="alert">
              {readyTeams.reason}
            </span>
          ) : null}
          <div className="grow" />
          <Button variant="primary" onClick={handleStart} disabled={mainSets.length === 0}>
            Bắt đầu phiên thi
          </Button>
        </div>
      </div>
    </main>
  );
}


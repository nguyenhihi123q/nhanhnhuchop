// Sân khấu thi đấu: đồng hồ theo deadline, 4 đáp án, khóa input, tạm dừng, menu giáo viên.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react';
import { useApp } from '../../app/AppContext';
import { navigate } from '../../app/useRoute';
import { useAudio } from '../../lib/audio/AudioProvider';
import { useToast } from '../../components/Toast';
import { Badge, Button, Card, Dialog, Field, IconButton } from '../../components/ui';
import { IconMenu, IconPause, IconPlay, IconTrophy } from '../../components/icons';
import { OPTION_LETTERS } from '../../domain/question';
import {
  TEAM_COLOR_PALETTE,
  type Session,
  type Team,
  type TiebreakOutcome,
} from '../../domain/session';
import { computeStandings } from '../../domain/ranking';
import { uid } from '../../domain/ids';
import {
  COUNTDOWN_MS,
  currentInstance,
  currentQuestion,
  engineReducer,
  initialEngineState,
  type EngineAction,
  type EngineState,
} from '../game';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function teamHex(team: Team): string {
  return TEAM_COLOR_PALETTE.find((c) => c.value === team.color)?.hex ?? '#6d28d9';
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function StagePage({ sessionId }: { sessionId: string }) {
  const { sessions, ready } = useApp();
  const session = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  if (!ready) {
    return (
      <main className="page">
        <div className="container">
          <Card>Đang tải phiên thi…</Card>
        </div>
      </main>
    );
  }
  if (!session) {
    return (
      <main className="page">
        <div className="container">
          <Card>
            <h2 className="card__title">Không tìm thấy phiên thi</h2>
            <p>Phiên thi có thể đã bị xóa. Hãy thiết lập phiên mới.</p>
            <Button variant="primary" onClick={() => navigate('/setup')}>
              Thiết lập phiên thi
            </Button>
          </Card>
        </div>
      </main>
    );
  }
  return <StageRunner key={session.id} session={session} />;
}

function StageRunner({ session }: { session: Session }) {
  const { upsertSession, tiebreakSet } = useApp();
  const { manager } = useAudio();
  const toast = useToast();
  const [state, dispatch] = useReducer(engineReducer, initialEngineState(session.config));
  const [authored, setAuthored] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [tiebreakOpen, setTiebreakOpen] = useState(false);
  const [tbQuestionId, setTbQuestionId] = useState<string | null>(null);
  const [tbSelections, setTbSelections] = useState<Record<string, string | null>>({});
  const stateRef = useRef(state);
  stateRef.current = state;

  // Nhóm đội đồng điểm cao nhất cần phân định (dùng cho lượt câu phụ).
  const tiebreakPool = useMemo(() => {
    const live: Session = { ...session, rounds: state.rounds, tiebreaks: state.tiebreaks };
    const standings = computeStandings(live);
    return standings.tieGroups[0]?.teamIds ?? [];
  }, [session, state.rounds, state.tiebreaks]);

  const pendingTeam = useMemo(() => {
    const existing = new Set(state.rounds.filter((r) => r.counted).map((r) => r.teamId));
    return session.config.teams.find((t) => !existing.has(t.id)) ?? null;
  }, [session.config.teams, state.rounds]);

  const question = currentQuestion(state);
  const instance = currentInstance(state);

  // Lưu snapshot phiên để phục hồi sau reload; chỉ chạy sau khi bấm bắt đầu.
  useEffect(() => {
    if (!authored) return;
    let cancelled = false;
    (async () => {
      try {
        const allDone = state.rounds.filter((r) => r.counted).length >= session.config.teams.length;
        const next: Session = {
          ...session,
          rounds: state.rounds,
          tiebreaks: state.tiebreaks,
          finalized: allDone || session.finalized,
        };
        if (!cancelled) await upsertSession(next);
      } catch {
        // Không chặn trò chơi vì lỗi lưu.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authored, state.rounds, state.tiebreaks, session, upsertSession]);

  // Tự tạm dừng khi rời tab.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && ['playing', 'feedback', 'countdown'].includes(stateRef.current.phase)) {
        dispatch({ type: 'PAUSE', nowMs: now() });
        toast.push('Tạm dừng vì bạn rời khỏi tab. Bấm Tiếp tục để chơi tiếp.');
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [toast]);

  // Vòng tick bằng requestAnimationFrame; deadline là nguồn sự thật.
  useEffect(() => {
    const advancing = ['countdown', 'playing', 'feedback'].includes(state.phase);
    if (!advancing) return;
    let raf = 0;
    const loop = () => {
      dispatch({ type: 'TICK', nowMs: now() });
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(raf);
  }, [state.phase]);

  // Nhạc nền chỉ khi đang chơi.
  useEffect(() => {
    if (state.phase === 'playing') {
      void manager.startMusic();
      manager.resetTicks();
    } else {
      manager.stopMusic();
    }
  }, [state.phase, manager]);

  useEffect(() => {
    if (state.phase !== 'playing') return;
    const remaining = state.remainingMs;
    if (remaining <= 10000 && remaining > 0) manager.tick(Math.ceil(remaining / 1000));
  }, [state.remainingMs, state.phase, manager]);

  const beginRound = useCallback(
    (team: Team) => {
      setAuthored(true);
      dispatch({ type: 'INIT_ROUND', nowMs: now(), team });
      dispatch({ type: 'START_ROUND', nowMs: now() });
      void manager.ensureContext();
    },
    [manager],
  );

  const answer = useCallback(
    (optionId: string) => {
      if (stateRef.current.phase !== 'playing' || stateRef.current.answeredCurrent) return;
      void manager.ensureContext();
      dispatch({ type: 'ANSWER', nowMs: now(), optionId, eventId: uid('evt') });
    },
    [manager],
  );

  // Phím tắt: 1–4 / A–D chọn đáp án; Space tạm dừng / tiếp tục; Esc mở menu giáo viên.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const s = stateRef.current;
      const key = event.key.toLowerCase();
      if (key === ' ' || key === 'spacebar') {
        event.preventDefault();
        if (s.phase === 'paused') dispatch({ type: 'RESUME', nowMs: now() });
        else if (['playing', 'feedback', 'countdown'].includes(s.phase))
          dispatch({ type: 'PAUSE', nowMs: now() });
        return;
      }
      if (s.phase !== 'playing') return;
      const inst = currentInstance(s);
      if (!inst) return;
      let index = -1;
      if (key >= '1' && key <= '4') index = Number(key) - 1;
      else if (['a', 'b', 'c', 'd'].includes(key)) index = ['a', 'b', 'c', 'd'].indexOf(key);
      if (index < 0) return;
      const optionId = inst.optionOrder[index];
      if (optionId) answer(optionId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  // Phản hồi âm thanh theo trạng thái.
  const prevPhase = useRef(state.phase);
  useEffect(() => {
    const prev = prevPhase.current;
    prevPhase.current = state.phase;
    if (prev === state.phase) return;
    if (state.phase === 'countdown') void manager.play('countdown');
    else if (state.phase === 'playing' && prev === 'countdown') void manager.play('start');
    else if (state.phase === 'roundResult' && state.rounds[state.rounds.length - 1]?.endedReason === 'time')
      void manager.play('timeUp');
  }, [state.phase, state.rounds, manager]);

  // Âm thanh cho mỗi câu trả lời vừa ghi nhận.
  const lastLogId = useRef<string | null>(null);
  useEffect(() => {
    const last = state.logs[state.logs.length - 1];
    if (!last || last.id === lastLogId.current) return;
    lastLogId.current = last.id;
    void manager.play(last.outcome === 'correct' ? 'correct' : 'wrong');
  }, [state.logs, manager]);

  const startTiebreak = useCallback(() => {
    const first = tiebreakSet?.questions[0];
    if (!first) {
      toast.error('Chưa có bộ “Câu phụ”. Hãy khôi phục bộ mẫu trong thư viện.');
      return;
    }
    setTbQuestionId(first.id);
    setTbSelections({});
    setTiebreakOpen(true);
  }, [tiebreakSet, toast]);

  function tbSetSelection(teamId: string, optionId: string | null) {
    setTbSelections((prev) => ({ ...prev, [teamId]: optionId }));
  }

  function tbChooseQuestion() {
    if (!tiebreakSet) return;
    const used = new Set(session.tiebreaks.map((t) => t.questionId));
    const next =
      tiebreakSet.questions.find((q) => !used.has(q.id)) ??
      tiebreakSet.questions[Math.floor(Math.random() * tiebreakSet.questions.length)];
    setTbQuestionId(next ? next.id : null);
    setTbSelections({});
  }

  async function tbRecord() {
    const question = tiebreakSet?.questions.find((q) => q.id === tbQuestionId) ?? null;
    if (!question || !tiebreakPool) return;
    const attempts = tiebreakPool.map((teamId) => {
      const selectedOptionId = tbSelections[teamId] ?? null;
      return {
        teamId,
        selectedOptionId,
        correct: selectedOptionId != null && selectedOptionId === question.correctOptionId,
      };
    });
    const outcome: TiebreakOutcome = {
      id: uid('tb'),
      questionId: question.id,
      attempts,
      atMs: Date.now(),
    };
    await upsertSession({ ...session, tiebreaks: [...session.tiebreaks, outcome] });
    const winners = attempts.filter((a) => a.correct).map((a) => a.teamId);
    if (winners.length === 1) {
      void manager.play('win');
      toast.success('Đã phân định đồng hạng.');
      setTiebreakOpen(false);
    } else {
      toast.push('Chưa phân định. Chọn câu phụ khác hoặc ghi nhận lại.');
      tbChooseQuestion();
    }
  }

  const phase = state.phase;
  const remaining = state.remainingMs;
  const low = phase === 'playing' && remaining <= 10000;
  const countdownLeft =
    state.countdownStartedMs != null
      ? Math.max(1, Math.ceil((COUNTDOWN_MS - (state.nowMs - state.countdownStartedMs)) / 1000))
      : 3;
  const progressPct = Math.max(
    0,
    Math.min(100, (remaining / (session.config.durationSeconds * 1000)) * 100),
  );
  const currentRound = state.rounds[state.rounds.length - 1] ?? null;

  const revealOption = (optionId: string): 'correct' | 'wrong' | 'dim' | null => {
    if (phase !== 'feedback' || !instance) return null;
    if (optionId === instance.correctOptionId) return 'correct';
    const chosen = state.logs[state.logs.length - 1]?.selectedOptionId;
    if (optionId === chosen) return 'wrong';
    return 'dim';
  };

  return (
    <div className="stage">
      <div className="stage__top">
        <span className="stage__team">
          <span className="team-dot" style={{ background: teamHex(state.team) }} />
          {state.team.name || 'Chưa chọn đội'}
        </span>
        <Badge tone="brand">
          Câu {Math.min(state.currentIndex + 1, Math.max(state.instanceIds.length, 1))}/
          {state.instanceIds.length}
        </Badge>
        <IconButton label="Menu giáo viên" onClick={() => setTeacherOpen(true)}>
          <IconMenu />
        </IconButton>
      </div>

      {phase === 'playing' || phase === 'feedback' || phase === 'paused' ? (
        <div className="stage__body">
          <div className="stage__question">
            {question && instance ? (
              <>
                <div className="stage__qnum">Câu {state.currentIndex + 1}</div>
                <div className="stage__qtext">{question.text}</div>
                <div className="options">
                  {instance.optionOrder.map((optionId, index) => {
                    const option = question.options.find((o) => o.id === optionId);
                    if (!option) return null;
                    const reveal = revealOption(optionId);
                    const cls =
                      reveal === 'correct'
                        ? 'option option--correct'
                        : reveal === 'wrong'
                          ? 'option option--wrong'
                          : reveal === 'dim'
                            ? 'option option--dim'
                            : 'option';
                    return (
                      <button
                        key={optionId}
                        type="button"
                        className={cls}
                        disabled={phase !== 'playing'}
                        onClick={() => answer(optionId)}
                      >
                        <span className="option__key">{OPTION_LETTERS[index]}</span>
                        <span>{option.text}</span>
                      </button>
                    );
                  })}
                </div>
                {phase === 'feedback' ? (
                  <div
                    className={`feedback ${
                      state.logs[state.logs.length - 1]?.outcome === 'correct'
                        ? 'feedback--ok'
                        : 'feedback--bad'
                    }`}
                  >
                    {state.logs[state.logs.length - 1]?.outcome === 'correct'
                      ? 'Chính xác!'
                      : 'Chưa đúng!'}
                  </div>
                ) : null}
              </>
            ) : (
              <p>Không có câu hỏi nào cho lượt này.</p>
            )}
          </div>

          <aside className="stage__side">
            <div className={`timer ${low ? 'timer--low' : ''}`}>{formatClock(remaining)}</div>
            <div className="timer__label">Thời gian còn lại</div>
            <div className="energy">
              <div className="energy__fill" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="score-box">
              <div className="score-box__value">{state.score}</div>
              <div className="score-box__sub">
                {state.correctCount} đúng · {state.wrongCount} sai
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() =>
                phase === 'paused'
                  ? dispatch({ type: 'RESUME', nowMs: now() })
                  : dispatch({ type: 'PAUSE', nowMs: now() })
              }
            >
              {phase === 'paused' ? <IconPlay /> : <IconPause />}
              {phase === 'paused' ? 'Tiếp tục' : 'Tạm dừng'}
            </Button>
          </aside>
        </div>
      ) : null}

      {phase === 'ready' ? (
        <div className="stage-overlay">
          <div className="stage-overlay__card">
            <h2 className="dialog__title">Sẵn sàng lượt tiếp theo</h2>
            <p>
              {pendingTeam
                ? `Lượt của ${pendingTeam.name}. Bấm bắt đầu khi đội đã sẵn sàng.`
                : 'Tất cả các đội đã hoàn thành lượt của mình.'}
            </p>
            <div className="stage__bottom" style={{ justifyContent: 'center' }}>
              {pendingTeam ? (
                <Button variant="primary" className="stage-btn" onClick={() => beginRound(pendingTeam)}>
                  <IconPlay /> Bắt đầu lượt
                </Button>
              ) : (
                <Button variant="primary" onClick={() => navigate(`/results/${session.id}`)}>
                  <IconTrophy /> Xem kết quả
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'countdown' ? (
        <div className="stage-overlay">
          <div className="countdown">{countdownLeft}</div>
        </div>
      ) : null}

      {phase === 'paused' ? (
        <div className="stage-overlay">
          <div className="stage-overlay__card">
            <h2 className="dialog__title">Đã tạm dừng</h2>
            <p>Đồng hồ đã dừng. Bấm tiếp tục để chơi tiếp.</p>
            <Button
              variant="primary"
              className="stage-btn"
              onClick={() => dispatch({ type: 'RESUME', nowMs: now() })}
            >
              <IconPlay /> Tiếp tục
            </Button>
          </div>
        </div>
      ) : null}

      {phase === 'roundResult' && currentRound ? (
        <div className="stage-overlay">
          <div className="stage-overlay__card">
            <h2 className="dialog__title">{currentRound.teamName} hoàn thành lượt</h2>
            <p>
              {currentRound.score} điểm · {currentRound.correctCount} đúng ·{' '}
              {currentRound.wrongCount} sai · {currentRound.cancelledCount} bỏ qua
            </p>
            <p className="stage__hint">
              {currentRound.endedReason === 'time'
                ? 'Hết giờ'
                : currentRound.endedReason === 'exhausted'
                  ? 'Đã hết bộ câu hỏi'
                  : 'Giáo viên kết thúc lượt'}
            </p>
            <div className="stage__bottom" style={{ justifyContent: 'center' }}>
              <Button variant="ghost" onClick={() => dispatch({ type: 'REPLAY_ROUND', nowMs: now() })}>
                Chơi lại lượt này
              </Button>
              <Button variant="primary" onClick={() => dispatch({ type: 'ACK_ROUND_RESULT' })}>
                Lượt tiếp theo
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'finalResult' ? <FinalOverlay session={session} onTiebreak={startTiebreak} /> : null}

      <TeacherDialog
        open={teacherOpen}
        onClose={() => setTeacherOpen(false)}
        state={state}
        dispatch={dispatch}
        onOpenTiebreak={() => {
          setTeacherOpen(false);
          startTiebreak();
        }}
        canTiebreak={tiebreakPool.length > 1}
      />

      {tiebreakOpen ? (
        <Dialog
          open
          onClose={() => setTiebreakOpen(false)}
          title="Câu phụ — Phân định đồng hạng"
          footer={
            <>
              <Button onClick={() => setTiebreakOpen(false)}>Đóng</Button>
              <Button onClick={tbChooseQuestion}>Câu khác</Button>
              <Button variant="primary" onClick={tbRecord} disabled={!tbQuestionId}>
                Ghi nhận kết quả
              </Button>
            </>
          }
        >
          <TiebreakPanel
            pool={tiebreakPool}
            teams={session.config.teams}
            question={tiebreakSet?.questions.find((q) => q.id === tbQuestionId) ?? null}
            selections={tbSelections}
            onSelect={tbSetSelection}
          />
        </Dialog>
      ) : null}

    </div>
  );
}

function FinalOverlay({ session, onTiebreak }: { session: Session; onTiebreak: () => void }) {
  const standings = computeStandings(session);
  const needsTiebreak = standings.hasTie;
  return (
    <div className="stage-overlay">
      <div className="stage-overlay__card">
        <h2 className="dialog__title">Kết thúc các lượt thi</h2>
        <ul className="rank-list" style={{ marginBottom: 16 }}>
          {standings.ranked.map((item) => (
            <li
              key={item.teamId}
              className={`rank-row ${item.rank === 1 && !item.tied ? 'rank-row--win' : ''}`}
            >
              <span className="rank-row__pos">{item.rank}</span>
              <span className="rank-row__name">{item.teamName}</span>
              <span className="rank-row__score">{item.score}</span>
            </li>
          ))}
        </ul>
        <div className="stage__bottom" style={{ justifyContent: 'center' }}>
          {needsTiebreak ? (
            <Button variant="primary" onClick={onTiebreak}>
              Phân định đồng hạng
            </Button>
          ) : null}
          <Button onClick={() => navigate(`/results/${session.id}`)}>
            <IconTrophy /> Xem kết quả đầy đủ
          </Button>
        </div>
      </div>
    </div>
  );
}

function TeacherDialog({
  open,
  onClose,
  state,
  dispatch,
  onOpenTiebreak,
  canTiebreak,
}: {
  open: boolean;
  onClose: () => void;
  state: EngineState;
  dispatch: Dispatch<EngineAction>;
  onOpenTiebreak: () => void;
  canTiebreak: boolean;
}) {
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState('Điều chỉnh của giáo viên');
  const [manualOpen, setManualOpen] = useState(false);

  const inRound = !['ready', 'roundResult', 'finalResult'].includes(state.phase);

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Menu giáo viên">
        <div className="grid">
          <div className="actions-inline">
            <Button
              onClick={() => {
                dispatch({ type: 'CANCEL_QUESTION', nowMs: now() });
                onClose();
              }}
              disabled={!inRound || state.answeredCurrent}
            >
              Hủy câu lỗi (không tính điểm)
            </Button>
            <Button
              onClick={() => {
                dispatch({ type: 'END_ROUND_MANUAL', nowMs: now() });
                onClose();
              }}
              disabled={!inRound}
            >
              Kết thúc lượt ngay
            </Button>
            <Button onClick={onOpenTiebreak} disabled={!canTiebreak}>
              Câu phụ — Phân định đồng hạng
            </Button>
          </div>

          <Card as="section">
            <h3 className="card__title">Cộng/trừ điểm thủ công</h3>
            <Field label="Số điểm thay đổi" hint="Nhập số âm để trừ điểm; tổng điểm không xuống dưới 0." htmlFor="adj-delta">
              <input
                id="adj-delta"
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value))}
              />
            </Field>
            <Field label="Lý do" htmlFor="adj-reason">
              <input
                id="adj-reason"
                type="text"
                value={reason}
                maxLength={120}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              onClick={() => {
                dispatch({ type: 'ADJUST_SCORE', nowMs: now(), delta, reason: reason.trim() || 'Điều chỉnh' });
                onClose();
              }}
            >
              Áp dụng
            </Button>
          </Card>

          <div className="actions-inline">
            <Button
              variant="danger"
              onClick={() => {
                setManualOpen(true);
              }}
            >
              Kết thúc phiên
            </Button>
          </div>

          {state.adjustments.length > 0 ? (
            <ul className="list-plain">
              {state.adjustments.map((a) => (
                <li key={a.id} className="list-row">
                  <span className="list-row__main">
                    {a.delta >= 0 ? '+' : ''}
                    {a.delta} điểm · {a.reason}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        title="Kết thúc phiên thi?"
        footer={
          <>
            <Button onClick={() => setManualOpen(false)}>Hủy</Button>
            <Button
              variant="danger"
              onClick={() => {
                dispatch({ type: 'FINALIZE' });
                setManualOpen(false);
                onClose();
              }}
            >
              Kết thúc phiên
            </Button>
          </>
        }
      >
        <p>Các lượt chưa chơi sẽ bị bỏ qua. Bạn có chắc muốn kết thúc phiên thi ngay bây giờ?</p>
      </Dialog>
    </>
  );
}

function TiebreakPanel({
  pool,
  teams,
  question,
  selections,
  onSelect,
}: {
  pool: string[];
  teams: Team[];
  question: import('../../domain/types').Question | null;
  selections: Record<string, string | null>;
  onSelect: (teamId: string, optionId: string | null) => void;
}) {
  if (pool.length === 0) {
    return <p>Không có đội nào đồng điểm cần phân định.</p>;
  }
  if (!question) {
    return <p>Chưa có câu hỏi phụ. Hãy khôi phục bộ “Câu phụ” rồi thử lại.</p>;
  }
  return (
    <div className="grid">
      <p className="stage__hint">
        Đọc câu hỏi cho các đội đồng điểm, ghi lại đáp án mỗi đội chọn (thẻ giấy A/B/C/D), rồi bấm
        “Ghi nhận kết quả”.
      </p>
      <Card as="section">
        <h3 className="card__title">{question.text}</h3>
        <ol className="list-plain">
          {question.options.map((o, i) => (
            <li key={o.id} className="list-row">
              <span className="stepper__num">{OPTION_LETTERS[i]}</span>
              <span className="list-row__main">{o.text}</span>
            </li>
          ))}
        </ol>
      </Card>
      {pool.map((teamId) => {
        const team = teams.find((t) => t.id === teamId);
        return (
          <Card key={teamId} as="section">
            <h3 className="card__title">
              <span className="team-dot" style={{ background: team ? teamHex(team) : '#6d28d9' }} />
              {team?.name ?? teamId}
            </h3>
            <div className="actions-inline">
              {question.options.map((o, i) => (
                <Button
                  key={o.id}
                  variant={selections[teamId] === o.id ? 'primary' : 'secondary'}
                  onClick={() => onSelect(teamId, o.id)}
                >
                  {OPTION_LETTERS[i]}
                </Button>
              ))}
              <Button
                variant={selections[teamId] === null && teamId in selections ? 'primary' : 'ghost'}
                onClick={() => onSelect(teamId, null)}
              >
                Không trả lời
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}






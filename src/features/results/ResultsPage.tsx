// Trang kết quả: bảng xếp hạng, xem lại từng lượt, câu phụ, xuất Excel và JSON.
import { useMemo, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { navigate } from '../../app/useRoute';
import { useToast } from '../../components/Toast';
import { Badge, Button, Card } from '../../components/ui';
import { IconDownload, IconTrophy } from '../../components/icons';
import { computeStandings, teamsNeedingTiebreak } from '../../domain/ranking';
import { TEAM_COLOR_PALETTE } from '../../domain/session';
import { OPTION_LETTERS } from '../../domain/question';
import { buildResultsWorkbook, workbookToBlob } from '../import/excel';
import { downloadBlob, downloadText } from '../../lib/download';

function teamHex(color: string): string {
  return TEAM_COLOR_PALETTE.find((c) => c.value === color)?.hex ?? '#6d28d9';
}

export function ResultsPage({ sessionId }: { sessionId: string }) {
  const { ready, sessions, upsertSession } = useApp();
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const session = useMemo(
    () => sessions.find((s) => s.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  const standings = useMemo(() => (session ? computeStandings(session) : null), [session]);
  const pendingTiebreak = useMemo(
    () => (session && standings ? teamsNeedingTiebreak(session, standings) : []),
    [session, standings],
  );

  if (!ready) {
    return (
      <main className="page">
        <div className="container">
          <Card>Đang tải kết quả…</Card>
        </div>
      </main>
    );
  }

  if (!session || !standings) {
    return (
      <main className="page">
        <div className="container">
          <Card>
            <h2 className="card__title">Không tìm thấy phiên thi</h2>
            <p>Phiên thi có thể đã bị xóa.</p>
            <Button variant="primary" onClick={() => navigate('/')}>
              Về thư viện
            </Button>
          </Card>
        </div>
      </main>
    );
  }

  async function handleExportExcel() {
    if (!session || !standings) return;
    try {
      const workbook = await buildResultsWorkbook(session, standings);
      const blob = await workbookToBlob(workbook);
      downloadBlob(blob, `ket-qua-${session.name}.xlsx`, blob.type);
    } catch {
      toast.error('Không xuất được bảng kết quả.');
    }
  }

  function handleExportJson() {
    if (!session) return;
    downloadText(JSON.stringify(session, null, 2), `phien-${session.id}.json`, 'application/json');
  }

  async function handleFinalize() {
    if (!session) return;
    await upsertSession({ ...session, finalized: true });
    toast.success('Đã chốt kết quả phiên thi.');
  }

  const winner =
    standings.ranked.length > 0 && !standings.hasTie ? standings.ranked[0] : null;
  const unresolvedTie = pendingTiebreak.map(
    (id) => session.config.teams.find((t) => t.id === id)?.name ?? id,
  );

  return (
    <main className="page">
      <div className="container">
        <div className="page-head">
          <div>
            <h1>Kết quả phiên thi</h1>
            <p>
              {session.name} · {session.config.teams.length} đội · {session.rounds.length} lượt
            </p>
          </div>
          <div className="actions-inline">
            <Button onClick={() => navigate('/')}>Về thư viện</Button>
            <Button onClick={handleExportExcel}>
              <IconDownload size={18} /> Xuất Excel
            </Button>
            <Button onClick={handleExportJson}>Sao lưu JSON</Button>
          </div>
        </div>

        {winner ? (
          <Card className="rank-row rank-row--win" as="section">
            <span className="rank-row__pos">
              <IconTrophy size={26} />
            </span>
            <span className="rank-row__name">
              Quán quân: <strong>{winner.teamName}</strong>
            </span>
            <span className="rank-row__score">{winner.score}</span>
          </Card>
        ) : null}

        {unresolvedTie.length > 0 ? (
          <Card as="section">
            <h2 className="card__title">Cần phân định đồng hạng</h2>
            <p>
              Các đội đồng điểm: <strong>{unresolvedTie.join(', ')}</strong>. Dùng bộ “Câu phụ” với
              thẻ giấy A/B/C/D để phân định rồi ghi lại kết quả.
            </p>
            <Button variant="primary" onClick={() => navigate('/setup')}>
              Tổ chức lượt câu phụ
            </Button>
          </Card>
        ) : null}

        <h2>Bảng xếp hạng</h2>
        <ul className="rank-list">
          {standings.ranked.map((item) => {
            const team = session.config.teams.find((t) => t.id === item.teamId);
            const teamRounds = session.rounds.filter((r) => r.counted && r.teamId === item.teamId);
            const correct = teamRounds.reduce((sum, r) => sum + r.correctCount, 0);
            const wrong = teamRounds.reduce((sum, r) => sum + r.wrongCount, 0);
            const open = expanded === item.teamId;
            return (
              <li key={item.teamId} className={`rank-row ${item.rank === 1 && !item.tied ? 'rank-row--win' : ''}`}>
                <span className="rank-row__pos">{item.rank}</span>
                <span className="rank-row__name">
                  <span
                    className="team-dot"
                    style={{ background: team ? teamHex(team.color) : '#6d28d9' }}
                  />
                  {item.teamName}
                  {item.tied ? <Badge tone="warn">Đồng hạng</Badge> : null}
                </span>
                <span className="rank-row__sub">
                  {correct} đúng · {wrong} sai
                </span>
                <span className="rank-row__score">{item.score}</span>
                <Button
                  className="btn--sm"
                  onClick={() => setExpanded(open ? null : item.teamId)}
                  aria-expanded={open}
                >
                  {open ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                </Button>
              </li>
            );
          })}
        </ul>

        {expanded ? <RoundDetails session={session} teamId={expanded} /> : null}

        <div className="toolbar" style={{ marginTop: 'calc(var(--space) * 4)' }}>
          <Button variant="primary" onClick={handleFinalize} disabled={session.finalized}>
            {session.finalized ? 'Đã chốt kết quả' : 'Chốt kết quả phiên'}
          </Button>
          {!session.finalized ? (
            <Button onClick={() => navigate(`/play/${session.id}`)}>Tiếp tục chơi</Button>
          ) : null}
        </div>

      </div>
    </main>
  );
}

function RoundDetails({ session, teamId }: { session: import('../../domain/session').Session; teamId: string }) {
  const rounds = session.rounds.filter((r) => r.teamId === teamId);
  const countedRounds = rounds.filter((r) => r.counted);
  if (countedRounds.length === 0) {
    return <p className="field__hint">Đội này chưa có lượt nào được tính điểm.</p>;
  }
  return (
    <Card as="section" className="grid">
      <h3 className="card__title">Chi tiết lượt thi</h3>
      {rounds.map((round, index) => (
        <div key={round.roundId} className="list-row">
          <div className="list-row__main">
            <strong>
              Lượt {index + 1} {round.counted ? '' : '(không tính điểm)'}
            </strong>
            <div className="list-row__hint">
              {round.correctCount} đúng · {round.wrongCount} sai · {round.cancelledCount} bỏ qua ·{' '}
              {Math.round(round.actualDurationMs / 1000)}s
            </div>
            {round.logs.length > 0 ? (
              <table className="data-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>Câu hỏi</th>
                    <th>Chọn</th>
                    <th>Đáp án</th>
                    <th>Kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {round.logs.map((log) => {
                    const q = session.config.questionSnapshot[log.questionId];
                    const selectedIndex = q?.options.findIndex((o) => o.id === log.selectedOptionId) ?? -1;
                    const correctIndex = q?.options.findIndex((o) => o.id === log.correctOptionId) ?? -1;
                    return (
                      <tr key={log.id}>
                        <td>{q?.text ?? '(không rõ)'}</td>
                        <td>{selectedIndex >= 0 ? OPTION_LETTERS[selectedIndex] : '—'}</td>
                        <td>{correctIndex >= 0 ? OPTION_LETTERS[correctIndex] : '—'}</td>
                        <td>{log.outcome === 'correct' ? 'Đúng' : 'Sai'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      ))}
    </Card>
  );
}


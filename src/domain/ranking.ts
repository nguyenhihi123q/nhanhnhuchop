// Tính bảng xếp hạng và nhóm đồng hạng từ kết quả các lượt.
import type { RoundResult, Session, TiebreakOutcome } from './session';

export type RankedTeam = {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
  tied: boolean;
};

export type Standings = {
  ranked: RankedTeam[];
  /** Các nhóm đồng hạng có từ 2 đội trở lên (theo thứ hạng). */
  tieGroups: { rank: number; teamIds: string[] }[];
  hasTie: boolean;
};

/** Điểm xếp hạng = tổng các lượt có counted=true, gộp theo đội. */
export function computeStandings(session: Session): Standings {
  const totals = new Map<string, { name: string; score: number }>();
  for (const team of session.config.teams) {
    totals.set(team.id, { name: team.name, score: 0 });
  }
  for (const round of session.rounds) {
    if (!round.counted) continue;
    const cur = totals.get(round.teamId);
    if (!cur) continue;
    cur.score += round.score;
  }

  const list = [...totals.entries()].map(([teamId, v]) => ({
    teamId,
    teamName: v.name,
    score: v.score,
  }));

  // Sắp xếp theo điểm giảm dần; thứ hạng cho phép đồng hạng.
  list.sort((a, b) => b.score - a.score);
  const ranked: RankedTeam[] = [];
  let currentRank = 0;
  let prevScore: number | null = null;
  list.forEach((item, index) => {
    if (prevScore === null || item.score !== prevScore) {
      currentRank = index + 1;
      prevScore = item.score;
    }
    ranked.push({ ...item, rank: currentRank, tied: false });
  });

  // Đánh dấu đồng hạng và nhóm.
  const groups = new Map<number, string[]>();
  for (const r of ranked) {
    const arr = groups.get(r.rank) ?? [];
    arr.push(r.teamId);
    groups.set(r.rank, arr);
  }
  const tieGroups: { rank: number; teamIds: string[] }[] = [];
  for (const r of ranked) {
    const group = groups.get(r.rank)!;
    if (group.length > 1) r.tied = true;
  }
  for (const [rank, teamIds] of groups.entries()) {
    if (teamIds.length > 1) tieGroups.push({ rank, teamIds });
  }
  tieGroups.sort((a, b) => a.rank - b.rank);

  return { ranked, tieGroups, hasTie: tieGroups.length > 0 };
}

/** Áp dụng kết quả câu phụ để phá hòa (thay đổi thứ hạng trong nhóm hòa). */
export function teamIdsWithWinningTiebreak(
  session: Session,
  poolTeamIds: string[],
): { winners: Set<string>; resolved: boolean } {
  const relevant = session.tiebreaks.filter(
    (t) =>
      t.attempts.some((a) => poolTeamIds.includes(a.teamId)) &&
      t.attempts.some((a) => a.correct),
  );
  if (relevant.length === 0) return { winners: new Set(), resolved: false };
  const last = relevant[relevant.length - 1] as TiebreakOutcome;
  const correct = last.attempts.filter((a) => a.correct).map((a) => a.teamId);
  if (correct.length === 1) return { winners: new Set(correct), resolved: true };
  return { winners: new Set(), resolved: false };
}

/** Lấy danh sách đội cần phân định (đồng điểm cao nhất chưa phân định). */
export function teamsNeedingTiebreak(session: Session, standings: Standings): string[] {
  for (const group of standings.tieGroups) {
    const { winners, resolved } = teamIdsWithWinningTiebreak(session, group.teamIds);
    if (resolved && winners.size === 1) continue;
    // Chỉ xét nhóm còn tranh chấp (nhiều hơn 1 đội chưa bị loại).
    const eliminated = new Set<string>();
    for (const t of session.tiebreaks) {
      for (const a of t.attempts) {
        if (!a.correct && group.teamIds.includes(a.teamId)) {
          // Chỉ loại khi ở lượt cuối chưa phân định.
        }
      }
    }
    if (group.teamIds.length - eliminated.size > 1) return group.teamIds;
  }
  return [];
}

export type RoundStats = {
  correct: number;
  wrong: number;
  cancelled: number;
  answered: number;
};

export function roundStats(round: RoundResult): RoundStats {
  return {
    correct: round.correctCount,
    wrong: round.wrongCount,
    cancelled: round.cancelledCount,
    answered: round.answeredCount,
  };
}

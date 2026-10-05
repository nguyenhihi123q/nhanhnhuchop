// Trạng thái toàn ứng dụng: thư viện bộ câu hỏi, lịch sử phiên, seed một lần.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { QuestionSet } from '../domain/types';
import type { Session } from '../domain/session';
import { buildSeedSets, TIEBREAK_SET_DEF } from '../data';
import {
  hasSeeded,
  listSessions,
  listSets,
  markSeeded,
  removeSession,
  removeSet,
  saveSession,
  saveSet,
} from '../lib/storage/repository';
import { useToast } from '../components/Toast';

type AppApi = {
  ready: boolean;
  sets: QuestionSet[];
  sessions: Session[];
  tiebreakSet: QuestionSet | null;
  refresh: () => Promise<void>;
  createSet: (set: QuestionSet) => Promise<void>;
  updateSet: (set: QuestionSet) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  restoreSampleSets: () => Promise<void>;
  upsertSession: (session: Session) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
};

const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp phải dùng trong <AppProvider>.');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);

  const refresh = useCallback(async () => {
    const [nextSets, nextSessions] = await Promise.all([listSets(), listSessions()]);
    setSets(nextSets);
    setSessions(nextSessions);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const already = await hasSeeded();
        if (!already) {
          const seeded = buildSeedSets();
          for (const set of seeded) await saveSet(set);
          await markSeeded();
        }
        const nextSets = await listSets();
        const nextSessions = await listSessions();
        if (!cancelled) {
          setSets(nextSets);
          setSessions(nextSessions);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setReady(true);
          toast.error('Không đọc được dữ liệu trên trình duyệt này.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const createSet = useCallback(
    async (set: QuestionSet) => {
      await saveSet(set);
      await refresh();
    },
    [refresh],
  );

  const updateSet = useCallback(
    async (set: QuestionSet) => {
      await saveSet(set);
      await refresh();
    },
    [refresh],
  );

  const deleteSet = useCallback(
    async (id: string) => {
      await removeSet(id);
      await refresh();
    },
    [refresh],
  );

  const restoreSampleSets = useCallback(async () => {
    const seeded = buildSeedSets();
    for (const set of seeded) await saveSet(set);
    await markSeeded();
    await refresh();
  }, [refresh]);

  const upsertSession = useCallback(
    async (session: Session) => {
      await saveSession(session);
      await refresh();
    },
    [refresh],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      await removeSession(id);
      await refresh();
    },
    [refresh],
  );

  const tiebreakSet = useMemo(
    () => sets.find((s) => s.title === TIEBREAK_SET_DEF.title) ?? null,
    [sets],
  );

  const api = useMemo<AppApi>(
    () => ({
      ready,
      sets,
      sessions,
      tiebreakSet,
      refresh,
      createSet,
      updateSet,
      deleteSet,
      restoreSampleSets,
      upsertSession,
      deleteSession,
    }),
    [
      ready,
      sets,
      sessions,
      tiebreakSet,
      refresh,
      createSet,
      updateSet,
      deleteSet,
      restoreSampleSets,
      upsertSession,
      deleteSession,
    ],
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

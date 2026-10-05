// Bọc AudioManager thành React context; khởi tạo AudioContext từ hành động người dùng.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AudioManager } from './audioManager';
import { loadPrefs, savePrefs, type Prefs } from '../prefs';

type AudioApi = {
  manager: AudioManager;
  prefs: Prefs;
  updatePrefs: (patch: Partial<Prefs>) => void;
  /** Phát đoạn thử 1–2 giây để kiểm tra loa; cũng để mở khóa AudioContext. */
  testSound: () => Promise<void>;
  autoplayBlocked: boolean;
  clearBlocked: () => void;
};

const AudioContextReact = createContext<AudioApi | null>(null);

export function useAudio(): AudioApi {
  const ctx = useContext(AudioContextReact);
  if (!ctx) throw new Error('useAudio phải dùng trong <AudioProvider>.');
  return ctx;
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const managerRef = useRef<AudioManager | null>(null);
  if (!managerRef.current) managerRef.current = new AudioManager(prefs);
  const manager = managerRef.current;

  useEffect(() => {
    manager.setPrefs(prefs);
  }, [manager, prefs]);

  useEffect(() => {
    manager.onAutoplayBlocked(() => setAutoplayBlocked(true));
    return () => manager.dispose();
  }, [manager]);

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const testSound = useCallback(async () => {
    await manager.ensureContext();
    await manager.play('start');
  }, [manager]);

  const api = useMemo<AudioApi>(
    () => ({
      manager,
      prefs,
      updatePrefs,
      testSound,
      autoplayBlocked,
      clearBlocked: () => setAutoplayBlocked(false),
    }),
    [manager, prefs, updatePrefs, testSound, autoplayBlocked],
  );

  return <AudioContextReact.Provider value={api}>{children}</AudioContextReact.Provider>;
}

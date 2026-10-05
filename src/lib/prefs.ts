// Tùy chọn nhỏ lưu trong localStorage: âm lượng, bật/tắt âm, bộ lọc, cờ seed.
// Không lưu dữ liệu lớn ở đây (bộ câu hỏi nằm trong IndexedDB).

const KEY = 'nnc-prefs-v1';

export type Prefs = {
  soundEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  seeded: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  soundEnabled: true,
  musicEnabled: true,
  musicVolume: 0.2,
  sfxVolume: 0.6,
  seeded: false,
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      musicVolume: clamp01(parsed.musicVolume ?? DEFAULT_PREFS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULT_PREFS.sfxVolume),
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Bỏ qua: tùy chọn không quan trọng bằng dữ liệu câu hỏi.
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

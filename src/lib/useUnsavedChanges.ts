// Hook cảnh báo rời trang khi còn thay đổi chưa lưu.
import { useEffect } from 'react';

export function useUnsavedChangesWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}

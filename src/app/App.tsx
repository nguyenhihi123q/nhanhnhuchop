// Vỏ ứng dụng: provider, header, điều hướng hash và các trang theo route.
import { useRef } from 'react';
import { ToastProvider, useToast } from '../components/Toast';
import { AudioProvider, useAudio } from '../lib/audio/AudioProvider';
import { AppProvider } from './AppContext';
import { navigate, useRoute } from './useRoute';
import { Button, IconButton } from '../components/ui';
import { IconBolt, IconLeaf, IconSound, IconSoundOff } from '../components/icons';
import { LibraryPage } from '../features/library/LibraryPage';
import { EditorPage } from '../features/library/EditorPage';
import { SetupPage } from '../features/session/SetupPage';
import { StagePage } from '../features/game/StagePage';
import { ResultsPage } from '../features/results/ResultsPage';
import { HelpPage } from './HelpPage';

function AppHeader() {
  const { prefs, updatePrefs, autoplayBlocked, clearBlocked } = useAudio();
  const toast = useToast();
  return (
    <>
      <header className="app-header">
        <div className="container app-header__inner">
          <a className="brand" href="#/">
            <span className="brand__mark" aria-hidden="true">
              <IconBolt size={22} />
            </span>
            <span className="brand__title">
              Nhanh như chớp
              <small>Vòng tinh hoa</small>
            </span>
          </a>
          <nav className="app-header__nav">
            <Button variant="ghost" onClick={() => navigate('/help')}>
              <IconLeaf size={18} />
              <span className="label">Hướng dẫn</span>
            </Button>
            <IconButton
              label={prefs.soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
              aria-pressed={prefs.soundEnabled}
              onClick={() => updatePrefs({ soundEnabled: !prefs.soundEnabled })}
            >
              {prefs.soundEnabled ? <IconSound /> : <IconSoundOff />}
            </IconButton>
          </nav>
        </div>
      </header>
      {autoplayBlocked ? (
        <div className="container">
          <div className="toast toast--error" style={{ marginTop: 8 }}>
            <span className="toast__text">
              Trình duyệt đang chặn âm thanh. Bấm nút bên cạnh để cho phép phát âm thanh rồi tiếp tục.
            </span>
            <Button
              variant="primary"
              className="btn--sm"
              onClick={() => {
                clearBlocked();
                toast.push('Đã bật lại âm thanh. Nếu vẫn im, hãy bấm "Thử âm thanh" ở bước kiểm tra.');
              }}
            >
              Bật âm thanh
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function RouteView() {
  const route = useRoute();
  const lastRoute = useRef(route.name);
  lastRoute.current = route.name;

  switch (route.name) {
    case 'editor':
      return <EditorPage setId={route.setId} />;
    case 'setup':
      return <SetupPage />;
    case 'stage':
      return <StagePage sessionId={route.sessionId} />;
    case 'results':
      return <ResultsPage sessionId={route.sessionId} />;
    case 'help':
      return <HelpPage />;
    case 'library':
    default:
      return <LibraryPage />;
  }
}

export function App() {
  return (
    <ToastProvider>
      <AudioProvider>
        <AppProvider>
          <div className="app-shell">
            <AppHeader />
            <RouteView />
          </div>
        </AppProvider>
      </AudioProvider>
    </ToastProvider>
  );
}

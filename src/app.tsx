import { useEffect, useState } from 'preact/hooks';
import { getFb, isConfigured, type Fb } from './data/firebase';
import { t } from './i18n';
import { useRoute } from './router';
import { Home } from './screens/Home';
import { Create } from './screens/Create';
import { RoomScreen } from './screens/RoomScreen';
import { PinocchioIcon } from './ui/PinocchioIcon';
import { BigScreen } from './screens/BigScreen';

export function App() {
  const route = useRoute();
  const [fb, setFb] = useState<Fb | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isConfigured()) return;
    getFb().then(setFb, (e) => setError(String(e?.message ?? e)));
  }, []);

  if (!isConfigured()) {
    return (
      <div class="page">
        <Logo />
        <div class="card">{t.home.notConfigured}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div class="page">
        <Logo />
        <div class="card error">
          {t.errors.generic}
          <br />
          <small>{error}</small>
        </div>
      </div>
    );
  }
  if (!fb) return <Loading />;
  if (route.name === 'new') return <Create fb={fb} />;
  if (route.name === 'screen' && route.code) return <BigScreen key={route.code} fb={fb} code={route.code} />;
  if (route.name === 'room' && route.code) return <RoomScreen key={route.code} fb={fb} code={route.code} params={route.params} />;
  return <Home fb={fb} />;
}

/** "Pinocchio" + the mascot. `textOnly` when the big mascot is already shown above it. */
export function Logo({ small, textOnly }: { small?: boolean; textOnly?: boolean }) {
  return (
    <div class="logo" style={small ? { fontSize: '26px' } : undefined}>
      <span>{t.appName}</span>
      {!textOnly && <PinocchioIcon size="1.05em" class="wiggle" />}
    </div>
  );
}

export function Loading() {
  return (
    <div class="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <PinocchioIcon size={96} class="mascot-hero" />
      <p class="muted">{t.common.loading}</p>
    </div>
  );
}

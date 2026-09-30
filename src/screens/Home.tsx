import { useState } from 'preact/hooks';
import type { Fb } from '../data/firebase';
import { roomExists } from '../data/room';
import { session } from '../data/session';
import { t } from '../i18n';
import { go } from '../router';
import { Logo } from '../app';
import { cycleTheme } from '../theme';
import { HowToPlay } from '../ui/HowToPlay';

export function Home({ fb }: { fb: Fb }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const last = session.lastRoom();

  const join = async (e: Event) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 4) return;
    setBusy(true);
    if (await roomExists(fb, c)) go(`/r/${c}`);
    else setError(t.join.notFound);
    setBusy(false);
  };

  return (
    <div class="page">
      <div class="row">
        <span class="spacer" />
        <button class="icon-btn" onClick={() => cycleTheme()} aria-label={t.host.theme}>
          🌓
        </button>
      </div>
      <div class="col" style={{ alignItems: 'center', gap: '6px', marginTop: '12px' }}>
        <div class="big-emoji">🪵</div>
        <Logo />
        <p class="muted center">{t.tagline}</p>
      </div>

      {last && (
        <button class="btn wood" onClick={() => go(`/r/${last}`)}>
          {t.home.rejoin(last)}
        </button>
      )}

      <form class="card col" onSubmit={join}>
        <h3>{t.home.join}</h3>
        <input
          class="code-input"
          value={code}
          maxLength={4}
          autocapitalize="characters"
          autocomplete="off"
          autocorrect="off"
          spellcheck={false}
          placeholder={t.home.codePlaceholder}
          aria-label={t.lobby.code}
          onInput={(e) => {
            setCode((e.target as HTMLInputElement).value.toUpperCase().replace(/[^A-Z]/g, ''));
            setError('');
          }}
        />
        {error && <p class="error">{error}</p>}
        <button class="btn" disabled={code.length !== 4 || busy}>
          {t.home.joinButton}
        </button>
      </form>

      <HowToPlay />

      <button class="btn secondary" onClick={() => go('/new')}>
        ✨ {t.home.create}
      </button>

    </div>
  );
}

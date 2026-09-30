import { useState } from 'preact/hooks';
import type { Fb } from '../data/firebase';
import { joinRoom } from '../data/room';
import { session } from '../data/session';
import { t } from '../i18n';
import type { Room } from '../logic/types';
import { AVATARS, AvatarPicker } from '../ui/components';
import { Logo } from '../app';
import { go } from '../router';

export function JoinForm({ fb, code, room, onJoined }: { fb: Fb; code: string; room: Room; onJoined: (pid: string) => void }) {
  const profile = session.profile();
  const taken = Object.values(room.players ?? {})
    .filter((p) => !p.kicked)
    .map((p) => p.avatar);
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(
    profile.avatar && !taken.includes(profile.avatar) ? profile.avatar : AVATARS.find((a) => !taken.includes(a)) ?? AVATARS[0],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = room.state.phase === 'end';
  const inProgress = !started && room.state.phase !== 'lobby' && room.state.phase !== 'truths';

  const join = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const r = await joinRoom(fb, code, name.trim(), avatar);
      if (r.ok) {
        session.saveProfile(name.trim(), avatar);
        session.saveSeat(code, { pid: r.pid });
        onJoined(r.pid);
        return;
      }
      setError({ 'not-found': t.join.notFound, started: t.join.started, full: t.join.full, 'name-taken': t.join.nameTaken }[r.reason]);
    } catch {
      setError(t.errors.generic);
    }
    setBusy(false);
  };

  if (started) {
    return (
      <div class="page">
        <Logo />
        <div class="card center col">
          <div class="big-emoji">⏰</div>
          <p>{t.join.started}</p>
          <button class="btn" onClick={() => go('/')}>
            {t.common.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form class="page" onSubmit={join}>
      <Logo small />
      <h1 class="center">{t.join.title(code)}</h1>
      {inProgress && <p class="card small center">{t.join.inProgress}</p>}
      <div class="players">
        {Object.values(room.players ?? {})
          .filter((p) => !p.kicked)
          .map((p) => (
            <div class="player" key={p.uid}>
              <span class="avatar">{p.avatar}</span>
              <span class="name">{p.name}</span>
            </div>
          ))}
      </div>
      <label class="field">
        {t.profile.name}
        <input value={name} maxLength={20} placeholder={t.profile.namePlaceholder} autocomplete="given-name" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <div class="col">
        <b>{t.profile.avatar}</b>
        <AvatarPicker value={avatar} onChange={setAvatar} taken={taken} />
      </div>
      {error && <p class="error shake">{error}</p>}
      <button class="btn" disabled={busy || !name.trim()}>
        {busy ? t.join.joining : t.join.join}
      </button>
    </form>
  );
}

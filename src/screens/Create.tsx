import { useEffect, useState } from 'preact/hooks';
import type { Fb } from '../data/firebase';
import { PACKS, getPack } from '../data/packs';
import { createRoom, resetHistory, watchHistory } from '../data/room';
import { session } from '../data/session';
import { t } from '../i18n';
import { countFresh, type PromptHistory } from '../logic/prompts';
import type { Meta } from '../logic/types';
import { go } from '../router';
import { AVATARS, AvatarPicker, Seg } from '../ui/components';
import { Logo } from '../app';

export function Create({ fb }: { fb: Fb }) {
  const profile = session.profile();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar || AVATARS[0]);
  const [pack, setPack] = useState(PACKS[0].id);
  const [length, setLength] = useState<Meta['length']>('standard');
  const [mode, setMode] = useState<Meta['mode']>('live');
  const [history, setHistory] = useState<PromptHistory>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => watchHistory(fb, pack, setHistory), [fb, pack]);

  const selected = getPack(pack);
  const fresh = countFresh(selected, history);

  const create = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      session.saveProfile(name.trim(), avatar);
      const { code, pid, hostKey } = await createRoom(fb, { name: name.trim(), avatar, pack, length, mode });
      session.saveSeat(code, { pid, hostKey });
      go(`/r/${code}`);
    } catch {
      setError(t.errors.generic);
      setBusy(false);
    }
  };

  return (
    <form class="page" onSubmit={create}>
      <div class="row">
        <button type="button" class="icon-btn" onClick={() => go('/')} aria-label={t.common.back}>
          ←
        </button>
        <span class="spacer" />
        <Logo small />
        <span class="spacer" />
        <span style={{ width: '44px' }} />
      </div>
      <h1>{t.create.title}</h1>

      <label class="field">
        {t.profile.name}
        <input value={name} maxLength={20} placeholder={t.profile.namePlaceholder} autocomplete="given-name" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <div class="col">
        <b>{t.profile.avatar}</b>
        <AvatarPicker value={avatar} onChange={setAvatar} />
      </div>

      <div class="col">
        <b>{t.create.pack}</b>
        <Seg
          vertical
          value={pack}
          onChange={setPack}
          options={PACKS.map((p) => ({ value: p.id, label: `${p.emoji ?? '🎲'} ${p.name}`, hint: p.description }))}
        />
        <p class="small muted">
          {fresh > 0 ? t.create.freshLeft(fresh, selected.prompts.length) : t.create.allPlayed}{' '}
          {fresh < selected.prompts.length && (
            <button type="button" class="btn ghost small" style={{ display: 'inline', padding: 0, minHeight: 0 }} onClick={() => confirm(t.create.resetConfirm) && resetHistory(fb, pack)}>
              {t.create.resetHistory}
            </button>
          )}
        </p>
      </div>

      <div class="col">
        <b>{t.create.length}</b>
        <Seg
          value={length}
          onChange={setLength}
          options={[
            { value: 'short', label: t.create.short, hint: t.create.shortHint },
            { value: 'standard', label: t.create.standard, hint: t.create.standardHint },
          ]}
        />
      </div>

      <div class="col">
        <b>{t.create.mode}</b>
        <Seg
          vertical
          value={mode}
          onChange={setMode}
          options={[
            { value: 'live', label: `⚡ ${t.create.live}`, hint: t.create.liveHint },
            { value: 'precall', label: `📅 ${t.create.precall}`, hint: t.create.precallHint },
          ]}
        />
      </div>

      {error && <p class="error">{error}</p>}
      <button class="btn" disabled={busy || !name.trim()}>
        {busy ? t.create.creating : t.create.create}
      </button>
    </form>
  );
}

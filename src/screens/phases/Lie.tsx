import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { checkLie, lieUpdates, type LieCheck } from '../../logic/actions';
import { currentSubject, hasSubmitted } from '../../logic/engine';
import { MAX_ANSWER } from '../../logic/normalize';
import { shuffle } from '../../logic/random';
import { WaitingFor } from '../../ui/components';
import { useGame } from '../../ui/game';
import { QuestionHeader } from './QuestionHeader';

const MESSAGES: Record<Exclude<LieCheck, 'ok'>, string> = {
  empty: t.lie.empty,
  'too-long': t.lie.tooLong,
  truth: t.lie.tooClose,
  taken: t.lie.taken,
};

export function Lie() {
  const { room, pid, code, act, pack } = useGame();
  const q = room.state.q;
  const subject = currentSubject(room);
  const myLie = room.priv?.[pid]?.lies?.[q]?.text;
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  if (subject === pid) {
    return (
      <>
        <QuestionHeader />
        <div class="card center col pop-in">
          <div class="big-emoji">🙊</div>
          <h2>{t.lie.subjectTitle}</h2>
          <p class="muted">{t.lie.subjectHint}</p>
        </div>
        <WaitingFor />
      </>
    );
  }

  if (myLie || hasSubmitted(room, pid)) {
    return (
      <>
        <QuestionHeader fill={myLie} />
        <div class="card center col pop-in">
          <div class="big-emoji">🤥</div>
          <h2>{t.lie.locked}</h2>
          <p class="muted">{t.lie.lockedHint}</p>
        </div>
        <WaitingFor />
      </>
    );
  }

  const fail = (msg: string) => {
    setError(msg);
    setShakeKey((k) => k + 1);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    const check = checkLie(room, code, q, text);
    if (check !== 'ok') return fail(MESSAGES[check]);
    setBusy(true);
    const ok = await act(lieUpdates(code, pid, q, text));
    setBusy(false);
    // A write can fail if someone submitted the same lie a split second earlier.
    if (!ok) fail(t.lie.taken);
    else (document.activeElement as HTMLElement | null)?.blur();
  };

  const lieForMe = () => {
    const question = room.pub?.questions?.[q];
    const prompt = pack.prompts.find((p) => p.id === question?.promptId);
    let pool = suggestions.length ? suggestions : shuffle(prompt?.lies ?? []);
    pool = pool.filter((s) => checkLie(room, code, q, s) === 'ok' && s !== text);
    if (!pool.length) return fail(t.lie.noIdeas);
    setText(pool[0]);
    setSuggestions(pool.slice(1));
    setError('');
  };

  return (
    <>
      <QuestionHeader fill={text || undefined} />
      <form class="col" onSubmit={submit}>
        <h2>{t.lie.title}</h2>
        <input
          key={shakeKey}
          class={error ? 'shake' : ''}
          value={text}
          maxLength={MAX_ANSWER}
          placeholder={t.lie.placeholder}
          enterkeyhint="send"
          autocomplete="off"
          data-testid="lie-input"
          onInput={(e) => {
            setText((e.target as HTMLInputElement).value);
            setError('');
          }}
        />
        {error && <p class="error">{error}</p>}
        <div class="row">
          <button type="button" class="btn secondary" style={{ flex: 1 }} onClick={lieForMe}>
            {t.lie.lieForMe}
          </button>
          <button class="btn" style={{ flex: 1 }} disabled={busy || !text.trim()} data-testid="lie-submit">
            {t.lie.submit}
          </button>
        </div>
      </form>
      <WaitingFor onlyMissing />
    </>
  );
}

import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { GAME } from '../../config/game';
import { truthUpdates } from '../../logic/actions';
import { MAX_ANSWER, cleanAnswer } from '../../logic/normalize';
import { activePids, hasSubmitted } from '../../logic/engine';
import { PromptText, Timer, WaitingFor } from '../../ui/components';
import { useGame } from '../../ui/game';

export function Truths() {
  const { room, pid, pack, code, act, isHost } = useGame();
  const dealt = room.pub?.prompts?.[pid] ?? [];
  const saved = room.priv?.[pid]?.truths ?? {};
  const precall = room.meta.mode === 'precall';
  const done = hasSubmitted(room, pid);
  // Once both answers are saved we show "All done"; "Edit my answers" reopens the form.
  const [editing, setEditing] = useState(false);

  // Which dealt prompts are shown: answered ones first, then fresh ones, then spares on "swap".
  const [shown, setShown] = useState<string[]>([]);
  useEffect(() => {
    if (!dealt.length || shown.length) return;
    const answered = dealt.filter((id) => saved[id]);
    const rest = dealt.filter((id) => !saved[id]);
    setShown([...answered, ...rest].slice(0, GAME.truthsPerPlayer));
  }, [dealt.join(',')]);

  // Skipped prompts go to the back of the queue.
  const [skipped, setSkipped] = useState<string[]>([]);
  const swap = (i: number) => {
    const spare = dealt
      .filter((id) => !shown.includes(id) && !saved[id])
      .sort((a, b) => skipped.indexOf(a) - skipped.indexOf(b));
    if (!spare.length) return;
    const next = [...shown];
    setSkipped([...skipped.filter((id) => id !== shown[i]), shown[i]]);
    next[i] = spare[0];
    setShown(next);
  };

  const answered = shown.filter((id) => saved[id]).length;

  if (!dealt.length) return <p class="muted center">{t.common.loading}</p>;

  if (done && !editing) {
    return (
      <>
        {!precall && <Timer />}
        <div class="card center col pop-in">
          <div class="big-emoji">🎉</div>
          <h2>{t.truths.allDone}</h2>
          <p class="muted">{t.truths.allDoneHint}</p>
          <button class="btn secondary" onClick={() => setEditing(true)}>
            ✏️ {t.truths.edit}
          </button>
        </div>
        {isHost && precall && <p class="small muted center">{t.truths.precallHostHint}</p>}
        <WaitingFor />
        {isHost && precall && <p class="small muted center">{t.lobby.players(activePids(room).length)}</p>}
      </>
    );
  }

  return (
    <>
      <h1>{t.truths.title}</h1>
      {!precall && <Timer />}
      <p class="muted">{precall ? t.truths.precallIntro : t.truths.intro}</p>
      {shown.map((id, i) => {
        const prompt = pack.prompts.find((p) => p.id === id);
        if (!prompt) return null;
        return (
          <TruthCard
            key={id}
            template={prompt.me}
            value={saved[id] ?? ''}
            canSwap={dealt.some((d) => !shown.includes(d) && !saved[d])}
            onSwap={() => swap(i)}
            onSave={(text) => act(truthUpdates(room, code, pid, id, text, prompt.me))}
          />
        );
      })}
      <p class="small muted center">{t.truths.answered(answered, GAME.truthsPerPlayer)}</p>
      {done && (
        <button class="btn" onClick={() => setEditing(false)}>
          {t.truths.done}
        </button>
      )}
      <WaitingFor onlyMissing />
    </>
  );
}

function TruthCard({ template, value, canSwap, onSwap, onSave }: { template: string; value: string; canSwap: boolean; onSwap: () => void; onSave: (t: string) => Promise<boolean> }) {
  const [text, setText] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>(value ? 'saved' : 'idle');
  const dirty = cleanAnswer(text, template) !== value.trim();

  const save = async (e: Event) => {
    e.preventDefault();
    if (!text.trim()) return;
    setState('saving');
    const ok = await onSave(text);
    setState(ok ? 'saved' : 'idle');
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <form class="card col slide-up" onSubmit={save}>
      <PromptText template={template} fill={value || undefined} />
      <input
        value={text}
        maxLength={MAX_ANSWER}
        placeholder={t.truths.placeholder}
        enterkeyhint="done"
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
      />
      <div class="row">
        {!value && canSwap && (
          <button type="button" class="btn secondary small" onClick={onSwap}>
            {t.truths.swap}
          </button>
        )}
        <span class="spacer" />
        {state === 'saved' && !dirty ? (
          <span class="small" style={{ color: 'var(--truth)', fontWeight: 700 }}>
            {t.truths.saved}
          </span>
        ) : (
          <button class="btn small" disabled={!text.trim() || state === 'saving'}>
            {t.common.save}
          </button>
        )}
      </div>
    </form>
  );
}

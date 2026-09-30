import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { SCORING } from '../../config/scoring';
import { checkFinal, finalUpdates, finalVoteUpdates } from '../../logic/actions';
import { hasSubmitted } from '../../logic/engine';
import { MAX_ANSWER } from '../../logic/normalize';
import { Avatar, PlayerMini, Timer, WaitingFor, buzz, confetti } from '../../ui/components';
import { useGame } from '../../ui/game';

function FinalHeader({ noTimer }: { noTimer?: boolean }) {
  const { room } = useGame();
  const n = room.pub?.final?.length ?? 0;
  return (
    <div class="col">
      <div class="row">
        <span class="round-pill">
          {t.round.title(3)} {t.round.doubleShort}
        </span>
        <span class="spacer" />
        {room.state.phase !== 'f-write' && <span class="small muted nowrap">{t.round.questionOf(room.state.q + 1, n)}</span>}
      </div>
      {!noTimer && <Timer />}
    </div>
  );
}

export function FinalWrite() {
  const { room, pid, code, act } = useGame();
  const saved = room.priv?.[pid]?.final;
  const [truth, setTruth] = useState(saved?.truth ?? '');
  const [fib, setFib] = useState(saved?.fib ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (saved && hasSubmitted(room, pid)) {
    return (
      <>
        <FinalHeader />
        <div class="card center col pop-in">
          <div class="big-emoji">🤐</div>
          <h2>{t.final.locked}</h2>
        </div>
        <WaitingFor />
      </>
    );
  }

  const submit = async (e: Event) => {
    e.preventDefault();
    const check = checkFinal(truth, fib);
    if (check === 'same') return setError(t.final.same);
    if (check === 'too-long') return setError(t.lie.tooLong);
    if (check !== 'ok') return setError(t.lie.empty);
    setBusy(true);
    await act(finalUpdates(code, pid, truth, fib));
    setBusy(false);
  };

  return (
    <form class="col" onSubmit={submit} style={{ gap: '14px' }}>
      <FinalHeader />
      <h1>🎭 {t.round.title(3)}</h1>
      <p class="muted">{t.final.intro}</p>
      <label class="field">
        ✅ {t.final.truth}
        <input value={truth} maxLength={MAX_ANSWER} placeholder={t.final.truthPlaceholder} data-testid="final-truth" onInput={(e) => setTruth((e.target as HTMLInputElement).value)} />
      </label>
      <label class="field">
        🤥 {t.final.fib}
        <input value={fib} maxLength={MAX_ANSWER} placeholder={t.final.fibPlaceholder} data-testid="final-fib" onInput={(e) => setFib((e.target as HTMLInputElement).value)} />
      </label>
      {error && <p class="error shake">{error}</p>}
      <button class="btn" disabled={busy || !truth.trim() || !fib.trim()} data-testid="final-submit">
        {t.final.submit}
      </button>
      <WaitingFor onlyMissing />
    </form>
  );
}

export function FinalPick() {
  const { room, pid, code, act } = useGame();
  const i = room.state.q;
  const fq = room.pub?.final?.[i];
  if (!fq) return null;
  const subject = room.players?.[fq.subject];
  const isSubject = fq.subject === pid;
  const vote = room.priv?.[pid]?.fvotes?.[i];
  return (
    <>
      <FinalHeader />
      <div class="card subject-banner">
        <Avatar player={subject} size="lg" />
        <h2>{isSubject ? t.final.subjectTitle : t.final.pickTitle(subject?.name ?? '')}</h2>
      </div>
      {isSubject && <p class="muted center">{t.final.subjectHint}</p>}
      <div class="tf-grid" data-testid="tf-options">
        {fq.options.map((text, idx) => (
          <button
            key={idx}
            class={`tf-option slide-up ${vote === idx ? 'selected' : ''}`}
            style={{ animationDelay: `${idx * 0.1}s` }}
            disabled={isSubject}
            onClick={() => {
              buzz(20);
              void act(finalVoteUpdates(code, pid, i, idx as 0 | 1));
            }}
          >
            {text}
          </button>
        ))}
      </div>
      <WaitingFor onlyMissing />
    </>
  );
}

export function FinalReveal() {
  const { room, pid } = useGame();
  const { q: i, step } = room.state;
  const fq = room.pub?.final?.[i];
  const fr = room.pub?.finalReveal?.[i];
  const shown = step >= 1;
  const iWasRight = !!fr?.right?.includes(pid);
  useEffect(() => {
    if (shown && (iWasRight || fq?.subject === pid)) confetti(1600);
  }, [shown]);
  if (!fq || !fr) return null;
  const subject = room.players?.[fq.subject];
  const right = fr.right ?? [];
  const fooled = fr.fooled ?? [];
  const mult = SCORING.multiplier[3] ?? 1;
  const votersFor = (idx: number) => (idx === fr.truthIndex ? right : fooled);

  return (
    <>
      <FinalHeader noTimer />
      <div class="card subject-banner">
        <Avatar player={subject} size="lg" />
        <h2>{t.final.pickTitle(subject?.name ?? '')}</h2>
      </div>
      <div class="tf-grid" data-testid="final-reveal">
        {fq.options.map((text, idx) => {
          const isTrue = idx === fr.truthIndex;
          return (
            <div key={`${idx}-${shown}`} class={`tf-option ${shown ? (isTrue ? 'is-true' : 'is-fib') : ''}`}>
              {shown && <span class="stamp" style={{ '--stamp-delay': '0s', ...(isTrue ? {} : { color: 'var(--lie)', borderColor: 'var(--lie)' }) }}>{isTrue ? t.final.trueLabel : t.final.fibLabel}</span>}
              <span>{text}</span>
              <div class="pickers">
                {votersFor(idx).map((p, k) => (
                  <PlayerMini key={p} pid={p} delay={0.2 + k * 0.12} />
                ))}
              </div>
              <span class="small muted">{t.final.votes(votersFor(idx).length)}</span>
            </div>
          );
        })}
      </div>
      {shown && (
        <div class="points-list">
          {right.length > 0 && (
            <div class="points-row">
              <span>{t.final.right}</span>
              <span class="pts plus">{t.final.each(SCORING.pickedTruth * mult)}</span>
            </div>
          )}
          {fooled.length > 0 && (
            <div class="points-row">
              <Avatar player={subject} size="sm" />
              <span>
                {subject?.name} · {fooled.length} {t.reveal.fooledYou}
              </span>
              <span class="pts plus">{t.common.plusPoints(SCORING.perPlayerFooled * fooled.length * mult)}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

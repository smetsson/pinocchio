import { useEffect } from 'preact/hooks';
import { t } from '../../i18n';
import { SCORING } from '../../config/scoring';
import { currentRound } from '../../logic/engine';
import type { RevealStep } from '../../logic/types';
import { Avatar, PlayerMini, confetti } from '../../ui/components';
import { useGame } from '../../ui/game';
import { QuestionHeader } from './QuestionHeader';

export function Reveal() {
  const { room } = useGame();
  const { q, step } = room.state;
  const reveal = room.pub?.reveal?.[q];
  if (!reveal) return null;
  const steps = reveal.steps ?? [];
  const truth = steps.find((s) => s.kind === 'truth');
  const current = steps[step];
  return (
    <>
      <QuestionHeader noTimer fill={!current || current.kind === 'truth' ? truth?.text : undefined} />
      {current ? <RevealCard key={`${q}-${step}`} step={current} /> : <Summary truthText={truth?.text ?? ''} />}
      <div class="row" style={{ justifyContent: 'center', gap: '6px' }}>
        {[...steps, null].map((_, i) => (
          <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: i === step ? 'var(--accent)' : 'var(--line)' }} />
        ))}
      </div>
    </>
  );
}

function RevealCard({ step }: { step: RevealStep }) {
  const { room, pid } = useGame();
  const mult = SCORING.multiplier[currentRound(room)] ?? 1;
  const pickers = step.pickers ?? [];
  const stampDelay = 0.8 + pickers.length * 0.18 + 0.5;
  const author = step.author ? room.players?.[step.author] : undefined;
  const iPicked = pickers.includes(pid);

  useEffect(() => {
    if (step.kind !== 'truth') return;
    const id = setTimeout(() => confetti(iPicked ? 2400 : 1400), stampDelay * 1000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div class={`reveal-card ${step.kind}`} style={{ '--stamp-delay': `${stampDelay}s` }} data-testid="reveal-card">
      <div class="answer">“{step.text}”</div>
      <div class="col" style={{ gap: '6px' }}>
        <span class="small muted">{pickers.length ? t.reveal.pickedBy : step.kind === 'truth' ? t.reveal.nobodyFound : t.reveal.nobody}</span>
        <div class="pickers">
          {pickers.map((p, i) => (
            <PlayerMini key={p} pid={p} delay={0.5 + i * 0.18} />
          ))}
        </div>
      </div>
      <div class="stamp">
        {step.kind === 'truth' && t.reveal.truth}
        {step.kind === 'house' && t.reveal.houseLie}
        {step.kind === 'lie' && (
          <>
            <span class="nose-grow">🤥</span>
            <Avatar player={author} size="sm" />
            {t.reveal.lieBy(author?.name ?? '?')}
          </>
        )}
      </div>
      {step.kind === 'lie' && pickers.length > 0 && (
        <div class="stamp" style={{ border: 'none', transform: 'none', fontSize: '22px' }}>
          {t.common.plusPoints(SCORING.perPlayerFooled * pickers.length * mult)}
        </div>
      )}
      {step.kind === 'truth' && pickers.length > 0 && (
        <div class="stamp" style={{ border: 'none', transform: 'none', fontSize: '22px' }}>
          {t.common.plusPoints(SCORING.pickedTruth * mult)} {iPicked ? '🎉' : ''}
        </div>
      )}
      {step.likes > 0 && <div class="small">{t.reveal.likes(step.likes)}</div>}
    </div>
  );
}

function Summary({ truthText }: { truthText: string }) {
  const { room } = useGame();
  const { q } = room.state;
  const reveal = room.pub!.reveal![q];
  const rows = Object.entries(reveal.deltas ?? {})
    .map(([pid, pts]) => ({ pid, pts }))
    .sort((a, b) => b.pts - a.pts);
  const unpicked = reveal.unpicked ?? [];
  return (
    <>
      <div class="reveal-card truth" style={{ padding: '14px' }}>
        <span class="small muted">{t.reveal.truth}</span>
        <div class="answer" style={{ fontSize: '24px' }}>
          “{truthText}”
        </div>
      </div>
      {unpicked.length > 0 && (
        <div class="col">
          <h3 class="small muted">{t.reveal.alsoLies}</h3>
          {unpicked.map((s) => (
            <div class="points-row" key={s.optId}>
              <span>
                “{s.text}” <span class="muted small">— {s.kind === 'house' ? t.reveal.houseLie : room.players?.[s.author ?? '']?.name}</span>
              </span>
              {s.likes > 0 && <span class="pts">{t.reveal.likes(s.likes)}</span>}
            </div>
          ))}
        </div>
      )}
      <h3>{t.reveal.points}</h3>
      <div class="points-list">
        {rows.map((r, i) => (
          <div class="points-row" key={r.pid} style={{ animationDelay: `${i * 0.08}s` }}>
            <Avatar player={room.players?.[r.pid]} size="sm" />
            <span>{room.players?.[r.pid]?.name}</span>
            <span class={`pts ${r.pts > 0 ? 'plus' : 'muted'}`}>{r.pts > 0 ? t.common.plusPoints(r.pts) : '—'}</span>
          </div>
        ))}
      </div>
    </>
  );
}

import { SCORING } from '../config/scoring';
import { t } from '../i18n';

/** Collapsible game rules. Point values come from the scoring settings, so they always match the game. */
export function HowToPlay({ open }: { open?: boolean }) {
  const boosted = Object.entries(SCORING.multiplier).filter(([, m]) => m > 1);
  return (
    <details class="howto card" open={open}>
      <summary>{t.howTo.title}</summary>
      <ol class="howto-steps">
        {t.howTo.steps.map((s) => (
          <li key={s.title}>
            <span class="howto-icon" aria-hidden="true">
              {s.icon}
            </span>
            <div>
              <b>{s.title}</b>
              <p class="small muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div class="howto-points">
        <b>{t.howTo.pointsTitle}</b>
        <ul class="small">
          <li>{t.howTo.points.truth(SCORING.pickedTruth)}</li>
          <li>{t.howTo.points.fooled(SCORING.perPlayerFooled)}</li>
          <li>{t.howTo.points.like(SCORING.perLike)}</li>
          {boosted.map(([round, m]) => (
            <li key={round}>
              <b>{t.howTo.points.multiplier(t.round.title(Number(round)), m)}</b>
            </li>
          ))}
        </ul>
      </div>
      <p class="small muted">{t.howTo.tip}</p>
    </details>
  );
}

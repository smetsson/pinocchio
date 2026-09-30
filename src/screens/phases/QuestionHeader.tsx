import { t } from '../../i18n';
import { SCORING } from '../../config/scoring';
import { currentRound, currentSubject } from '../../logic/engine';
import { Avatar, PromptText, Timer } from '../../ui/components';
import { useGame } from '../../ui/game';

/** Round label, "question 2 of 4", subject and the prompt about them. */
export function QuestionHeader({ fill, noTimer }: { fill?: string; noTimer?: boolean }) {
  const { room, pack } = useGame();
  const q = room.state.q;
  const question = room.pub?.questions?.[q];
  const round = currentRound(room);
  const inRound = (room.pub?.questions ?? []).filter((x) => x.round === round);
  const index = inRound.indexOf(question!) + 1;
  const subject = room.players?.[currentSubject(room) ?? ''];
  const prompt = pack.prompts.find((p) => p.id === question?.promptId);
  return (
    <div class="col">
      <div class="row">
        <span class="round-pill">
          {t.round.title(round)}
          {(SCORING.multiplier[round] ?? 1) > 1 ? ` · ${t.round.points(SCORING.multiplier[round])}` : ''}
        </span>
        <span class="spacer" />
        <span class="small muted nowrap">{t.round.questionOf(Math.max(1, index), inRound.length)}</span>
      </div>
      {!noTimer && <Timer />}
      <div class="card subject-banner">
        <Avatar player={subject} size="lg" />
        {prompt ? <PromptText template={prompt.them} name={subject?.name} fill={fill} /> : <p class="prompt">{question?.promptId}</p>}
      </div>
    </div>
  );
}

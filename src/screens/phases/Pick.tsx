import { t } from '../../i18n';
import { likeUpdates, voteUpdates } from '../../logic/actions';
import { currentSubject } from '../../logic/engine';
import { Progress, WaitingFor, buzz } from '../../ui/components';
import { useGame } from '../../ui/game';
import { QuestionHeader } from './QuestionHeader';

export function Pick() {
  const { room, pid, code, act, spectator } = useGame();
  const q = room.state.q;
  const options = room.pub?.options?.[q] ?? [];
  const isSubject = currentSubject(room) === pid;
  const watching = isSubject || !!spectator;
  const mine = room.toPlayer?.[pid]?.mine?.[q];
  const vote = room.priv?.[pid]?.votes?.[q];
  const like = room.priv?.[pid]?.likes?.[q];

  return (
    <>
      <QuestionHeader />
      <h2>{spectator ? t.pick.title : isSubject ? t.pick.subjectTitle : vote ? t.pick.picked : t.pick.title}</h2>
      {isSubject && <p class="muted">{t.pick.subjectHint}</p>}
      <Progress />
      <div class="options" data-testid="options">
        {options.map((o, i) => {
          const isMine = o.id === mine;
          return (
            <div class="option" key={o.id} style={{ animationDelay: `${i * 0.07}s` }}>
              <button
                class={`option-btn ${vote === o.id ? 'selected' : ''} ${isMine ? 'mine' : ''}`}
                disabled={watching || isMine}
                onClick={() => {
                  buzz(20);
                  void act(voteUpdates(code, pid, q, o.id));
                }}
              >
                {isMine && <span class="tag">{t.pick.yours}</span>}
                {o.text}
              </button>
              {!watching && !isMine && (
                <button
                  class={`like-btn ${like === o.id ? 'on' : ''}`}
                  aria-label="like"
                  aria-pressed={like === o.id}
                  onClick={() => act(likeUpdates(code, pid, q, like === o.id ? null : o.id))}
                >
                  👍
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!watching && <p class="small muted center">{t.pick.likeHint}</p>}
      <WaitingFor onlyMissing noProgress />
    </>
  );
}

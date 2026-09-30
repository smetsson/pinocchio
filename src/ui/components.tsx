import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import QRCode from 'qrcode';
import { t } from '../i18n';
import { isAway, hasSubmitted, expectedPids, statusKey } from '../logic/engine';
import type { Pid, Player } from '../logic/types';
import { useGame } from './game';

export const AVATARS = ['🦊', '🐸', '🐼', '🐙', '🦄', '🐯', '🐨', '🐵', '🦉', '🐧', '🐢', '🦖', '🐝', '🦋', '🐳', '🦀', '🍕', '🌵', '🍩', '🚀', '👽', '🤖', '🦥', '🐞'];

export function Avatar({ player, size, away, badge }: { player?: Player; size?: 'sm' | 'lg'; away?: boolean; badge?: string }) {
  return (
    <span class={`avatar ${size ?? ''} ${away ? 'away' : ''}`} aria-hidden="true">
      {player?.avatar ?? '❔'}
      {badge && <span class="badge">{badge}</span>}
    </span>
  );
}

export function AvatarPicker({ value, onChange, taken = [] }: { value: string; onChange: (a: string) => void; taken?: string[] }) {
  return (
    <div class="avatar-grid" role="radiogroup" aria-label={t.profile.avatar}>
      {AVATARS.map((a) => (
        <button
          type="button"
          key={a}
          role="radio"
          aria-checked={a === value}
          class={a === value ? 'selected' : ''}
          disabled={taken.includes(a) && a !== value}
          onClick={() => onChange(a)}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string>({
  value,
  onChange,
  options,
  vertical,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; hint?: string }[];
  vertical?: boolean;
}) {
  return (
    <div class={`seg ${vertical ? 'vertical' : ''}`} role="radiogroup">
      {options.map((o) => (
        <button type="button" key={o.value} role="radio" aria-checked={o.value === value} class={o.value === value ? 'selected' : ''} onClick={() => onChange(o.value)}>
          {o.label}
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
    </div>
  );
}

/** Re-render every `ms` milliseconds. */
export function useTicker(ms = 250): void {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Countdown bar. `bare` = just the bar (no seconds, no red warning), e.g. on title cards. */
export function Timer({ bare }: { bare?: boolean }) {
  const { room, now } = useGame();
  useTicker(250);
  const { deadline } = room.state;
  const total = useRef({ deadline: 0, span: 1 });
  if (!deadline) return null;
  const left = Math.max(0, deadline - now());
  // Remember the span when a new deadline appears (so the bar starts full, and "+30s" refills it).
  if (total.current.deadline !== deadline) total.current = { deadline, span: Math.max(left, 1000) };
  const secs = Math.ceil(left / 1000);
  const low = !bare && secs <= 10;
  return (
    <div class="row" aria-live="off">
      <div class={`timer grow ${low ? 'low' : ''}`}>
        <div class="fill" style={{ transform: `scaleX(${Math.min(1, left / total.current.span)})` }} />
      </div>
      {!bare && <span class={`timer-label ${low ? 'low' : ''}`}>{t.timer.seconds(secs)}</span>}
    </div>
  );
}

/** Shows who still has to submit in this phase. The host can tap a player to remove them. */
/** "👀 4 of 5 have picked" with a bar, for the current phase. */
export function Progress() {
  const { room } = useGame();
  const expected = expectedPids(room);
  const done = expected.filter((pid) => hasSubmitted(room, pid)).length;
  const key = statusKey(room.state)?.split('-')[0] ?? '';
  const label = t.waiting.progress[key]?.(done, expected.length);
  if (!label || !expected.length) return null;
  return (
    <div class="progress-pill" data-testid="progress">
      <span key={done} class="pop-in">
        {label}
      </span>
      <div class="progress-bar">
        <div style={{ transform: `scaleX(${done / expected.length})` }} />
      </div>
    </div>
  );
}

export function WaitingFor({ onlyMissing, noProgress }: { onlyMissing?: boolean; noProgress?: boolean }) {
  const { room, now, isHost, host, pid: me } = useGame();
  useTicker(2000);
  const expected = expectedPids(room);
  if (!expected.length) return null;
  const missing = expected.filter((pid) => !hasSubmitted(room, pid));
  const shown = onlyMissing ? missing : expected;
  return (
    <div class="col">
      {!noProgress && <Progress />}
      <h3 class="small muted">{missing.length ? t.waiting.title : t.waiting.everyone}</h3>
      <div class="waiting">
        {shown.map((pid) => {
          const p = room.players?.[pid];
          const done = hasSubmitted(room, pid);
          const away = isAway(room, pid, now());
          return (
            <button
              key={pid}
              class={`who ${done ? 'done' : ''}`}
              style={{ cursor: isHost && pid !== me ? 'pointer' : 'default' }}
              onClick={() => isHost && pid !== me && p && confirm(t.host.kickConfirm(p.name)) && host.kick(pid)}
            >
              <Avatar player={p} away={away} />
              <span>
                {p?.name}
                {away && !done ? ` · ${t.waiting.away}` : ''}
              </span>
              <span>{done ? '✅' : '⏳'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PlayerMini({ pid, delay = 0 }: { pid: Pid; delay?: number }) {
  const { room } = useGame();
  const p = room.players?.[pid];
  return (
    <span class="player-mini" style={{ animationDelay: `${delay}s` }}>
      <Avatar player={p} size="sm" />
      <span>{p?.name}</span>
    </span>
  );
}

export function QR({ text }: { text: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 360, color: { dark: '#2b1d14', light: '#ffffff' } }).then(setSrc, () => setSrc(''));
  }, [text]);
  return src ? (
    <div class="qr">
      <img src={src} alt="QR code" />
    </div>
  ) : null;
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ComponentChildren }) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()} role="dialog">
        {children}
      </div>
    </div>
  );
}

/** Animate a number from `from` to `to` (after `delay` ms), for scoreboards. */
export function useCountUp(from: number, to: number, delay = 0, duration = 1200): number {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    setValue(from);
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, delay, duration]);
  return value;
}

/** Small dependency-free confetti burst. */
export function confetti(duration = 1800) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#ff5a36', '#1faa59', '#8b4dff', '#f5b301', '#2fa4ff', '#ff4fa3'];
  const parts = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 12 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (t: number) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

export function buzz(ms = 30) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

export async function shareOrCopy(url: string, title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ url, title, text });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed';
  }
  return copyText(url);
}

export async function copyText(text: string): Promise<'copied' | 'failed'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** Renders "The weirdest job ____" with a styled blank, replacing {name}. */
export function PromptText({ template, name, fill }: { template: string; name?: string; fill?: string }) {
  const text = name ? template.replace(/\{name\}/g, name) : template;
  const [before, after] = text.split('____');
  return (
    <p class="prompt">
      {before}
      <span class="blank">{fill ?? '    '}</span>
      {after ?? ''}
    </p>
  );
}

import { useLayoutEffect, useRef, useState } from 'react';
import type { SessionEntry, Task, Project } from '../types';
import { BUSY_WORK_ID } from '../utils/focusSessionStatus';

export interface LiveInterval {
  start: number;
  end: number | null;
}

interface Props {
  history: SessionEntry[];
  tasks: Task[];
  projects: Project[];
  liveIntervals: LiveInterval[];
  liveTaskId: string | null;
  liveTaskTitle: string | null;
  isRunning: boolean;
}

const START_HOUR = 6;
const END_HOUR = 20;
// Zoomed in enough that a normal 25min session renders at a comfortable
// ~42px — legible without needing the label to be hidden or the block
// inflated past its real duration. The day no longer fits in the drawer at
// a glance; the view scrolls (see focus-timeline-track's overflow) and
// auto-scrolls to "now" on open.
const HOUR_PX = 100;
// A floor just large enough that a block stays visible/hoverable — NOT large
// enough to misrepresent duration. Inflating it (as an earlier version did,
// disproportionately to the scale) made short or back-to-back sessions
// visually swallow whichever session started next, since the next block's
// bar would start underneath the still-"long" previous one and paint over it.
const MIN_BLOCK_PX = 4;
// Below this, the label text clips against the block's own padding — the
// label is simply omitted rather than inflating the block to fit it; the
// hover title always has the exact times regardless.
const LABEL_MIN_PX = 13;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function startOfDay(ts: number): Date {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d;
}

function windowFor(day: Date) {
  const start = new Date(day);
  start.setHours(START_HOUR, 0, 0, 0);
  const end = new Date(day);
  end.setHours(END_HOUR, 0, 0, 0);
  return { windowStart: start.getTime(), windowEnd: end.getTime() };
}

function msToY(ms: number, windowStart: number) {
  return ((ms - windowStart) / HOUR_MS) * HOUR_PX;
}

function fmtHour(h: number) {
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${period}`;
}

function fmtClock(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

interface Block {
  key: string;
  top: number;
  height: number;
  title: string;
  color: string;
  completed: boolean;
  live: boolean;
  running: boolean;
  startMs: number;
  endMs: number;
}

export function SessionTimeline({ history, tasks, projects, liveIntervals, liveTaskId, liveTaskTitle, isRunning }: Props) {
  const [dayOffset, setDayOffset] = useState(0);
  // The live (not-yet-logged) segments and the "now" line need to advance
  // every second while this view is open — Date.now() can't be called
  // directly in the render body, so it's sampled lazily on mount and then
  // refreshed from the interval's own callback (not synchronously in the
  // effect body) to avoid a same-render cascade.
  const [now, setNow] = useState(() => Date.now());
  const nowLineRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // The day no longer fits without scrolling at this zoom level — land on
  // "now" when opening today's timeline (or switching back to it) instead
  // of making the user scroll down to find it; other days land at the top.
  useLayoutEffect(() => {
    if (nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ block: 'center' });
    } else {
      trackRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [dayOffset]);

  const day = startOfDay(now + dayOffset * DAY_MS);
  const { windowStart, windowEnd } = windowFor(day);
  const isToday = dayOffset === 0;

  function colorForTask(taskId: string): string {
    if (taskId === BUSY_WORK_ID) return 'var(--text-muted)';
    const task = tasks.find(t => t.id === taskId);
    const project = task?.projectId ? projects.find(p => p.id === task.projectId) : null;
    return project?.color ?? 'var(--accent)';
  }

  const blocks: Block[] = [];

  for (const entry of history) {
    const endMs = entry.completedAt;
    const startMs = endMs - entry.sessionSecs * 1000;
    if (endMs <= windowStart || startMs >= windowEnd) continue;
    const clampedStart = Math.max(startMs, windowStart);
    const clampedEnd = Math.min(endMs, windowEnd);
    blocks.push({
      key: entry.id,
      top: msToY(clampedStart, windowStart),
      height: Math.max(msToY(clampedEnd, windowStart) - msToY(clampedStart, windowStart), MIN_BLOCK_PX),
      title: entry.taskTitle,
      color: colorForTask(entry.taskId),
      completed: !!entry.taskCompleted,
      live: false,
      running: false,
      startMs, endMs,
    });
  }

  if (isToday && liveTaskId && liveIntervals.length > 0) {
    const title = liveTaskTitle ?? 'Unknown task';
    const color = colorForTask(liveTaskId);
    liveIntervals.forEach((iv, i) => {
      const endMs = iv.end ?? now;
      if (endMs <= windowStart || iv.start >= windowEnd) return;
      const clampedStart = Math.max(iv.start, windowStart);
      const clampedEnd = Math.min(endMs, windowEnd);
      const running = iv.end === null && isRunning;
      blocks.push({
        key: `live-${i}`,
        top: msToY(clampedStart, windowStart),
        height: Math.max(msToY(clampedEnd, windowStart) - msToY(clampedStart, windowStart), MIN_BLOCK_PX),
        title,
        color,
        completed: false,
        live: true,
        running,
        startMs: iv.start, endMs,
      });
    });
  }

  const showNowLine = isToday && now >= windowStart && now <= windowEnd;
  const nowTop = showNowLine ? msToY(now, windowStart) : 0;

  const hours: number[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) hours.push(h);

  const dayLabel = isToday ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const trackHeight = (END_HOUR - START_HOUR) * HOUR_PX;

  const hasPaused = liveTaskId && liveIntervals.length > 0 && !isRunning;

  return (
    <div className="focus-timeline">
      <div className="focus-timeline-nav">
        <button className="focus-timeline-nav-btn" onClick={() => setDayOffset(o => o - 1)} title="Previous day">‹</button>
        <span className="focus-timeline-nav-label">
          {dayLabel}
          {isToday && hasPaused && <span className="focus-timeline-paused-badge"> · ⏸ paused</span>}
        </span>
        <button className="focus-timeline-nav-btn" onClick={() => setDayOffset(o => o + 1)} disabled={isToday} title="Next day">›</button>
      </div>
      <div ref={trackRef} className="focus-timeline-track" style={{ height: trackHeight }}>
        {hours.map(h => (
          <div key={h} className="focus-timeline-hour-row" style={{ top: (h - START_HOUR) * HOUR_PX }}>
            <span className="focus-timeline-hour-label">{fmtHour(h)}</span>
            <div className="focus-timeline-hour-line" />
          </div>
        ))}
        {blocks.length === 0 && (
          <p className="focus-history-empty focus-timeline-empty">No sessions logged {isToday ? 'today' : 'on this day'}</p>
        )}
        {blocks.map(b => (
          <div
            key={b.key}
            className={`focus-timeline-block${b.completed ? ' focus-timeline-block--completed' : ''}${b.live ? ' focus-timeline-block--live' : ''}${b.running ? ' focus-timeline-block--running' : ''}`}
            style={{ top: b.top, height: b.height, background: b.live ? undefined : b.color + '33', borderColor: b.color }}
            title={`${b.title} · ${fmtClock(b.startMs)}–${fmtClock(b.endMs)}`}
          >
            {b.height >= LABEL_MIN_PX && (
              <span className="focus-timeline-block-label" style={{ color: b.color }}>
                {b.live && !b.running ? '⏸ ' : ''}{b.title}
              </span>
            )}
          </div>
        ))}
        {showNowLine && <div ref={nowLineRef} className="focus-timeline-now" style={{ top: nowTop }} />}
      </div>
    </div>
  );
}

import { useCallback, useId, useRef, useState } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label?: string;
  color?: string;
  size?: number;
  log?: boolean;
  step?: number;
  bipolar?: boolean;
  defaultValue?: number;
  format?: (v: number) => string;
  disabled?: boolean;
}

const START = -135;
const SWEEP = 270;
const DOTS = 25;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
};

export function Knob({
  value,
  min,
  max,
  onChange,
  label,
  color = '#ffb347',
  size = 54,
  log = false,
  step,
  bipolar = false,
  defaultValue,
  format,
  disabled,
}: KnobProps) {
  const [active, setActive] = useState(false);
  const [hover, setHover] = useState(false);
  const drag = useRef<{ y: number; t: number } | null>(null);
  const gid = useId().replace(/:/g, '');

  const toT = useCallback(
    (v: number) => {
      if (log) return Math.log(Math.max(min, v) / min) / Math.log(max / min);
      return (v - min) / (max - min);
    },
    [log, min, max],
  );
  const fromT = useCallback(
    (t: number) => {
      const c = Math.min(1, Math.max(0, t));
      let v = log ? min * Math.pow(max / min, c) : min + c * (max - min);
      if (step) v = Math.round(v / step) * step;
      return Math.min(max, Math.max(min, v));
    },
    [log, min, max, step],
  );

  const t = Math.min(1, Math.max(0, toT(value)));
  const angle = START + t * SWEEP;

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t };
    setActive(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const sens = e.shiftKey ? 700 : 180;
    const nt = drag.current.t + (drag.current.y - e.clientY) / sens;
    onChange(fromT(nt));
  };
  const end = () => {
    drag.current = null;
    setActive(false);
  };
  const onWheel = (e: React.WheelEvent) => {
    if (disabled) return;
    const d = e.deltaY > 0 ? -1 : 1;
    const inc = step && (max - min) / step <= 60 ? step / (max - min) : 0.02;
    onChange(fromT(t + d * inc));
  };

  const cx = size / 2;
  const cy = size / 2;
  const rRing = size * 0.46;
  const rDots = size * 0.4;
  const rCap = size * 0.29;
  const glow = active ? 1 : hover ? 0.75 : 0.5;
  const center = bipolar ? 0.5 : 0;
  const lo = Math.min(center, t);
  const hi = Math.max(center, t);

  const display = format ? format(value) : value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);

  return (
    <div
      className={`knob flex select-none flex-col items-center gap-0.5 ${disabled ? 'opacity-35' : ''}`}
      style={{ width: size + 12 }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <svg
        width={size}
        height={size}
        className="cursor-ns-resize touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onWheel={onWheel}
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        style={{ filter: `drop-shadow(0 0 ${3 + glow * 6}px ${color}${Math.round(glow * 110).toString(16).padStart(2, '0')})` }}
      >
        <defs>
          <radialGradient id={`cap${gid}`} cx="40%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#5b5f68" />
            <stop offset="45%" stopColor="#2a2d33" />
            <stop offset="100%" stopColor="#0d0e11" />
          </radialGradient>
          <linearGradient id={`skirt${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a3d44" />
            <stop offset="100%" stopColor="#101115" />
          </linearGradient>
        </defs>
        {/* track */}
        <path d={arcPath(cx, cy, rRing, START, START + SWEEP)} stroke="#1b1d22" strokeWidth={size * 0.05} fill="none" strokeLinecap="round" />
        {hi - lo > 0.001 && (
          <path
            d={arcPath(cx, cy, rRing, START + lo * SWEEP, START + hi * SWEEP)}
            stroke={color}
            strokeOpacity={0.35 + glow * 0.5}
            strokeWidth={size * 0.035}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* LED dots */}
        {Array.from({ length: DOTS }, (_, i) => {
          const dt = i / (DOTS - 1);
          const on = dt >= lo - 0.001 && dt <= hi + 0.001;
          const [x, y] = polar(cx, cy, rDots, START + dt * SWEEP);
          const edge = Math.abs(dt - t) < 1 / (DOTS - 1);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={size * (edge && on ? 0.028 : 0.022)}
              fill={on ? color : '#2a2c31'}
              opacity={on ? 0.55 + glow * 0.45 : 0.8}
            />
          );
        })}
        {/* cap */}
        <circle cx={cx} cy={cy + 1.5} r={rCap + 2} fill="#000" opacity={0.6} />
        <circle cx={cx} cy={cy} r={rCap + 1.5} fill={`url(#skirt${gid})`} />
        <circle cx={cx} cy={cy} r={rCap} fill={`url(#cap${gid})`} stroke="#000" strokeOpacity={0.5} />
        <g transform={`rotate(${angle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy - rCap * 0.25} x2={cx} y2={cy - rCap * 0.9} stroke={color} strokeWidth={2} strokeLinecap="round" />
        </g>
      </svg>
      {label && <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{label}</div>}
      <div
        className="lcd-mini min-w-[38px] rounded-sm px-1 text-center font-mono text-[9px] leading-[13px]"
        style={{ color, textShadow: `0 0 ${active ? 6 : 3}px ${color}` }}
      >
        {display}
      </div>
    </div>
  );
}

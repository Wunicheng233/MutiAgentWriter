import type {CSSProperties, ReactNode} from 'react';
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {totalFrames} from './content';
import {theme} from './theme';

type Still =
  | 'dashboard'
  | 'create-brief'
  | 'overview'
  | 'reader'
  | 'editor'
  | 'quality'
  | 'export'
  | 'versions';

type CursorPoint = {
  frame: number;
  x: number;
  y: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const ease = (value: number) => interpolate(value, [0, 1], [0, 1], {easing: (t) => t * t * (3 - 2 * t)});

const fadeIn = (frame: number, duration = 16) =>
  interpolate(frame, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const fadeOut = (frame: number, total: number, duration = 16) =>
  interpolate(frame, [total - duration, total], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const fade = (frame: number, total: number, duration = 16) => fadeIn(frame, duration) * fadeOut(frame, total, duration);

const range = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

const smooth = (frame: number, from: number, to: number) => ease(range(frame, from, to));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

const cursorPosition = (points: CursorPoint[], frame: number) => {
  if (points.length === 1 || frame <= points[0].frame) {
    return {x: points[0].x, y: points[0].y};
  }

  const last = points[points.length - 1];
  if (frame >= last.frame) {
    return {x: last.x, y: last.y};
  }

  const segmentIndex = points.findIndex((point, index) => index < points.length - 1 && frame >= point.frame && frame <= points[index + 1].frame);
  const index = Math.max(0, segmentIndex);
  const p0 = points[Math.max(index - 1, 0)];
  const p1 = points[index];
  const p2 = points[index + 1];
  const p3 = points[Math.min(index + 2, points.length - 1)];
  const rawT = clamp((frame - p1.frame) / Math.max(1, p2.frame - p1.frame), 0, 1);
  const t = 0.5 - Math.cos(rawT * Math.PI) / 2;

  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
  };
};

const still = (name: Still) => staticFile(`stills/${name}.png`);

const baseText: CSSProperties = {
  margin: 0,
  fontFamily: theme.fonts.sans,
  letterSpacing: 0,
};

const buttonBase: CSSProperties = {
  height: 56,
  borderRadius: 14,
  border: `1px solid ${theme.colors.line}`,
  background: 'rgba(255, 253, 248, 0.96)',
  color: theme.colors.ink,
  fontFamily: theme.fonts.sans,
  fontSize: 24,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 24px',
  boxShadow: '0 16px 36px rgba(58, 46, 36, 0.08)',
};

const PrimaryButton = ({children, compact = false}: {children: ReactNode; compact?: boolean}) => (
  <div
    style={{
      ...buttonBase,
      height: compact ? 44 : 56,
      padding: compact ? '0 18px' : '0 26px',
      background: theme.colors.pine,
      color: theme.colors.white,
      borderColor: 'rgba(95, 135, 111, 0.24)',
      fontSize: compact ? 18 : 24,
      boxShadow: '0 18px 42px rgba(69, 105, 86, 0.24)',
    }}
  >
    {children}
  </div>
);

const SceneBackdrop = ({children, dark = false}: {children: ReactNode; dark?: boolean}) => (
  <AbsoluteFill
    style={{
      overflow: 'hidden',
      background: dark
        ? `radial-gradient(circle at 78% 20%, rgba(95, 135, 111, 0.26), transparent 34%), linear-gradient(135deg, #1d211f, #2b302b 56%, #161817)`
        : `radial-gradient(circle at 14% 16%, rgba(223, 127, 88, 0.11), transparent 28%), radial-gradient(circle at 86% 18%, rgba(95, 135, 111, 0.22), transparent 34%), linear-gradient(135deg, ${theme.colors.paper}, ${theme.colors.paperWarm} 55%, ${theme.colors.paperMist})`,
      color: dark ? theme.colors.white : theme.colors.ink,
      fontFamily: theme.fonts.serif,
    }}
  >
    {children}
  </AbsoluteFill>
);

const FilmGrain = ({opacity = 0.13}: {opacity?: number}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      mixBlendMode: 'multiply',
      backgroundImage:
        'linear-gradient(90deg, rgba(62, 52, 44, 0.045) 1px, transparent 1px), linear-gradient(0deg, rgba(62, 52, 44, 0.03) 1px, transparent 1px)',
      backgroundSize: '5px 5px',
    }}
  />
);

const SceneTitle = ({
  kicker,
  title,
  x = 108,
  y = 84,
  maxWidth = 520,
  light = false,
}: {
  kicker: string;
  title: string;
  x?: number;
  y?: number;
  maxWidth?: number;
  light?: boolean;
}) => {
  const frame = useCurrentFrame();
  const show = fadeIn(frame, 18);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: maxWidth,
        opacity: show,
        transform: `translateY(${interpolate(show, [0, 1], [14, 0])}px)`,
        zIndex: 20,
      }}
    >
      <div
        style={{
          ...baseText,
          fontSize: 18,
          letterSpacing: 8,
          textTransform: 'uppercase',
          color: light ? 'rgba(255,250,244,0.72)' : theme.colors.pine,
          marginBottom: 12,
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: theme.fonts.serif,
          fontSize: 54,
          fontWeight: 500,
          lineHeight: 1.12,
          color: light ? theme.colors.white : theme.colors.ink,
          textWrap: 'balance',
        }}
      >
        {title}
      </h2>
    </div>
  );
};

const ProductShot = ({
  asset,
  frame,
  scaleFrom = 1.06,
  scaleTo = 1,
  xFrom = 0,
  xTo = 0,
  yFrom = 0,
  yTo = 0,
  dim = 0,
  radius = 0,
}: {
  asset: Still;
  frame: number;
  scaleFrom?: number;
  scaleTo?: number;
  xFrom?: number;
  xTo?: number;
  yFrom?: number;
  yTo?: number;
  dim?: number;
  radius?: number;
}) => {
  const move = smooth(frame, 0, 90);
  return (
    <>
      <Img
        src={still(asset)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: radius,
          transform: `translate(${interpolate(move, [0, 1], [xFrom, xTo])}px, ${interpolate(
            move,
            [0, 1],
            [yFrom, yTo]
          )}px) scale(${interpolate(move, [0, 1], [scaleFrom, scaleTo])})`,
          filter: `saturate(0.98) contrast(1.01) brightness(${1 - dim})`,
        }}
      />
      {dim > 0 ? (
        <AbsoluteFill
          style={{
            background: `rgba(36, 30, 24, ${dim})`,
          }}
        />
      ) : null}
    </>
  );
};

const Cursor = ({
  points,
  visibleFrom = 0,
  visibleTo = 9999,
  clickFrames = [],
}: {
  points: CursorPoint[];
  visibleFrom?: number;
  visibleTo?: number;
  clickFrames?: number[];
}) => {
  const frame = useCurrentFrame();
  if (frame < visibleFrom || frame > visibleTo || points.length === 0) {
    return null;
  }

  const current = cursorPosition(points, frame);
  const previous = cursorPosition(points, Math.max(points[0].frame, frame - 4));
  const trailing = [5, 10].map((offset) => cursorPosition(points, Math.max(points[0].frame, frame - offset)));
  const velocityX = current.x - previous.x;
  const velocityY = current.y - previous.y;
  const speed = Math.hypot(velocityX, velocityY);
  const tilt = clamp(velocityX * 0.1 + velocityY * 0.035, -10, 10);
  const nearestClick = clickFrames
    .map((clickFrame) => ({clickFrame, distance: Math.abs(frame - clickFrame), age: frame - clickFrame}))
    .filter(({distance}) => distance <= 9)
    .sort((a, b) => a.distance - b.distance)[0];
  const press = nearestClick ? 1 - nearestClick.distance / 9 : 0;
  const ripple = clickFrames
    .map((clickFrame) => frame - clickFrame)
    .filter((age) => age >= 0 && age <= 24)
    .sort((a, b) => a - b)[0];
  const rippleProgress = ripple === undefined ? 1 : ripple / 24;
  const visibleOpacity = fade(frame - visibleFrom, Math.max(1, visibleTo - visibleFrom), 10);
  const trailOpacity = clamp(speed / 80, 0, 0.18) * visibleOpacity;

  return (
    <div
      style={{
        position: 'absolute',
        left: current.x,
        top: current.y,
        zIndex: 80,
        pointerEvents: 'none',
        opacity: visibleOpacity,
      }}
    >
      {trailing.map((point, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: point.x - current.x + 8,
            top: point.y - current.y + 10,
            width: 18 - index * 4,
            height: 18 - index * 4,
            borderRadius: 999,
            background: `rgba(25, 25, 23, ${trailOpacity * (index === 0 ? 0.75 : 0.45)})`,
            filter: 'blur(3px)',
          }}
        />
      ))}
      {ripple !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: -22,
            top: -22,
            width: 64,
            height: 64,
            borderRadius: 999,
            border: `2px solid rgba(95, 135, 111, ${0.45 * (1 - rippleProgress)})`,
            background: `rgba(95, 135, 111, ${0.11 * (1 - rippleProgress)})`,
            transform: `scale(${interpolate(rippleProgress, [0, 1], [0.62, 1.9])})`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'relative',
          width: 38,
          height: 46,
          filter: `drop-shadow(0 ${8 + press * 2}px ${14 + press * 3}px rgba(28, 24, 20, 0.28))`,
          transform: `rotate(${-8 + tilt}deg) scale(${1 - press * 0.12})`,
          transformOrigin: '4px 4px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: 'polygon(0 0, 0 39px, 12px 30px, 19px 46px, 29px 42px, 22px 27px, 38px 27px)',
            background: '#fffdf8',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 4,
            top: 4,
            width: 29,
            height: 36,
            clipPath: 'polygon(0 0, 0 30px, 9px 23px, 15px 36px, 22px 33px, 16px 21px, 29px 21px)',
            background: '#171716',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 11,
            top: 11,
            width: 8,
            height: 14,
            borderRadius: 999,
            background: 'rgba(255, 255, 255, 0.16)',
            transform: 'rotate(-22deg)',
            filter: 'blur(0.4px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 13,
            top: 15,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: `rgba(95, 135, 111, ${0.08 + press * 0.08})`,
            filter: 'blur(8px)',
            transform: `scale(${1 + press * 0.4})`,
          }}
        />
      </div>
    </div>
  );
};

const FocusWindow = ({
  asset,
  source,
  target,
  frame,
  from = 0,
  to = 24,
  label,
}: {
  asset: Still;
  source: Rect;
  target: Rect;
  frame: number;
  from?: number;
  to?: number;
  label?: string;
}) => {
  const show = smooth(frame, from, to);
  const exit = 1 - smooth(frame, to + 72, to + 104);
  const opacity = show * exit;
  const zoom = Math.min(target.width / source.width, target.height / source.height);

  return (
    <div
      style={{
        position: 'absolute',
        left: target.x,
        top: target.y,
        width: target.width,
        height: target.height,
        borderRadius: 24,
        overflow: 'hidden',
        border: `1px solid ${theme.colors.line}`,
        boxShadow: '0 28px 80px rgba(58, 46, 36, 0.20)',
        opacity,
        transform: `translateY(${interpolate(show, [0, 1], [18, 0])}px) scale(${interpolate(show, [0, 1], [0.96, 1])})`,
        background: theme.colors.white,
        zIndex: 40,
      }}
    >
      <Img
        src={still(asset)}
        style={{
          position: 'absolute',
          width: 1920 * zoom,
          height: 1080 * zoom,
          left: -source.x * zoom,
          top: -source.y * zoom,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
        }}
      />
      {label ? (
        <div
          style={{
            position: 'absolute',
            left: 18,
            bottom: 16,
            padding: '8px 12px',
            borderRadius: 999,
            background: 'rgba(255, 253, 248, 0.86)',
            color: theme.colors.pineDark,
            fontFamily: theme.fonts.sans,
            fontSize: 16,
            boxShadow: '0 10px 22px rgba(58, 46, 36, 0.10)',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

const Pill = ({
  children,
  active = false,
  light = false,
}: {
  children: ReactNode;
  active?: boolean;
  light?: boolean;
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 38,
      borderRadius: 999,
      padding: '0 15px',
      background: active
        ? theme.colors.pine
        : light
          ? 'rgba(255, 253, 248, 0.12)'
          : 'rgba(255, 253, 248, 0.88)',
      color: active ? theme.colors.white : light ? 'rgba(255, 253, 248, 0.84)' : theme.colors.muted,
      border: active ? '1px solid rgba(255,255,255,0.18)' : `1px solid ${light ? 'rgba(255,255,255,0.16)' : theme.colors.line}`,
      fontFamily: theme.fonts.sans,
      fontSize: 18,
      boxShadow: active ? '0 14px 28px rgba(69, 105, 86, 0.18)' : undefined,
    }}
  >
    {children}
  </div>
);

const OpeningScene = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const intro = spring({frame, fps, config: {damping: 18, stiffness: 92}});
  const writing = smooth(frame, 38, 72);
  const underline = smooth(frame, 58, 94);
  const exit = fadeOut(frame, duration, 18);

  return (
    <SceneBackdrop>
      <FilmGrain opacity={0.12} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: exit,
        }}
      >
        <div style={{textAlign: 'center', transform: `translateY(${interpolate(intro, [0, 1], [30, 0])}px)`}}>
          <div
            style={{
              ...baseText,
              fontSize: 19,
              letterSpacing: 12,
              textTransform: 'uppercase',
              color: theme.colors.pine,
              marginBottom: 32,
            }}
          >
            MultiAgentWriter
          </div>
          <h1
            style={{
              margin: 0,
              fontFamily: theme.fonts.serif,
              fontSize: 104,
              fontWeight: 500,
              lineHeight: 1,
              color: theme.colors.ink,
            }}
          >
            Vibe Coding?{' '}
            <span
              style={{
                display: 'inline-block',
                color: theme.colors.pineDark,
                transform: `translateX(${interpolate(writing, [0, 1], [26, 0])}px)`,
                opacity: writing,
              }}
            >
              Vibe Writing!
            </span>
          </h1>
          <div
            style={{
              margin: '30px auto 0',
              height: 3,
              width: 810 * underline,
              background: `linear-gradient(90deg, transparent, ${theme.colors.pine}, transparent)`,
              opacity: 0.56,
            }}
          />
          <p
            style={{
              ...baseText,
              margin: '34px 0 0',
              fontSize: 38,
              color: theme.colors.muted,
              opacity: smooth(frame, 78, 112),
            }}
          >
            更高效，更沉浸、更有灵魂
          </p>
        </div>
      </div>
    </SceneBackdrop>
  );
};

const ShelfScene = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  return (
    <SceneBackdrop>
      <ProductShot asset="dashboard" frame={frame} scaleFrom={1.08} scaleTo={1.02} yFrom={18} yTo={0} dim={0.02} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(248,242,234,0.72), transparent 45%, rgba(248,242,234,0.12))'}} />
      <SceneTitle kicker="Shelf" title="作品书架" maxWidth={390} />
      <div
        style={{
          position: 'absolute',
          left: 108,
          bottom: 122,
          display: 'flex',
          gap: 14,
          opacity: smooth(frame, 28, 52),
          zIndex: 30,
        }}
      >
        <Pill active>生成中 55%</Pill>
        <Pill>已完成</Pill>
        <Pill>质量评分</Pill>
      </div>
      <FocusWindow
        asset="dashboard"
        source={{x: 1028, y: 125, width: 300, height: 130}}
        target={{x: 1320, y: 122, width: 410, height: 178}}
        frame={frame}
        from={54}
        to={78}
        label="新建项目"
      />
      <FocusWindow
        asset="dashboard"
        source={{x: 566, y: 292, width: 430, height: 330}}
        target={{x: 1076, y: 604, width: 520, height: 398}}
        frame={frame}
        from={86}
        to={112}
        label="真实项目卡片"
      />
      <Cursor
        points={[
          {frame: 28, x: 1340, y: 162},
          {frame: 70, x: 1512, y: 166},
          {frame: 110, x: 1240, y: 720},
          {frame: duration - 12, x: 1230, y: 720},
        ]}
        visibleFrom={28}
        visibleTo={duration - 12}
        clickFrames={[72, 116]}
      />
      <FilmGrain opacity={0.08} />
    </SceneBackdrop>
  );
};

const CreateSkillScene = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const typed = smooth(frame, 22, 58);
  const skillShow = smooth(frame, 70, 96);
  const selected = smooth(frame, 118, 148);

  return (
    <SceneBackdrop>
      <ProductShot asset="create-brief" frame={frame} scaleFrom={1.05} scaleTo={1.01} xFrom={-12} xTo={0} dim={0.01} />
      <SceneTitle kicker="Brief + Skill" title="创作配置" x={102} y={76} maxWidth={390} />
      <div
        style={{
          position: 'absolute',
          left: 680,
          top: 580,
          width: 365 * typed,
          height: 3,
          background: theme.colors.pine,
          opacity: 0.52,
          zIndex: 18,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 700,
          top: 758,
          width: 548,
          padding: '18px 22px',
          borderRadius: 18,
          background: 'rgba(255, 253, 248, 0.92)',
          border: `1px solid ${theme.colors.line}`,
          boxShadow: theme.shadow,
          opacity: smooth(frame, 38, 68),
          zIndex: 24,
        }}
      >
        <div style={{...baseText, fontSize: 16, color: theme.colors.faint, marginBottom: 8}}>作品简介</div>
        <div style={{fontFamily: theme.fonts.serif, color: theme.colors.ink, fontSize: 26, lineHeight: 1.45}}>
          一个只能用剩余寿命兑换线索的重生者，试图改写十年前的失败。
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 106,
          top: 254,
          width: 542,
          opacity: skillShow,
          transform: `translateX(${interpolate(skillShow, [0, 1], [54, 0])}px)`,
          zIndex: 35,
        }}
      >
        <div
          style={{
            borderRadius: 26,
            background: 'rgba(255, 253, 248, 0.92)',
            border: `1px solid ${theme.colors.line}`,
            boxShadow: '0 28px 86px rgba(58, 46, 36, 0.16)',
            padding: 24,
          }}
        >
          <div style={{...baseText, fontSize: 16, letterSpacing: 7, color: theme.colors.pine, marginBottom: 18}}>
            WRITER STYLE
          </div>
          {[
            ['鲁迅', '冷峻反讽 · 现实针脚'],
            ['刘慈欣', '宏大尺度 · 技术奇观'],
            ['海明威', '克制短句 · 冰山原则'],
          ].map(([name, desc], index) => {
            const active = index === 0;
            return (
              <div
                key={name}
                style={{
                  height: 90,
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 22px',
                  marginTop: index === 0 ? 0 : 14,
                  background: active ? theme.colors.pine : theme.colors.white,
                  color: active ? theme.colors.white : theme.colors.ink,
                  border: `1px solid ${active ? 'rgba(255,255,255,0.18)' : theme.colors.line}`,
                  boxShadow: active ? '0 18px 46px rgba(69, 105, 86, 0.20)' : undefined,
                  transform: active ? `scale(${interpolate(selected, [0, 1], [1, 1.025])})` : undefined,
                }}
              >
                <div>
                  <div style={{fontFamily: theme.fonts.serif, fontSize: 30}}>{name}</div>
                  <div style={{...baseText, fontSize: 16, marginTop: 5, opacity: 0.76}}>{desc}</div>
                </div>
                <Pill active={active}>{active ? '启用' : '可选'}</Pill>
              </div>
            );
          })}
        </div>
      </div>
      <Cursor
        points={[
          {frame: 20, x: 1066, y: 754},
          {frame: 88, x: 1390, y: 344},
          {frame: 134, x: 1612, y: 354},
          {frame: duration - 10, x: 1612, y: 354},
        ]}
        visibleFrom={20}
        visibleTo={duration - 10}
        clickFrames={[136]}
      />
      <FilmGrain opacity={0.08} />
    </SceneBackdrop>
  );
};

const AgentNode = ({
  label,
  detail,
  index,
  activeFrame,
}: {
  label: string;
  detail: string;
  index: number;
  activeFrame: number;
}) => {
  const frame = useCurrentFrame();
  const active = smooth(frame, activeFrame, activeFrame + 18) * (1 - smooth(frame, activeFrame + 48, activeFrame + 68));
  return (
    <div
      style={{
        position: 'relative',
        width: 230,
        height: 146,
        borderRadius: 24,
        background: active > 0.2 ? theme.colors.pine : 'rgba(255, 253, 248, 0.90)',
        color: active > 0.2 ? theme.colors.white : theme.colors.ink,
        border: `1px solid ${active > 0.2 ? 'rgba(255,255,255,0.22)' : theme.colors.line}`,
        boxShadow:
          active > 0.2 ? '0 30px 72px rgba(69, 105, 86, 0.28)' : '0 18px 50px rgba(58, 46, 36, 0.10)',
        padding: 22,
        transform: `translateY(${interpolate(active, [0, 1], [0, -14])}px)`,
        zIndex: 10 + index,
      }}
    >
      <div style={{fontFamily: theme.fonts.serif, fontSize: 32, lineHeight: 1}}>{label}</div>
      <div style={{...baseText, fontSize: 17, lineHeight: 1.45, marginTop: 16, opacity: 0.76}}>{detail}</div>
      <div
        style={{
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 18,
          height: 3,
          borderRadius: 999,
          background: active > 0.2 ? 'rgba(255,255,255,0.58)' : theme.colors.line,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.round(active * 100)}%`,
            height: '100%',
            background: active > 0.2 ? theme.colors.white : theme.colors.pine,
          }}
        />
      </div>
    </div>
  );
};

const WorkflowScene = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const modal = smooth(frame, 98, 124);
  return (
    <SceneBackdrop>
      <ProductShot asset="overview" frame={frame} scaleFrom={1.04} scaleTo={1.01} dim={0.1} />
      <AbsoluteFill style={{background: 'rgba(248,242,234,0.38)'}} />
      <SceneTitle kicker="Workflow" title="写作闭环" x={100} y={80} maxWidth={390} />
      <div
        style={{
          position: 'absolute',
          left: 156,
          right: 156,
          top: 414,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 28,
        }}
      >
        {[
          ['Planner', '拆章节与场景'],
          ['Writer', '完成初稿'],
          ['Critic', '逐段评审'],
          ['Reviser', '定向修订'],
          ['Confirm', '人在节点把关'],
        ].map(([label, detail], index) => (
          <AgentNode key={label} label={label} detail={detail} index={index} activeFrame={28 + index * 24} />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 260,
          right: 260,
          top: 494,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${theme.colors.pine}, transparent)`,
          opacity: 0.28,
          zIndex: 20,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 166,
          bottom: 118,
          width: 490,
          borderRadius: 28,
          padding: 28,
          background: 'rgba(255,253,248,0.95)',
          border: `1px solid ${theme.colors.line}`,
          boxShadow: '0 32px 92px rgba(58, 46, 36, 0.22)',
          opacity: modal,
          transform: `translateY(${interpolate(modal, [0, 1], [26, 0])}px) scale(${interpolate(modal, [0, 1], [0.96, 1])})`,
          zIndex: 45,
        }}
      >
        <div style={{...baseText, color: theme.colors.pine, letterSpacing: 6, fontSize: 15, marginBottom: 14}}>
          CHAPTER CONFIRM
        </div>
        <div style={{fontFamily: theme.fonts.serif, fontSize: 34, color: theme.colors.ink}}>第 2 章草稿已完成</div>
        <div style={{...baseText, color: theme.colors.muted, fontSize: 19, lineHeight: 1.55, marginTop: 12}}>
          人工确认后再进入下一章，逐章共创不会跳步。
        </div>
        <div style={{display: 'flex', gap: 14, marginTop: 24}}>
          <div style={{...buttonBase, height: 46, fontSize: 18}}>修改意见</div>
          <PrimaryButton compact>通过并继续</PrimaryButton>
        </div>
      </div>
      <Cursor
        points={[
          {frame: 28, x: 268, y: 474},
          {frame: 54, x: 588, y: 474},
          {frame: 80, x: 910, y: 474},
          {frame: 112, x: 1330, y: 474},
          {frame: 148, x: 1472, y: 894},
          {frame: duration - 10, x: 1472, y: 894},
        ]}
        visibleFrom={24}
        visibleTo={duration - 10}
        clickFrames={[150]}
      />
      <FilmGrain opacity={0.08} />
    </SceneBackdrop>
  );
};

const SelectionPanel = ({frame}: {frame: number}) => {
  const panel = smooth(frame, 84, 112);
  const loading = smooth(frame, 128, 146) * (1 - smooth(frame, 162, 180));
  const result = smooth(frame, 168, 202);
  return (
    <div
      style={{
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 398,
        background: 'rgba(255, 253, 248, 0.98)',
        borderLeft: `1px solid ${theme.colors.line}`,
        boxShadow: '-28px 0 70px rgba(58, 46, 36, 0.12)',
        transform: `translateX(${interpolate(panel, [0, 1], [420, 0])}px)`,
        opacity: panel,
        zIndex: 46,
        fontFamily: theme.fonts.sans,
      }}
    >
      <div style={{height: 72, display: 'flex', borderBottom: `1px solid ${theme.colors.line}`}}>
        <div
          style={{
            flex: 1,
            display: 'grid',
            placeItems: 'center',
            color: theme.colors.faint,
            fontSize: 17,
          }}
        >
          AI 助手
        </div>
        <div
          style={{
            flex: 1,
            display: 'grid',
            placeItems: 'center',
            color: theme.colors.pineDark,
            borderBottom: `3px solid ${theme.colors.pine}`,
            fontWeight: 700,
            fontSize: 17,
          }}
        >
          选区操作
        </div>
      </div>
      <div style={{padding: 22, borderBottom: `1px solid ${theme.colors.line}`}}>
        <div style={{fontSize: 14, color: theme.colors.faint, marginBottom: 8}}>选中的文本：</div>
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: theme.colors.paper,
            color: theme.colors.muted,
            fontSize: 16,
            lineHeight: 1.5,
          }}
        >
          屏幕上的弹窗还在闪烁：“优化通知……”
        </div>
      </div>
      <div style={{padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
        {['润色', '扩写', '缩写', '增强张力'].map((action, index) => (
          <div
            key={action}
            style={{
              height: 44,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 12,
              border: `1px solid ${index === 0 ? theme.colors.pine : theme.colors.line}`,
              background: index === 0 ? theme.colors.pineSoft : theme.colors.white,
              color: index === 0 ? theme.colors.pineDark : theme.colors.ink,
              fontSize: 16,
            }}
          >
            {action}
          </div>
        ))}
      </div>
      <div style={{padding: 22}}>
        <div
          style={{
            height: 86,
            display: 'grid',
            placeItems: 'center',
            opacity: loading,
            color: theme.colors.pineDark,
            fontSize: 17,
          }}
        >
          AI 正在改写中...
        </div>
        <div style={{opacity: result, transform: `translateY(${interpolate(result, [0, 1], [16, 0])}px)`}}>
          <div style={{fontSize: 14, color: theme.colors.faint, marginBottom: 10}}>改写结果对比：</div>
          <div
            style={{
              borderRadius: 14,
              background: theme.colors.paper,
              padding: 16,
              color: theme.colors.ink,
              fontSize: 16,
              lineHeight: 1.65,
            }}
          >
            屏幕上的弹窗
            <span style={{background: 'rgba(223, 127, 88, 0.18)', color: '#b55d39', textDecoration: 'line-through'}}>
              还在闪烁
            </span>
            <span style={{background: 'rgba(95, 135, 111, 0.18)', color: theme.colors.pineDark}}>
              像一枚反复跳动的诊断灯
            </span>
            ：“优化通知……”
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 24,
          display: 'flex',
          gap: 12,
          opacity: result,
        }}
      >
        <div style={{...buttonBase, flex: 1, height: 46, fontSize: 17, boxShadow: 'none'}}>放弃</div>
        <div style={{...buttonBase, flex: 1, height: 46, fontSize: 17, background: theme.colors.pine, color: theme.colors.white}}>
          应用
        </div>
      </div>
    </div>
  );
};

const SelectionAIScene = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const select = smooth(frame, 36, 72);
  const toolbar = smooth(frame, 66, 86) * (1 - smooth(frame, 102, 118));
  const applied = smooth(frame, 212, 238);

  return (
    <SceneBackdrop>
      <ProductShot asset="editor" frame={frame} scaleFrom={1.04} scaleTo={1.015} xFrom={-8} xTo={0} dim={0.03} />
      <AbsoluteFill style={{background: 'linear-gradient(90deg, rgba(248,242,234,0.48), transparent 35%, rgba(248,242,234,0.10))'}} />
      <SceneTitle kicker="AI Rewrite" title="选区润色" x={104} y={72} maxWidth={390} />
      <div
        style={{
          position: 'absolute',
          left: 108,
          top: 214,
          display: 'flex',
          gap: 12,
          opacity: smooth(frame, 16, 36),
          zIndex: 26,
        }}
      >
        <Pill>就地对比</Pill>
        <Pill>一键应用</Pill>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 688,
          top: 412,
          width: 588,
          height: 94,
          borderRadius: 10,
          background: `rgba(95, 135, 111, ${0.22 * select})`,
          boxShadow: `0 0 0 2px rgba(95,135,111,${0.28 * select})`,
          opacity: select,
          zIndex: 24,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 352,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 12,
          padding: '8px 10px',
          background: 'rgba(255, 253, 248, 0.98)',
          border: `1px solid ${theme.colors.line}`,
          boxShadow: '0 18px 48px rgba(58, 46, 36, 0.17)',
          opacity: toolbar,
          transform: `translateY(${interpolate(toolbar, [0, 1], [10, 0])}px)`,
          zIndex: 42,
          fontFamily: theme.fonts.sans,
        }}
      >
        {['润色', '扩写', '缩写'].map((label, index) => (
          <div
            key={label}
            style={{
              height: 38,
              padding: '0 13px',
              borderRadius: 10,
              display: 'grid',
              placeItems: 'center',
              color: index === 0 ? theme.colors.white : theme.colors.ink,
              background: index === 0 ? theme.colors.pine : 'transparent',
              fontSize: 16,
            }}
          >
            {label}
          </div>
        ))}
        <div style={{width: 1, height: 24, background: theme.colors.line, margin: '0 4px'}} />
        <div style={{height: 38, padding: '0 12px', display: 'grid', placeItems: 'center', fontSize: 16}}>更多</div>
      </div>
      <SelectionPanel frame={frame} />
      <div
        style={{
          position: 'absolute',
          left: 680,
          top: 398,
          width: 684,
          padding: 28,
          borderRadius: 22,
          background: 'rgba(255,253,248,0.96)',
          border: `1px solid ${theme.colors.line}`,
          boxShadow: '0 28px 90px rgba(58, 46, 36, 0.18)',
          opacity: applied,
          transform: `translateY(${interpolate(applied, [0, 1], [28, 0])}px)`,
          zIndex: 52,
          fontFamily: theme.fonts.serif,
          fontSize: 34,
          lineHeight: 1.7,
          color: theme.colors.ink,
        }}
      >
        屏幕上的弹窗像一枚反复跳动的诊断灯：“优化通知——林澈，您的劳动合同将于本月底终止。”
      </div>
      <Cursor
        points={[
          {frame: 24, x: 722, y: 434},
          {frame: 62, x: 1210, y: 492},
          {frame: 96, x: 806, y: 372},
          {frame: 138, x: 1660, y: 230},
          {frame: 218, x: 1764, y: 1032},
          {frame: duration - 10, x: 1764, y: 1032},
        ]}
        visibleFrom={24}
        visibleTo={duration - 10}
        clickFrames={[98, 220]}
      />
      <FilmGrain opacity={0.07} />
    </SceneBackdrop>
  );
};

const VersionCard = ({
  version,
  title,
  current = false,
  y,
  delay,
}: {
  version: string;
  title: string;
  current?: boolean;
  y: number;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const show = smooth(frame, delay, delay + 22);
  return (
    <div
      style={{
        position: 'absolute',
        left: 744,
        top: y,
        width: 530,
        minHeight: 104,
        borderRadius: 18,
        padding: '20px 24px',
        background: current ? theme.colors.pine : 'rgba(255, 253, 248, 0.96)',
        color: current ? theme.colors.white : theme.colors.ink,
        border: `1px solid ${current ? 'rgba(255,255,255,0.18)' : theme.colors.line}`,
        boxShadow: current ? '0 24px 70px rgba(69, 105, 86, 0.22)' : '0 16px 42px rgba(58, 46, 36, 0.10)',
        opacity: show,
        transform: `translateX(${interpolate(show, [0, 1], [34, 0])}px)`,
        zIndex: 34,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontFamily: theme.fonts.serif, fontSize: 31}}>{version}</div>
        <Pill active={current} light={current}>
          {current ? '当前版本' : '可恢复'}
        </Pill>
      </div>
      <div style={{...baseText, fontSize: 17, marginTop: 10, opacity: 0.78}}>{title}</div>
    </div>
  );
};

const HistoryScene = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const modal = smooth(frame, 116, 146);
  const compare = smooth(frame, 152, 188);

  return (
    <SceneBackdrop>
      <ProductShot asset="versions" frame={frame} scaleFrom={1.035} scaleTo={1.01} dim={0.02} />
      <SceneTitle kicker="Version" title="版本回溯" x={104} y={74} maxWidth={390} />
      <VersionCard version="V3" title="AI 选区润色后 · 1832 字" current y={266} delay={28} />
      <VersionCard version="V2" title="人工调整节奏 · 1799 字" y={392} delay={48} />
      <VersionCard version="V1" title="章节初稿生成 · 1950 字" y={518} delay={68} />
      <div
        style={{
          position: 'absolute',
          left: 1296,
          top: 410,
          display: 'flex',
          gap: 12,
          opacity: smooth(frame, 82, 104),
          zIndex: 40,
        }}
      >
        <PrimaryButton compact>对比</PrimaryButton>
        <div style={{...buttonBase, height: 44, fontSize: 18}}>恢复</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 420,
          top: 170,
          width: 1080,
          height: 700,
          borderRadius: 30,
          background: 'rgba(255,253,248,0.98)',
          border: `1px solid ${theme.colors.line}`,
          boxShadow: '0 34px 110px rgba(58, 46, 36, 0.25)',
          opacity: modal,
          transform: `scale(${interpolate(modal, [0, 1], [0.96, 1])}) translateY(${interpolate(modal, [0, 1], [22, 0])}px)`,
          zIndex: 60,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 74,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 34px',
            borderBottom: `1px solid ${theme.colors.line}`,
          }}
        >
          <div style={{fontFamily: theme.fonts.serif, fontSize: 32}}>版本对比</div>
          <Pill>V2 → V3</Pill>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 34}}>
          <div>
            <div style={{...baseText, color: theme.colors.faint, fontSize: 16, marginBottom: 12}}>旧版本</div>
            <div
              style={{
                minHeight: 430,
                borderRadius: 18,
                background: theme.colors.paper,
                padding: 26,
                fontFamily: theme.fonts.serif,
                fontSize: 25,
                lineHeight: 1.8,
                color: theme.colors.muted,
              }}
            >
              屏幕上的弹窗还在闪烁：优化通知。林澈看着它，手指停在键盘上。
            </div>
          </div>
          <div>
            <div style={{...baseText, color: theme.colors.faint, fontSize: 16, marginBottom: 12}}>新版本</div>
            <div
              style={{
                minHeight: 430,
                borderRadius: 18,
                background: theme.colors.paper,
                padding: 26,
                fontFamily: theme.fonts.serif,
                fontSize: 25,
                lineHeight: 1.8,
                color: theme.colors.ink,
              }}
            >
              屏幕上的弹窗
              <span style={{background: `rgba(95, 135, 111, ${0.24 * compare})`}}>像一枚反复跳动的诊断灯</span>
              ：优化通知。林澈看着它，手指停在键盘上。
            </div>
          </div>
        </div>
      </div>
      <Cursor
        points={[
          {frame: 72, x: 1392, y: 428},
          {frame: 106, x: 1348, y: 430},
          {frame: 166, x: 1348, y: 430},
          {frame: duration - 10, x: 1348, y: 430},
        ]}
        visibleFrom={70}
        visibleTo={duration - 10}
        clickFrames={[108]}
      />
      <FilmGrain opacity={0.08} />
    </SceneBackdrop>
  );
};

const MiniShot = ({
  asset,
  title,
  x,
  y,
  width,
  height,
  delay,
}: {
  asset: Still;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const show = smooth(frame, delay, delay + 28);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: 28,
        overflow: 'hidden',
        background: theme.colors.white,
        border: `1px solid ${theme.colors.line}`,
        boxShadow: '0 28px 82px rgba(58, 46, 36, 0.16)',
        opacity: show,
        transform: `translateY(${interpolate(show, [0, 1], [36, 0])}px) scale(${interpolate(show, [0, 1], [0.96, 1])})`,
        zIndex: 24,
      }}
    >
      <Img src={still(asset)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      <div
        style={{
          position: 'absolute',
          left: 22,
          bottom: 22,
          padding: '10px 14px',
          borderRadius: 999,
          background: 'rgba(255, 253, 248, 0.90)',
          color: theme.colors.pineDark,
          fontFamily: theme.fonts.sans,
          fontSize: 18,
        }}
      >
        {title}
      </div>
    </div>
  );
};

const ReaderQualityScene = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const sweep = smooth(frame, 96, 150);

  return (
    <SceneBackdrop>
      <SceneTitle kicker="Deliver" title="阅读交付" x={102} y={74} maxWidth={390} />
      <MiniShot asset="reader" title="沉浸阅读" x={116} y={238} width={770} height={612} delay={24} />
      <MiniShot asset="quality" title="质量分析" x={822} y={178} width={520} height={404} delay={58} />
      <MiniShot asset="export" title="导出分享" x={1100} y={572} width={590} height={358} delay={92} />
      <div
        style={{
          position: 'absolute',
          left: 938,
          top: 632,
          width: 424,
          height: 96,
          borderRadius: 22,
          background: 'rgba(255,253,248,0.92)',
          border: `1px solid ${theme.colors.line}`,
          boxShadow: '0 26px 72px rgba(58, 46, 36, 0.16)',
          opacity: smooth(frame, 112, 140),
          zIndex: 42,
          padding: 22,
          fontFamily: theme.fonts.sans,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'space-between', color: theme.colors.ink, fontSize: 22}}>
          <span>总体质量</span>
          <span>8.0/10</span>
        </div>
        <div style={{height: 7, background: theme.colors.paper, borderRadius: 999, marginTop: 18, overflow: 'hidden'}}>
          <div
            style={{
              width: `${interpolate(sweep, [0, 1], [12, 80])}%`,
              height: '100%',
              background: theme.colors.pine,
              borderRadius: 999,
            }}
          />
        </div>
      </div>
      <Cursor
        points={[
          {frame: 42, x: 724, y: 286},
          {frame: 90, x: 1110, y: 340},
          {frame: 138, x: 1368, y: 714},
          {frame: duration - 10, x: 1368, y: 714},
        ]}
        visibleFrom={36}
        visibleTo={duration - 10}
        clickFrames={[92, 140]}
      />
      <FilmGrain opacity={0.08} />
    </SceneBackdrop>
  );
};

const ClosingScene = ({duration}: {duration: number}) => {
  const frame = useCurrentFrame();
  const line = smooth(frame, 18, 72);
  const show = fade(frame, duration, 18);
  return (
    <SceneBackdrop dark>
      <FilmGrain opacity={0.1} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: show,
          textAlign: 'center',
        }}
      >
        <div>
          <div
            style={{
              margin: '0 auto 34px',
              width: 760 * line,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${theme.colors.paperWarm}, transparent)`,
              opacity: 0.58,
            }}
          />
          <div
            style={{
              ...baseText,
              fontSize: 20,
              letterSpacing: 12,
              textTransform: 'uppercase',
              color: 'rgba(255,250,244,0.68)',
              marginBottom: 24,
            }}
          >
            MultiAgentWriter
          </div>
          <h2 style={{margin: 0, fontFamily: theme.fonts.serif, fontWeight: 500, fontSize: 90, color: theme.colors.white}}>
            StoryForge AI
          </h2>
          <p style={{...baseText, margin: '28px 0 0', fontSize: 34, color: 'rgba(255,250,244,0.72)'}}>
            从灵感，到章节；从章节，到作品。
          </p>
        </div>
      </div>
    </SceneBackdrop>
  );
};

const scenes = [
  {from: 0, duration: 120, component: OpeningScene},
  {from: 120, duration: 135, component: ShelfScene},
  {from: 255, duration: 165, component: CreateSkillScene},
  {from: 420, duration: 165, component: WorkflowScene},
  {from: 585, duration: 255, component: SelectionAIScene},
  {from: 840, duration: 180, component: HistoryScene},
  {from: 1020, duration: 150, component: ReaderQualityScene},
  {from: 1170, duration: 90, component: ClosingScene},
] as const;

export const StoryForgeDemo = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {scenes.map(({from, duration, component: Scene}) => (
        <Sequence key={from} from={from} durationInFrames={duration}>
          <Scene duration={duration} />
        </Sequence>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 4,
          background: 'rgba(95, 135, 111, 0.13)',
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${(frame / totalFrames) * 100}%`,
            background: theme.colors.pine,
            opacity: 0.5,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  continueRender,
  delayRender,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export const FPS = 30;
export const DURATION_S = 25.8;

// Montserrat is bundled locally (public/fonts) so the render needs no network.
const fontFamily = 'Montserrat';
const FONT_FILES = [
  { file: 'fonts/montserrat-latin.woff2', style: 'normal' },
  { file: 'fonts/montserrat-latin-italic.woff2', style: 'italic' },
];

const useMontserrat = () => {
  const [handle] = React.useState(() => delayRender('Loading Montserrat'));
  React.useEffect(() => {
    Promise.all(
      FONT_FILES.map(({ file, style }) =>
        new FontFace(fontFamily, `url(${staticFile(file)})`, { weight: '100 900', style })
          .load()
          .then((face) => document.fonts.add(face)),
      ),
    )
      .catch((err) => console.error('Font load failed', err))
      .finally(() => continueRender(handle));
  }, [handle]);
};

// Brand palette, taken from the Bibliodor visual.
const NAVY = '#07101d';
const NAVY_2 = '#0d1d33';
const GOLD = '#f2b13f';
const GOLD_GRAD = 'linear-gradient(180deg, #ffe09a 0%, #f6b543 52%, #d4861f 100%)';
const WHITE = '#f7f4ee';

// Scene boundaries (seconds), aligned on the voice-over word timings.
const T = {
  talkEnd: 7.25, // presenter speaks on camera
  fastEnd: 9.25, // "Pendant qu'on hésite, tout va trop vite."
  halfEnd: 11.03, // "On rate la moitié de ce qui se passe !"
  nowEnd: 12.86, // "Alors il faut s'y mettre. Maintenant."
  productEnd: 21.9, // the guide + benefits
};

const s = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Opacity window for a scene, with short cross-fades. */
const win = (f: number, a: number, b: number, fi = 4, fo = 4) =>
  Math.min(interpolate(f, [s(a), s(a) + fi], [0, 1], clamp), interpolate(f, [s(b) - fo, s(b)], [1, 0], clamp));

const useSpring = (at: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - s(at), fps, config: { damping: 14, stiffness: 170, mass: 0.8, ...cfg } });
};

const goldText: React.CSSProperties = {
  background: GOLD_GRAD,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  filter: 'drop-shadow(0 0 22px rgba(242,177,63,0.45))',
};

/** A word that lands on the exact moment it is spoken. */
const W: React.FC<{ at: number; gold?: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({
  at,
  gold,
  children,
  style,
}) => {
  const p = useSpring(at);
  const f = useCurrentFrame();
  const blur = interpolate(f, [s(at), s(at) + 6], [10, 0], clamp);
  return (
    <span
      style={{
        display: 'inline-block',
        marginRight: '0.24em',
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + p * 0.1})`,
        filter: `blur(${blur}px)`,
        ...(gold ? goldText : {}),
        ...style,
      }}
    >
      {children}
    </span>
  );
};

const Line: React.FC<{ size: number; weight?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  size,
  weight = 800,
  children,
  style,
}) => (
  <div
    style={{
      fontSize: size,
      fontWeight: weight,
      lineHeight: 1.08,
      letterSpacing: '-0.02em',
      color: WHITE,
      textAlign: 'center',
      textShadow: '0 6px 30px rgba(0,0,0,0.55)',
      ...style,
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------ UGC captions */

type Word = [text: string, at: number, gold?: boolean];

// Spoken words of the on-camera hook, grouped into short caption chunks.
const HOOK_CHUNKS: Word[][] = [
  [['Un', 0.23], ['jour,', 0.4]],
  [['vos', 0.96], ['enfants', 1.12], ['vous', 1.44], ['demanderont', 1.6]],
  [['où', 2.16], ['vous', 2.32], ['étiez…', 2.6]],
  [['quand', 3.36], ['l’IA', 3.52, true], ['a', 4.16], ['tout', 4.4], ['changé.', 4.56]],
  [['Et', 5.52], ['vous,', 5.68, true]],
  [['vous', 6.16], ['répondrez', 6.32], ['quoi ?', 6.72, true]],
];

const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const idx = HOOK_CHUNKS.findIndex((c, i) => {
    const next = HOOK_CHUNKS[i + 1];
    return t >= c[0][1] - 0.05 && (!next || t < next[0][1] - 0.05);
  });
  const pop = useSpring((HOOK_CHUNKS[Math.max(idx, 0)][0][1] as number) - 0.05, { damping: 12, stiffness: 260 });
  if (idx < 0 || t >= T.talkEnd) return null;
  const chunk = HOOK_CHUNKS[idx];
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1330 }}>
      <div
        style={{
          maxWidth: 940,
          textAlign: 'center',
          fontSize: 84,
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          transform: `scale(${0.85 + 0.15 * pop})`,
          textTransform: 'uppercase',
        }}
      >
        {chunk.map(([text, at, gold], i) => {
          const active = t >= at - 0.03;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.25em',
                color: gold && active ? GOLD : WHITE,
                opacity: active ? 1 : 0.35,
                WebkitTextStroke: '3px rgba(0,0,0,0.85)',
                paintOrder: 'stroke fill',
                textShadow: '0 6px 18px rgba(0,0,0,0.75)',
              }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------- talking presenter */

const Presenter: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [s(T.talkEnd) - 3, s(T.talkEnd) + 2], [1, 0], clamp);
  // UGC-style punch-in on "Et vous," then a slow push on the question
  const punch = f >= s(5.52) ? 1.13 + interpolate(f, [s(5.52), s(7.25)], [0, 0.04], clamp) : interpolate(f, [0, s(5.5)], [1.0, 1.05]);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ transform: `scale(${punch})`, transformOrigin: '50% 34%' }}>
        <OffthreadVideo src={staticFile('presenter.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(4,8,15,0.35) 0%, transparent 18%, transparent 58%, rgba(4,8,15,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};

/* ---------------------------------------------------------------- graphics */

const NODES = Array.from({ length: 70 }, (_, i) => ({
  x: random(`x${i}`) * 1080,
  y: random(`y${i}`) * 1920,
  vx: (random(`vx${i}`) - 0.5) * 0.9,
  vy: (random(`vy${i}`) - 0.5) * 0.9,
  r: 1.5 + random(`r${i}`) * 3,
  gold: random(`g${i}`) > 0.55,
}));

const Network: React.FC<{ speed: number }> = ({ speed }) => {
  const f = useCurrentFrame();
  const pts = NODES.map((n) => ({
    ...n,
    x: (((n.x + n.vx * f * speed) % 1080) + 1080) % 1080,
    y: (((n.y + n.vy * f * speed) % 1920) + 1920) % 1920,
  }));
  const lines: React.ReactNode[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < 230) {
        lines.push(
          <line
            key={`${i}-${j}`}
            x1={pts[i].x}
            y1={pts[i].y}
            x2={pts[j].x}
            y2={pts[j].y}
            stroke={pts[i].gold ? GOLD : '#5aa2ff'}
            strokeOpacity={(1 - d / 230) * 0.35}
            strokeWidth={1.2}
          />,
        );
      }
    }
  }
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', opacity: 0.75 }}>
      {lines}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.gold ? '#ffcf73' : '#7db8ff'} />
      ))}
    </svg>
  );
};

const STREAKS = Array.from({ length: 90 }, (_, i) => ({
  a: random(`a${i}`) * Math.PI * 2,
  ph: random(`p${i}`),
  gold: random(`sg${i}`) > 0.6,
}));

/** Hyperspace streaks: the world accelerating. */
const Warp: React.FC<{ intensity: number }> = ({ intensity }) => {
  const f = useCurrentFrame();
  if (intensity <= 0.01) return null;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', opacity: intensity }}>
      {STREAKS.map((st, i) => {
        const prog = (st.ph + f * (0.012 + intensity * 0.03)) % 1;
        const r1 = 80 + prog * prog * 1400;
        const len = 30 + intensity * 260 * prog;
        return (
          <line
            key={i}
            x1={540 + Math.cos(st.a) * r1}
            y1={900 + Math.sin(st.a) * r1}
            x2={540 + Math.cos(st.a) * (r1 + len)}
            y2={900 + Math.sin(st.a) * (r1 + len)}
            stroke={st.gold ? '#ffc65c' : '#9cc9ff'}
            strokeWidth={1.5 + prog * 3}
            strokeOpacity={prog * 0.9}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
};

const Background: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const warp = interpolate(t, [7.3, 7.8, 9.0, 9.4], [0, 0.8, 0.8, 0.15], clamp);
  const glow = interpolate(t, [12.9, 14.0], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${NAVY_2} 0%, ${NAVY} 62%, #03060b 100%)` }}>
      <Network speed={1 + warp * 6} />
      <Warp intensity={warp} />
      <div
        style={{
          position: 'absolute',
          left: 20,
          top: 120,
          width: 1040,
          height: 1040,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(242,177,63,0.30) 0%, rgba(242,177,63,0) 65%)',
          opacity: glow,
        }}
      />
    </AbsoluteFill>
  );
};

const Clock: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const p = useSpring(at, { damping: 12 });
  const sp = Math.max(0, f - s(at));
  const big = sp * sp * 0.9;
  return (
    <svg width={300} height={300} viewBox="-150 -150 300 300" style={{ opacity: p, transform: `scale(${0.5 + p * 0.5})` }}>
      <circle r={130} fill="rgba(255,255,255,0.04)" stroke={GOLD} strokeWidth={8} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={0} y1={-112} x2={0} y2={-96} stroke={WHITE} strokeWidth={5} transform={`rotate(${i * 30})`} strokeLinecap="round" />
      ))}
      <line x1={0} y1={0} x2={0} y2={-70} stroke={WHITE} strokeWidth={10} strokeLinecap="round" transform={`rotate(${big * 0.4})`} />
      <line x1={0} y1={0} x2={0} y2={-105} stroke={GOLD} strokeWidth={6} strokeLinecap="round" transform={`rotate(${big * 4})`} />
      <circle r={10} fill={GOLD} />
    </svg>
  );
};

const Fast: React.FC = () => {
  const f = useCurrentFrame();
  const o = win(f, T.talkEnd, T.fastEnd, 3, 3);
  const jitter = f >= s(8.56) ? (random(`j${f}`) - 0.5) * 12 : 0;
  return (
    <AbsoluteFill style={{ opacity: o, alignItems: 'center', justifyContent: 'center' }}>
      <Line size={70} weight={600} style={{ color: '#cfd8e6' }}>
        <W at={7.28}>Pendant</W>
        <W at={7.52}>qu’on</W>
        <W at={7.68}>hésite,</W>
      </Line>
      <div style={{ margin: '40px 0', transform: `translate(${jitter}px, ${jitter * 0.6}px)` }}>
        <Clock at={8.2} />
      </div>
      <Line size={120} weight={900} style={{ textShadow: '4px 0 0 rgba(255,60,60,0.5), -4px 0 0 rgba(60,170,255,0.5)' }}>
        <W at={8.24}>TOUT</W>
        <W at={8.4}>VA</W>
        <br />
        <W at={8.56}>TROP</W>
        <W at={8.76} gold>
          VITE.
        </W>
      </Line>
    </AbsoluteFill>
  );
};

const Half: React.FC = () => {
  const f = useCurrentFrame();
  const o = win(f, T.fastEnd, T.halfEnd, 3, 3);
  // half of the screen goes dark: the half you miss
  const dark = interpolate(f, [s(9.72), s(10.1)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ring = interpolate(f, [s(9.6), s(10.2)], [0, 0.5], { ...clamp, easing: Easing.out(Easing.cubic) });
  const R = 320;
  const C = 2 * Math.PI * R;
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 540 * dark,
          background: 'linear-gradient(90deg, rgba(2,4,8,0.78), rgba(2,4,8,0.95))',
          borderLeft: dark > 0 ? `3px solid ${GOLD}` : 'none',
        }}
      />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 500, opacity: 0.85 }}>
        <svg width={720} height={720} viewBox="-360 -360 720 720">
          <circle r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
          <circle r={R} fill="none" stroke={GOLD} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${C * ring} ${C}`} transform="rotate(90)" />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 690 }}>
        <Line size={84} weight={700}>
          <W at={9.25}>On</W>
          <W at={9.36}>rate</W>
        </Line>
        <Line size={156} weight={900} style={{ marginTop: 6 }}>
          <W at={9.6}>la</W>
          <W at={9.72} gold>
            moitié
          </W>
        </Line>
        <Line size={62} weight={600} style={{ marginTop: 14, color: '#cfd8e6' }}>
          <W at={10.1}>de</W>
          <W at={10.19}>ce</W>
          <W at={10.24}>qui</W>
          <W at={10.36}>se</W>
          <W at={10.44}>passe !</W>
        </Line>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Now: React.FC = () => {
  const f = useCurrentFrame();
  const o = win(f, T.halfEnd, T.nowEnd, 2, 3);
  const at = 12.32;
  const slam = interpolate(f, [s(at), s(at) + 5], [2.2, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const slamO = interpolate(f, [s(at), s(at) + 2], [0, 1], clamp);
  const wave = interpolate(f, [s(at), s(at) + 16], [0, 1], clamp);
  const shake = interpolate(f, [s(at), s(at) + 12], [22, 0], clamp) * Math.sin(f * 3.1);
  const flash = interpolate(f, [s(at), s(at) + 6], [0.55, 0], clamp);
  const up = interpolate(f, [s(12.2), s(12.36)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: o, transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: `translateY(${-up * 170}px)` }}>
          <Line size={96} weight={700}>
            <W at={11.04}>Alors</W>
            <W at={11.28}>il</W>
            <W at={11.41}>faut</W>
            <br />
            <W at={11.57}>s’y</W>
            <W at={11.76}>mettre.</W>
          </Line>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: 300 + wave * 1400,
            height: 300 + wave * 1400,
            borderRadius: '50%',
            border: `${10 * (1 - wave)}px solid ${GOLD}`,
            opacity: (1 - wave) * slamO,
          }}
        />
        <div style={{ fontSize: 132, fontWeight: 900, letterSpacing: '-0.03em', ...goldText, transform: `translateY(150px) scale(${slam})`, opacity: slamO }}>
          MAINTENANT.
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff4dc', opacity: flash }} />
    </AbsoluteFill>
  );
};

const Check: React.FC<{ at: number; label: string }> = ({ at, label }) => {
  const f = useCurrentFrame();
  const p = useSpring(at, { damping: 15 });
  const draw = interpolate(f, [s(at) + 2, s(at) + 10], [0, 1], clamp);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: p, transform: `translateX(${(1 - p) * -60}px)`, margin: '10px 0' }}>
      <svg width={64} height={64} viewBox="0 0 64 64">
        <circle cx={32} cy={32} r={29} fill="rgba(242,177,63,0.15)" stroke={GOLD} strokeWidth={3} />
        <path
          d="M18 33 L28 43 L47 22"
          fill="none"
          stroke={GOLD}
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={48}
          strokeDashoffset={48 * (1 - draw)}
        />
      </svg>
      <span style={{ fontSize: 52, fontWeight: 700, color: WHITE }}>{label}</span>
    </div>
  );
};

/** The guide, from its reveal to the end card. */
const Product: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const o = interpolate(f, [s(T.nowEnd), s(T.nowEnd) + 4], [0, 1], clamp);
  const rise = useSpring(12.9, { damping: 16, stiffness: 70, mass: 1.1 });
  // In the CTA the tablet steps back and up to leave room for the button
  const cta = interpolate(f, [s(21.9), s(22.5)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const width = interpolate(cta, [0, 1], [560, 470]);
  const top = interpolate(cta, [0, 1], [300, 290]);
  const tilt = Math.sin(t * 0.9) * 6;
  const zoomTitle = interpolate(t, [13.2, 15.0, 15.5], [1, 1.06, 1], clamp);
  const sweep = interpolate(t, [14.4, 15.6], [-0.4, 1.4], clamp);
  const titleO = interpolate(f, [s(13.18), s(13.4), s(16.8), s(17.0)], [0, 1, 1, 0], clamp);
  const benefitsO = interpolate(f, [s(21.8), s(22.1)], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: 'absolute', left: 540 - width / 2, top, width, perspective: 1400, transform: `translateY(${(1 - rise) * 900}px)` }}>
        <div style={{ position: 'relative', transform: `rotateY(${tilt}deg) rotateX(${(1 - rise) * 25}deg) scale(${zoomTitle})` }}>
          <Img
            src={staticFile('tablet.png')}
            style={{ width: '100%', display: 'block', filter: 'drop-shadow(0 40px 60px rgba(0,0,0,0.7)) drop-shadow(0 0 60px rgba(242,177,63,0.35))' }}
          />
          {/* light sweep over the cover when the title is spoken */}
          <div
            style={{
              position: 'absolute',
              inset: '4% 7%',
              background: `linear-gradient(105deg, transparent ${sweep * 100 - 18}%, rgba(255,240,200,0.4) ${sweep * 100}%, transparent ${sweep * 100 + 18}%)`,
              mixBlendMode: 'screen',
            }}
          />
        </div>
      </div>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1170, opacity: titleO }}>
        <Line size={58} weight={800}>
          <W at={13.18}>L’intelligence</W>
          <W at={13.88}>artificielle</W>
        </Line>
        <Line size={110} weight={900} style={{ marginTop: 6 }}>
          <W at={14.48} gold>
            de A à Z
          </W>
        </Line>
        <Line size={44} weight={600} style={{ marginTop: 14, color: '#d9d2c4' }}>
          <W at={15.36}>le</W>
          <W at={15.52}>grand</W>
          <W at={15.76}>guide</W>
          <W at={15.96} gold>
            Bibliodor
          </W>
        </Line>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1150, opacity: benefitsO }}>
        <div>
          <Check at={17.04} label="Comprendre l’IA" />
          <Check at={18.08} label="S’en servir chaque jour" />
          <Check at={19.52} label="Garder la main" />
          <Check at={20.48} label="Même en partant de zéro" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CTA: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [s(21.95), s(22.1)], [0, 1], clamp);
  const btn = useSpring(23.52, { damping: 11, stiffness: 160 });
  const pulse = f > s(23.9) ? 1 + Math.sin((f - s(23.9)) * 0.28) * 0.035 : 1;
  const shine = ((f - s(23.7)) % 40) / 40;
  const tap = interpolate(f, [s(24.4), s(24.4) + 14], [0, 1], clamp);
  const urlO = interpolate(f, [s(24.0), s(24.3)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1010, paddingLeft: 60, paddingRight: 60 }}>
        <Line size={74} weight={800}>
          <W at={22.0}>Ne</W>
          <W at={22.12}>regardez</W>
          <W at={22.48}>pas</W>
          <br />
          <W at={22.56} gold>
            l’avenir
          </W>
          <W at={22.96}>passer.</W>
        </Line>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1300 }}>
        <div
          style={{
            position: 'relative',
            width: 820,
            height: 150,
            borderRadius: 80,
            background: 'linear-gradient(180deg, #ffd884 0%, #f6b543 55%, #e39a2a 100%)',
            boxShadow: '0 0 0 4px rgba(255,226,160,0.5), 0 0 70px rgba(242,177,63,0.7), 0 20px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            opacity: btn,
            transform: `scale(${(0.6 + 0.4 * btn) * pulse})`,
          }}
        >
          <span style={{ fontSize: 64, fontWeight: 900, color: '#141008' }}>OBTENIR LE GUIDE</span>
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 160,
              left: -200 + shine * 1200,
              background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.65), transparent)',
              transform: 'skewX(-20deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 600 - tap * 160,
              top: 75 - tap * 160,
              width: tap * 320,
              height: tap * 320,
              borderRadius: '50%',
              border: '6px solid rgba(255,255,255,0.8)',
              opacity: 1 - tap,
            }}
          />
        </div>
        <div style={{ marginTop: 34, fontSize: 38, fontWeight: 700, color: '#d9d2c4', letterSpacing: '0.08em', opacity: urlO }}>bibliodor.com</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Brand: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [s(0.2), s(1.0)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 110, opacity: o * 0.95 }}>
      <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '0.38em', color: WHITE, marginRight: '-0.38em', textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}>
        BIBLIO<span style={{ color: GOLD }}>DOR</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '0.3em', color: '#e6dfd2', marginTop: 10, textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
        LES IDÉES QUI VALENT DE <span style={{ color: GOLD }}>L’OR</span>
      </div>
    </AbsoluteFill>
  );
};

export const Pub: React.FC = () => {
  useMontserrat();
  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: NAVY }}>
      <Background />
      <Fast />
      <Half />
      <Now />
      <Product />
      <CTA />
      <Presenter />
      <Captions />
      <Brand />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.5) 100%)' }} />
      <Audio src={staticFile('mix.wav')} />
    </AbsoluteFill>
  );
};

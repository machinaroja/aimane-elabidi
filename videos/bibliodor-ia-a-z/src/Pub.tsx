import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  continueRender,
  delayRender,
} from 'remotion';

export const FPS = 30;
export const DURATION_S = 34.6;

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
  hookEnd: 6.66,
  youEnd: 8.74,
  accelEnd: 14.74,
  halfEnd: 18.66,
  nowEnd: 20.9,
  productEnd: 30.26,
};

const s = (sec: number) => Math.round(sec * FPS);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Opacity window for a scene, with short cross-fades. */
const win = (f: number, a: number, b: number, fi = 5, fo = 5) =>
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

const Center: React.FC<{ children: React.ReactNode; top?: number; style?: React.CSSProperties }> = ({
  children,
  top,
  style,
}) => (
  <AbsoluteFill
    style={{
      justifyContent: top === undefined ? 'center' : 'flex-start',
      alignItems: 'center',
      paddingTop: top,
      paddingLeft: 70,
      paddingRight: 70,
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

/* ---------------------------------------------------------------- background */

const NODES = Array.from({ length: 70 }, (_, i) => ({
  x: random(`x${i}`) * 1080,
  y: random(`y${i}`) * 1920,
  vx: (random(`vx${i}`) - 0.5) * 0.9,
  vy: (random(`vy${i}`) - 0.5) * 0.9,
  r: 1.5 + random(`r${i}`) * 3,
  gold: random(`g${i}`) > 0.55,
}));

const Network: React.FC<{ speed: number; opacity: number }> = ({ speed, opacity }) => {
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
    <svg width={1080} height={1920} style={{ position: 'absolute', opacity }}>
      {lines}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.r}
          fill={p.gold ? '#ffcf73' : '#7db8ff'}
          style={{ filter: `drop-shadow(0 0 ${p.r * 3}px ${p.gold ? GOLD : '#4d9bff'})` }}
        />
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
  const cx = 540;
  const cy = 900;
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', opacity: intensity }}>
      {STREAKS.map((st, i) => {
        const prog = (st.ph + f * (0.012 + intensity * 0.03)) % 1;
        const r1 = 80 + prog * prog * 1400;
        const len = 30 + intensity * 260 * prog;
        const x1 = cx + Math.cos(st.a) * r1;
        const y1 = cy + Math.sin(st.a) * r1;
        const x2 = cx + Math.cos(st.a) * (r1 + len);
        const y2 = cy + Math.sin(st.a) * (r1 + len);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
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
  const warp =
    interpolate(t, [9.9, 10.6, 14.6, 15.0], [0, 0.55, 0.55, 0.2], clamp) +
    interpolate(t, [17.6, 18.0, 18.7, 19.0], [0, 0.9, 0.9, 0], clamp);
  const speed = 1 + warp * 6;
  const zoom = interpolate(t, [0, DURATION_S], [1.08, 1.0]);
  const glowY = interpolate(t, [20.9, 22], [1250, 820], clamp);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, ${NAVY_2} 0%, ${NAVY} 62%, #03060b 100%)` }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Network speed={speed} opacity={0.75} />
      </AbsoluteFill>
      <Warp intensity={warp} />
      {/* warm gold light from the product, once it appears */}
      <div
        style={{
          position: 'absolute',
          left: 540 - 520,
          top: glowY - 520,
          width: 1040,
          height: 1040,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(242,177,63,0.30) 0%, rgba(242,177,63,0) 65%)',
          opacity: interpolate(t, [20.9, 22.2], [0, 1], clamp),
        }}
      />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------- brand */

const Brand: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [s(0.2), s(1.2)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 120, opacity: o * 0.92 }}>
      <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '0.38em', color: WHITE, marginRight: '-0.38em' }}>
        BIBLIO<span style={{ color: GOLD }}>DOR</span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '0.3em', color: '#d9d2c4', marginTop: 10 }}>
        LES IDÉES QUI VALENT DE <span style={{ color: GOLD }}>L’OR</span>
      </div>
      <div style={{ width: 150, height: 3, background: GOLD, marginTop: 18, borderRadius: 2, opacity: 0.85 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------- scenes */

const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const o = win(f, 0, T.hookEnd, 1, 4);
  const lift = interpolate(f, [s(3.2), s(3.7)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <Center style={{ opacity: o }}>
      <div style={{ transform: `translateY(${-lift * 250}px) scale(${1 - lift * 0.35})`, opacity: 1 - lift * 0.55 }}>
        <Line size={92} weight={700}>
          <W at={0.08}>Un</W>
          <W at={0.32}>jour,</W>
        </Line>
        <Line size={84} weight={700} style={{ marginTop: 16 }}>
          <W at={1.12}>vos</W>
          <W at={1.36}>enfants</W>
          <br />
          <W at={1.76}>vous</W>
          <W at={1.92}>demanderont…</W>
        </Line>
      </div>
      <div style={{ position: 'absolute', top: 820 }}>
        <Line size={118}>
          <W at={3.44} style={{ ...goldText, fontSize: 150, lineHeight: 0.6, verticalAlign: '-0.12em' }}>
            «
          </W>
          <W at={3.44}>Où</W>
          <W at={3.6}>étiez-vous…</W>
        </Line>
        <Line size={118} style={{ marginTop: 10 }}>
          <W at={4.64}>quand</W>
          <W at={4.8} gold style={{ fontSize: 140, ...goldText }}>
            l’IA
          </W>
        </Line>
        <Line size={118} style={{ marginTop: 10 }}>
          <W at={5.36}>a</W>
          <W at={5.6}>tout</W>
          <W at={5.76}>changé ?</W>
          <W at={5.9} style={{ ...goldText, fontSize: 150, lineHeight: 0.6, verticalAlign: '-0.12em' }}>
            »
          </W>
        </Line>
      </div>
    </Center>
  );
};

const AndYou: React.FC = () => {
  const f = useCurrentFrame();
  const o = win(f, T.hookEnd, T.youEnd, 1, 3);
  const q = useSpring(7.5, { damping: 18, stiffness: 90 });
  const blink = Math.floor(f / 8) % 2 === 0 ? 1 : 0.2;
  return (
    <Center style={{ opacity: o }}>
      <div
        style={{
          position: 'absolute',
          fontSize: 1100,
          fontWeight: 900,
          ...goldText,
          opacity: 0.1 * q,
          transform: `scale(${0.7 + q * 0.3}) rotate(${(1 - q) * -12}deg)`,
          top: 260,
        }}
      >
        ?
      </div>
      <Line size={190} weight={900}>
        <W at={6.78}>Et</W>
        <W at={6.88} gold>
          vous,
        </W>
      </Line>
      <Line size={96} weight={700} style={{ marginTop: 30 }}>
        <W at={7.4}>vous</W>
        <W at={7.52}>répondrez</W>
        <br />
        <W at={8.08}>quoi ?</W>
        <span style={{ display: 'inline-block', width: 14, height: 90, background: GOLD, opacity: blink, verticalAlign: '-0.1em' }} />
      </Line>
    </Center>
  );
};

const TOOLS = ['Rédaction', 'Images', 'Vidéo', 'Voix', 'Code', 'Agents', 'Recherche', 'Traduction'];
const JOBS = ['Marketing', 'Compta', 'Service client', 'Design', 'Juridique', 'Enseignement', 'Santé', 'Commerce'];

const Chip: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const at = 11.9 + i * 0.1;
  const p = useSpring(at, { damping: 12, stiffness: 220 });
  const flipAt = 13.57 + i * 0.06;
  const flip = interpolate(f, [s(flipAt), s(flipAt) + 7], [0, 180], clamp);
  const showJob = flip > 90;
  return (
    <div
      style={{
        width: 440,
        height: 100,
        margin: 12,
        borderRadius: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 40,
        fontWeight: 700,
        color: showJob ? '#1b1206' : WHITE,
        background: showJob ? GOLD_GRAD : 'rgba(255,255,255,0.07)',
        border: `2px solid ${showJob ? '#ffd889' : 'rgba(125,184,255,0.45)'}`,
        boxShadow: showJob ? '0 0 34px rgba(242,177,63,0.45)' : '0 0 24px rgba(77,155,255,0.2)',
        opacity: p,
        transform: `scale(${0.6 + 0.4 * p}) rotateX(${showJob ? flip - 180 : flip}deg)`,
      }}
    >
      {showJob ? JOBS[i] : TOOLS[i]}
    </div>
  );
};

const Accelerate: React.FC = () => {
  const f = useCurrentFrame();
  const o = win(f, T.youEnd, T.accelEnd, 2, 4);
  const toGrid = interpolate(f, [s(11.0), s(11.4)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const shake = interpolate(f, [s(10.36), s(11.1)], [14, 0], clamp) * Math.sin(f * 2.3);
  const weekO = interpolate(f, [s(11.16), s(11.3), s(12.7), s(12.8)], [0, 1, 1, 0], clamp);
  const monthO = interpolate(f, [s(12.8), s(12.95)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Center style={{ transform: `translateY(${-toGrid * 560}px) scale(${1 - toGrid * 0.32})` }}>
        <Line size={70} weight={600} style={{ color: '#cfd8e6' }}>
          <W at={8.79}>Pendant</W>
          <W at={9.0}>que</W>
          <W at={9.12}>vous</W>
          <W at={9.24}>hésitez,</W>
        </Line>
        <Line size={104} weight={800} style={{ marginTop: 22 }}>
          <W at={9.92}>le</W>
          <W at={10.08}>monde</W>
        </Line>
        <Line size={150} weight={900} style={{ marginTop: 4 }}>
          <W at={10.36} gold style={{ fontStyle: 'italic', transform: `skewX(-10deg) translateX(${shake}px)` }}>
            accélère.
          </W>
        </Line>
      </Center>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 700 }}>
        <div style={{ position: 'relative', height: 120, width: 1000 }}>
          <div style={{ position: 'absolute', width: '100%', textAlign: 'center', opacity: weekO }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '0.3em', color: GOLD }}>CHAQUE SEMAINE</span>
            <div style={{ fontSize: 62, fontWeight: 800, color: WHITE, marginTop: 6 }}>de nouveaux outils</div>
          </div>
          <div style={{ position: 'absolute', width: '100%', textAlign: 'center', opacity: monthO }}>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '0.3em', color: GOLD }}>CHAQUE MOIS</span>
            <div style={{ fontSize: 62, fontWeight: 800, color: WHITE, marginTop: 6 }}>des métiers transformés</div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: 1000,
            marginTop: 40,
            perspective: 900,
          }}
        >
          {TOOLS.map((_, i) => (
            <Chip key={i} i={i} />
          ))}
        </div>
      </AbsoluteFill>
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
        <line
          key={i}
          x1={0}
          y1={-112}
          x2={0}
          y2={-96}
          stroke={WHITE}
          strokeWidth={5}
          transform={`rotate(${i * 30})`}
          strokeLinecap="round"
        />
      ))}
      <line x1={0} y1={0} x2={0} y2={-70} stroke={WHITE} strokeWidth={10} strokeLinecap="round" transform={`rotate(${big * 0.4})`} />
      <line x1={0} y1={0} x2={0} y2={-105} stroke={GOLD} strokeWidth={6} strokeLinecap="round" transform={`rotate(${big * 4})`} />
      <circle r={10} fill={GOLD} />
    </svg>
  );
};

const Half: React.FC = () => {
  const f = useCurrentFrame();
  const o = win(f, T.accelEnd, T.halfEnd, 3, 3);
  // half of the screen goes dark: the half of life you miss
  const dark = interpolate(f, [s(16.3), s(16.75)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ring = interpolate(f, [s(16.2), s(16.8)], [0, 0.5], { ...clamp, easing: Easing.out(Easing.cubic) });
  const fastO = interpolate(f, [s(17.6), s(17.7)], [0, 1], clamp);
  const jitter = f >= s(17.64) ? (random(`j${f}`) - 0.5) * 12 : 0;
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
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 860 - 360, opacity: 0.85 }}>
        <svg width={720} height={720} viewBox="-360 -360 720 720">
          <circle r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
          <circle
            r={R}
            fill="none"
            stroke="url(#gg)"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${C * ring} ${C}`}
            transform="rotate(90)"
          />
          <defs>
            <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe09a" />
              <stop offset="1" stopColor="#d4861f" />
            </linearGradient>
          </defs>
        </svg>
      </AbsoluteFill>
      <Center top={330}>
        <Line size={84} weight={700}>
          <W at={14.8}>Si</W>
          <W at={14.96}>vous</W>
          <W at={15.2}>attendez,</W>
        </Line>
      </Center>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 680 }}>
        <Line size={78} weight={700}>
          <W at={15.76}>vous</W>
          <W at={15.96}>ratez</W>
        </Line>
        <Line size={150} weight={900} style={{ marginTop: 6 }}>
          <W at={16.16}>la</W>
          <W at={16.32} gold>
            moitié
          </W>
        </Line>
        <Line size={60} weight={600} style={{ marginTop: 14, color: '#cfd8e6' }}>
          <W at={16.68}>de</W>
          <W at={16.8}>ce</W>
          <W at={16.9}>qui</W>
          <W at={17.0}>se</W>
          <W at={17.12}>passe.</W>
        </Line>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1270, opacity: fastO }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 34, transform: `translate(${jitter}px, ${jitter * 0.6}px)` }}>
          <Clock at={17.6} />
        </div>
        <Line size={92} weight={900} style={{ marginTop: 20, textShadow: `4px 0 0 rgba(255,60,60,0.55), -4px 0 0 rgba(60,170,255,0.55)` }}>
          <W at={17.64}>ÇA</W>
          <W at={17.76}>VA</W>
          <W at={17.97}>TROP</W>
          <W at={18.16} gold>
            VITE.
          </W>
        </Line>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Now: React.FC = () => {
  const f = useCurrentFrame();
  const o = win(f, T.halfEnd, T.nowEnd, 2, 2);
  const slam = interpolate(f, [s(20.08), s(20.08) + 5], [2.2, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const slamO = interpolate(f, [s(20.08), s(20.08) + 2], [0, 1], clamp);
  const wave = interpolate(f, [s(20.08), s(20.08) + 18], [0, 1], clamp);
  const shake = interpolate(f, [s(20.08), s(20.08) + 12], [22, 0], clamp) * Math.sin(f * 3.1);
  const flash = interpolate(f, [s(20.08), s(20.08) + 6], [0.55, 0], clamp);
  const up = interpolate(f, [s(20.0), s(20.15)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: o, transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
      <Center>
        <div style={{ transform: `translateY(${-up * 170}px)` }}>
          <Line size={96} weight={700}>
            <W at={18.72}>Alors</W>
            <W at={18.96}>il</W>
            <W at={19.16}>faut</W>
            <br />
            <W at={19.36}>s’y</W>
            <W at={19.56}>mettre.</W>
          </Line>
        </div>
      </Center>
      <Center>
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
        <div
          style={{
            fontSize: 132,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            ...goldText,
            transform: `translateY(150px) scale(${slam})`,
            opacity: slamO,
          }}
        >
          MAINTENANT.
        </div>
      </Center>
      <AbsoluteFill style={{ background: '#fff4dc', opacity: flash }} />
    </AbsoluteFill>
  );
};

const Check: React.FC<{ at: number; label: string }> = ({ at, label }) => {
  const f = useCurrentFrame();
  const p = useSpring(at, { damping: 15 });
  const draw = interpolate(f, [s(at) + 2, s(at) + 10], [0, 1], clamp);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        opacity: p,
        transform: `translateX(${(1 - p) * -60}px)`,
        margin: '10px 0',
      }}
    >
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

const Product: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const o = interpolate(f, [s(20.9), s(21.1)], [0, 1], clamp);
  const rise = useSpring(20.96, { damping: 16, stiffness: 70, mass: 1.1 });
  // In the CTA the tablet steps back and up to leave room for the button
  const cta = interpolate(f, [s(30.2), s(30.9)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const width = interpolate(cta, [0, 1], [580, 470]);
  const top = interpolate(cta, [0, 1], [330, 300]);
  const tilt = Math.sin(t * 0.9) * 6;
  const zoomTitle = interpolate(t, [21.6, 23.4, 24.0], [1, 1.06, 1], clamp);
  const sweep = interpolate(t, [23.0, 24.2], [-0.4, 1.4], clamp);
  const benefitsO = interpolate(f, [s(30.1), s(30.4)], [1, 0], clamp);
  const tagO = interpolate(f, [s(23.71), s(23.9), s(30.1), s(30.4)], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div
        style={{
          position: 'absolute',
          left: 540 - width / 2,
          top,
          width,
          perspective: 1400,
          transform: `translateY(${(1 - rise) * 900}px)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            transform: `rotateY(${tilt}deg) rotateX(${(1 - rise) * 25}deg) scale(${zoomTitle})`,
            transformStyle: 'preserve-3d',
          }}
        >
          <Img
            src={staticFile('tablet.png')}
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 34,
              boxShadow: '0 40px 90px rgba(0,0,0,0.7), 0 0 80px rgba(242,177,63,0.35)',
            }}
          />
          {/* light sweep over the cover when the title is spoken */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 34,
              background: `linear-gradient(105deg, transparent ${sweep * 100 - 18}%, rgba(255,240,200,0.45) ${sweep * 100}%, transparent ${sweep * 100 + 18}%)`,
              mixBlendMode: 'screen',
            }}
          />
        </div>
      </div>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1090, opacity: tagO }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: '#d9d2c4', letterSpacing: '0.04em' }}>
          Le grand guide <span style={{ color: GOLD, fontWeight: 800 }}>Bibliodor</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1170, opacity: benefitsO }}>
        <div>
          <Check at={25.2} label="Comprendre l’IA" />
          <Check at={26.24} label="S’en servir chaque jour" />
          <Check at={27.88} label="Garder la main" />
          <Check at={28.72} label="Même en partant de zéro" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CTA: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [s(30.26), s(30.4)], [0, 1], clamp);
  const btn = useSpring(32.2, { damping: 11, stiffness: 160 });
  const pulse = f > s(32.6) ? 1 + Math.sin((f - s(32.6)) * 0.28) * 0.035 : 1;
  const shine = ((f - s(32.4)) % 40) / 40;
  const tap = interpolate(f, [s(33.0), s(33.0) + 14], [0, 1], clamp);
  const urlO = interpolate(f, [s(32.7), s(33.0)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 940, paddingLeft: 60, paddingRight: 60 }}>
        <Line size={74} weight={800}>
          <W at={30.32}>Ne</W>
          <W at={30.48}>regardez</W>
          <W at={31.0}>pas</W>
          <br />
          <W at={31.12} gold>
            l’avenir
          </W>
          <W at={31.56}>passer.</W>
        </Line>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 1260 }}>
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
          <span style={{ fontSize: 64, fontWeight: 900, color: '#141008', letterSpacing: '0.01em' }}>OBTENIR LE GUIDE</span>
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
        <div style={{ marginTop: 34, fontSize: 38, fontWeight: 700, color: '#d9d2c4', letterSpacing: '0.08em', opacity: urlO }}>
          bibliodor.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Finish: React.FC = () => (
  <>
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)' }} />
  </>
);

export const Pub: React.FC = () => {
  useMontserrat();
  return (
    <AbsoluteFill style={{ fontFamily, backgroundColor: NAVY }}>
      <Background />
      <Hook />
      <AndYou />
      <Accelerate />
      <Half />
      <Now />
      <Product />
      <CTA />
      <Brand />
      <Finish />
      <Audio src={staticFile('mix.wav')} />
    </AbsoluteFill>
  );
};

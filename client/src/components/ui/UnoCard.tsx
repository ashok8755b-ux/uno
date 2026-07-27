import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';

export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw-two'
  | 'wild' | 'wild-draw-four'
  | 'back';

export interface UnoCardData {
  color: CardColor;
  value: CardValue;
}

const COLOR_CONFIG: Record<Exclude<CardColor, 'wild'>, {
  bg: string; shadow: string; oval: string;
}> = {
  red:    { bg: 'linear-gradient(145deg,#b71c1c 0%,#e53935 50%,#ef5350 100%)', shadow: 'rgba(229,57,53,0.5)',  oval: 'rgba(183,28,28,0.85)' },
  blue:   { bg: 'linear-gradient(145deg,#0d47a1 0%,#1e88e5 50%,#42a5f5 100%)', shadow: 'rgba(30,136,229,0.5)', oval: 'rgba(13,71,161,0.85)'  },
  green:  { bg: 'linear-gradient(145deg,#1b5e20 0%,#43a047 50%,#66bb6a 100%)', shadow: 'rgba(67,160,71,0.5)',  oval: 'rgba(27,94,32,0.85)'   },
  yellow: { bg: 'linear-gradient(145deg,#e65100 0%,#fb8c00 50%,#ffa726 100%)', shadow: 'rgba(251,140,0,0.5)',  oval: 'rgba(230,81,0,0.85)'   },
};

const SIZES = {
  xs:  { w: 32,  h: 48,  font: 10, corner: 8,  oval: { w: 20, h: 30 }, border: 1 },
  sm:  { w: 48,  h: 72,  font: 16, corner: 11, oval: { w: 30, h: 46 }, border: 1.5 },
  md:  { w: 72,  h: 108, font: 26, corner: 15, oval: { w: 44, h: 68 }, border: 2 },
  lg:  { w: 96,  h: 144, font: 36, corner: 19, oval: { w: 60, h: 90 }, border: 2.5 },
  xl:  { w: 120, h: 180, font: 46, corner: 23, oval: { w: 74, h: 112 }, border: 3 },
};

function cornerLabel(value: CardValue): string {
  switch (value) {
    case 'skip': return '⊘';
    case 'reverse': return '↺';
    case 'draw-two': return '+2';
    case 'wild': return 'W';
    case 'wild-draw-four': return '+4';
    default: return value;
  }
}

function SymbolText({ value, size }: { value: CardValue; size: number }) {
  const symbols: Partial<Record<CardValue, string>> = {
    skip: '⊘',
    reverse: '↺',
    'draw-two': '+2',
    wild: '🌈',
    'wild-draw-four': '+4',
    back: '🂠',
  };
  const text = symbols[value] ?? value;
  return (
    <span style={{ fontSize: size, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em', userSelect: 'none' }}>
      {text}
    </span>
  );
}

function WildOval({ w, h }: { w: number; h: number }) {
  return (
    <div
      style={{
        width: w, height: h,
        borderRadius: '50%',
        overflow: 'hidden',
        transform: 'rotate(-25deg)',
        border: '2px solid rgba(255,255,255,0.3)',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
      }}
    >
      <div style={{ background: '#e53935' }} />
      <div style={{ background: '#1e88e5' }} />
      <div style={{ background: '#ffd60a' }} />
      <div style={{ background: '#43a047' }} />
    </div>
  );
}

interface UnoCardProps {
  color?: CardColor;
  value?: CardValue;
  size?: keyof typeof SIZES;
  isPlayable?: boolean;
  isSelected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function UnoCard({
  color = 'red',
  value = '0',
  size = 'md',
  isPlayable = false,
  isSelected = false,
  interactive = false,
  onClick,
  className,
  style,
}: UnoCardProps) {
  const s = SIZES[size];
  const isBack = value === 'back';
  const isWild = color === 'wild';
  const cfg = isWild ? null : COLOR_CONFIG[color];

  const cardBg = isBack
    ? 'linear-gradient(145deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)'
    : isWild
    ? 'linear-gradient(145deg,#1a1a1a 0%,#2d2d2d 50%,#1a1a1a 100%)'
    : cfg!.bg;

  const shadowColor = isBack
    ? 'rgba(15,52,96,0.5)'
    : isWild ? 'rgba(139,92,246,0.4)' : cfg!.shadow;

  const borderColor = isSelected
    ? '#ffd60a'
    : isPlayable
    ? 'rgba(255,255,255,0.5)'
    : 'rgba(255,255,255,0.18)';

  const clickable = interactive || isPlayable;

  return (
    <motion.div
      onClick={clickable ? onClick : undefined}
      whileHover={clickable ? { scale: 1.08, y: -6 } : undefined}
      whileTap={clickable ? { scale: 0.95 } : undefined}
      className={cn(className)}
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.w * 0.12,
        background: cardBg,
        border: `${s.border}px solid ${borderColor}`,
        boxShadow: isSelected
          ? `0 0 0 3px #ffd60a, 0 8px 32px ${shadowColor}, 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)`
          : `0 8px 32px ${shadowColor}, 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)`,
        cursor: clickable ? 'pointer' : 'default',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Shine overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      {isBack ? (
        /* Card back */
        <div style={{
          width: '75%', height: '80%',
          border: '2px solid rgba(255,255,255,0.2)',
          borderRadius: s.w * 0.08,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg,rgba(255,45,85,0.3),rgba(10,132,255,0.3))',
        }}>
          <span style={{ fontSize: s.font * 0.65, fontWeight: 900, color: 'rgba(255,255,255,0.8)', letterSpacing: '-0.03em' }}>
            UNO
          </span>
        </div>
      ) : (
        <>
          {/* Center oval */}
          <div style={{
            position: 'absolute',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isWild ? (
              <WildOval w={s.oval.w} h={s.oval.h} />
            ) : (
              <div style={{
                width: s.oval.w, height: s.oval.h,
                borderRadius: '50%',
                background: cfg!.oval,
                transform: 'rotate(-25deg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid rgba(255,255,255,0.2)',
              }}>
                <div style={{ transform: 'rotate(25deg)', color: 'white' }}>
                  <SymbolText value={value} size={s.font} />
                </div>
              </div>
            )}
            {/* Wild +4 label */}
            {isWild && value === 'wild-draw-four' && (
              <span style={{
                position: 'absolute', bottom: -s.font * 0.6,
                fontSize: s.font * 0.7, fontWeight: 900, color: 'white',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
              }}>+4</span>
            )}
          </div>

          {/* Top-left corner */}
          {size !== 'xs' && (
            <div style={{
              position: 'absolute', top: s.border + 3, left: s.border + 4,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              lineHeight: 1, color: 'white',
            }}>
              <span style={{ fontSize: s.corner, fontWeight: 900, letterSpacing: '-0.04em' }}>
                {cornerLabel(value)}
              </span>
            </div>
          )}

          {/* Bottom-right corner (rotated) */}
          {size !== 'xs' && (
            <div style={{
              position: 'absolute', bottom: s.border + 3, right: s.border + 4,
              transform: 'rotate(180deg)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              lineHeight: 1, color: 'white',
            }}>
              <span style={{ fontSize: s.corner, fontWeight: 900, letterSpacing: '-0.04em' }}>
                {cornerLabel(value)}
              </span>
            </div>
          )}
        </>
      )}

      {/* Playable indicator */}
      {isPlayable && (
        <motion.div
          style={{
            position: 'absolute', inset: -3, borderRadius: s.w * 0.14,
            border: '2px solid rgba(255,255,255,0.7)',
            pointerEvents: 'none',
          }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

/** Fanned stack of card backs */
export function CardStack({ count, size = 'sm' }: { count: number; size?: keyof typeof SIZES }) {
  const visible = Math.min(count, 5);
  return (
    <div style={{ position: 'relative', width: SIZES[size].w + (visible - 1) * 4, height: SIZES[size].h }}>
      {Array.from({ length: visible }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: i * 4, top: i * -1,
          zIndex: i,
          filter: i < visible - 1 ? `brightness(${0.7 + i * 0.06})` : undefined,
        }}>
          <UnoCard color="red" value="back" size={size} />
        </div>
      ))}
    </div>
  );
}

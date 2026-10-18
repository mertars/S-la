import { useId } from "react";
import {
  BarChart3, CalendarClock, Gift, Hash, Layers, Receipt, Repeat, Search, ShoppingBasket, Trash2, Users, Zap, Star, Sparkles, HeartHandshake,
} from "lucide-react";

// Uygulamanın kendi çizimleri — yalnızca tema jetonlarıyla renklenir (kesem.css: .k-art*).
// İnce çizgi, tek ışık, parlama yok.

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/**
 * Kavanoz kumbara. level 0–1 doluluk.
 *  state: near|over → doluluk rengi durum rengi olur; color: kategori/hedef renk anahtarı (ör. "sky").
 *  Cam yansıması, hafif dalgalanan sıvı (hareket azaltma tercihinde durur), ₺ işlenmiş altın bozukluklar, kapakta kalp etiketi.
 */
export function Jar({ level = 0, size = 120, state, color, label, coins = true, tag = true, className = "" }) {
  const id = useId().replace(/:/g, "");
  const v = clamp01(level);
  // gövde iç alanı: y 46 → 140 (94 birim)
  const top = 46;
  const h = 94;
  const y = top + (1 - v) * h - (v >= 0.995 ? 3 : 0);
  const coinCount = coins ? Math.min(6, Math.round(v * 9) + (v > 0 ? 1 : 0)) : 0;
  const COINS = [[42, 132], [60, 133], [78, 132], [51, 126], [69, 126], [60, 120]];
  const body = "M38 32 C38 38 22 40 22 54 L22 128 C22 136 28 141 36 141 L84 141 C92 141 98 136 98 128 L98 54 C98 40 82 38 82 32 Z";
  const wave = "M0 5 Q15 0 30 5 T60 5 T90 5 T120 5 T150 5 T180 5 T210 5 T240 5 V160 H0 Z";
  const style = color ? { "--jar": `var(--kc-${color})` } : undefined;
  return (
    <svg className={`k-art k-jar ${className}`} data-state={state} style={style} width={size} height={size * 1.25} viewBox="0 0 120 150" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <clipPath id={`jc${id}`}><path d={body} /></clipPath>
        <linearGradient id={`jl${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="k-jar-liq-top" />
          <stop offset="1" className="k-jar-liq-bot" />
        </linearGradient>
        <linearGradient id={`jg${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="k-jar-glass-a" />
          <stop offset="0.32" className="k-jar-glass-b" />
          <stop offset="0.78" className="k-jar-glass-c" />
          <stop offset="1" className="k-jar-glass-d" />
        </linearGradient>
        <radialGradient id={`jk${id}`} cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" className="k-coin-a" />
          <stop offset="0.6" className="k-coin-b" />
          <stop offset="1" className="k-coin-c" />
        </radialGradient>
        <linearGradient id={`jd${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="k-lid-a" />
          <stop offset="1" className="k-lid-b" />
        </linearGradient>
      </defs>
      <ellipse className="k-art-ground" cx="60" cy="144" rx="42" ry="4" />
      {/* camın arka yüzü */}
      <path className="k-jar-back" d={body} />
      <g clipPath={`url(#jc${id})`}>
        <g className="k-jar-level" style={{ transform: `translateY(${y}px)` }}>
          <g className="k-jar-wave b"><path d={wave} fill={`url(#jl${id})`} opacity="0.55" /></g>
          <g className="k-jar-wave a"><path d={wave} fill={`url(#jl${id})`} /></g>
          {v > 0.08 && (
            <g className="k-jar-bubbles">
              <circle cx="46" cy="24" r="1.6" /><circle cx="72" cy="40" r="1.2" /><circle cx="58" cy="58" r="1.8" />
            </g>
          )}
        </g>
        {COINS.slice(0, coinCount).map(([cx, cy], i) => (
          <g key={i} className="k-jar-coin">
            <ellipse cx={cx} cy={cy} rx="10" ry="4.2" fill={`url(#jk${id})`} />
            <ellipse cx={cx} cy={cy - 0.6} rx="7" ry="2.5" className="k-coin-rim" />
            {i === coinCount - 1 && <text x={cx} y={cy + 1.6} textAnchor="middle" className="k-coin-sym">₺</text>}
          </g>
        ))}
      </g>
      {/* cam: yansıma + kenar */}
      <path d={body} fill={`url(#jg${id})`} className="k-jar-gloss" />
      <path className="k-jar-glass" d="M38 24 L38 32 C38 38 22 40 22 54 L22 128 C22 136 28 141 36 141 L84 141 C92 141 98 136 98 128 L98 54 C98 40 82 38 82 32 L82 24" fill="none" />
      <path className="k-jar-shine" d="M30 62 C29 80 29 100 30 118" fill="none" />
      <path className="k-jar-shine thin" d="M36 52 L36 56" fill="none" />
      {/* kapak */}
      <rect x="33" y="12" width="54" height="14" rx="5" fill={`url(#jd${id})`} className="k-jar-lid" />
      <path className="k-jar-lid-line" d="M39 17 H81 M39 21 H81" fill="none" />
      {tag && size >= 56 && (
        <g className="k-jar-tag">
          <path d="M86 19 C94 21 98 27 99 34" fill="none" className="k-jar-string" />
          <path d="M99 36 C99 32.5 94.5 31.8 94.2 35.2 C94 37.8 99 41 99 41 C99 41 104 37.8 103.8 35.2 C103.5 31.8 99 32.5 99 36 Z" className="k-jar-heart" />
        </g>
      )}
    </svg>
  );
}

/** Kumbara domuzu — boş ekranlar ve tanışma için ince çizgi çizim. */
export function Piggy({ size = 132, className = "", coin = true }) {
  return (
    <svg className={`k-art k-piggy ${className}`} width={size} height={size * 0.82} viewBox="0 0 140 115" aria-hidden="true">
      <ellipse className="k-art-ground" cx="70" cy="108" rx="46" ry="4" />
      <path className="k-art-blob" d="M30 64 C30 40 50 28 74 28 C100 28 118 42 118 64 C118 84 102 98 76 98 C50 98 30 88 30 64 Z" />
      <g className="k-art-line" fill="none">
        <path d="M30 64 C30 40 50 28 74 28 C100 28 118 42 118 64 C118 84 102 98 76 98 C50 98 30 88 30 64 Z" />
        <path d="M54 33 L50 20 L64 29" />
        <path d="M118 58 C126 56 130 62 128 68 C126 74 120 74 117 70" />
        <path d="M46 92 L46 104 M60 96 L60 104 M88 96 L88 104 M102 90 L102 102" />
        <path d="M64 38 H84" />
        <circle cx="96" cy="52" r="1.6" className="k-art-dot" />
        <path d="M28 66 C22 66 20 60 24 57" />
      </g>
      {coin && (
        <g className="k-art-coin">
          <circle cx="74" cy="14" r="8" />
          <path d="M74 10 V18" fill="none" />
        </g>
      )}
    </svg>
  );
}

const SPOT_ICON = {
  receipt: Receipt, search: Search, chart: BarChart3, gift: Gift, cart: ShoppingBasket, people: HeartHandshake, users: Users,
  repeat: Repeat, calendar: CalendarClock, trash: Trash2, tag: Hash, bolt: Zap, layers: Layers, star: Star, sparkles: Sparkles,
};

/** Küçük sade boş ekran çizimi: yumuşak leke + ince çizgi ikon + iki küçük bozukluk. */
export function Spot({ name = "receipt", size = 120 }) {
  if (name === "piggy") return <Piggy size={size + 12} />;
  if (name === "jar") return <Jar level={0.18} size={size * 0.62} coins />;
  const I = SPOT_ICON[name] || Receipt;
  return (
    <svg className="k-art k-spot" width={size} height={size * 0.8} viewBox="0 0 120 96" aria-hidden="true">
      <ellipse className="k-art-ground" cx="60" cy="90" rx="34" ry="3" />
      <path className="k-art-blob" d="M22 50 C20 26 40 12 62 12 C88 12 102 28 100 50 C98 72 82 84 60 84 C38 84 24 72 22 50 Z" />
      <g className="k-art-coin small">
        <circle cx="98" cy="22" r="5" />
        <circle cx="20" cy="76" r="3.5" />
      </g>
      <g transform="translate(38 26)">
        <I width={44} height={44} strokeWidth={1.5} className="k-art-icon" />
      </g>
    </svg>
  );
}

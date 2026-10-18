import { useId } from "react";
import {
  BarChart3, CalendarClock, Gift, Hash, Layers, Receipt, Repeat, Search, ShoppingBasket, Trash2, Users, Zap, Star, Sparkles, HeartHandshake,
} from "lucide-react";

// Uygulamanın kendi çizimleri — yalnızca tema jetonlarıyla renklenir (kesem.css: .k-art*).
// İnce çizgi, tek ışık, parlama yok.

const clamp01 = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/**
 * Kavanoz kumbara. level 0–1 doluluk. state: ok|near|over → doluluk rengi (yoksa marka rengi).
 * Doluluk yumuşakça yükselir/azalır (CSS geçişi).
 */
export function Jar({ level = 0, size = 120, state, label, coins = true, className = "" }) {
  const id = useId().replace(/:/g, "");
  const v = clamp01(level);
  // gövde iç alanı: y 40 → 140 (100 birim)
  const top = 40;
  const h = 100;
  const y = top + (1 - v) * h;
  const coinRows = coins ? Math.min(3, Math.ceil(v * 6)) : 0;
  return (
    <svg className={`k-art k-jar ${className}`} data-state={state} width={size} height={size * 1.2} viewBox="0 0 120 144" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <clipPath id={`jc${id}`}>
          <path d="M37 30 C37 35 21 37 21 50 L21 126 C21 134 27 139 35 139 L85 139 C93 139 99 134 99 126 L99 50 C99 37 83 35 83 30 Z" />
        </clipPath>
      </defs>
      {/* zemin gölgesi */}
      <ellipse className="k-art-ground" cx="60" cy="140" rx="44" ry="3.5" />
      {/* doluluk */}
      <g clipPath={`url(#jc${id})`}>
        <g className="k-jar-level" style={{ transform: `translateY(${y}px)` }}>
          <path className="k-jar-fill" d="M0 3 C14 -1 26 -1 40 3 C54 7 66 7 80 3 C94 -1 106 -1 120 3 L120 120 L0 120 Z" />
          <path className="k-jar-surface" d="M0 3 C14 -1 26 -1 40 3 C54 7 66 7 80 3 C94 -1 106 -1 120 3" fill="none" />
        </g>
        {Array.from({ length: coinRows }).map((_, r) => (
          <g key={r} className="k-jar-coins">
            {[0, 1, 2].map((c) => (
              <ellipse key={c} cx={38 + c * 22 + (r % 2) * 10} cy={131 - r * 7} rx="9" ry="3.6" />
            ))}
          </g>
        ))}
      </g>
      {/* cam gövde */}
      <path className="k-jar-glass" d="M37 22 L37 30 C37 35 21 37 21 50 L21 126 C21 134 27 139 35 139 L85 139 C93 139 99 134 99 126 L99 50 C99 37 83 35 83 30 L83 22" fill="none" />
      <path className="k-jar-shine" d="M29 58 L29 112" fill="none" />
      {/* kapak */}
      <rect className="k-jar-lid" x="33" y="10" width="54" height="13" rx="4" />
      <path className="k-jar-lid-line" d="M40 16.5 H80" fill="none" />
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

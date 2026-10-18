import { useLayoutEffect, useRef } from "react";

// Büyük rakamları bulunduğu genişliğe sığdırır: telefonun yazı tipi daha geniş olsa da
// (iOS SF Rounded) "2.500 ₺" gibi tutarlar kavanoza/kenara taşmaz, gerekirse küçülür.
export function Fit({ className = "", children, min = 0.55 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      const avail = el.clientWidth;
      const need = el.scrollWidth;
      if (avail > 0 && need > avail + 0.5) {
        const base = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.max(base * min, Math.floor(base * (avail / need) * 100) / 100)}px`;
      }
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement || el);
    return () => ro.disconnect();
  });
  return (
    <span ref={ref} className={`k-fit ${className}`}>
      {children}
    </span>
  );
}

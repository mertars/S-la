import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

// Alt sayfa (bottom sheet). Telefonda ekranın altından yükselir; tablette
// ortalanmış kart. Özellikler:
//  • Geri tuşu (Android/PWA kaydırma jesti) en üstteki sayfayı kapatır —
//    history'ye bir giriş eklenir, kapanınca geri alınır.
//  • Tutamaç/başlık bölgesinden aşağı sürükleyerek kapatma.
//  • Esc ile kapatma, odak sayfaya alınır.
// İç içe sayfalarda (ör. ekleme sayfasının üstünde kategori düzenleyici) geri
// tuşu SADECE en üstteki sayfayı kapatmalı → tek, paylaşılan popstate dinleyici.
const sheetStack = [];
let sheetSeq = 0;
const pops = { ignore: 0, bound: false };
function ensurePopListener() {
  if (pops.bound) return;
  pops.bound = true;
  window.addEventListener("popstate", () => {
    if (pops.ignore > 0) {
      pops.ignore--;
      return;
    }
    const top = sheetStack[sheetStack.length - 1];
    if (top) {
      top.popped = true;
      top.close();
    }
  });
}

export default function Sheet({ open, onClose, title, children, footer, tall = false, size = "md", labelledBy }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = { id: ++sheetSeq, close: () => closeRef.current?.(), popped: false };
    sheetStack.push(token);
    ensurePopListener();
    window.history.pushState({ kesemSheet: token.id, depth: window.history.state?.depth ?? 0 }, "");
    const onKey = (e) => e.key === "Escape" && sheetStack[sheetStack.length - 1] === token && closeRef.current?.();
    window.addEventListener("keydown", onKey);
    ref.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = sheetStack.indexOf(token);
      if (i >= 0) sheetStack.splice(i, 1);
      // Kendi eklediğimiz geçmiş girişini sessizce geri al (geri tuşuyla
      // kapandıysa zaten geri gidilmiştir).
      // Ertelenir + yalnızca giriş hâlâ BİZİMSE geri alınır (React StrictMode'un
      // dev'deki çift efekt çalıştırması geçmişi bozmasın).
      if (!token.popped) {
        setTimeout(() => {
          if (window.history.state?.kesemSheet === token.id) {
            pops.ignore++;
            window.history.back();
          }
        }, 0);
      }
    };
  }, [open]);

  // Aşağı sürükle-kapat
  const drag = useRef(null);
  const onDown = useCallback((e) => {
    if (e.target.closest("button, input, textarea, a")) return;
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);
  const onMove = useCallback((e) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    drag.current.dy = dy;
    if (ref.current) ref.current.style.transform = `translateY(${dy}px)`;
  }, []);
  const onUp = useCallback(() => {
    if (!drag.current) return;
    const { dy } = drag.current;
    drag.current = null;
    if (ref.current) ref.current.style.transform = "";
    if (dy > 110) closeRef.current?.();
  }, []);

  if (!open) return null;
  return (
    <div className="k-sheet-layer">
      <div className="k-scrim" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-labelledby={labelledBy}
        className={`k-sheet k-sheet-${size} ${tall ? "k-sheet-tall" : ""}`}
      >
        <div className="k-sheet-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <span className="k-grabber" />
          <div className="k-sheet-title-row">
            <h2 className="k-sheet-title">{title}</h2>
            <button type="button" className="k-icon-btn" onClick={onClose} aria-label="Kapat">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="k-sheet-body">{children}</div>
        {footer}
      </div>
    </div>
  );
}

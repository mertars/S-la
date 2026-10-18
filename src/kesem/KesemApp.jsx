import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Plus, Receipt, Sun, PiggyBank } from "lucide-react";
import "./kesem.css";
import { KesemProvider, useKesem } from "./state/store";
import { useIsTablet, useKesemRoute, useMediaQuery } from "./state/route";
import { AppCtx } from "./ui/appctx";
import AddSheet from "./ui/AddSheet";
import { Toast, EmptyState } from "./ui/common";
import { Jar } from "./ui/art";
import HomePage from "./pages/Home";
import ExpensesPage from "./pages/Expenses";
import AnalysisPage from "./pages/Analysis";
import MorePage from "./pages/More";
import GoalsPage from "./pages/Goals";
import LockScreen from "./ui/LockScreen";
import Onboarding from "./ui/Onboarding";
import { emptyFilter } from "./model/filters";
import { appName, empty, namesFrom, splashSign } from "./texts";

// Alt gezinme: 4 sekme + ayrı yuvarlak "Ekle" düğmesi. "analiz", Harcamalar sekmesinin ikinci yüzü.
const TABS = [
  { key: "", label: "Bugün", icon: Sun },
  { key: "harcamalar", label: "Harcamalar", icon: Receipt, also: ["analiz"] },
  { key: "kumbara", label: "Kumbara", icon: PiggyBank },
  { key: "daha-fazla", label: "Daha fazla", icon: MoreHorizontal },
];
const tabIndex = (seg) => Math.max(0, TABS.findIndex((t) => t.key === seg || t.also?.includes(seg)));

function NavTabs({ active, onGo, vertical }) {
  return (
    <div className={`k-nav-tabs ${vertical ? "vertical" : ""}`} style={{ "--i": active }}>
      <span className="k-nav-ind" aria-hidden="true" />
      {TABS.map((t, i) => {
        const I = t.icon;
        const on = i === active;
        return (
          <button key={t.key} type="button" className={`k-nav-item ${on ? "on" : ""}`} onClick={() => onGo(t.key)} aria-current={on ? "page" : undefined}>
            <I size={22} strokeWidth={on ? 2.1 : 1.75} aria-hidden="true" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Uygulama kökünü her zaman GÖRÜNEN alana (visualViewport) oturtur.
 * Neden: iOS'ta klavye açılınca ya da bir alan odaklanınca sayfa (layout viewport) kayar;
 * `position: fixed; inset: 0` olan eski kök onunla kayıyor, alt çubuk ekranın ortasına çıkıyordu.
 * Artık kök = görünen alan; alt çubuk kökün son (sabit) satırı → hep en altta. Klavye açıkken gizlenir.
 */
function useAppViewport(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vv = window.visualViewport;
    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = vv ? vv.height : window.innerHeight;
        const t = vv ? vv.offsetTop : 0;
        el.style.setProperty("--k-vvh", `${Math.round(h)}px`);
        el.style.setProperty("--k-vvt", `${Math.round(t)}px`);
        const typing = !!document.activeElement?.matches?.("input:not([type=checkbox]):not([type=file]), textarea, select");
        el.dataset.kKbd = vv && typing && window.innerHeight - vv.height > 120 ? "1" : "0";
      });
    };
    // Klavye kapanınca iOS'un kaydırdığı belgeyi başa sar (alt çubuk boşlukta asılı kalmasın).
    const onFocusOut = () =>
      setTimeout(() => {
        if (!document.activeElement?.matches?.("input, textarea, select")) {
          if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
        }
        apply();
      }, 80);
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    document.addEventListener("focusin", apply);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      document.removeEventListener("focusin", apply);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [ref]);
}

// Açılış (veriler yüklenirken) — index.html'deki statik açılışla aynı görünüm.
function Splash({ names }) {
  return (
    <div className="k-splash" role="status" aria-label="Yükleniyor">
      <Jar level={0.42} size={84} />
      <b>{appName(names)}</b>
      <small>{splashSign(names)}</small>
    </div>
  );
}

function Shell({ onExit, userId }) {
  const k = useKesem();
  const rootRef = useRef(null);
  useAppViewport(rootRef);
  const theme = useMediaQuery("(prefers-color-scheme: dark)") ? "dark" : "light";
  const isTablet = useIsTablet();
  const { segs, navigate, goBack } = useKesemRoute();
  const names = useMemo(() => namesFrom(k.settings), [k.settings]);
  const title = appName(names);
  const [sheet, setSheet] = useState(null); // { mode, initial, editId }
  const [expFilter, setExpFilter] = useState(emptyFilter);
  const [unlocked, setUnlocked] = useState(false);
  const [covered, setCovered] = useState(false);
  const hiddenAt = useRef(0);

  const tab = segs[0] || "";
  const { dismissToast } = k;
  const openAdd = useCallback(
    (o = {}) => {
      dismissToast(); // önceki şerit yeni ekleme ekranının üstünde kalmasın
      setSheet({ mode: "tx", initial: o.initial || {}, editId: o.editId || null, key: Date.now() });
    },
    [dismissToast]
  );
  const openTemplate = useCallback((o = {}) => setSheet({ mode: "template", initial: o.initial || {}, editId: null, key: Date.now() }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const scheme = k.settings.mode === "auto" ? theme : k.settings.mode;

  const app = useMemo(
    () => ({ openAdd, openTemplate, navigate, goBack, isTablet, exit: onExit, names, appName: title, expFilter, setExpFilter, userKey: userId, markUnlocked: () => setUnlocked(true) }),
    [openAdd, openTemplate, navigate, goBack, isTablet, onExit, names, title, expFilter, userId]
  );

  // Eski adresler (birikimler artık kendi sekmesinde)
  useEffect(() => {
    if (segs[0] === "daha-fazla" && segs[1] === "birikimler") navigate(`kumbara${segs[2] ? "/" + segs[2] : ""}`, { replace: true });
  }, [segs, navigate]);

  // ---- Kilit: açılışta ve arka plandan dönünce PIN; uygulama değiştiricide içerik örtülür ----
  const lockOn = k.ready && !!k.lock.enabled && !!k.lock.hash;
  const locked = lockOn && !unlocked;
  const autoLock = k.lock.autoLock || 0;
  useEffect(() => {
    if (!k.ready) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        if (lockOn || k.settings.privacy) setCovered(true);
      } else {
        setCovered(false);
        if (lockOn && Date.now() - hiddenAt.current >= autoLock * 1000) setUnlocked(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [k.ready, lockOn, autoLock, k.settings.privacy]);

  // Başlık + adlar (index.html'deki statik açılış ekranı bir sonraki açılışta doğru adları yazsın)
  useEffect(() => {
    document.title = title;
    if (!k.ready) return;
    try {
      localStorage.setItem("kesem_names", JSON.stringify({ sila: names.sila, mert: names.mert }));
    } catch {
      /* depolama yok — açılış varsayılan adları gösterir */
    }
  }, [title, names, k.ready]);

  // Tarayıcı/durum çubuğu rengi = başlık bandının rengi (iki "theme-color" etiketi de; gece modunda siyah şerit kalmasın)
  useEffect(() => {
    const root = rootRef.current;
    let color = scheme === "dark" ? "#0c0a0d" : "#f6f2f4";
    if (root) {
      const probe = document.createElement("i");
      probe.style.color = "var(--k-band-1)";
      root.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      // "color(srgb r g b)" ya da "rgb(r, g, b)" → #rrggbb (meta etiketi her tarayıcıda okusun)
      const n = (c.match(/[\d.]+/g) || []).map(Number);
      if (n.length >= 3) {
        const k255 = c.startsWith("color(") ? 255 : 1;
        color = "#" + n.slice(0, 3).map((x) => Math.round(Math.min(255, x * k255)).toString(16).padStart(2, "0")).join("");
      }
    }
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute("content", color);
      m.removeAttribute("media");
    });
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.background = scheme === "dark" ? "#0c0a0d" : "#f6f2f4";
  }, [scheme, k.settings.palette]);

  // Sayfa kayınca durum çubuğu şeridi görünür olsun (saat/şarj satırı içerik üstünde okunur kalsın)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onScroll = (e) => {
      const t = e.target;
      if (!t || !t.classList || !(t.classList.contains("k-main") || t.classList.contains("k-md-master") || t.classList.contains("k-md-detail"))) return;
      const v = t.scrollTop > 8 ? "1" : "0";
      if (root.dataset.kScrolled !== v) root.dataset.kScrolled = v;
    };
    root.addEventListener("scroll", onScroll, true);
    return () => root.removeEventListener("scroll", onScroll, true);
  }, []);

  // Sayfa değişince başa kaydır
  useEffect(() => {
    document.querySelector(".k-main")?.scrollTo?.(0, 0);
  }, [tab, segs[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Açılışta (ve uygulamaya dönünce): vadesi gelen taksit & abonelikleri kayda çevir; bugünü "uğradığın gün" say.
  const { ready, materialize, touchActivity } = k;
  useEffect(() => {
    if (!ready) return;
    const run = () => {
      materialize();
      touchActivity();
    };
    run();
    const onVis = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ready, materialize, touchActivity]);

  const showOnb = k.ready && !locked && k.settings.onboarded !== true && (k.settings.onbForce || (k.transactions.length === 0 && !(k.budget.monthlyMinor > 0)));
  let page;
  if (!k.ready && !k.failed) page = <Splash names={names} />;
  else if (k.failed) page = <div className="k-page"><EmptyState art="jar" {...empty(names).failed} /></div>;
  else if (tab === "harcamalar") page = <ExpensesPage selectedId={segs[1] || null} />;
  else if (tab === "analiz") page = <AnalysisPage />;
  else if (tab === "kumbara") page = <GoalsPage id={segs[1] || null} />;
  else if (tab === "daha-fazla") page = <MorePage section={segs[1] || null} id={segs[2] || null} />;
  else page = <HomePage />;

  const active = tabIndex(tab);
  const go = (key) => (key === tab && !segs[1] ? document.querySelector(".k-main")?.scrollTo?.({ top: 0, behavior: "smooth" }) : navigate(key));

  return (
    <AppCtx.Provider value={app}>
      <div ref={rootRef} className="kesem-root" data-k-scheme={scheme} data-k-palette={k.settings.palette} data-k-tablet={isTablet ? "1" : "0"} data-k-privacy={k.settings.privacy ? "1" : "0"} data-k-cover={locked || showOnb || covered || !k.ready ? "1" : "0"}>
        <div className="k-bg" aria-hidden="true" />
        <div className="k-statusbar" aria-hidden="true" />
        {locked && <LockScreen onUnlock={() => setUnlocked(true)} />}
        {isTablet && k.ready && (
          <nav className="k-side" aria-label="Gezinme">
            <div className="k-side-brand">
              <Jar level={0.5} size={30} coins={false} />
              <span>{title}</span>
            </div>
            <button type="button" className="k-side-add" onClick={() => openAdd()} disabled={!k.ready}>
              <Plus size={20} strokeWidth={2.4} /> <span>Ekle</span>
            </button>
            <NavTabs active={active} onGo={go} vertical />
          </nav>
        )}
        <main className="k-main" id="k-main">
          {k.ready && !k.persistent && <div className="k-banner" role="alert">Kalıcı depolama kullanılamıyor; kayıtlar bu oturum kapanınca silinir.</div>}
          {locked ? null : page}
        </main>
        {!isTablet && k.ready && (
          <nav className="k-nav" aria-label="Gezinme">
            <NavTabs active={active} onGo={go} />
            <button type="button" className="k-nav-add" onClick={() => openAdd()} disabled={!k.ready} aria-label="Harcama ya da gelir ekle">
              <Plus size={28} strokeWidth={2.2} />
            </button>
          </nav>
        )}
        {showOnb && <Onboarding />}
        {covered && <div className="k-cover" aria-hidden="true"><Jar level={0.42} size={70} coins={false} /></div>}
        {!locked && sheet && <AddSheet key={sheet.key} mode={sheet.mode} initial={sheet.initial} editId={sheet.editId} onClose={closeSheet} />}
        <Toast />
      </div>
    </AppCtx.Provider>
  );
}

export default function KesemApp({ userId, onExit }) {
  return (
    <KesemProvider userId={userId}>
      <Shell onExit={onExit} userId={userId} />
    </KesemProvider>
  );
}

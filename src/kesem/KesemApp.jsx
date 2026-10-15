import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Home, MoreHorizontal, Plus, Receipt, ArrowLeft } from "lucide-react";
import "./kesem.css";
import { KesemProvider, useKesem } from "./state/store";
import { useIsTablet, useKesemRoute } from "./state/route";
import { AppCtx } from "./ui/appctx";
import AddSheet from "./ui/AddSheet";
import { Toast, EmptyState } from "./ui/common";
import HomePage from "./pages/Home";
import ExpensesPage from "./pages/Expenses";
import AnalysisPage from "./pages/Analysis";
import MorePage from "./pages/More";
import { useMenuLabel } from "./config";
import { useTheme } from "../context/ThemeContext";

const TABS = [
  { key: "", label: "Ana Sayfa", icon: Home },
  { key: "harcamalar", label: "Harcamalar", icon: Receipt },
  { key: "analiz", label: "Analiz", icon: BarChart3 },
  { key: "daha-fazla", label: "Daha Fazla", icon: MoreHorizontal },
];

function NavItem({ tab, active, onClick }) {
  const I = tab.icon;
  return (
    <button type="button" className={`k-nav-item ${active ? "on" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <I size={22} strokeWidth={active ? 2.4 : 2} />
      <span>{tab.label}</span>
    </button>
  );
}

function Shell({ onExit }) {
  const k = useKesem();
  const { theme } = useTheme();
  const isTablet = useIsTablet();
  const { segs, navigate, goBack } = useKesemRoute();
  const menuLabel = useMenuLabel();
  const [sheet, setSheet] = useState(null); // { mode, initial, editId }

  const tab = segs[0] || "";
  const openAdd = useCallback((o = {}) => setSheet({ mode: "tx", initial: o.initial || {}, editId: o.editId || null, key: Date.now() }), []);
  const openTemplate = useCallback((o = {}) => setSheet({ mode: "template", initial: o.initial || {}, editId: null, key: Date.now() }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const scheme = k.settings.mode === "auto" ? theme : k.settings.mode;

  // Sekme değişince açık ekleme sayfasını kapat (geçmiş girişi sayfa kapanırken geri alınır).
  const go = useCallback((path, opts) => navigate(path, opts), [navigate]);

  const app = useMemo(
    () => ({ openAdd, openTemplate, navigate: go, goBack, isTablet, exit: onExit, menuLabel }),
    [openAdd, openTemplate, go, goBack, isTablet, onExit, menuLabel]
  );

  // iOS/Android durum çubuğu rengi modülün kendi zeminine uysun; çıkışta eski hâli.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute("content");
    meta?.setAttribute("content", scheme === "dark" ? "#0c0a0d" : "#f6f2f4");
    return () => prev && meta?.setAttribute("content", prev);
  }, [scheme]);

  // Sayfa değişince başlığa odak/kaydırma sıfırlansın
  useEffect(() => {
    document.querySelector(".k-main")?.scrollTo?.(0, 0);
  }, [tab]);

  let page;
  if (!k.ready && !k.failed) page = <div className="k-boot" role="status" aria-label="Yükleniyor"><span className="k-spinner" /></div>;
  else if (k.failed) page = <div className="k-page"><EmptyState icon={<ArrowLeft size={30} />} title="Veriler açılamadı" text="Depolama erişilemiyor. Sayfayı yenile ya da tarayıcı ayarlarını kontrol et." /></div>;
  else if (tab === "harcamalar") page = <ExpensesPage selectedId={segs[1] || null} />;
  else if (tab === "analiz") page = <AnalysisPage />;
  else if (tab === "daha-fazla") page = <MorePage section={segs[1] || null} />;
  else page = <HomePage />;

  const activeTab = TABS.some((t) => t.key === tab) ? tab : "";

  return (
    <AppCtx.Provider value={app}>
      <div className="kesem-root" data-k-scheme={scheme} data-k-palette={k.settings.palette} data-k-tablet={isTablet ? "1" : "0"}>
        <div className="k-bg" aria-hidden="true" />
        {isTablet && (
          <nav className="k-side" aria-label="Harcama takibi gezinmesi">
            <div className="k-side-brand">{menuLabel}</div>
            <button type="button" className="k-side-add" onClick={() => openAdd()} disabled={!k.ready}>
              <Plus size={20} strokeWidth={2.6} /> Ekle
            </button>
            {TABS.map((t) => (
              <NavItem key={t.key} tab={t} active={activeTab === t.key} onClick={() => navigate(t.key)} />
            ))}
            <button type="button" className="k-side-exit" onClick={onExit}>
              <ArrowLeft size={18} /> Routinix
            </button>
          </nav>
        )}
        <main className="k-main" id="k-main">
          {k.ready && !k.persistent && <div className="k-banner" role="alert">Kalıcı depolama kullanılamıyor — kayıtlar bu oturum kapanınca silinir.</div>}
          {page}
        </main>
        {!isTablet && (
          <nav className="k-tabbar" aria-label="Harcama takibi gezinmesi">
            <NavItem tab={TABS[0]} active={activeTab === ""} onClick={() => navigate("")} />
            <NavItem tab={TABS[1]} active={activeTab === "harcamalar"} onClick={() => navigate("harcamalar")} />
            <button type="button" className="k-fab" onClick={() => openAdd()} disabled={!k.ready} aria-label="Harcama veya gelir ekle">
              <Plus size={30} strokeWidth={2.6} />
            </button>
            <NavItem tab={TABS[2]} active={activeTab === "analiz"} onClick={() => navigate("analiz")} />
            <NavItem tab={TABS[3]} active={activeTab === "daha-fazla"} onClick={() => navigate("daha-fazla")} />
          </nav>
        )}
        {isTablet && (
          <button type="button" className="k-fab floating" onClick={() => openAdd()} disabled={!k.ready} aria-label="Harcama veya gelir ekle">
            <Plus size={30} strokeWidth={2.6} />
          </button>
        )}
        {sheet && <AddSheet key={sheet.key} mode={sheet.mode} initial={sheet.initial} editId={sheet.editId} onClose={closeSheet} />}
        <Toast />
      </div>
    </AppCtx.Provider>
  );
}

// Dışarıdan kullanılan giriş: tam ekran modül.
export default function KesemApp({ userId, onExit }) {
  return (
    <KesemProvider userId={userId}>
      <Shell onExit={onExit} />
    </KesemProvider>
  );
}

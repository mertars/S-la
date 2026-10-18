import { useMemo, useState } from "react";
import { Amt } from "../ui/Amt";
import {
  CreditCard, Tags, Hash, Zap, Trash2, Settings, ChevronRight, Plus, RotateCcw, CalendarClock, Landmark,
  Target, Layers, Coins, Repeat, Gift, ShoppingBasket, Award, Heart,
} from "lucide-react";
import { AmountField } from "../ui/parts";
import { Jar } from "../ui/art";
import { about, empty } from "../texts";
import { useFinance } from "../state/derived";
import BudgetPage from "./Budget";
import DebtsPage from "./Debts";
import RecurringPage from "./Recurring";
import CalendarPage from "./Calendar";
import WishesPage from "./Wishes";
import ShoppingPage from "./Shopping";
import BadgesPage from "./Badges";
import { personBalances, installmentProgress } from "../model/finance";
import { CURRENCIES, currencySymbol, CURRENCY_NAMES, formatRate, formatMoneyText } from "../model/money";
import { relativeDayLabel } from "../model/dates";
import PageHeader from "../ui/PageHeader";
import TxRow from "../ui/TxRow";
import { Bubble } from "../ui/icons";
import { EmptyState, Segmented, UndoRedoButtons } from "../ui/common";
import { AccountEditor, CategoryEditor, TagEditor } from "../ui/editors";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { formatMoney } from "../model/money";
import SettingsSection from "./Settings";

const SECTIONS = [
  { key: "kategoriler", icon: Tags, label: "Kategoriler", desc: "Kategori ve alt kategorilerini düzenle" },
  { key: "odeme", icon: CreditCard, label: "Ödeme yöntemleri", desc: "Nakit, kartların" },
  { key: "etiketler", icon: Hash, label: "Etiketler", desc: "Kayıtlarını etiketle" },
  { key: "kisayollar", icon: Zap, label: "Kısayollar ve şablonlar", desc: "Tek dokunuşla eklemeler" },
  { key: "silinenler", icon: Trash2, label: "Son silinenler", desc: "Silinen kayıtları geri getir" },
  { key: "kurlar", icon: Coins, label: "Para birimleri", desc: "₺, $, € ve manuel kur" },
  { key: "ayarlar", icon: Settings, label: "Ayarlar ve yedek", desc: "İsimler, görünüm, gizlilik, kilit, yedek" },
  { key: "hakkinda", icon: Heart, label: "Hakkında", desc: "" },
];

function AboutSection() {
  const app = useApp();
  const a = about(app.names);
  return (
    <div className="k-about">
      <Jar level={0.62} size={92} />
      <h2>{a.title}</h2>
      <p>{a.text}</p>
      <p className="k-sign">{a.sign}</p>
      <p className="k-hint">Sürüm 2.0 · çevrimdışı çalışır · bildirim göndermez</p>
    </div>
  );
}


function CategoriesSection() {
  const k = useKesem();
  const [kind, setKind] = useState("expense");
  const [editor, setEditor] = useState(null);
  const tops = k.topCategories(kind);
  return (
    <>
      <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Gider" }, { value: "income", label: "Gelir" }]} label="Kategori türü" />
      <div className="k-card-list mt">
        {tops.map((c) => (
          <div key={c.id} className="k-manage-group">
            <button type="button" className="k-manage-row" onClick={() => setEditor(c)}>
              <Bubble icon={c.icon} color={c.color} size={38} />
              <span>{c.name}</span>
              <ChevronRight size={16} />
            </button>
            {k.subCategories(c.id).map((s) => (
              <button key={s.id} type="button" className="k-manage-row sub" onClick={() => setEditor(s)}>
                <span className="k-dot" style={{ "--c": `var(--kc-${s.color})` }} />
                <span>{s.name}</span>
                <ChevronRight size={14} />
              </button>
            ))}
            <button type="button" className="k-manage-row sub add" onClick={() => setEditor({ kind, parentId: c.id })}>
              <Plus size={14} /> <span>Alt kategori ekle</span>
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="k-btn tonal full mt" onClick={() => setEditor({ kind })}>
        <Plus size={17} /> Yeni kategori
      </button>
      {editor && <CategoryEditor key={editor.id || "new"} initial={editor} onClose={() => setEditor(null)} />}
    </>
  );
}

function AccountsSection() {
  const k = useKesem();
  const [editor, setEditor] = useState(null);
  return (
    <>
      <div className="k-card-list">
        {k.accounts.map((a) => (
          <button key={a.id} type="button" className="k-manage-row" onClick={() => setEditor(a)}>
            <Bubble icon={a.type === "cash" ? "cash" : a.type === "card" ? "card" : "wallet"} color={a.color} size={38} />
            <span>{a.name}</span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      <button type="button" className="k-btn tonal full mt" onClick={() => setEditor({})}>
        <Plus size={17} /> Yeni ödeme yöntemi
      </button>
      <p className="k-hint">Örnek: “Akbank Kredi Kartı”. Silinen bir yöntemin eski kayıtları adıyla görünmeye devam eder.</p>
      {editor && <AccountEditor key={editor.id || "new"} initial={editor} onClose={() => setEditor(null)} />}
    </>
  );
}

function TagsSection() {
  const k = useKesem();
  const app = useApp();
  const [editor, setEditor] = useState(null);
  const counts = useMemo(() => {
    const m = new Map();
    for (const t of k.transactions) for (const id of t.tagIds || []) m.set(id, (m.get(id) || 0) + 1);
    return m;
  }, [k.transactions]);
  return (
    <>
      {k.tags.length ? (
        <div className="k-card-list">
          {k.tags.map((t) => (
            <button key={t.id} type="button" className="k-manage-row" onClick={() => setEditor(t)}>
              <span className="k-hash">#</span>
              <span>{t.name}</span>
              <em>{counts.get(t.id) || 0} kayıt</em>
              <ChevronRight size={16} />
            </button>
          ))}
        </div>
      ) : (
        <EmptyState art="tag" {...empty(app.names).tags} />
      )}
      <button type="button" className="k-btn tonal full mt" onClick={() => setEditor({})}>
        <Plus size={17} /> Yeni etiket
      </button>
      {editor && <TagEditor key={editor.id || "new"} initial={editor} onClose={() => setEditor(null)} />}
    </>
  );
}

function TemplatesSection() {
  const k = useKesem();
  const app = useApp();
  return (
    <>
      {k.templates.length ? (
        <div className="k-card-list">
          {k.templates.map((t) => {
            const c = k.catById(t.categoryId);
            return (
              <div key={t.id} className="k-manage-row plain">
                <button type="button" className="k-manage-main" onClick={() => app.openTemplate({ initial: t })}>
                  <Bubble icon={c.icon} color={c.color} size={38} />
                  <span>
                    {t.name}
                    <small>
                      {t.amountMinor ? <Amt>{formatMoney(t.amountMinor, t.currency)}</Amt> : "Tutar her seferinde sorulur"} · {t.useCount || 0} kullanım
                    </small>
                  </span>
                </button>
                <button type="button" role="switch" aria-checked={!!t.quick} aria-label={`${t.name} ana sayfada göster`} className={`k-toggle ${t.quick ? "on" : ""}`} onClick={() => k.saveTemplate({ id: t.id, quick: !t.quick })}>
                  <i />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState art="bolt" {...empty(app.names).templates} />
      )}
      <button type="button" className="k-btn tonal full mt" onClick={() => app.openTemplate({})}>
        <Plus size={17} /> Yeni kısayol
      </button>
    </>
  );
}

function TrashSection() {
  const k = useKesem();
  const app = useApp();
  const items = k.deletedTransactions;
  if (!items.length) return <EmptyState art="trash" {...empty(app.names).trash} />;
  return (
    <div className="k-card-list">
      {items.map((t) => (
        <div key={t.id} className="k-trash-row">
          <TxRow tx={t} />
          <div className="k-trash-actions">
            <button type="button" className="k-btn tonal sm" onClick={() => k.restoreTransaction(t.id)}>
              <RotateCcw size={15} /> Geri yükle
            </button>
            <button type="button" className="k-btn danger-ghost sm" onClick={() => k.purgeTransaction(t.id)}>
              Kalıcı sil
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CurrenciesSection() {
  const k = useKesem();
  const enabled = k.enabledCurrencies;
  const toggle = (c) => k.saveRates({ enabled: enabled.includes(c) ? enabled.filter((x) => x !== c) : [...enabled, c] });
  const setRate = (c, minor) => k.saveRates({ rates: { ...k.rates, [c]: { rate: minor / 100, updatedAt: Date.now() } } });
  return (
    <>
      <p className="k-hint" style={{ marginTop: 0 }}>Kurları sen girersin; internet gerekmez. Bir kayıt eklerken o günkü kur kayda yazılır, sonradan değişse de eski kayıtların ₺ karşılığı değişmez.</p>
      <div className="k-card-list k-gap">
        {CURRENCIES.map((c) => (
          <div key={c} className="k-manage-row plain" style={{ flexWrap: "wrap" }}>
            <span className="k-menu-icon" style={{ fontWeight: 800 }}>{currencySymbol(c)}</span>
            <span>{c}<small>{CURRENCY_NAMES[c]}{c !== "TRY" && k.rates[c] ? ` · 1 ${currencySymbol(c)} = ${formatRate(k.rates[c].rate)} ₺` : ""}</small></span>
            {c === "TRY" ? <em>Ana para birimi</em> : (
              <button type="button" role="switch" aria-checked={enabled.includes(c)} aria-label={`${c} kullan`} className={`k-toggle ${enabled.includes(c) ? "on" : ""}`} onClick={() => toggle(c)}><i /></button>
            )}
          </div>
        ))}
      </div>
      {CURRENCIES.filter((c) => c !== "TRY" && enabled.includes(c)).map((c) => (
        <div key={c} className="k-gap">
          <div className="k-label">1 {currencySymbol(c)} kaç ₺?</div>
          <AmountField label={`${c} kuru`} value={Math.round((k.rates[c]?.rate || 0) * 100)} onChange={(v) => setRate(c, v)} placeholder="Kuru gir" />
        </div>
      ))}
    </>
  );
}

const BODY = { hakkinda: AboutSection, kurlar: CurrenciesSection, kategoriler: CategoriesSection, odeme: AccountsSection, etiketler: TagsSection, kisayollar: TemplatesSection, gorunum: SettingsSection, silinenler: TrashSection, ayarlar: SettingsSection };

function SectionPage({ section, onBack }) {
  const meta = SECTIONS.find((s) => s.key === section) || (section === "kurlar" ? { label: "Para birimleri", desc: "₺, $, € ve manuel kur" } : section === "gorunum" ? SECTIONS.find((s) => s.key === "ayarlar") : null);
  const Body = BODY[section];
  if (!meta || !Body) return null;
  return (
    <div className="k-page">
      <PageHeader title={meta.label} subtitle={meta.desc} onBack={onBack} right={<UndoRedoButtons />} />
      <div className="k-section-body">
        <Body />
      </div>
      <div className="k-page-end" />
    </div>
  );
}

const FEATURE = { butce: BudgetPage, borclar: DebtsPage, takvim: CalendarPage, istekler: WishesPage, alisveris: ShoppingPage, rozetler: BadgesPage };

function MenuRow({ icon: I, label, sub, onClick, active, badge }) {
  return (
    <button type="button" className={`k-menu-row ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "true" : undefined}>
      <span className="k-menu-icon"><I size={19} strokeWidth={1.75} aria-hidden="true" /></span>
      <span className="k-menu-label">{label}</span>
      {sub != null && <span className="k-menu-sub">{sub}</span>}
      {badge ? <em className="k-menu-badge">{badge}</em> : null}
      <ChevronRight size={16} className="k-chev" aria-hidden="true" />
    </button>
  );
}

function Menu({ section }) {
  const app = useApp();
  const k = useKesem();
  const f = useFinance();
  const st = f.status;
  const bal = personBalances({ people: k.people, debts: k.debts, rates: k.rates });
  const net = bal.reduce((s, b) => s + b.net, 0);
  const next = f.planned.find((i) => i.kind !== "debt");
  const leftPlans = k.installments.reduce((s, p) => s + installmentProgress(p).leftCount, 0);
  const open = k.shopping.filter((i) => !i.doneAt).length;
  const wishes = k.wishes.filter((w) => !w.boughtAt).length;
  const go = (key) => app.navigate(`daha-fazla/${key}`, { replace: app.isTablet && !!section });
  const short = (m) => formatMoneyText(m, "TRY", { hideZeroDecimals: true });
  const groups = [
    {
      title: "Para",
      rows: [
        { key: "butce", icon: Target, label: "Bütçe", sub: st.hasBudget ? `${short(Math.max(0, st.free))} kaldı` : "Belirle" },
        { key: "abonelikler", icon: Repeat, label: "Abonelik ve faturalar", sub: k.recurrings.length ? `${k.recurrings.length}` : "" },
        { key: "taksitler", icon: Layers, label: "Taksitler", sub: leftPlans ? `${leftPlans} kaldı` : "" },
        { key: "takvim", icon: CalendarClock, label: "Ödeme takvimi", sub: next ? relativeDayLabel(next.days) : "" },
        { key: "borclar", icon: Landmark, label: "Borç defteri", sub: net === 0 ? "" : net > 0 ? `${short(net)} alacak` : `${short(-net)} borç` },
      ],
    },
    {
      title: "Listeler",
      rows: [
        { key: "istekler", icon: Gift, label: "İstek listesi", sub: wishes ? `${wishes}` : "" },
        { key: "alisveris", icon: ShoppingBasket, label: "Alışveriş listesi", sub: open ? `${open}` : "" },
        { key: "rozetler", icon: Award, label: "Seri ve rozetler", sub: `${f.streak.current} gün` },
      ],
    },
    {
      title: "Düzen",
      rows: SECTIONS.filter((x) => !["ayarlar", "hakkinda"].includes(x.key)).map((x) => ({ key: x.key, icon: x.icon, label: x.label, badge: x.key === "silinenler" && k.deletedTransactions.length ? k.deletedTransactions.length : null })),
    },
    {
      title: "Uygulama",
      rows: [
        { key: "ayarlar", icon: Settings, label: "Ayarlar ve yedek", sub: k.lock.enabled ? "Kilit açık" : "" },
        { key: "hakkinda", icon: Heart, label: "Hakkında" },
      ],
    },
  ];
  return (
    <div className="k-page">
      <PageHeader title="Daha fazla" right={<UndoRedoButtons />} />
      {groups.map((g) => (
        <section key={g.title} className="k-menu-group" aria-label={g.title}>
          <h2 className="k-section-title">{g.title}</h2>
          <div className="k-list">
            {g.rows.map((r) => <MenuRow key={r.key} icon={r.icon} label={r.label} sub={r.sub} badge={r.badge} active={section === r.key} onClick={() => go(r.key)} />)}
          </div>
        </section>
      ))}
      <div className="k-page-end" />
    </div>
  );
}

export default function MorePage({ section, id }) {
  const app = useApp();
  if (section === "abonelikler" || section === "taksitler") return <RecurringPage tab={section} id={id} />;
  if (FEATURE[section]) {
    const F = FEATURE[section];
    return <F id={id} onBack={() => app.goBack("daha-fazla")} />;
  }
  const menu = <Menu section={section} />;
  if (!app.isTablet) return section ? <SectionPage section={section} onBack={() => app.goBack("daha-fazla")} /> : menu;
  return (
    <div className="k-md">
      <div className="k-md-master">{menu}</div>
      <div className="k-md-detail">
        {section ? <SectionPage section={section} onBack={() => app.goBack("daha-fazla")} /> : <div className="k-page"><EmptyState art="sparkles" title="Bir bölüm seç" text="Soldaki listeden açtığın bölüm burada görünür." /></div>}
      </div>
    </div>
  );
}

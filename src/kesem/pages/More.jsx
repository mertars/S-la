import { useMemo, useState } from "react";
import {
  CreditCard, Tags, Hash, Zap, Palette, Trash2, Settings, ChevronRight, Plus, RotateCcw, Download, CalendarClock, Landmark,
  PiggyBank, Target, Layers, Coins, Lock,
} from "lucide-react";
import PageHeader from "../ui/PageHeader";
import TxRow from "../ui/TxRow";
import { Bubble, Icon } from "../ui/icons";
import { EmptyState, Segmented, UndoRedoButtons } from "../ui/common";
import { AccountEditor, CategoryEditor, TagEditor } from "../ui/editors";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { KESEM_DEFAULT_MENU_LABEL, setMenuLabel } from "../config";
import { formatMoney } from "../model/money";
import { PALETTES } from "../ui/palettes";

const SECTIONS = [
  { key: "kategoriler", icon: Tags, label: "Kategoriler", desc: "Kategori ve alt kategorilerini düzenle" },
  { key: "odeme", icon: CreditCard, label: "Ödeme yöntemleri", desc: "Nakit, kartların" },
  { key: "etiketler", icon: Hash, label: "Etiketler", desc: "Kayıtlarını etiketle" },
  { key: "kisayollar", icon: Zap, label: "Kısayollar ve şablonlar", desc: "Tek dokunuşla eklemeler" },
  { key: "gorunum", icon: Palette, label: "Görünüm", desc: "Tema ve renk paleti" },
  { key: "silinenler", icon: Trash2, label: "Son silinenler", desc: "Silinen kayıtları geri getir" },
  { key: "ayarlar", icon: Settings, label: "Ayarlar", desc: "Menü adı, yedek, depolama" },
];

const SOON = [
  [Layers, "Taksitler"],
  [CalendarClock, "Tekrarlayan ödemeler"],
  [Landmark, "Borç ve alacak"],
  [Target, "Bütçe"],
  [PiggyBank, "Birikim"],
  [Coins, "Para birimleri"],
];

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
        <EmptyState icon={<Hash size={30} />} title="Etiket yok" text="Bir harcama eklerken etiket yazarsan burada görünür." />
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
                      {t.amountMinor ? formatMoney(t.amountMinor, t.currency) : "Tutar her seferinde sorulur"} · {t.useCount || 0} kullanım
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
        <EmptyState icon={<Zap size={30} />} title="Henüz kısayol yok" text="Sık yaptığın bir harcamayı kısayol yap; Ana Sayfa'dan tek dokunuşla eklersin." />
      )}
      <button type="button" className="k-btn tonal full mt" onClick={() => app.openTemplate({})}>
        <Plus size={17} /> Yeni kısayol
      </button>
    </>
  );
}

function AppearanceSection() {
  const k = useKesem();
  const { settings } = k;
  return (
    <>
      <div className="k-label">Görünüm</div>
      <Segmented
        value={settings.mode}
        onChange={(v) => k.updateSettings({ mode: v })}
        options={[{ value: "auto", label: "Routinix gibi" }, { value: "light", label: "Açık" }, { value: "dark", label: "Koyu" }]}
        label="Görünüm modu"
      />
      <div className="k-label mt">Renk paleti</div>
      <div className="k-palettes">
        {PALETTES.map((p) => (
          <button key={p.key} type="button" aria-pressed={settings.palette === p.key} className={`k-palette ${settings.palette === p.key ? "on" : ""}`} data-k-palette={p.key} onClick={() => k.updateSettings({ palette: p.key })}>
            <span className="k-palette-swatch" />
            <b>{p.name}</b>
          </button>
        ))}
      </div>
    </>
  );
}

function TrashSection() {
  const k = useKesem();
  const items = k.deletedTransactions;
  if (!items.length) return <EmptyState icon={<Trash2 size={30} />} title="Silinen kayıt yok" text="Sildiğin kayıtlar burada durur; istediğin zaman geri getirebilirsin." />;
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

function SettingsSection() {
  const k = useKesem();
  const app = useApp();
  const [label, setLabel] = useState(app.menuLabel);
  const exportJson = () => {
    const data = {
      uygulama: "Routinix Harcama Takibi",
      surum: 1,
      tarih: new Date().toISOString(),
      islemler: k.transactions.concat(k.deletedTransactions),
      kategoriler: k.categories,
      odemeYontemleri: k.accounts,
      etiketler: k.tags,
      kisayollar: k.templates,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `harcama-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <>
      <div className="k-label">Hamburger menüdeki ad</div>
      <div className="k-inline-form">
        <input className="k-input" value={label} maxLength={28} onChange={(e) => setLabel(e.target.value)} aria-label="Menü adı" placeholder={KESEM_DEFAULT_MENU_LABEL} />
        <button type="button" className="k-btn primary" onClick={() => { setMenuLabel(label); k.notify({ message: "Menü adı güncellendi" }); }}>
          Kaydet
        </button>
      </div>
      <p className="k-hint">Boş bırakıp kaydedersen “{KESEM_DEFAULT_MENU_LABEL}” olur.</p>

      <div className="k-label mt">Veriler</div>
      <div className="k-note-card">
        <Lock size={18} />
        <p>
          Kayıtların yalnızca bu cihazda, hesabına özel olarak saklanır ve internet olmadan da çalışır.{" "}
          {k.persistent ? "" : "Dikkat: Bu tarayıcı kalıcı depolamaya izin vermiyor; sekmeyi kapatınca veriler silinir."}
        </p>
      </div>
      <button type="button" className="k-btn tonal full" onClick={exportJson}>
        <Download size={17} /> Yedeği indir (JSON)
      </button>
      <p className="k-hint">Fiş fotoğrafları yedeğe dahil değildir.</p>
    </>
  );
}

const BODY = { kategoriler: CategoriesSection, odeme: AccountsSection, etiketler: TagsSection, kisayollar: TemplatesSection, gorunum: AppearanceSection, silinenler: TrashSection, ayarlar: SettingsSection };

function SectionPage({ section, onBack }) {
  const meta = SECTIONS.find((s) => s.key === section);
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

export default function MorePage({ section }) {
  const app = useApp();
  const k = useKesem();
  const menu = (
    <div className="k-page">
      <PageHeader title="Daha Fazla" subtitle="Ayarlar ve yönetim" right={<UndoRedoButtons />} />
      <div className="k-card-list">
        {SECTIONS.map((s) => (
          <button key={s.key} type="button" className={`k-manage-row big ${section === s.key ? "active" : ""}`} onClick={() => app.navigate(`daha-fazla/${s.key}`, { replace: app.isTablet && !!section })}>
            <span className="k-menu-icon">
              <s.icon size={19} />
            </span>
            <span>
              {s.label}
              <small>{s.desc}</small>
            </span>
            {s.key === "silinenler" && k.deletedTransactions.length > 0 && <em>{k.deletedTransactions.length}</em>}
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      <div className="k-label mt">Yakında</div>
      <div className="k-soon-grid">
        {SOON.map(([I, t]) => (
          <div key={t} className="k-soon">
            <I size={20} />
            <span>{t}</span>
          </div>
        ))}
      </div>
      <div className="k-page-end" />
    </div>
  );
  if (!app.isTablet) return section ? <SectionPage section={section} onBack={() => app.goBack("daha-fazla")} /> : menu;
  return (
    <div className="k-md">
      <div className="k-md-master">{menu}</div>
      <div className="k-md-detail">
        {section ? <SectionPage section={section} onBack={() => app.goBack("daha-fazla")} /> : <div className="k-page"><EmptyState icon={<Settings size={30} />} title="Bir bölüm seç" text="Kategorilerini, ödeme yöntemlerini ve görünümü soldan yönet." /></div>}
      </div>
    </div>
  );
}

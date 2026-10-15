import { useMemo, useRef } from "react";
import { ArrowLeft, Plus, Repeat, Sparkles, Wallet, X, Zap } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import TxRow from "../ui/TxRow";
import { Bubble, Icon } from "../ui/icons";
import { EmptyState, UndoRedoButtons } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { dayTotals, monthTotals, suggestShortcuts } from "../model/stats";
import { formatMoney } from "../model/money";
import { monthLabel, trLower } from "../model/dates";
import { STARTER_IDEAS } from "../model/defaults";

// Uzun bas → tutarı değiştirerek ekle; kısa dokun → anında ekle.
function useLongPress(onLong, onTap, ms = 450) {
  const timer = useRef(null);
  const fired = useRef(false);
  const start = useRef(null);
  const clear = () => clearTimeout(timer.current);
  return {
    onPointerDown: (e) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        onLong();
      }, ms);
    },
    onPointerMove: (e) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (fired.current) return;
      onTap();
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}

function QuickChip({ tpl }) {
  const k = useKesem();
  const app = useApp();
  const cat = k.catById(tpl.categoryId);
  const busy = useRef(false);
  const press = useLongPress(
    () => app.openAdd({ initial: { ...tpl, templateId: tpl.id } }),
    () => {
      if (!tpl.amountMinor) return app.openAdd({ initial: { ...tpl, templateId: tpl.id } });
      if (busy.current) return; // çift dokunuşla çift kayıt olmasın
      busy.current = true;
      k.quickAdd(tpl).finally(() => setTimeout(() => (busy.current = false), 700));
    }
  );
  return (
    <button type="button" className="k-quick" style={{ "--c": `var(--kc-${cat.color})` }} {...press} aria-label={`${tpl.name}${tpl.amountMinor ? ", " + formatMoney(tpl.amountMinor) : ""} ekle`}>
      <Bubble icon={cat.icon} color={cat.color} size={34} />
      <span className="k-quick-name">{tpl.name}</span>
      <span className="k-quick-amt">{tpl.amountMinor ? formatMoney(tpl.amountMinor, tpl.currency, { hideZeroDecimals: true }) : "Tutar gir"}</span>
    </button>
  );
}

export default function HomePage() {
  const k = useKesem();
  const app = useApp();
  const { transactions, templates, settings } = k;
  const now = Date.now();
  const month = useMemo(() => monthTotals(transactions, now), [transactions]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = useMemo(() => dayTotals(transactions, now), [transactions]); // eslint-disable-line react-hooks/exhaustive-deps
  const quicks = templates.filter((t) => t.quick);
  const suggestions = useMemo(() => suggestShortcuts(transactions, templates, settings.dismissedSuggestions), [transactions, templates, settings.dismissedSuggestions]);
  const lastAdded = useMemo(() => transactions.reduce((a, t) => (!a || t.createdAt > a.createdAt ? t : a), null), [transactions]);
  const recent = transactions.slice(0, 5);

  const shortcutFrom = (g) => {
    const t = g.sample;
    const sub = t.subcategoryId ? k.catById(t.subcategoryId) : null;
    app.openTemplate({
      initial: { name: (t.merchant || sub?.name || k.catById(t.categoryId).name).slice(0, 28), kind: t.kind, amountMinor: t.amountMinor, categoryId: t.categoryId, subcategoryId: t.subcategoryId, accountId: t.accountId, merchant: t.merchant, quick: true },
    });
  };

  return (
    <div className="k-page">
      <PageHeader
        title={app.menuLabel}
        subtitle={monthLabel(now)}
        left={
          <button type="button" className="k-back" onClick={app.exit} aria-label="Routinix'e dön">
            <ArrowLeft size={20} />
            <span>Routinix</span>
          </button>
        }
        right={<UndoRedoButtons />}
      />

      <section className="k-hero" aria-label="Bu ayın özeti">
        <span className="k-hero-label">Bu ay harcanan</span>
        <strong className="k-hero-amount">{formatMoney(month.expense)}</strong>
        <div className="k-hero-row">
          <div>
            <span>Gelir</span>
            <b className="pos">{formatMoney(month.income)}</b>
          </div>
          <div>
            <span>Bugün</span>
            <b>{formatMoney(today.expense)}</b>
          </div>
          <div>
            <span>Kalan</span>
            <b className={month.net < 0 ? "neg" : ""}>{formatMoney(month.net)}</b>
          </div>
        </div>
      </section>

      <section className="k-section" aria-label="Sık harcamalar">
        <div className="k-section-head">
          <h2>
            <Zap size={16} /> Sık harcamalar
          </h2>
          <button type="button" className="k-link" onClick={() => app.openTemplate({})}>
            <Plus size={14} /> Kısayol
          </button>
        </div>
        {quicks.length > 0 ? (
          <div className="k-quick-row no-scrollbar">
            {quicks.map((t) => (
              <QuickChip key={t.id} tpl={t} />
            ))}
          </div>
        ) : (
          <div className="k-ideas">
            <p>Her gün yaptığın harcamaları tek dokunuşla ekle. Bir fikirle başla:</p>
            <div className="k-chips wrap">
              {STARTER_IDEAS.map((i) => (
                <button key={i.name} type="button" className="k-chip" onClick={() => app.openTemplate({ initial: { ...i, quick: true } })}>
                  <Icon name={i.icon} size={16} /> {i.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {suggestions.map((g) => {
          const t = g.sample;
          const label = t.merchant || (t.subcategoryId && k.catById(t.subcategoryId).name) || k.catById(t.categoryId).name;
          return (
            <div key={g.key} className="k-suggest-card">
              <Sparkles size={16} />
              <button type="button" onClick={() => shortcutFrom(g)}>
                <b>{label}</b> {g.count} kez {formatMoney(t.amountMinor)} girdin — kısayol yap?
              </button>
              <button type="button" className="k-icon-btn sm" aria-label="Önerme" onClick={() => k.updateSettings({ dismissedSuggestions: [...settings.dismissedSuggestions, g.key] })}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </section>

      {lastAdded && (
        <section className="k-repeat" aria-label="Son harcamayı tekrarla">
          <Repeat size={18} />
          <span className="k-repeat-text">
            <small>Son {lastAdded.kind === "income" ? "gelir" : "harcama"}</small>
            <b>
              {lastAdded.merchant || k.catById(lastAdded.categoryId).name} · {formatMoney(lastAdded.amountMinor)}
            </b>
          </span>
          <button type="button" className="k-btn tonal sm" onClick={() => k.repeatTransaction(lastAdded)}>
            Tekrarla
          </button>
          <button type="button" className="k-btn ghost sm" onClick={() => app.openAdd({ initial: { ...lastAdded, occurredAt: undefined, receiptId: null } })}>
            Düzenle
          </button>
        </section>
      )}

      <section className="k-section" aria-label="Son kayıtlar">
        <div className="k-section-head">
          <h2>Son kayıtlar</h2>
          {transactions.length > 5 && (
            <button type="button" className="k-link" onClick={() => app.navigate("harcamalar")}>
              Tümü
            </button>
          )}
        </div>
        {recent.length ? (
          <div className="k-card-list">
            {recent.map((t) => (
              <TxRow key={t.id} tx={t} onClick={() => app.navigate(`harcamalar/${t.id}`)} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Wallet size={30} />}
            title="Henüz kayıt yok"
            text="Alttaki + tuşuna dokunup ilk harcamanı ya da gelirini ekle. Birkaç saniye sürer."
            action={
              <button type="button" className="k-btn primary" onClick={() => app.openAdd({})}>
                <Plus size={18} /> İlk harcamayı ekle
              </button>
            }
          />
        )}
      </section>
      <div className="k-page-end" />
    </div>
  );
}

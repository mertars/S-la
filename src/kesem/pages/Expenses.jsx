import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Edit3, Receipt, Repeat, Search, Trash2, X, Zap } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import TxRow from "../ui/TxRow";
import { Bubble } from "../ui/icons";
import { EmptyState, Segmented, UndoRedoButtons } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { groupByDay, totals } from "../model/stats";
import { formatMoney } from "../model/money";
import { dayKey, dayLabel, fullDateTime, monthLabel, monthRange, shiftMonth, trLower } from "../model/dates";
import { useEffect } from "react";

const FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "expense", label: "Gider" },
  { value: "income", label: "Gelir" },
];

export function TxDetail({ id, onBack }) {
  const k = useKesem();
  const app = useApp();
  const tx = k.txById(id);
  const [img, setImg] = useState(null);
  const [big, setBig] = useState(false);

  useEffect(() => {
    let url;
    let alive = true;
    setImg(null);
    if (tx?.receiptId)
      k.getBlob(tx.receiptId).then((r) => {
        if (alive && r?.blob) {
          url = URL.createObjectURL(r.blob);
          setImg(url);
        }
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [tx?.receiptId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tx || tx.deletedAt) {
    return (
      <div className="k-page">
        <PageHeader title="Kayıt" onBack={onBack} />
        <EmptyState icon={<Receipt size={30} />} title="Kayıt bulunamadı" text="Silinmiş ya da taşınmış olabilir." />
      </div>
    );
  }
  const cat = k.catById(tx.categoryId);
  const sub = tx.subcategoryId ? k.catById(tx.subcategoryId) : null;
  const acc = k.accById(tx.accountId);
  const income = tx.kind === "income";
  const tags = (tx.tagIds || []).map((i) => k.tagById(i)).filter(Boolean);

  return (
    <div className="k-page">
      <PageHeader title={tx.merchant || sub?.name || cat.name} subtitle={fullDateTime(tx.occurredAt)} onBack={onBack} right={<UndoRedoButtons />} />
      <section className="k-detail-hero" style={{ "--c": `var(--kc-${cat.color})` }}>
        <Bubble icon={cat.icon} color={cat.color} size={60} />
        <strong className={income ? "pos" : ""}>{formatMoney(income ? tx.amountMinor : -tx.amountMinor, tx.currency)}</strong>
        <span>
          {income ? "Gelir" : "Gider"} · {cat.name}
          {sub ? ` › ${sub.name}` : ""}
        </span>
      </section>
      <dl className="k-facts">
        <div>
          <dt>Ödeme</dt>
          <dd>{acc.name}</dd>
        </div>
        <div>
          <dt>Tarih ve saat</dt>
          <dd>{fullDateTime(tx.occurredAt)}</dd>
        </div>
        {tx.merchant && (
          <div>
            <dt>Yer</dt>
            <dd>{tx.merchant}</dd>
          </div>
        )}
        {tx.note && (
          <div>
            <dt>Not</dt>
            <dd>{tx.note}</dd>
          </div>
        )}
        {tags.length > 0 && (
          <div>
            <dt>Etiketler</dt>
            <dd className="k-chips wrap">
              {tags.map((t) => (
                <span key={t.id} className="k-chip sm plain">
                  #{t.name}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
      {img && (
        <button type="button" className="k-receipt-view" onClick={() => setBig(true)} aria-label="Fişi büyüt">
          <img src={img} alt="Fiş fotoğrafı" />
        </button>
      )}
      {big && img && (
        <div className="k-lightbox" onClick={() => setBig(false)} role="dialog" aria-label="Fiş">
          <img src={img} alt="Fiş fotoğrafı" />
          <button type="button" className="k-icon-btn" aria-label="Kapat">
            <X size={20} />
          </button>
        </div>
      )}
      <div className="k-actions">
        <button type="button" className="k-btn primary" onClick={() => app.openAdd({ editId: tx.id, initial: tx })}>
          <Edit3 size={17} /> Düzenle
        </button>
        <button type="button" className="k-btn tonal" onClick={() => k.repeatTransaction(tx)}>
          <Repeat size={17} /> Tekrarla
        </button>
        <button type="button" className="k-btn tonal" onClick={() => app.openAdd({ initial: { ...tx, occurredAt: undefined, receiptId: null } })}>
          <Copy size={17} /> Düzenleyerek tekrarla
        </button>
        <button
          type="button"
          className="k-btn tonal"
          onClick={() =>
            app.openTemplate({ initial: { name: (tx.merchant || sub?.name || cat.name).slice(0, 28), kind: tx.kind, amountMinor: tx.amountMinor, categoryId: tx.categoryId, subcategoryId: tx.subcategoryId, accountId: tx.accountId, merchant: tx.merchant, note: tx.note, tagIds: tx.tagIds, quick: true } })
          }
        >
          <Zap size={17} /> Kısayol yap
        </button>
        <button
          type="button"
          className="k-btn danger-ghost"
          onClick={async () => {
            await k.deleteTransaction(tx.id);
            onBack?.();
          }}
        >
          <Trash2 size={17} /> Sil
        </button>
      </div>
      <div className="k-page-end" />
    </div>
  );
}

export default function ExpensesPage({ selectedId }) {
  const k = useKesem();
  const app = useApp();
  const [monthTs, setMonthTs] = useState(Date.now());
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const range = monthRange(monthTs);
  const isNow = monthRange(Date.now())[0] === range[0];

  const list = useMemo(() => {
    const q = trLower(query.trim());
    return k.transactions.filter((t) => {
      if (!q) {
        if (t.occurredAt < range[0] || t.occurredAt >= range[1]) return false;
      }
      if (filter !== "all" && t.kind !== filter) return false;
      if (!q) return true;
      const hay = [t.merchant, t.note, k.catById(t.categoryId).name, t.subcategoryId && k.catById(t.subcategoryId).name, k.accById(t.accountId).name, ...(t.tagIds || []).map((i) => k.tagById(i)?.name)]
        .filter(Boolean)
        .map(trLower)
        .join(" ");
      return hay.includes(q);
    });
  }, [k.transactions, range[0], filter, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const sums = useMemo(() => totals(list), [list]);
  const groups = useMemo(() => groupByDay(list, dayKey), [list]);

  const master = (
    <div className="k-page">
      <PageHeader title="Harcamalar" subtitle={query ? "Arama sonuçları (tüm aylar)" : monthLabel(monthTs)} right={<UndoRedoButtons />} />
      <div className="k-toolbar">
        <div className="k-month">
          <button type="button" className="k-icon-btn" onClick={() => setMonthTs(shiftMonth(monthTs, -1))} aria-label="Önceki ay">
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="k-month-label" onClick={() => setMonthTs(Date.now())} disabled={isNow} aria-label="Bu aya dön">
            {monthLabel(monthTs)}
          </button>
          <button type="button" className="k-icon-btn" onClick={() => setMonthTs(shiftMonth(monthTs, 1))} disabled={isNow} aria-label="Sonraki ay">
            <ChevronRight size={18} />
          </button>
        </div>
        <label className="k-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ara: yer, not, kategori, etiket" aria-label="Ara" />
          {query && (
            <button type="button" className="k-clear" onClick={() => setQuery("")} aria-label="Aramayı temizle">
              <X size={14} />
            </button>
          )}
        </label>
        <Segmented value={filter} onChange={setFilter} options={FILTERS} label="Filtre" />
      </div>
      <div className="k-sum-strip">
        <span>
          Gider <b>{formatMoney(sums.expense)}</b>
        </span>
        <span>
          Gelir <b className="pos">{formatMoney(sums.income)}</b>
        </span>
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={<Receipt size={30} />} title={query ? "Sonuç bulunamadı" : "Bu ayda kayıt yok"} text={query ? "Farklı bir kelime dene." : "Yeni bir kayıt eklemek için + tuşuna dokun."} />
      ) : (
        groups.map((g) => {
          const dt = totals(g.items);
          return (
            <section key={g.key} className="k-day" aria-label={dayLabel(g.ts)}>
              <div className="k-day-head">
                <h3>{dayLabel(g.ts)}</h3>
                <span>{dt.expense ? formatMoney(-dt.expense) : formatMoney(dt.income, "TRY", { sign: true })}</span>
              </div>
              <div className="k-card-list">
                {g.items.map((t) => (
                  <TxRow key={t.id} tx={t} active={t.id === selectedId} onClick={() => app.navigate(`harcamalar/${t.id}`, { replace: app.isTablet && !!selectedId })} />
                ))}
              </div>
            </section>
          );
        })
      )}
      <div className="k-page-end" />
    </div>
  );

  if (!app.isTablet) {
    return selectedId ? <TxDetail id={selectedId} onBack={() => app.goBack("harcamalar")} /> : master;
  }
  return (
    <div className="k-md">
      <div className="k-md-master">{master}</div>
      <div className="k-md-detail">
        {selectedId ? (
          <TxDetail id={selectedId} onBack={() => app.goBack("harcamalar")} />
        ) : (
          <div className="k-page">
            <EmptyState icon={<Receipt size={30} />} title="Bir kayıt seç" text="Ayrıntılarını burada görürsün; düzenleyebilir, tekrarlayabilir ya da silebilirsin." />
          </div>
        )}
      </div>
    </div>
  );
}

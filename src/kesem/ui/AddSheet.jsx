import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Amt } from "./Amt";
import { CalendarDays, Camera, ChevronRight, Clock, CreditCard, Hash, Layers, Plus, Store, StickyNote, Trash2, Users, X, Zap, Image as ImageIcon } from "lucide-react";
import Sheet from "./Sheet";
import NumPad from "./NumPad";
import DateTimePicker from "./DateTimePicker";
import { Segmented } from "./common";
import { CategoryEditor, AccountEditor } from "./editors";
import { Icon } from "./icons";
import { downscaleImage } from "./receipt";
import { useKesem } from "../state/store";
import { displayInput, formatMoney, minorToInput, parseAmountInput, pressKey, rateOf, formatRate, CURRENCIES, currencySymbol } from "../model/money";
import { installmentAmounts, splitEqual } from "../model/finance";
import { AmountField } from "./parts";
import { addDays, dateTimeLabel, daysBetween, formatTime, fromDateInput, shortDate, toDateInput, trLower } from "../model/dates";
import { ADD_HINT_EMPTY, ADD_HINT_PICKED, ADD_HINT_READY } from "../texts";

const KINDS = [
  { value: "expense", label: "Harcama" },
  { value: "income", label: "Gelir" },
];
const TOP_N = 8;
const isOther = (c) => c.id === "cat-diger" || c.id === "cat-diger-gelir";

// Hızlı ekleme — uygulamanın en sık kullanılan ekranı.
//   Akış: tutarı yaz → kategoriye dokun → kaydedildi (2 adım).
//   Kategori önce seçilirse: tutarı yaz → "Ekle".
//   Saat, ödeme yöntemi, yer, not, etiket, fotoğraf, taksit, bölüşme, döviz: varsayılanla gelir, "Ayrıntılar"da gizli.
//   mode "tx"       : yeni kayıt (initial = ön doldurma) ya da düzenleme (editId)
//   mode "template" : kısayol oluştur/düzenle (tutar isteğe bağlı)
export default function AddSheet({ mode = "tx", initial = {}, editId = null, onClose }) {
  const k = useKesem();
  const { settings, transactions, accounts, tags } = k;
  const isTpl = mode === "template";
  const editingTx = editId ? k.txById(editId) : null;
  const editingTpl = isTpl && initial.id ? initial : null;
  const instant = !isTpl && !editId; // kategoriye dokununca anında kaydet

  const [kind, setKind] = useState(initial.kind || "expense");
  const [amount, setAmount] = useState(minorToInput(initial.amountMinor));
  const [categoryId, setCategoryId] = useState(initial.categoryId || null);
  const [subId, setSubId] = useState(initial.subcategoryId || null);
  const [accountId, setAccountId] = useState(initial.accountId || settings.lastAccount || accounts[0]?.id || null);
  const [when, setWhen] = useState(initial.occurredAt || Date.now());
  const [whenTouched, setWhenTouched] = useState(!!initial.occurredAt && !!editId);
  const [merchant, setMerchant] = useState(initial.merchant || "");
  const [note, setNote] = useState(initial.note || "");
  const [tagNames, setTagNames] = useState(() => (initial.tagIds || []).map((i) => k.tagById(i)?.name).filter(Boolean));
  const [tagDraft, setTagDraft] = useState("");
  const [name, setName] = useState(initial.name || "");
  const [quick, setQuick] = useState(isTpl ? initial.quick ?? true : false);
  const [receipt, setReceipt] = useState(undefined); // undefined=değişmedi, null=kaldırıldı, {blob,url}
  const [existingUrl, setExistingUrl] = useState(null);
  const [details, setDetails] = useState(false);
  const [dtOpen, setDtOpen] = useState(false);
  const [merchantFocus, setMerchantFocus] = useState(false);
  const [catEditor, setCatEditor] = useState(null);
  const [accEditor, setAccEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState(initial.currency || "TRY");
  const [rateMinor, setRateMinor] = useState(() => {
    const r = initial.fx?.rate ?? rateOf(initial.currency || "TRY", k.rates);
    return r && (initial.currency || "TRY") !== "TRY" ? Math.round(r * 100) : 0;
  });
  const [instOn, setInstOn] = useState(!!initial.installments);
  const [instCount, setInstCount] = useState(6);
  const [splitOn, setSplitOn] = useState(false);
  const [splitNames, setSplitNames] = useState([]);
  const [splitDraft, setSplitDraft] = useState("");
  const [paidBy, setPaidBy] = useState("me");
  const [photoErr, setPhotoErr] = useState("");
  const [flash, setFlash] = useState(null); // dokunulan kategori (kısa vurgulama)
  const [allCats, setAllCats] = useState(false); // en çok kullanılan 8 kategori görünür; "Tümü" hepsini açar
  const touchedCat = useRef(!!initial.categoryId);

  // Mevcut fiş önizlemesi
  useEffect(() => {
    let url;
    let alive = true;
    const rid = editingTx?.receiptId || initial.receiptId;
    if (rid) {
      k.getBlob(rid).then((rec) => {
        if (alive && rec?.blob) {
          url = URL.createObjectURL(rec.blob);
          setExistingUrl(url);
        }
      });
    }
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => receipt?.url && URL.revokeObjectURL(receipt.url), [receipt]);

  // En çok kullanılan kategoriler başta (son 120 gün). Sıra açılışta sabitlenir → ekran oynamaz.
  const [usage] = useState(() => {
    const m = new Map();
    const since = Date.now() - 120 * 86400000;
    for (const t of transactions) if (t.occurredAt >= since) m.set(t.categoryId, (m.get(t.categoryId) || 0) + 1);
    return m;
  });
  const cats = useMemo(() => {
    const list = [...k.topCategories(kind)];
    if (categoryId && !list.some((c) => c.id === categoryId)) {
      const c = k.catById(categoryId);
      if (c?.kind === kind && !c.parentId) list.push(c);
    }
    return list.sort((a, b) => isOther(a) - isOther(b) || (usage.get(b.id) || 0) - (usage.get(a.id) || 0) || a.order - b.order);
  }, [k, kind, usage, categoryId]);

  const shownCats = useMemo(() => {
    if (allCats || cats.length <= TOP_N) return cats;
    const top = cats.slice(0, TOP_N);
    const sel = categoryId && cats.find((c) => c.id === categoryId);
    return sel && !top.includes(sel) ? [...top.slice(0, TOP_N - 1), sel] : top;
  }, [cats, allCats, categoryId]);

  const amountMinor = parseAmountInput(amount);
  const subs = categoryId ? k.subCategories(categoryId) : [];
  const foreign = currency !== "TRY";
  const rateOk = !foreign || rateMinor > 0;
  const fxRate = foreign ? rateMinor / 100 : 1;
  const splitList = splitDraft.trim() ? [...splitNames, splitDraft.trim()] : splitNames;
  const splitActive = splitOn && instant && kind === "expense" && splitList.length > 0;
  const instActive = instOn && instant && kind === "expense" && instCount > 1;
  const extrasOk = rateOk && (!splitOn || splitList.length > 0);
  const valid = isTpl ? name.trim().length > 0 && !!categoryId : amountMinor > 0 && !!categoryId && extrasOk;
  const canMore = instant && kind === "expense";
  const cat = categoryId ? k.catById(categoryId) : null;
  const acc = accountId ? k.accById(accountId) : null;
  // Geçmişe dönük ekleme: gün seçilir, saat şimdiki saat olarak kalır (Ayrıntılar'dan değişir).
  const dayOff = whenTouched ? Math.max(0, daysBetween(when, Date.now())) : 0;
  const atDay = (dayTs) => {
    const n = new Date();
    const d = new Date(dayTs);
    d.setHours(n.getHours(), n.getMinutes(), 0, 0);
    return d.getTime();
  };
  const pickDay = (off) => {
    if (off === 0) {
      setWhen(Date.now());
      setWhenTouched(false);
    } else {
      setWhen(atDay(addDays(Date.now(), -off)));
      setWhenTouched(true);
    }
  };
  const pickDate = (dayTs) => {
    const off = daysBetween(dayTs, Date.now());
    if (off <= 0) return pickDay(0);
    setWhen(atDay(dayTs));
    setWhenTouched(true);
  };

  const switchKind = (nk) => {
    if (nk === kind) return;
    setKind(nk);
    setCategoryId(null);
    setSubId(null);
    touchedCat.current = false;
  };
  const pickCurrency = (c) => {
    setCurrency(c);
    const r = rateOf(c, k.rates);
    setRateMinor(c === "TRY" ? 0 : r ? Math.round(r * 100) : 0);
  };
  const addPerson = (raw) => {
    const n = raw.trim().slice(0, 28);
    if (!n) return;
    setSplitNames((cur) => (cur.some((x) => trLower(x) === trLower(n)) ? cur : [...cur, n]));
    setSplitDraft("");
  };

  // Mağaza önerileri: daha önce yazılanlar, sıklığa/yeniliğe göre.
  const merchantIndex = useMemo(() => {
    const map = new Map();
    for (const t of transactions) {
      if (!t.merchant) continue;
      const key = trLower(t.merchant);
      const e = map.get(key) || { name: t.merchant, count: 0, last: t };
      e.count++;
      map.set(key, e);
    }
    return [...map.values()];
  }, [transactions]);
  const suggestions = useMemo(() => {
    const q = trLower(merchant.trim());
    return merchantIndex
      .filter((e) => (q ? trLower(e.name).includes(q) && trLower(e.name) !== q : true))
      .sort((a, b) => {
        const ap = q && trLower(a.name).startsWith(q) ? 1 : 0;
        const bp = q && trLower(b.name).startsWith(q) ? 1 : 0;
        return bp - ap || b.count - a.count || b.last.occurredAt - a.last.occurredAt;
      })
      .slice(0, 5);
  }, [merchant, merchantIndex]);
  const pickMerchant = (e) => {
    setMerchant(e.name);
    setMerchantFocus(false);
    if (!touchedCat.current && e.last.kind === kind && !isTpl) {
      if (e.last.categoryId && k.catById(e.last.categoryId).kind === kind) {
        setCategoryId(e.last.categoryId);
        setSubId(e.last.subcategoryId || null);
      }
      if (e.last.accountId) setAccountId(e.last.accountId);
    }
  };

  // Tuş takımı + fiziksel klavye (tablet/masaüstü)
  const onKey = useCallback((key) => setAmount((cur) => pressKey(cur, key)), []);
  useEffect(() => {
    if (details || catEditor || accEditor) return;
    const h = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if (/^\d$/.test(e.key)) onKey(e.key);
      else if (e.key === "," || e.key === ".") onKey(",");
      else if (e.key === "Backspace") onKey("back");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [details, catEditor, accEditor, onKey]);

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoErr("");
    try {
      const blob = await downscaleImage(file);
      setReceipt({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setPhotoErr("Fotoğraf eklenemedi. Başka bir görsel dene.");
    }
  };

  const addTag = (raw) => {
    const t = raw.trim().replace(/^#/, "").slice(0, 24);
    if (!t) return;
    setTagNames((cur) => (cur.some((x) => trLower(x) === trLower(t)) ? cur : [...cur, t]));
    setTagDraft("");
  };
  const toggleTag = (n) => setTagNames((cur) => (cur.some((x) => trLower(x) === trLower(n)) ? cur.filter((x) => trLower(x) !== trLower(n)) : [...cur, n]));
  const popularTags = useMemo(() => {
    const count = new Map();
    for (const t of transactions) for (const id of t.tagIds || []) count.set(id, (count.get(id) || 0) + 1);
    return [...tags].sort((a, b) => (count.get(b.id) || 0) - (count.get(a.id) || 0)).slice(0, 12);
  }, [tags, transactions]);

  const draftInput = (o = {}) => ({
    kind,
    amountMinor,
    categoryId: o.categoryId ?? categoryId,
    subcategoryId: o.categoryId !== undefined && o.categoryId !== categoryId ? null : subId,
    accountId,
    occurredAt: whenTouched ? when : Date.now(),
    currency,
    rate: foreign ? fxRate : undefined,
    merchant,
    note,
    tagNames: tagDraft.trim() ? [...tagNames, tagDraft.trim()] : tagNames,
  });

  const save = async (o = {}) => {
    const catId = o.categoryId ?? categoryId;
    const ok = isTpl ? name.trim().length > 0 && !!catId : amountMinor > 0 && !!catId && extrasOk;
    if (!ok || busy) return;
    setBusy(true);
    try {
      if (isTpl) {
        const input = draftInput(o);
        const tagIds = [];
        for (const n of input.tagNames) {
          const hit = tags.find((t) => trLower(t.name) === trLower(n));
          if (hit) tagIds.push(hit.id);
          else {
            const rec = await k.saveTag({ name: n });
            if (rec) tagIds.push(rec.id);
          }
        }
        const rec = await k.saveTemplate({
          id: editingTpl?.id, name: name.trim().slice(0, 28), kind, amountMinor: amountMinor || null, currency: "TRY",
          categoryId: catId, subcategoryId: input.subcategoryId, accountId, merchant: merchant.trim(), note: note.trim(), tagIds, quick,
        });
        if (rec) {
          k.notify({ message: editingTpl ? "Kısayol güncellendi" : `“${rec.name}” kısayolu hazır` });
          onClose();
        }
      } else if (editId) {
        if (await k.updateTransaction(editId, { ...draftInput(o), receipt })) onClose();
      } else if (instActive) {
        const d = draftInput(o);
        const c = k.catById(catId);
        const plan = await k.createInstallmentPlan({ ...d, totalMinor: amountMinor, count: instCount, firstAt: d.occurredAt, title: merchant.trim() || (d.subcategoryId && k.catById(d.subcategoryId).name) || c?.name });
        if (plan) onClose();
      } else {
        const links = initial.linkIds ? initial.linkIds.map((l) => ({ ...l, patch: (tx) => ({ ...(l.kind === "wish" ? { boughtAt: tx.occurredAt } : { checked: true, doneAt: tx.occurredAt }), txId: tx.id }) })) : undefined;
        const split = splitActive ? { names: splitList, paidBy } : undefined;
        if (await k.addTransaction({ ...draftInput(o), receipt, templateId: initial.templateId || null, links, split })) onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const tapCategory = (id) => {
    touchedCat.current = true;
    if (id !== categoryId) setSubId(null);
    setCategoryId(id);
    if (instant && amountMinor > 0 && extrasOk) {
      setFlash(id);
      save({ categoryId: id });
    }
  };

  const makeShortcut = async () => {
    if (amountMinor <= 0 || !categoryId) return;
    const tagIds = tags.filter((t) => tagNames.some((n) => trLower(n) === trLower(t.name))).map((t) => t.id);
    const rec = await k.saveTemplate({
      name: (merchant.trim() || (subId && k.catById(subId).name) || cat?.name || "Kısayol").slice(0, 28),
      kind, amountMinor, currency: "TRY", categoryId, subcategoryId: subId, accountId, merchant: merchant.trim(), note: note.trim(), tagIds, quick: true,
    });
    if (rec) k.notify({ message: `“${rec.name}” kısayolu eklendi`, actionLabel: "Geri al", action: "undo" });
  };

  const remove = async () => {
    setDetails(false);
    onClose();
    await k.deleteTransaction(editId);
  };

  const title = isTpl ? (editingTpl ? "Kısayolu düzenle" : "Yeni kısayol") : editId ? "Kaydı düzenle" : kind === "income" ? "Gelir ekle" : "Harcama ekle";
  const receiptShown = receipt === null ? null : receipt?.url || existingUrl;
  const sym = currencySymbol(currency);
  const extrasCount = [merchant.trim(), note.trim(), tagNames.length || tagDraft.trim(), receiptShown, subId, foreign, instActive, splitActive].filter(Boolean).length;
  const submitLabel = editId || editingTpl ? "Kaydet" : isTpl ? "Kısayol ekle" : instActive ? "Taksitlendir" : !categoryId && amountMinor > 0 ? "Kategori seç" : "Ekle";
  const hint = isTpl ? "Tutarı boş bırakırsan kısayola dokununca sorulur." : editId ? "Kategoriye dokunarak değiştir." : !amountMinor ? ADD_HINT_EMPTY : categoryId ? ADD_HINT_PICKED : ADD_HINT_READY;

  const head = isTpl ? (
    <h2 className="k-sheet-title">{title}</h2>
  ) : (
    <div className="k-qa-head">
      <span className="k-sr">{title}</span>
      <Segmented value={kind} onChange={switchKind} options={KINDS} label="Tür" small />
    </div>
  );

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={title}
        head={head}
        tall
        size="lg"
        className="k-qa-sheet"
        bodyClass="k-qa-body"
        footer={<NumPad onKey={onKey} onSubmit={() => save()} canSubmit={valid && !busy} submitLabel={submitLabel} />}
      >
        <div className="k-qa" data-kind={kind}>
          {isTpl && (
            <label className="k-input-row k-qa-name">
              <Zap size={18} aria-hidden="true" />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kısayol adı, ör. Sabah kahvesi" maxLength={28} aria-label="Kısayol adı" />
            </label>
          )}
          <div className="k-qa-amount">
            <div className="k-qa-amount-cat" aria-hidden={!cat}>
              {cat ? <><Icon name={cat.icon} size={15} strokeWidth={1.8} /> {cat.name}{subId ? ` · ${k.catById(subId).name}` : ""}</> : kind === "income" ? "Gelir" : "Harcama"}
            </div>
            <div className="k-qa-amount-row" aria-live="polite" aria-label={`Tutar ${amountMinor ? formatMoney(amountMinor, currency) : "girilmedi"}${cat ? ", " + cat.name : ""}`}>
              <span className="k-qa-num" data-empty={!amount} key={amount.length}>
                {kind === "income" && amount ? "+" : ""}
                {displayInput(amount)}
              </span>
              <span className="k-qa-sym">{sym}</span>
            </div>
            <button type="button" className="k-qa-meta" onClick={() => setDetails(true)} aria-label="Ayrıntılar: ödeme yöntemi, saat, yer, not, etiket, fotoğraf">
              {!amount && !isTpl && !editId && <span className="k-qa-tip">{ADD_HINT_EMPTY}</span>}
              {(amount || isTpl || editId) && <><span><CreditCard size={14} aria-hidden="true" /> {acc?.name || "Ödeme"}</span>
              <span><Clock size={14} aria-hidden="true" /> {formatTime(whenTouched ? when : Date.now())}</span>
              </>}
              {extrasCount > 0 && <span className="k-qa-badge">+{extrasCount}</span>}
              <span className="k-qa-more">Ayrıntılar <ChevronRight size={14} aria-hidden="true" /></span>
            </button>
          </div>
          {!isTpl && (
            <div className="k-qa-days" role="radiogroup" aria-label="Gün">
              {[0, 1, 2].map((d) => (
                <button key={d} type="button" role="radio" aria-checked={dayOff === d} className={`k-qa-day ${dayOff === d ? "on" : ""}`} onClick={() => pickDay(d)}>
                  {d === 0 ? "Bugün" : d === 1 ? "Dün" : "Önceki gün"}
                </button>
              ))}
              <label className={`k-qa-day pick ${dayOff > 2 ? "on" : ""}`} aria-checked={dayOff > 2} role="radio">
                <CalendarDays size={15} aria-hidden="true" />
                <span>{dayOff > 2 ? shortDate(when) : "Tarih"}</span>
                <input type="date" max={toDateInput(Date.now())} value={toDateInput(whenTouched ? when : Date.now())} onChange={(e) => e.target.value && pickDate(fromDateInput(e.target.value))} aria-label="Geçmiş bir tarih seç" />
              </label>
            </div>
          )}
          <p className="k-qa-hint" aria-live="polite">{hint}</p>
          <div className="k-qa-cats-head">
            <span>Kategori</span>
            {cats.length > TOP_N && (
              <button type="button" className="k-qa-more-btn" onClick={() => setAllCats((v) => !v)} aria-expanded={allCats}>
                {allCats ? "Daha az" : `Tümü (${cats.length})`}
              </button>
            )}
          </div>
          <div className={`k-qa-grid ${allCats ? "all" : ""}`} role="listbox" aria-label="Kategori">
            {shownCats.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={categoryId === c.id}
                className={`k-qa-cat ${categoryId === c.id ? "on" : ""} ${flash === c.id ? "flash" : ""}`}
                style={{ "--c": `var(--kc-${c.color})` }}
                onClick={() => tapCategory(c.id)}
                disabled={busy}
              >
                <Icon name={c.icon} size={17} strokeWidth={1.8} />
                <span>{c.name}</span>
              </button>
            ))}
            {(allCats || cats.length <= TOP_N) && (
              <button type="button" className="k-qa-cat add" onClick={() => setCatEditor({ kind })}>
                <Plus size={17} strokeWidth={1.8} />
                <span>Yeni</span>
              </button>
            )}
          </div>
        </div>
      </Sheet>

      {details && (
        <Sheet open onClose={() => setDetails(false)} title="Ayrıntılar" size="md" footer={<div className="k-footbar"><button type="button" className="k-btn primary full" onClick={() => setDetails(false)}>Tamam</button></div>}>
          <div className="k-form k-details">
            {cat && subs.length > 0 && (
              <div className="k-field">
                <div className="k-field-label">{cat.name} · alt kategori</div>
                <div className="k-chips wrap" role="listbox" aria-label="Alt kategori">
                  {subs.map((c) => (
                    <button key={c.id} type="button" role="option" aria-selected={subId === c.id} className={`k-chip sm ${subId === c.id ? "on" : ""}`} style={{ "--c": `var(--kc-${c.color})` }} onClick={() => setSubId(subId === c.id ? null : c.id)}>
                      {c.name}
                    </button>
                  ))}
                  <button type="button" className="k-chip sm dashed" onClick={() => setCatEditor({ kind, parentId: categoryId })}><Plus size={14} /> Alt kategori</button>
                </div>
              </div>
            )}

            {!isTpl && (
              <div className="k-field">
                <div className="k-field-label">Zaman</div>
                <button type="button" className="k-row-btn" onClick={() => setDtOpen((v) => !v)} aria-expanded={dtOpen}>
                  <Clock size={18} />
                  <span>{whenTouched ? dateTimeLabel(when) : `Şimdi · ${dateTimeLabel(when)}`}</span>
                  <em>{dtOpen ? "Kapat" : "Değiştir"}</em>
                </button>
                {dtOpen && <DateTimePicker value={when} onChange={(t) => { setWhen(t); setWhenTouched(true); }} onNow={() => { setWhen(Date.now()); setWhenTouched(false); }} />}
              </div>
            )}

            <div className="k-field">
              <div className="k-field-label">{kind === "income" ? "Hesap" : "Ödeme yöntemi"}</div>
              <div className="k-chips wrap" role="listbox" aria-label="Ödeme yöntemi">
                {accounts.map((a) => (
                  <button key={a.id} type="button" role="option" aria-selected={accountId === a.id} className={`k-chip ${accountId === a.id ? "on" : ""}`} style={{ "--c": `var(--kc-${a.color})` }} onClick={() => setAccountId(a.id)}>
                    <Icon name={a.type === "cash" ? "cash" : a.type === "card" ? "card" : "wallet"} size={17} />
                    {a.name}
                  </button>
                ))}
                <button type="button" className="k-chip dashed" onClick={() => setAccEditor({})}><Plus size={16} /> Yeni</button>
              </div>
            </div>

            <div className="k-field k-relative">
              <div className="k-field-label">Yer</div>
              <label className="k-input-row">
                <Store size={18} />
                <input value={merchant} onFocus={() => setMerchantFocus(true)} onBlur={() => setTimeout(() => setMerchantFocus(false), 120)} onChange={(e) => setMerchant(e.target.value)} placeholder="Mağaza, kafe… (isteğe bağlı)" maxLength={48} autoComplete="off" aria-label="Mağaza veya yer" />
                {merchant && <button type="button" className="k-clear" onMouseDown={(e) => e.preventDefault()} onClick={() => setMerchant("")} aria-label="Temizle"><X size={14} /></button>}
              </label>
              {merchantFocus && suggestions.length > 0 && (
                <ul className="k-suggest" role="listbox" aria-label="Yer önerileri">
                  {suggestions.map((e) => (
                    <li key={e.name}>
                      <button type="button" role="option" onMouseDown={(ev) => ev.preventDefault()} onClick={() => pickMerchant(e)}>
                        <Store size={15} />
                        <span>{e.name}</span>
                        <em>{e.count}×</em>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="k-field">
              <div className="k-field-label">Not</div>
              <label className="k-input-row">
                <StickyNote size={18} />
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="İsteğe bağlı" maxLength={200} aria-label="Not" />
              </label>
            </div>

            <div className="k-field">
              <div className="k-field-label">Etiketler</div>
              <label className="k-input-row">
                <Hash size={18} />
                <input
                  value={tagDraft}
                  onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value.slice(0, -1)) : setTagDraft(e.target.value))}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(tagDraft))}
                  onBlur={() => addTag(tagDraft)}
                  placeholder="Etiket yaz, Enter"
                  maxLength={24}
                  aria-label="Etiket"
                  enterKeyHint="done"
                />
              </label>
              {(tagNames.length > 0 || popularTags.length > 0) && (
                <div className="k-chips wrap">
                  {[...tagNames, ...popularTags.map((t) => t.name).filter((n) => !tagNames.some((x) => trLower(x) === trLower(n)))].map((n) => {
                    const on = tagNames.some((x) => trLower(x) === trLower(n));
                    return <button key={n} type="button" aria-pressed={on} className={`k-chip sm ${on ? "on" : ""}`} onClick={() => toggleTag(n)}>#{n}</button>;
                  })}
                </div>
              )}
            </div>

            {!isTpl && (
              <div className="k-field">
                <div className="k-field-label">Fiş fotoğrafı</div>
                {receiptShown ? (
                  <div className="k-receipt">
                    <img src={receiptShown} alt="Fiş fotoğrafı" />
                    <button type="button" className="k-icon-btn" onClick={() => setReceipt(null)} aria-label="Fotoğrafı kaldır"><Trash2 size={16} /></button>
                  </div>
                ) : (
                  <label className="k-row-btn">
                    <Camera size={18} />
                    <span>Fotoğraf çek ya da seç</span>
                    <ImageIcon size={16} className="k-muted" />
                    <input type="file" accept="image/*" onChange={onPhoto} hidden />
                  </label>
                )}
                {photoErr && <p className="k-error">{photoErr}</p>}
              </div>
            )}

            {!isTpl && k.enabledCurrencies.length > 1 && (
              <div className="k-field">
                <div className="k-field-label">Para birimi</div>
                <div className="k-chips wrap" role="radiogroup" aria-label="Para birimi">
                  {CURRENCIES.filter((c) => k.enabledCurrencies.includes(c) || c === currency).map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={currency === c} className={`k-chip sm ${currency === c ? "on" : ""}`} onClick={() => pickCurrency(c)}>{currencySymbol(c)} {c}</button>
                  ))}
                </div>
                {foreign && <AmountField label={`Kur · 1 ${currencySymbol(currency)} = ? ₺`} value={rateMinor} onChange={setRateMinor} placeholder="Kuru gir" />}
                {foreign && rateMinor > 0 && amountMinor > 0 && <p className="k-hint" style={{ margin: 0 }}>≈ <Amt>{formatMoney(Math.round(amountMinor * fxRate))}</Amt> · kur {formatRate(fxRate)} ₺</p>}
                {foreign && rateMinor === 0 && <p className="k-error" style={{ margin: 0 }}>Bu para birimi için kuru girmelisin.</p>}
              </div>
            )}

            {canMore && (
              <div className="k-field">
                <div className="k-field-label">Ödeme şekli</div>
                <button type="button" className="k-row-btn" aria-pressed={instOn} onClick={() => { setInstOn((v) => !v); setSplitOn(false); }}>
                  <Layers size={18} />
                  <span>Taksitli alışveriş</span>
                  <em>{instOn ? "Açık" : "Kapalı"}</em>
                </button>
                {instOn && (
                  <div className="k-subpanel">
                    <div className="k-chips wrap" role="radiogroup" aria-label="Taksit sayısı">
                      {[2, 3, 6, 9, 12, 18, 24].map((n) => (
                        <button key={n} type="button" role="radio" aria-checked={instCount === n} className={`k-chip sm ${instCount === n ? "on" : ""}`} onClick={() => setInstCount(n)}>{n} taksit</button>
                      ))}
                    </div>
                    {amountMinor > 0 && instCount > 1 && (
                      <p className="k-hint">
                        {(() => {
                          const a = installmentAmounts(amountMinor, instCount);
                          return a[0] === a[1] ? `${instCount} × ${formatMoney(a[0], currency)}` : `1. taksit ${formatMoney(a[0], currency)}, sonrakiler ${formatMoney(a[1], currency)}`;
                        })()}{" "}· her ay kendiliğinden yazılır
                      </p>
                    )}
                  </div>
                )}
                <button type="button" className="k-row-btn" aria-pressed={splitOn} onClick={() => { setSplitOn((v) => !v); setInstOn(false); }}>
                  <Users size={18} />
                  <span>Hesabı bölüş</span>
                  <em>{splitOn ? "Açık" : "Kapalı"}</em>
                </button>
                {splitOn && (
                  <div className="k-subpanel">
                    <div className="k-field-label">Kiminle?</div>
                    <div className="k-chips wrap">
                      {[...new Set([...splitNames, ...k.people.map((p) => p.name)])].map((n) => {
                        const on = splitNames.some((x) => trLower(x) === trLower(n));
                        return <button key={n} type="button" aria-pressed={on} className={`k-chip sm ${on ? "on" : ""}`} onClick={() => (on ? setSplitNames((c) => c.filter((x) => trLower(x) !== trLower(n))) : addPerson(n))}>{n}</button>;
                      })}
                    </div>
                    <label className="k-input-row">
                      <Users size={16} />
                      <input value={splitDraft} onChange={(e) => setSplitDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPerson(splitDraft))} placeholder="Kişi adı ekle" maxLength={28} aria-label="Kişi adı" enterKeyHint="done" />
                    </label>
                    {splitList.length > 0 && (
                      <>
                        <Segmented value={paidBy === "me" ? "me" : "other"} onChange={(v) => setPaidBy(v === "me" ? "me" : splitList[0])} options={[{ value: "me", label: "Ben ödedim" }, { value: "other", label: "O ödedi" }]} label="Ödeyen" />
                        {paidBy !== "me" && splitList.length > 1 && (
                          <div className="k-chips wrap">
                            {splitList.map((n) => <button key={n} type="button" aria-pressed={paidBy === n} className={`k-chip sm ${paidBy === n ? "on" : ""}`} onClick={() => setPaidBy(n)}>{n}</button>)}
                          </div>
                        )}
                        {amountMinor > 0 && (() => {
                          const sh = splitEqual(amountMinor, splitList.length + 1, paidBy === "me");
                          return (
                            <div>
                              <div className="k-split-row"><span className="k-muted">Senin payın</span><b><Amt>{formatMoney(sh.myShare, currency)}</Amt></b></div>
                              {paidBy === "me"
                                ? splitList.map((n) => <div key={n} className="k-split-row"><span>{n} sana borçlu</span><b><Amt>{formatMoney(sh.otherShare, currency)}</Amt></b></div>)
                                : <div className="k-split-row"><span>{paidBy} kişisine borçlusun</span><b><Amt>{formatMoney(sh.myShare, currency)}</Amt></b></div>}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {isTpl && (
              <label className="k-switch-row">
                <span>
                  <b>Bugün ekranında göster</b>
                  <small>Tutar kayıtlıysa dokununca anında eklenir.</small>
                </span>
                <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
                <i aria-hidden="true" />
              </label>
            )}

            <div className="k-add-links">
              {!isTpl && amountMinor > 0 && categoryId && <button type="button" className="k-link" onClick={makeShortcut}><Zap size={15} /> Bunu kısayol yap</button>}
              {editId && <button type="button" className="k-link danger" onClick={remove}><Trash2 size={15} /> Kaydı sil</button>}
            </div>
          </div>
        </Sheet>
      )}

      {catEditor && (
        <CategoryEditor
          initial={catEditor}
          onClose={() => setCatEditor(null)}
          onSaved={(rec) => {
            touchedCat.current = true;
            if (rec.parentId) {
              setCategoryId(rec.parentId);
              setSubId(rec.id);
            } else {
              setCategoryId(rec.id);
              setSubId(null);
            }
          }}
        />
      )}
      {accEditor && <AccountEditor initial={accEditor} onClose={() => setAccEditor(null)} onSaved={(rec) => setAccountId(rec.id)} />}
    </>
  );
}

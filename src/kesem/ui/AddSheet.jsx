import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Clock, Plus, Trash2, X, Zap, Store, StickyNote, Hash } from "lucide-react";
import Sheet from "./Sheet";
import NumPad from "./NumPad";
import DateTimePicker from "./DateTimePicker";
import { Segmented } from "./common";
import { CategoryEditor, AccountEditor } from "./editors";
import { Bubble, Icon } from "./icons";
import { downscaleImage } from "./receipt";
import { useKesem } from "../state/store";
import { displayInput, formatMoney, minorToInput, parseAmountInput, pressKey } from "../model/money";
import { dateTimeLabel, trLower } from "../model/dates";
import { currencySymbol } from "../model/money";

const KINDS = [
  { value: "expense", label: "Gider" },
  { value: "income", label: "Gelir" },
];

// Hızlı harcama/gelir ekleme sayfası — uygulamanın ana akışı.
//   mode "tx"       : yeni kayıt (initial = ön doldurma) ya da düzenleme (editId)
//   mode "template" : kısayol/şablon oluştur-düzenle (tutar isteğe bağlı)
export default function AddSheet({ mode = "tx", initial = {}, editId = null, onClose }) {
  const k = useKesem();
  const { settings, transactions, accounts, tags, categories } = k;
  const isTpl = mode === "template";
  const editingTx = editId ? k.txById(editId) : null;
  const editingTpl = isTpl && initial.id ? initial : null;

  const startKind = initial.kind || "expense";
  const firstCat = (kind) => {
    const last = settings.lastCategory?.[kind];
    const tops = k.topCategories(kind);
    return tops.find((c) => c.id === last)?.id || tops[0]?.id || null;
  };

  const [kind, setKind] = useState(startKind);
  const [amount, setAmount] = useState(minorToInput(initial.amountMinor));
  const [categoryId, setCategoryId] = useState(initial.categoryId || firstCat(startKind));
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
  const [showPad, setShowPad] = useState(true);
  const [dtOpen, setDtOpen] = useState(false);
  const [merchantFocus, setMerchantFocus] = useState(false);
  const [catEditor, setCatEditor] = useState(null);
  const [accEditor, setAccEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const touchedCat = useRef(!!initial.categoryId);
  const scrollRef = useRef(null);

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

  const amountMinor = parseAmountInput(amount);
  const subs = categoryId ? k.subCategories(categoryId) : [];
  const topCats = k.topCategories(kind);
  const valid = isTpl ? name.trim().length > 0 : amountMinor > 0 && !!categoryId;
  const cat = categoryId ? k.catById(categoryId) : null;

  const switchKind = (nk) => {
    if (nk === kind) return;
    setKind(nk);
    setCategoryId(firstCat(nk));
    setSubId(null);
    touchedCat.current = false;
  };
  const pickCategory = (id) => {
    touchedCat.current = true;
    setCategoryId(id);
    setSubId(null);
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
    const list = merchantIndex
      .filter((e) => (q ? trLower(e.name).includes(q) && trLower(e.name) !== q : true))
      .sort((a, b) => {
        const ap = q && trLower(a.name).startsWith(q) ? 1 : 0;
        const bp = q && trLower(b.name).startsWith(q) ? 1 : 0;
        return bp - ap || b.count - a.count || b.last.occurredAt - a.last.occurredAt;
      });
    return list.slice(0, 5);
  }, [merchant, merchantIndex]);
  const pickMerchant = (e) => {
    setMerchant(e.name);
    setMerchantFocus(false);
    // Kullanıcı kategoriyi kendisi seçmediyse son kullanılan kategori/ödeme otomatik gelir.
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
    if (!showPad || dtOpen || catEditor || accEditor) return;
    const h = (e) => {
      if (e.target.closest?.("input, textarea")) return;
      if (/^\d$/.test(e.key)) onKey(e.key);
      else if (e.key === "," || e.key === ".") onKey(",");
      else if (e.key === "Backspace") onKey("back");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showPad, dtOpen, catEditor, accEditor, onKey]);

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

  const draftInput = () => ({
    kind,
    amountMinor,
    categoryId,
    subcategoryId: subId,
    accountId,
    occurredAt: whenTouched ? when : Date.now(),
    merchant,
    note,
    tagNames: tagDraft.trim() ? [...tagNames, tagDraft.trim()] : tagNames,
  });

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (isTpl) {
        const input = draftInput();
        const tagIds = [];
        // Şablon etiketleri ad olarak çözülür: var olanlar bağlanır.
        for (const n of input.tagNames) {
          const hit = tags.find((t) => trLower(t.name) === trLower(n));
          if (hit) tagIds.push(hit.id);
          else {
            const rec = await k.saveTag({ name: n });
            if (rec) tagIds.push(rec.id);
          }
        }
        const rec = await k.saveTemplate({
          id: editingTpl?.id,
          name: name.trim().slice(0, 28),
          kind,
          amountMinor: amountMinor || null,
          currency: "TRY",
          categoryId,
          subcategoryId: subId,
          accountId,
          merchant: merchant.trim(),
          note: note.trim(),
          tagIds,
          quick,
        });
        if (rec) {
          k.notify({ message: editingTpl ? "Kısayol güncellendi" : "Kısayol eklendi" });
          onClose();
        }
      } else if (editId) {
        if (await k.updateTransaction(editId, { ...draftInput(), receipt })) onClose();
      } else {
        if (await k.addTransaction({ ...draftInput(), receipt, templateId: initial.templateId || null })) onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const makeShortcut = async () => {
    if (amountMinor <= 0 || !categoryId) return;
    const tagIds = tags.filter((t) => tagNames.some((n) => trLower(n) === trLower(t.name))).map((t) => t.id);
    const rec = await k.saveTemplate({
      name: (merchant.trim() || (subId && k.catById(subId).name) || cat?.name || "Kısayol").slice(0, 28),
      kind, amountMinor, currency: "TRY", categoryId, subcategoryId: subId, accountId, merchant: merchant.trim(), note: note.trim(), tagIds, quick: true,
    });
    if (rec) k.notify({ message: `“${rec.name}” kısayolu eklendi`, actionLabel: "Geri Al", action: "undo" });
  };

  const remove = async () => {
    onClose();
    await k.deleteTransaction(editId);
  };

  const title = isTpl ? (editingTpl ? "Kısayolu düzenle" : "Yeni kısayol") : editId ? "Kaydı düzenle" : kind === "income" ? "Gelir ekle" : "Harcama ekle";
  const receiptShown = receipt === null ? null : receipt?.url || existingUrl;
  const sym = currencySymbol("TRY");
  const focusOther = () => setShowPad(false);

  const footer = showPad ? (
    <NumPad onKey={onKey} onSubmit={save} canSubmit={valid && !busy} submitLabel={editId || editingTpl ? "Kaydet" : isTpl ? "Kısayol ekle" : "Ekle"} />
  ) : (
    <div className="k-footbar">
      <button type="button" className="k-amount-mini" onClick={() => { setDtOpen(false); setShowPad(true); }} aria-label="Tutarı düzenle">
        <span>Tutar</span>
        <b>{amountMinor ? formatMoney(amountMinor) : "—"}</b>
      </button>
      <button type="button" className="k-btn primary" disabled={!valid || busy} onClick={save}>
        {editId || editingTpl ? "Kaydet" : isTpl ? "Kısayol ekle" : "Ekle"}
      </button>
    </div>
  );

  return (
    <>
      <Sheet open onClose={onClose} title={title} tall footer={footer} size="lg">
        <div className="k-add" ref={scrollRef} data-kind={kind}>
          {isTpl && (
            <div className="k-field">
              <div className="k-field-label"><Zap size={14} /> Kısayol adı</div>
              <input className="k-input" value={name} onFocus={focusOther} onChange={(e) => setName(e.target.value)} placeholder="Örn. Sabah kahvesi" maxLength={28} aria-label="Kısayol adı" />
            </div>
          )}
          <Segmented value={kind} onChange={switchKind} options={KINDS} label="Tür" />

          <button type="button" className={`k-amount ${showPad ? "active" : ""}`} onClick={() => { setDtOpen(false); setShowPad(true); }} aria-label="Tutar">
            <span className="k-amount-num" data-empty={!amount}>
              {kind === "income" ? "+" : ""}
              {displayInput(amount)}
            </span>
            <span className="k-amount-sym">{sym}</span>
          </button>
          {isTpl && !amount && <p className="k-hint">Tutarı boş bırakırsan kısayola dokununca tutarı sen girersin.</p>}

          <div className="k-field">
            <div className="k-field-label">Kategori</div>
            <div className="k-chips no-scrollbar" role="listbox" aria-label="Kategori">
              {topCats.map((c) => (
                <button key={c.id} type="button" role="option" aria-selected={categoryId === c.id} className={`k-chip ${categoryId === c.id ? "on" : ""}`} style={{ "--c": `var(--kc-${c.color})` }} onClick={() => pickCategory(c.id)}>
                  <Icon name={c.icon} size={17} />
                  {c.name}
                </button>
              ))}
              <button type="button" className="k-chip dashed" onClick={() => setCatEditor({ kind })}>
                <Plus size={16} /> Yeni
              </button>
            </div>
            {categoryId && (
              <div className="k-chips sub no-scrollbar" role="listbox" aria-label="Alt kategori">
                {subs.map((c) => (
                  <button key={c.id} type="button" role="option" aria-selected={subId === c.id} className={`k-chip sm ${subId === c.id ? "on" : ""}`} style={{ "--c": `var(--kc-${c.color})` }} onClick={() => setSubId(subId === c.id ? null : c.id)}>
                    {c.name}
                  </button>
                ))}
                <button type="button" className="k-chip sm dashed" onClick={() => setCatEditor({ kind, parentId: categoryId })}>
                  <Plus size={14} /> Alt kategori
                </button>
              </div>
            )}
          </div>

          <div className="k-field">
            <div className="k-field-label">{kind === "income" ? "Hesap" : "Ödeme yöntemi"}</div>
            <div className="k-chips no-scrollbar" role="listbox" aria-label="Ödeme yöntemi">
              {accounts.map((a) => (
                <button key={a.id} type="button" role="option" aria-selected={accountId === a.id} className={`k-chip ${accountId === a.id ? "on" : ""}`} style={{ "--c": `var(--kc-${a.color})` }} onClick={() => setAccountId(a.id)}>
                  <Icon name={a.type === "cash" ? "cash" : a.type === "card" ? "card" : "wallet"} size={17} />
                  {a.name}
                </button>
              ))}
              <button type="button" className="k-chip dashed" onClick={() => setAccEditor({})}>
                <Plus size={16} /> Yeni
              </button>
            </div>
          </div>

          {!isTpl && (
            <div className="k-field">
              <button type="button" className="k-row-btn" onClick={() => { setDtOpen((v) => !v); setShowPad(false); }} aria-expanded={dtOpen}>
                <Clock size={18} />
                <span>{whenTouched ? dateTimeLabel(when) : `Şimdi · ${dateTimeLabel(when)}`}</span>
                <em>{dtOpen ? "Kapat" : "Değiştir"}</em>
              </button>
              {dtOpen && (
                <DateTimePicker
                  value={when}
                  onChange={(t) => { setWhen(t); setWhenTouched(true); }}
                  onNow={() => { setWhen(Date.now()); setWhenTouched(false); }}
                />
              )}
            </div>
          )}

          <div className="k-field k-relative">
            <label className="k-input-row">
              <Store size={18} />
              <input value={merchant} onFocus={() => { focusOther(); setMerchantFocus(true); }} onBlur={() => setTimeout(() => setMerchantFocus(false), 120)} onChange={(e) => setMerchant(e.target.value)} placeholder="Mağaza / yer (isteğe bağlı)" maxLength={48} autoComplete="off" aria-label="Mağaza veya yer" />
              {merchant && (
                <button type="button" className="k-clear" onMouseDown={(e) => e.preventDefault()} onClick={() => setMerchant("")} aria-label="Temizle">
                  <X size={14} />
                </button>
              )}
            </label>
            {merchantFocus && suggestions.length > 0 && (
              <ul className="k-suggest" role="listbox" aria-label="Mağaza önerileri">
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
            <label className="k-input-row">
              <StickyNote size={18} />
              <input value={note} onFocus={focusOther} onChange={(e) => setNote(e.target.value)} placeholder="Not (isteğe bağlı)" maxLength={200} aria-label="Not" />
            </label>
          </div>

          <div className="k-field">
            <label className="k-input-row">
              <Hash size={18} />
              <input
                value={tagDraft}
                onFocus={focusOther}
                onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value.slice(0, -1)) : setTagDraft(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag(tagDraft))}
                onBlur={() => addTag(tagDraft)}
                placeholder="Etiket ekle (Enter ile)"
                maxLength={24}
                aria-label="Etiket"
              />
            </label>
            {(tagNames.length > 0 || popularTags.length > 0) && (
              <div className="k-chips wrap">
                {[...tagNames, ...popularTags.map((t) => t.name).filter((n) => !tagNames.some((x) => trLower(x) === trLower(n)))].map((n) => {
                  const on = tagNames.some((x) => trLower(x) === trLower(n));
                  return (
                    <button key={n} type="button" aria-pressed={on} className={`k-chip sm ${on ? "on" : ""}`} onClick={() => toggleTag(n)}>
                      #{n}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!isTpl && (
            <div className="k-field">
              {receiptShown ? (
                <div className="k-receipt">
                  <img src={receiptShown} alt="Fiş fotoğrafı" />
                  <button type="button" className="k-icon-btn" onClick={() => setReceipt(null)} aria-label="Fotoğrafı kaldır">
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <label className="k-row-btn">
                  <Camera size={18} />
                  <span>Fiş fotoğrafı ekle</span>
                  <input type="file" accept="image/*" onChange={onPhoto} hidden />
                </label>
              )}
              {photoErr && <p className="k-error">{photoErr}</p>}
            </div>
          )}

          {isTpl && (
            <label className="k-switch-row">
              <span>
                <b>Ana sayfada tek dokunuşla göster</b>
                <small>Tutar kayıtlıysa dokununca anında eklenir.</small>
              </span>
              <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
              <i aria-hidden="true" />
            </label>
          )}

          <div className="k-add-links">
            {!isTpl && amountMinor > 0 && categoryId && (
              <button type="button" className="k-link" onClick={makeShortcut}>
                <Zap size={15} /> Bunu kısayol yap
              </button>
            )}
            {editId && (
              <button type="button" className="k-link danger" onClick={remove}>
                <Trash2 size={15} /> Kaydı sil
              </button>
            )}
          </div>
          <div className="k-add-spacer" />
        </div>
      </Sheet>
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

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { openKesemDb } from "../data/idb";
import { DEFAULT_SETTINGS, EMPTY_TX_EXTRAS, SCHEMA_VERSION, DEFAULT_CURRENCY, uid } from "../model/schema";
import { buildDefaultAccounts, buildDefaultCategories } from "../model/defaults";
import { formatMoney } from "../model/money";
import { trLower } from "../model/dates";

// Kesem durum yönetimi. Tüm veri bellekte tutulur (kişisel harcama hacmi için
// yeterli) ve HER değişiklik bir "değişiklik kümesi"dir:
//   [{ store, id, before, after }]
// Küme IndexedDB'ye ATOMİK yazılır, sonra duruma uygulanır. Geri al = kümenin
// tersini uygulamak → geri al/yinele her veri türü için (ve sonraki parçalarda
// eklenecek taksit/borç/bütçe için de) otomatik çalışır.

const KesemCtx = createContext(null);
export const useKesem = () => {
  const v = useContext(KesemCtx);
  if (!v) throw new Error("useKesem, <KesemProvider> içinde kullanılmalı");
  return v;
};

const COLLECTIONS = ["transactions", "categories", "accounts", "tags", "templates"];
const emptyCols = () => Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
const initial = { status: "loading", persistent: true, cols: emptyCols(), settings: DEFAULT_SETTINGS };

function applyToState(state, changes) {
  const cols = { ...state.cols };
  let settings = state.settings;
  const copied = new Set();
  for (const c of changes) {
    if (c.store === "blobs") continue;
    if (c.store === "meta") {
      if (c.id === "settings") settings = c.after ? { ...DEFAULT_SETTINGS, ...c.after } : DEFAULT_SETTINGS;
      continue;
    }
    if (!cols[c.store]) continue;
    if (!copied.has(c.store)) {
      cols[c.store] = new Map(cols[c.store]);
      copied.add(c.store);
    }
    if (c.after) cols[c.store].set(c.id, c.after);
    else cols[c.store].delete(c.id);
  }
  return { ...state, cols, settings };
}

function reducer(state, a) {
  switch (a.type) {
    case "LOAD": {
      const cols = emptyCols();
      for (const col of COLLECTIONS) for (const r of a.data[col] || []) cols[col].set(r.id, r);
      return { status: "ready", persistent: a.persistent, cols, settings: { ...DEFAULT_SETTINGS, ...(a.settings || {}) } };
    }
    case "RESET":
      return initial;
    case "ERROR":
      return { ...state, status: "error" };
    case "APPLY":
      return applyToState(state, a.changes);
    default:
      return state;
  }
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name || "").localeCompare(b.name || "", "tr");
const MISSING_CAT = { id: null, name: "Kategorisiz", icon: "tag", color: "stone", kind: "expense", parentId: null };
const MISSING_ACC = { id: null, name: "Belirtilmemiş", type: "other", color: "stone" };

export function KesemProvider({ userId, children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dbRef = useRef(null);
  const stacks = useRef({ undo: [], redo: [] });
  const [stackTick, setStackTick] = useState(0);
  const [toast, setToast] = useState(null);

  // --- Yükleme + ilk kurulum (varsayılanlar) ------------------------------
  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "RESET" });
    (async () => {
      try {
        const db = await openKesemDb(`kesem-${userId || "misafir"}`);
        if (cancelled) {
          db.close();
          return;
        }
        dbRef.current = db;
        // Kalıcılık iste (sessiz; tarayıcı depoyu otomatik silmesin).
        try {
          navigator.storage?.persist?.();
        } catch {
          /* yoksay */
        }
        let schema = await db.get("meta", "schema");
        if (!schema) {
          const now = Date.now();
          const seed = [
            ...buildDefaultCategories().map((r) => ({ store: "categories", id: r.id, before: null, after: { ...r, createdAt: now, updatedAt: now } })),
            ...buildDefaultAccounts().map((r) => ({ store: "accounts", id: r.id, before: null, after: { ...r, createdAt: now, updatedAt: now } })),
            { store: "meta", id: "schema", before: null, after: { id: "schema", version: SCHEMA_VERSION } },
            { store: "meta", id: "settings", before: null, after: { ...DEFAULT_SETTINGS } },
          ];
          await db.apply(seed);
        }
        const [transactions, categories, accounts, tags, templates, settings] = await Promise.all([
          db.getAll("transactions"),
          db.getAll("categories"),
          db.getAll("accounts"),
          db.getAll("tags"),
          db.getAll("templates"),
          db.get("meta", "settings"),
        ]);
        if (cancelled) return;
        stacks.current = { undo: [], redo: [] };
        dispatch({ type: "LOAD", data: { transactions, categories, accounts, tags, templates }, settings, persistent: db.kind === "idb" });
      } catch {
        if (!cancelled) dispatch({ type: "ERROR" });
      }
    })();
    return () => {
      cancelled = true;
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [userId]);

  // --- Çekirdek: değişiklik kümesi uygula ---------------------------------
  const commit = useCallback(async (changes, { label, undoable = true } = {}) => {
    const db = dbRef.current;
    if (!db || !changes.length) return false;
    try {
      await db.apply(changes);
    } catch {
      setToast({ id: uid(), message: "Kaydedilemedi. Depolama dolu olabilir.", tone: "error" });
      return false;
    }
    dispatch({ type: "APPLY", changes });
    if (undoable) {
      stacks.current.undo.push({ label, changes });
      if (stacks.current.undo.length > 30) stacks.current.undo.shift();
      stacks.current.redo = [];
      setStackTick((n) => n + 1);
    }
    return true;
  }, []);

  const invert = (changes) => [...changes].reverse().map((c) => ({ store: c.store, id: c.id, before: c.after, after: c.before }));

  const notify = useCallback((t) => setToast({ id: uid(), ...t }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const undo = useCallback(async () => {
    const entry = stacks.current.undo.pop();
    if (!entry) return;
    const ok = await commit(invert(entry.changes), { undoable: false });
    if (ok) {
      stacks.current.redo.push(entry);
      notify({ message: `Geri alındı · ${entry.label}`, actionLabel: "Yinele", action: "redo" });
    } else stacks.current.undo.push(entry);
    setStackTick((n) => n + 1);
  }, [commit, notify]);

  const redo = useCallback(async () => {
    const entry = stacks.current.redo.pop();
    if (!entry) return;
    const ok = await commit(entry.changes, { undoable: false });
    if (ok) {
      stacks.current.undo.push(entry);
      notify({ message: `Yinelendi · ${entry.label}`, actionLabel: "Geri Al", action: "undo" });
    } else stacks.current.redo.push(entry);
    setStackTick((n) => n + 1);
  }, [commit, notify]);

  // --- Türetilmiş görünüm -------------------------------------------------
  const view = useMemo(() => {
    const { cols } = state;
    const all = (m) => [...m.values()];
    const live = (arr) => arr.filter((r) => !r.deletedAt);
    const allTx = all(cols.transactions);
    const transactions = live(allTx).sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt);
    const deletedTransactions = allTx.filter((r) => r.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt);
    const categories = live(all(cols.categories)).sort(byOrder);
    const accounts = live(all(cols.accounts)).sort(byOrder);
    const tags = live(all(cols.tags)).sort((a, b) => a.name.localeCompare(b.name, "tr"));
    const templates = live(all(cols.templates)).sort(byOrder);
    return {
      transactions,
      deletedTransactions,
      categories,
      accounts,
      tags,
      templates,
      txById: (id) => cols.transactions.get(id) || null,
      // Silinmiş kategori/hesap kayıtları da çözülebilir (eski harcamalar bozulmasın).
      catById: (id) => cols.categories.get(id) || MISSING_CAT,
      accById: (id) => cols.accounts.get(id) || MISSING_ACC,
      tagById: (id) => cols.tags.get(id) || null,
      topCategories: (kind) => categories.filter((c) => c.kind === kind && !c.parentId),
      subCategories: (parentId) => categories.filter((c) => c.parentId === parentId),
    };
  }, [state]);

  // --- Etiket çözümleme (ad → id, yoksa oluştur) ---------------------------
  const resolveTags = (names, now) => {
    const changes = [];
    const ids = [];
    const known = [...stateRef.current.cols.tags.values()];
    for (const raw of names || []) {
      const name = raw.trim().replace(/^#/, "").slice(0, 24);
      if (!name) continue;
      const key = trLower(name);
      const hit = known.find((t) => trLower(t.name) === key);
      if (hit) {
        if (hit.deletedAt) {
          const revived = { ...hit, deletedAt: null, updatedAt: now };
          changes.push({ store: "tags", id: hit.id, before: hit, after: revived });
        }
        if (!ids.includes(hit.id)) ids.push(hit.id);
      } else {
        const tag = { id: uid(), name, createdAt: now, updatedAt: now, deletedAt: null };
        known.push(tag);
        changes.push({ store: "tags", id: tag.id, before: null, after: tag });
        ids.push(tag.id);
      }
    }
    return { ids, changes };
  };

  const receiptChange = (receipt, now) => {
    if (!receipt?.blob) return null;
    const id = uid();
    return { id, change: { store: "blobs", id, before: null, after: { id, blob: receipt.blob, type: receipt.blob.type || "image/jpeg", createdAt: now } } };
  };

  const rememberChoice = (kind, categoryId, accountId) => {
    const s = stateRef.current.settings;
    const next = { ...s, lastCategory: { ...s.lastCategory, [kind]: categoryId }, lastAccount: accountId || s.lastAccount };
    commit([{ store: "meta", id: "settings", before: s, after: next }], { undoable: false });
  };

  // --- İşlem (harcama/gelir) eylemleri -------------------------------------
  const addTransaction = useCallback(
    async (input, { silent = false, label } = {}) => {
      const now = Date.now();
      const tg = resolveTags(input.tagNames, now);
      const rc = receiptChange(input.receipt, now);
      const tx = {
        id: uid(),
        kind: input.kind,
        amountMinor: input.amountMinor,
        currency: input.currency || DEFAULT_CURRENCY,
        categoryId: input.categoryId || null,
        subcategoryId: input.subcategoryId || null,
        accountId: input.accountId || null,
        occurredAt: input.occurredAt ?? now,
        merchant: (input.merchant || "").trim(),
        note: (input.note || "").trim(),
        tagIds: input.tagIds ? [...input.tagIds, ...tg.ids] : tg.ids,
        receiptId: rc ? rc.id : input.receiptId || null,
        templateId: input.templateId || null,
        ...EMPTY_TX_EXTRAS,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const changes = [...tg.changes, ...(rc ? [rc.change] : []), { store: "transactions", id: tx.id, before: null, after: tx }];
      if (input.templateId) {
        const tpl = stateRef.current.cols.templates.get(input.templateId);
        if (tpl) changes.push({ store: "templates", id: tpl.id, before: tpl, after: { ...tpl, useCount: (tpl.useCount || 0) + 1, lastUsedAt: now, updatedAt: now } });
      }
      const ok = await commit(changes, { label: label || (tx.kind === "income" ? "gelir eklendi" : "harcama eklendi") });
      if (!ok) return null;
      if (!silent) {
        notify({
          message: `${tx.kind === "income" ? "Gelir eklendi" : "Harcama eklendi"} · ${formatMoney(tx.kind === "income" ? tx.amountMinor : -tx.amountMinor, tx.currency)}`,
          actionLabel: "Geri Al",
          action: "undo",
        });
      }
      rememberChoice(tx.kind, tx.categoryId, tx.accountId);
      return tx;
    },
    [commit, notify] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const updateTransaction = useCallback(
    async (id, input) => {
      const before = stateRef.current.cols.transactions.get(id);
      if (!before) return false;
      const now = Date.now();
      const tg = resolveTags(input.tagNames, now);
      let receiptId = before.receiptId;
      const extra = [];
      if (input.receipt === null) receiptId = null;
      else if (input.receipt?.blob) {
        const rc = receiptChange(input.receipt, now);
        receiptId = rc.id;
        extra.push(rc.change);
      }
      const after = {
        ...before,
        kind: input.kind,
        amountMinor: input.amountMinor,
        categoryId: input.categoryId || null,
        subcategoryId: input.subcategoryId || null,
        accountId: input.accountId || null,
        occurredAt: input.occurredAt ?? before.occurredAt,
        merchant: (input.merchant || "").trim(),
        note: (input.note || "").trim(),
        tagIds: tg.ids,
        receiptId,
        updatedAt: now,
      };
      const ok = await commit([...tg.changes, ...extra, { store: "transactions", id, before, after }], { label: "düzenleme" });
      if (ok) {
        notify({ message: "Değişiklikler kaydedildi", actionLabel: "Geri Al", action: "undo" });
        rememberChoice(after.kind, after.categoryId, after.accountId);
      }
      return ok;
    },
    [commit, notify] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const deleteTransaction = useCallback(
    async (id) => {
      const before = stateRef.current.cols.transactions.get(id);
      if (!before) return false;
      const now = Date.now();
      const ok = await commit([{ store: "transactions", id, before, after: { ...before, deletedAt: now, updatedAt: now } }], { label: "silme" });
      if (ok) notify({ message: "Kayıt silindi", actionLabel: "Geri Al", action: "undo" });
      return ok;
    },
    [commit, notify]
  );

  const restoreTransaction = useCallback(
    async (id) => {
      const before = stateRef.current.cols.transactions.get(id);
      if (!before) return false;
      const ok = await commit([{ store: "transactions", id, before, after: { ...before, deletedAt: null, updatedAt: Date.now() } }], { label: "geri yükleme" });
      if (ok) notify({ message: "Kayıt geri yüklendi" });
      return ok;
    },
    [commit, notify]
  );

  const purgeTransaction = useCallback(
    async (id) => {
      const before = stateRef.current.cols.transactions.get(id);
      if (!before) return false;
      const ok = await commit([{ store: "transactions", id, before, after: null }], { label: "kalıcı silme", undoable: false });
      if (ok) notify({ message: "Kalıcı olarak silindi" });
      return ok;
    },
    [commit, notify]
  );

  // Aynı kaydın şimdi tarihli kopyası (tek dokunuş) — "son harcamayı tekrarla".
  const repeatTransaction = useCallback(
    (tx) =>
      addTransaction(
        { ...tx, receiptId: null, occurredAt: Date.now(), tagNames: tx.tagIds.map((i) => stateRef.current.cols.tags.get(i)?.name).filter(Boolean) },
        { label: "tekrarlanan kayıt" }
      ),
    [addTransaction]
  );

  // --- Genel "liste öğesi" eylemleri (kategori, hesap, şablon, etiket) -----
  const upsert = useCallback(
    async (store, record, label) => {
      const before = stateRef.current.cols[store].get(record.id) || null;
      const now = Date.now();
      const after = before
        ? { ...before, ...record, updatedAt: now }
        : { createdAt: now, deletedAt: null, order: stateRef.current.cols[store].size, ...record, updatedAt: now };
      const ok = await commit([{ store, id: after.id, before, after }], { label });
      return ok ? after : null;
    },
    [commit]
  );

  const softDelete = useCallback(
    async (store, id, label) => {
      const cols = stateRef.current.cols;
      const now = Date.now();
      const targets = [cols[store].get(id)];
      if (store === "categories") targets.push(...[...cols.categories.values()].filter((c) => c.parentId === id && !c.deletedAt));
      const changes = targets.filter(Boolean).map((r) => ({ store, id: r.id, before: r, after: { ...r, deletedAt: now, updatedAt: now } }));
      const ok = await commit(changes, { label });
      if (ok) notify({ message: `${label} tamamlandı`, actionLabel: "Geri Al", action: "undo" });
      return ok;
    },
    [commit, notify]
  );

  const saveCategory = useCallback((c) => upsert("categories", { ...c, id: c.id || uid() }, "kategori kaydı"), [upsert]);
  const deleteCategory = useCallback((id) => softDelete("categories", id, "kategori silme"), [softDelete]);
  const saveAccount = useCallback((a) => upsert("accounts", { ...a, id: a.id || uid() }, "ödeme yöntemi kaydı"), [upsert]);
  const deleteAccount = useCallback((id) => softDelete("accounts", id, "ödeme yöntemi silme"), [softDelete]);
  const saveTag = useCallback((t) => upsert("tags", { ...t, id: t.id || uid() }, "etiket kaydı"), [upsert]);
  const deleteTag = useCallback((id) => softDelete("tags", id, "etiket silme"), [softDelete]);
  const saveTemplate = useCallback((t) => upsert("templates", { useCount: 0, ...t, id: t.id || uid() }, "kısayol kaydı"), [upsert]);
  const deleteTemplate = useCallback((id) => softDelete("templates", id, "kısayol silme"), [softDelete]);

  const updateSettings = useCallback(
    (patch) => {
      const s = stateRef.current.settings;
      return commit([{ store: "meta", id: "settings", before: s, after: { ...s, ...patch } }], { undoable: false });
    },
    [commit]
  );

  // Şablondan TEK DOKUNUŞ ekleme (tutarı kayıtlıysa).
  const quickAdd = useCallback(
    (tpl) =>
      addTransaction(
        {
          kind: tpl.kind,
          amountMinor: tpl.amountMinor,
          currency: tpl.currency,
          categoryId: tpl.categoryId,
          subcategoryId: tpl.subcategoryId,
          accountId: tpl.accountId,
          merchant: tpl.merchant,
          note: tpl.note,
          tagIds: tpl.tagIds || [],
          templateId: tpl.id,
        },
        { label: `“${tpl.name}” eklendi` }
      ),
    [addTransaction]
  );

  const getBlob = useCallback(async (id) => (id && dbRef.current ? dbRef.current.get("blobs", id) : null), []);

  const value = useMemo(
    () => ({
      ready: state.status === "ready",
      failed: state.status === "error",
      persistent: state.persistent,
      settings: state.settings,
      ...view,
      canUndo: stacks.current.undo.length > 0,
      canRedo: stacks.current.redo.length > 0,
      stackTick,
      undo,
      redo,
      toast,
      notify,
      dismissToast,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      restoreTransaction,
      purgeTransaction,
      repeatTransaction,
      quickAdd,
      saveCategory,
      deleteCategory,
      saveAccount,
      deleteAccount,
      saveTag,
      deleteTag,
      saveTemplate,
      deleteTemplate,
      updateSettings,
      getBlob,
    }),
    [state, view, stackTick, toast, undo, redo, notify, dismissToast, addTransaction, updateTransaction, deleteTransaction, restoreTransaction, purgeTransaction, repeatTransaction, quickAdd, saveCategory, deleteCategory, saveAccount, deleteAccount, saveTag, deleteTag, saveTemplate, deleteTemplate, updateSettings, getBlob]
  );

  return <KesemCtx.Provider value={value}>{children}</KesemCtx.Provider>;
}

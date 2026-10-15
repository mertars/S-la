// Kesem veri modeli — SONRAKİ PARÇALAR için genişletilebilir tasarım.
//
// Genel kurallar
//  • Tutarlar `amountMinor` (kuruş, TAM SAYI) — kayan nokta hatası yok.
//    Her işlemde `currency` ("TRY") var → çoklu para birimi sonradan sadece
//    kur/biçim ekleyerek gelir, mevcut kayıtlar geçerli kalır.
//  • Zamanlar epoch milisaniye (number). `occurredAt` = harcamanın olduğu an.
//  • Silme = yumuşak silme (`deletedAt`) → "Geri al" ve "Son silinenler".
//  • IndexedDB şemasız olduğu için YENİ alanlar eklemek göç gerektirmez;
//    yapısal değişiklikler `SCHEMA_VERSION` + migrate() ile yapılır.
//
// Transaction (işlem)
//  { id, kind: "expense"|"income", amountMinor, currency,
//    categoryId, subcategoryId|null, accountId (ödeme yöntemi),
//    occurredAt, merchant, note, tagIds[], receiptId|null,
//    templateId|null,
//    // --- sonraki parçalar için AYRILMIŞ alanlar (şimdilik hep null) ---
//    installment: null,   // { planId, index, total }      → taksit
//    recurringId: null,   // tekrarlayan ödeme kuralı id'si
//    debtId: null,        // borç/alacak bağlantısı
//    goalId: null,        // birikim hedefi bağlantısı
//    fx: null,            // { rate, baseCurrency }         → çoklu para birimi
//    createdAt, updatedAt, deletedAt|null }
//
// Category: { id, kind, name, icon, color, parentId|null, order, builtin, createdAt, updatedAt, deletedAt }
//   (alt kategori = parentId dolu kategori; `budgetMinor` sonra eklenebilir)
// Account (ödeme yöntemi): { id, type: "cash"|"card"|"other", name, color, order, ... }
//   (kredi kartı için ileride: statementDay, dueDay, limitMinor)
// Tag: { id, name, createdAt, updatedAt, deletedAt }
// Template (şablon / kısayol): { id, name, kind, amountMinor|null, currency, categoryId,
//   subcategoryId, accountId, merchant, note, tagIds[], quick: bool, order, useCount, lastUsedAt }
// meta: { id: "settings", ... } , { id: "schema", version }
// blobs: { id, blob, type, createdAt }   (fiş fotoğrafları)

export const SCHEMA_VERSION = 1;
export const DEFAULT_CURRENCY = "TRY";

export const EMPTY_TX_EXTRAS = Object.freeze({
  installment: null,
  recurringId: null,
  debtId: null,
  goalId: null,
  fx: null,
});

export const DEFAULT_SETTINGS = Object.freeze({
  id: "settings",
  mode: "auto", // auto = Routinix temasını izle | light | dark
  palette: "gul",
  lastCategory: {}, // { expense: id, income: id }
  lastAccount: null,
  dismissedSuggestions: [],
});

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

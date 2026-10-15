# Kesem — Harcama Takibi (Parça 1/3)

Routinix içinde, hamburger menüden açılan tam ekran harcama takibi modülü.
`/kesem/...` adresiyle de doğrudan açılır (PWA yenileme/derin bağlantı).

## Yapı
- `config.js` — menü adı (`KESEM_DEFAULT_MENU_LABEL` + kullanıcı ayarı), yol sabitleri. Ana pakette, küçük.
- `KesemApp.jsx` — lazy yüklenen kabuk: telefonda cam alt çubuk, ≥768px'te cam yan çubuk + iki sütun.
- `kesem.css` — **tüm renkler** CSS değişkenleri (`.kesem-root` kapsamı; şema + 5 palet + `--kc-*` kategori renkleri).
- `data/idb.js` — kullanıcıya özel IndexedDB (`kesem-<userId>`), atomik yazma; yoksa bellek yedeği.
- `state/store.jsx` — bellek içi durum + **değişiklik kümeleri** (`{store,id,before,after}`) → geri al/yinele her veri türünde.
- `model/schema.js` — veri modeli ve sonraki parçalar için ayrılmış alanlar (taksit, tekrarlayan, borç, birikim, kur).
- `ui/AddSheet.jsx` — hızlı ekleme (tutar tuş takımı, kategori/ödeme çipleri, tarih-saat, mağaza önerisi, etiket, fiş).
- `pages/` — Ana Sayfa, Harcamalar (+detay), Analiz (boş durum), Daha Fazla (yönetim, görünüm, ayarlar).

## Sonraki parçalar için
- Yeni veri türü = `STORES` listesine + `COLLECTIONS`'a ekle; undo/redo otomatik çalışır.
- Supabase senkronu: `data/idb.js`'teki adaptör arayüzünü (`getAll/get/apply`) uygulayan yeni bir adaptör.
- Tüm kayıtlarda `updatedAt` / `deletedAt` (silme = yumuşak) senkron için hazır.

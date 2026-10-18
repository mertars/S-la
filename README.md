# Sıla'nın Kumbarası

Mert'ten Sıla'ya: telefon öncelikli, Türkçe, sade bir harcama ve birikim kumbarası (PWA).
Veritabanı, hesap ya da API anahtarı gerekmez. Tüm veriler cihazdaki IndexedDB'de durur, uygulama çevrimdışı çalışır.

## Geliştirme
```bash
npm install
npm run dev       # http://localhost:5173
npm test          # birim testler (hesaplama/model)
npm run lint      # ESLint
npm run build     # dist/
```

## Nerede ne var
- `src/kesem/texts.js`: **tüm kişisel metinler** (selam, geri bildirim, boş ekranlar, kutlama, kilit, imza). "Sıla" ve "Mert" adları Ayarlar > İsimler'den değişir.
- `src/kesem/kesem.css`: tema. Renk değerleri (Bordo, Toz Pembe, Gül Kurusu… × Gündüz/Gece) dosyanın başında.
- `src/kesem/ui/art.jsx`: kavanoz, kumbara ve boş ekran çizimleri (SVG, tema renklerinde).
- `src/kesem/ui/AddSheet.jsx`: hızlı ekleme (tutar → kategori = kayıt).

## Cloudflare
- Deploy: `npx wrangler deploy` (derleme `wrangler.jsonc` içinde tanımlı). `name`, Cloudflare'deki proje adıyla aynı olmalı.
- Ortam değişkeni gerekmez.

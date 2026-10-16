# Harcama Takibi

Telefon öncelikli, Türkçe harcama takibi (PWA). Veritabanı, hesap ya da API anahtarı gerekmez:
tüm veriler cihazdaki IndexedDB'de tutulur, çevrimdışı çalışır.

## Geliştirme
```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 37 birim test (hesaplama/model)
npm run build     # dist/
```

## Cloudflare
- Build command: `npm run build`
- Deploy: `npx wrangler deploy` (`wrangler.jsonc` içindeki `name` Cloudflare'deki proje adıyla aynı olmalı)
- Ortam değişkeni gerekmez.

Modül ayrıntıları: `src/kesem/README.md`

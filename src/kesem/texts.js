// =====================================================================
// Uygulamanın TÜM kişisel metinleri burada.
//
// • "Sıla" ve "Mert" adları sabit değil: Ayarlar > İsimler'den değişir
//   (settings.names). Her metin fonksiyonu adları `n` nesnesinden alır:
//   n.sila, n.mert  (+ ekli hâlleri: n.silaGen = "Sıla'nın", n.silaDat = "Sıla'ya" …)
// • Aynı anda birden çok seçenek olan metinlerde `pick()` bir öncekini
//   tekrarlamadan rastgele seçer → her seferinde farklı geri bildirim.
// • Ton: sıcak, kısa, sevimli; çocuksu ya da abartılı değil. Emoji yok.
// =====================================================================

export const DEFAULT_NAMES = Object.freeze({ sila: "Sıla", mert: "Mert" });

// ---- Türkçe ek uyumu (kesme işaretli özel ad ekleri) ----
const VOWELS = "aeıioöuüAEIİOÖUÜ";
const lastVowel = (w) => {
  for (let i = w.length - 1; i >= 0; i--) if (VOWELS.includes(w[i])) return w[i].toLocaleLowerCase("tr");
  return "e";
};
const endsWithVowel = (w) => VOWELS.includes(w[w.length - 1] || "");
const HARMONY4 = { a: "ı", ı: "ı", e: "i", i: "i", o: "u", u: "u", ö: "ü", ü: "ü" };
const HARMONY2 = { a: "a", ı: "a", o: "a", u: "a", e: "e", i: "e", ö: "e", ü: "e" };
/** İlgi hâli: Sıla → Sıla'nın, Mert → Mert'in, Ece → Ece'nin */
export const genitive = (w) => `${w}'${endsWithVowel(w) ? "n" : ""}${HARMONY4[lastVowel(w)]}n`;
/** Yönelme hâli: Sıla → Sıla'ya, Mert → Mert'e */
export const dative = (w) => `${w}'${endsWithVowel(w) ? "y" : ""}${HARMONY2[lastVowel(w)]}`;
/** Ayrılma hâli: Mert → Mert'ten, Sıla → Sıla'dan */
export const ablative = (w) => {
  const hard = /[çfhkpsşt]$/i.test(w);
  return `${w}'${hard ? "t" : "d"}${HARMONY2[lastVowel(w)]}n`;
};

export function namesFrom(settings) {
  const raw = settings?.names || {};
  const sila = (raw.sila || "").trim() || DEFAULT_NAMES.sila;
  const mert = (raw.mert || "").trim() || DEFAULT_NAMES.mert;
  return { sila, mert, silaGen: genitive(sila), silaDat: dative(sila), mertGen: genitive(mert), mertAbl: ablative(mert) };
}

/** Uygulamanın adı — PWA adı/ikonu ile aynı: "Sıla'nın Kumbarası" */
export const appName = (n) => `${n.silaGen} Kumbarası`;
export const APP_NAME_DEFAULT = "Sıla'nın Kumbarası";
export const APP_SHORT_NAME = "Sıla Kumbara";

// ---- tekrarsız rastgele seçim ----
const lastPick = new Map();
export function pick(key, list) {
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  let i = Math.floor(Math.random() * list.length);
  if (lastPick.get(key) === i) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  lastPick.set(key, i);
  return list[i];
}
/** Gün boyunca sabit kalan seçim (ekranda her açılışta değişip göz yormasın). */
export function pickDaily(key, list, ts = Date.now()) {
  const d = new Date(ts);
  let h = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

// =====================================================================
// Selam (saate göre)
// =====================================================================
export function greeting(n, ts = Date.now()) {
  const h = new Date(ts).getHours();
  if (h >= 5 && h < 11) return pickDaily("g-sabah", [`Günaydın ${n.sila}`, `Günaydın ${n.sila}`, `Güzel bir sabah, ${n.sila}`], ts);
  if (h >= 11 && h < 17) return pickDaily("g-gun", [`Merhaba ${n.sila}`, `İyi günler ${n.sila}`, `Selam ${n.sila}`], ts);
  if (h >= 17 && h < 22) return pickDaily("g-aksam", [`İyi akşamlar ${n.sila}`, `Akşamın güzel geçsin, ${n.sila}`], ts);
  return pickDaily("g-gece", [`İyi geceler ${n.sila}`, `Geç oldu ${n.sila}`], ts);
}

export function greetingLine(n, { txToday = 0 } = {}, ts = Date.now()) {
  const h = new Date(ts).getHours();
  if (txToday === 0 && h < 12) return pickDaily("gl-sabah", ["Bugün henüz bir şey yazmadın.", "Temiz bir sayfayla başlıyoruz.", "Kumbaran seni bekliyor."], ts);
  if (txToday === 0) return pickDaily("gl-bos", ["Bugün henüz harcama yok, böyle devam.", "Bugün kumbara sakin.", "Bugün hiç harcama yazılmadı."], ts);
  if (h >= 22 || h < 5) return pickDaily("gl-gece", ["Günün özeti aşağıda, iyi uykular.", "Yarın yeni bir sayfa."], ts);
  return pickDaily("gl-gun", ["Bugünün özeti burada.", "Her şey bir bakışta.", "Küçük adımlar, dolu kumbara."], ts);
}

// =====================================================================
// Harcama / gelir eklenince kısa geri bildirim (toast)
// =====================================================================
export function addedMessage(n, { kind, amountText, split, quick } = {}) {
  if (kind === "income") {
    return pick("add-in", [
      `Kumbaraya ${amountText} girdi.`,
      `Gelir yazıldı: ${amountText}. Güzel!`,
      `${amountText} eklendi, eline sağlık ${n.sila}.`,
      `Bakiye gülümsedi: ${amountText}.`,
      `${amountText} geldi, kayda geçti.`,
    ]);
  }
  if (split) return pick("add-split", [`Bölüştük: ${amountText} senin payın.`, `Senin payın ${amountText}, gerisi borç defterinde.`]);
  if (quick) {
    return pick("add-quick", [`Tek dokunuşla tamam: ${amountText}.`, `${amountText} yazıldı, hızlıydı.`, `Kısayoldan eklendi: ${amountText}.`]);
  }
  return pick("add-out", [
    `Yazıldı: ${amountText}.`,
    `Tamamdır ${n.sila}, ${amountText} kayıtta.`,
    `${amountText} not edildi.`,
    `Kaydettim: ${amountText}.`,
    `${amountText} defterde.`,
    `Not aldım, ${amountText}.`,
    `${amountText} eklendi, kolay gelsin.`,
    `Oldu bu iş: ${amountText}.`,
    `Hesap güncel: ${amountText}.`,
    `${amountText} yerini buldu.`,
  ]);
}

// =====================================================================
// Bütçe cümleleri (ana sayfa odağının altı)
// =====================================================================
export function budgetLine(n, st, fmt) {
  if (!st.hasBudget) return `Bir bütçe belirlersen her gün ne kadar harcayabileceğini hesaplarım, ${n.sila}.`;
  if (st.todayLeft < 0) {
    return pickDaily("b-tover", [
      `Bugünkü payını ${fmt(-st.todayLeft)} aştın; yarın pay kendini toparlar.`,
      `Bugün biraz cömert geçti (+${fmt(-st.todayLeft)}). Dert değil, yarın yeni gün.`,
    ]);
  }
  if (st.state === "over") return pickDaily("b-over", [`Bu ay bütçeyi aştık ${n.sila}. Kalan günlerde hafif gidelim.`, "Aylık bütçe doldu; yine de her şeyi yazmaya devam."]);
  if (st.state === "near") return pickDaily("b-near", ["Bütçenin sonuna yaklaştık, biraz dikkat.", `Ay sonuna az kaldı, bütçe de öyle. Yavaş yavaş, ${n.sila}.`]);
  if (st.spentToday === 0) return pickDaily("b-ok0", ["Bugün hiç harcamadın, ne güzel.", "Bugünün payı olduğu gibi duruyor."]);
  return pickDaily("b-ok", ["Her şey yolunda, keyfini çıkar.", "Gayet iyi gidiyorsun.", `Bütçe rahat, ${n.sila}.`]);
}
export const TODAY_STATE_LABEL = { ok: "Yolunda", near: "Dikkat", over: "Aşıldı", none: "" };

// =====================================================================
// Boş ekranlar
// =====================================================================
export function empty(n) {
  return {
    homeRecent: { title: "Kumbara bomboş", text: `İlk harcamanı yazınca burada görünür ${n.sila}. Sağ alttaki + yeter.` },
    expenses: { title: "Bu dönem tertemiz", text: "Bu ay için henüz kayıt yok. Yazmaya başlayınca gün gün burada dizilir." },
    search: { title: "Bulamadım", text: "Başka bir kelime dene ya da filtreleri gevşet." },
    analysis: { title: "Biraz kayıt lazım", text: `Birkaç harcama yazınca nereye ne gittiğini sana çizerek göstereceğim, ${n.sila}.` },
    goals: { title: "Kumbaran bekliyor", text: `Tatil, bir çanta, bir hayal… Hedefini koy, birlikte dolduralım ${n.sila}.` },
    wishes: { title: "Dilek listesi boş", text: "Gözüne kestirdiğin şeyleri buraya yaz; aldığında tek dokunuşla harcamaya dönüşür." },
    shopping: { title: "Liste tertemiz", text: "Alacaklarını yaz, markette işaretle. Sonra tek dokunuşla harcama olur." },
    debts: { title: "Kimseye borç yok", text: "Biriyle hesap bölüştüğünde ya da borç verdiğinde burada tutarım." },
    recurring: { title: "Düzenli ödeme yok", text: "Abonelik, kira, fatura… Eklersen tarihini hatırlarım, ay sonunda şaşırtmaz." },
    installments: { title: "Taksit yok", text: "Harcama eklerken Ayrıntılar'dan taksitlendirebilirsin; her ay kendiliğinden yazılır." },
    calendar: { title: "Takvim boş", text: "Abonelik, fatura ve taksitler eklendikçe günleri burada görünür." },
    trash: { title: "Çöp kutusu boş", text: "Sildiğin kayıtlar bir süre burada bekler, istersen geri getirirsin." },
    tags: { title: "Etiket yok", text: "Harcama eklerken Ayrıntılar'dan etiket yazınca burada toplanır." },
    templates: { title: "Kısayol yok", text: "Sık aldığın şeyleri (kahve, simit…) kısayol yap; tek dokunuşla eklenir." },
    pick: { title: "Bir şey seç", text: "Soldan bir kayıt seçince ayrıntısı burada açılır." },
    notFound: { title: "Bulunamadı", text: "Silinmiş ya da taşınmış olabilir." },
    failed: { title: "Kumbara açılamadı", text: "Depolamaya erişilemiyor. Sayfayı yenilemeyi ya da tarayıcı ayarlarını kontrol etmeyi dene." },
  };
}

// =====================================================================
// Kumbara (birikim hedefleri)
// =====================================================================
export function goalLine(n, p) {
  if (p.done) return `Doldu! Tebrikler ${n.sila}.`;
  if (p.pct >= 0.75) return "Az kaldı, son düzlük.";
  if (p.pct >= 0.5) return "Yarıyı geçtin, harika gidiyor.";
  if (p.pct > 0) return "Damlaya damlaya doluyor.";
  return "İlk bozuklukları atmaya hazır.";
}
export function goalCelebration(n, goalName) {
  return {
    title: pick("gc-t", [`Başardın ${n.sila}!`, "Kumbara doldu!", `İşte bu, ${n.sila}!`]),
    text: pick("gc-x", [
      `“${goalName}” için hedeflediğin tutarı biriktirdin. Kendinle gurur duy.`,
      `“${goalName}” kumbarası ağzına kadar dolu. Sabrın meyvesi.`,
      `“${goalName}” hazır. Hak ettin.`,
    ]),
  };
}
/** Sürpriz 1: İLK hedef tamamlanınca Mert'ten küçük bir not (bir kez gösterilir). */
export const firstGoalNote = (n) => ({
  from: n.mertAbl + " not",
  text: `Bunu başaracağını biliyordum ${n.sila}. İlk kumbaran doldu; nicelerine. — ${n.mert}`,
});
export const depositMessage = (n, amountText) => pick("dep", [`Kumbaraya ${amountText} attın.`, `${amountText} daha, tıkır tıkır.`, `Bir adım daha: ${amountText}.`]);

// =====================================================================
// Harcamasız gün serisi
// =====================================================================
export function streakLine(n, s) {
  if (s.current >= 7) return `${s.current} gündür harcamasızsın ${n.sila}, efsane.`;
  if (s.current >= 3) return `${s.current} gündür harcamasız. Seri sürüyor.`;
  if (s.current === 2) return "İki gündür harcamasız, güzel başlangıç.";
  if (s.current === 1) return "Dün harcamasızdın. Bugün de olur mu?";
  if (s.longest > 0) return `En uzun serin ${s.longest} gün. Yenisini başlatabilirsin.`;
  return "Hiç harcamadığın bir gün seriyi başlatır.";
}

// =====================================================================
// Yedekleme
// =====================================================================
export const backupReminder = (n) => ({ title: "Yedek alma zamanı", text: `Telefon değişirse anılar kaybolmasın ${n.sila}; bir yedek indir.` });
export const backupDone = (n, count) => pick("bk", [`Yedek hazır, ${count} kayıt güvende.`, `Kumbaranın yedeği indi (${count} kayıt).`, `Tamam ${n.sila}, ${count} kayıt yedeklendi.`]);

// =====================================================================
// Kilit ekranı
// =====================================================================
export const lockTitle = (n) => pickDaily("lock", [`Hoş geldin ${n.sila}`, `Merhaba ${n.sila}`, "Kumbaran kilitli"]);
export const LOCK_SUB = "PIN'ini gir";
export const LOCK_WRONG = "Olmadı, bir daha dene.";
export const LOCK_WAIT = "Çok deneme oldu, biraz bekleyelim.";

// =====================================================================
// İlk açılış + imza (Mert ölçülü: yalnızca burada, Hakkında'da ve özel günde)
// =====================================================================
export const welcome = (n) => ({
  title: `Merhaba ${n.sila}`,
  text: `Bu küçük kumbarayı ${n.mert} senin için yaptı. Harcamalarını yazmak birkaç saniye sürsün, birikimin hep gözünün önünde olsun diye.`,
  sign: `— ${n.mert}`,
});
export const splashSign = (n) => `${n.mertAbl} ${n.silaDat} sevgiyle`;
export const about = (n) => ({
  title: appName(n),
  text: `Bu uygulama ${n.silaDat} hediye olarak yapıldı. Veriler yalnızca bu cihazda durur; internet gerekmez.`,
  sign: `${n.mert} yaptı, ${n.sila} için.`,
});
/** Sürpriz 2: Ayarlar'da girilen özel günde (ör. doğum günü) ana sayfada küçük not. */
export const specialDayNote = (n) => ({ title: `${n.mertAbl} bir not`, text: `Bugün senin günün ${n.sila}. Kendine güzel bir şey al, kumbara izin veriyor. İyi ki varsın.` });

// =====================================================================
// Ekleme ekranı ipuçları
// =====================================================================
export const ADD_HINT_EMPTY = "Tutarı yaz, kategoriye dokun.";
export const ADD_HINT_READY = "Şimdi kategoriye dokun, eklensin.";
export const ADD_HINT_PICKED = "Hazır. Ekle'ye bas ya da kategoriyi değiştir.";

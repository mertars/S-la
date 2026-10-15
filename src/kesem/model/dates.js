// Türkiye tarih/saat biçimi — 24 saat, Türkçe ay/gün adları.
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const p2 = (n) => String(n).padStart(2, "0");

export const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
export const formatTime = (ts) => {
  const d = new Date(ts);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
export const monthKey = (ts) => dayKey(ts).slice(0, 7);
export const monthLabel = (ts) => {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
export const shiftMonth = (ts, delta) => {
  const d = new Date(ts);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return d.getTime();
};
export const monthRange = (ts) => {
  const d = new Date(ts);
  const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return [from, to];
};

export function dayLabel(ts, now = Date.now()) {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Dün";
  const d = new Date(ts);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const y = d.getFullYear() !== new Date(now).getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${base}${y} ${DAYS[d.getDay()]}`;
}

export function dateTimeLabel(ts, now = Date.now()) {
  const diff = Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);
  const d = new Date(ts);
  const date = diff === 0 ? "Bugün" : diff === 1 ? "Dün" : `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  return `${date} ${formatTime(ts)}`;
}

export function fullDateTime(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${DAYS[d.getDay()]} · ${formatTime(ts)}`;
}

export const withTime = (dayTs, h, m) => {
  const d = new Date(dayTs);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

// <input type="date"> için "YYYY-MM-DD" ↔ gün başı
export const toDateInput = (ts) => dayKey(ts);
export const fromDateInput = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
};

export const trLower = (s) => (s || "").toLocaleLowerCase("tr-TR");

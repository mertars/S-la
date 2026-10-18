import { useMemo, useRef } from "react";
import { Amt } from "../ui/Amt";
import { CalendarClock, ChevronRight, CloudDownload, Flame, Heart, Plus, Repeat, Settings, Sparkles, X } from "lucide-react";
import { useFinance } from "../state/derived";
import TxRow from "../ui/TxRow";
import { Bubble, Icon } from "../ui/icons";
import { Jar } from "../ui/art";
import { Fit } from "../ui/Fit";
import { EmptyState, UndoRedoButtons } from "../ui/common";
import { PrivacyButton } from "../ui/PageHeader";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { periodTotals, suggestShortcuts } from "../model/stats";
import { relativeDayLabel, startOfDay, periodRange } from "../model/dates";
import { formatMoney, formatMoneyText } from "../model/money";
import { goalProjection } from "../model/finance";
import { STARTER_IDEAS } from "../model/defaults";
import { backupReminder, budgetLine, empty, greeting, greetingLine, specialDayNote, streakLine, TODAY_STATE_LABEL } from "../texts";

const LONG_DATE = new Intl.DateTimeFormat("tr-TR", { weekday: "long", day: "numeric", month: "long" });
const money = (m) => formatMoney(m, "TRY", { hideZeroDecimals: true });

// Uzun bas → tutarı değiştirerek ekle; kısa dokun → anında ekle.
function useLongPress(onLong, onTap, ms = 450) {
  const timer = useRef(null);
  const fired = useRef(false);
  const start = useRef(null);
  const clear = () => clearTimeout(timer.current);
  return {
    onPointerDown: (e) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        onLong();
      }, ms);
    },
    onPointerMove: (e) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (fired.current) return;
      onTap();
    },
    onContextMenu: (e) => e.preventDefault(),
  };
}

function QuickButton({ tpl }) {
  const k = useKesem();
  const app = useApp();
  const cat = k.catById(tpl.categoryId);
  const busy = useRef(false);
  const press = useLongPress(
    () => app.openAdd({ initial: { ...tpl, templateId: tpl.id } }),
    () => {
      if (!tpl.amountMinor) return app.openAdd({ initial: { ...tpl, templateId: tpl.id } });
      if (busy.current) return; // çift dokunuşla çift kayıt olmasın
      busy.current = true;
      k.quickAdd(tpl).finally(() => setTimeout(() => (busy.current = false), 700));
    }
  );
  return (
    <button type="button" className="k-quick" {...press} aria-label={`${tpl.name}${tpl.amountMinor ? ", " + formatMoneyText(tpl.amountMinor) : ""} ekle. Basılı tut: düzenleyerek ekle`}>
      <Bubble icon={cat.icon} color={cat.color} size={52} />
      <span className="k-quick-name">{tpl.name}</span>
      <span className="k-quick-amt">{tpl.amountMinor ? <Amt>{formatMoney(tpl.amountMinor, tpl.currency, { hideZeroDecimals: true })}</Amt> : "tutar sor"}</span>
    </button>
  );
}

function NoteRow({ icon: I, title, text, onClick, tone, trailing }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`k-note-row ${tone || ""}`} onClick={onClick}>
      <span className="k-note-ico"><I size={18} strokeWidth={1.75} aria-hidden="true" /></span>
      <span className="k-note-main">
        {title && <b>{title}</b>}
        <span>{text}</span>
      </span>
      {trailing || (onClick ? <ChevronRight size={16} className="k-chev" aria-hidden="true" /> : null)}
    </Tag>
  );
}

export default function HomePage() {
  const k = useKesem();
  const app = useApp();
  const n = app.names;
  const { transactions, templates, settings } = k;
  const f = useFinance();
  const now = f.now;
  const st = f.status;
  const range = periodRange(now, k.budget.startDay);
  const month = useMemo(() => periodTotals(transactions, range, k.rates), [transactions, k.rates, range[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayStart = startOfDay(now);
  const todayTx = useMemo(() => transactions.filter((t) => t.occurredAt >= dayStart && t.occurredAt < dayStart + 86400000), [transactions, dayStart]);
  const todaySpent = useMemo(() => periodTotals(todayTx, undefined, k.rates).expense, [todayTx, k.rates]);
  const quicks = templates.filter((t) => t.quick);
  const suggestions = useMemo(() => suggestShortcuts(transactions, templates, settings.dismissedSuggestions), [transactions, templates, settings.dismissedSuggestions]);
  const lastAdded = useMemo(() => transactions.reduce((a, t) => (!a || t.createdAt > a.createdAt ? t : a), null), [transactions]);
  const list = todayTx.length ? todayTx : transactions.slice(0, 4);
  const next = f.planned.find((i) => i.kind !== "debt");
  const goal = k.goals.find((g) => !goalProjection(g).done) || k.goals[0];
  const gp = goal ? goalProjection(goal) : null;
  const md = new Date(now);
  const isSpecial = settings.specialDay && settings.specialDay === `${String(md.getMonth() + 1).padStart(2, "0")}-${String(md.getDate()).padStart(2, "0")}`;
  const needBackup = transactions.length >= 15 && (!settings.lastBackupAt || now - settings.lastBackupAt > 30 * 86400000);

  // Odak: bugünkü pay kavanozu (bütçe varsa) ya da bu dönemin toplamı
  const todayState = !st.hasBudget ? undefined : st.todayLeft < 0 ? "over" : st.allowance && st.todayLeft / st.allowance < 0.25 ? "near" : "ok";
  const level = st.hasBudget ? (st.allowance > 0 ? Math.max(0, st.todayLeft) / st.allowance : 0) : 0.22;

  const shortcutFrom = (g) => {
    const t = g.sample;
    const sub = t.subcategoryId ? k.catById(t.subcategoryId) : null;
    app.openTemplate({ initial: { name: (t.merchant || sub?.name || k.catById(t.categoryId).name).slice(0, 28), kind: t.kind, amountMinor: t.amountMinor, categoryId: t.categoryId, subcategoryId: t.subcategoryId, accountId: t.accountId, merchant: t.merchant, quick: true } });
  };
  const E = empty(n);

  return (
    <div className="k-page k-home">
      <header className="k-hello">
        <div className="k-hello-bar">
          <span className="k-hello-date">{LONG_DATE.format(now)}</span>
          <div className="k-head-side right">
            <UndoRedoButtons />
            <PrivacyButton />
            <button type="button" className="k-icon-btn plain" onClick={() => app.navigate("daha-fazla/ayarlar")} aria-label="Ayarlar">
              <Settings size={20} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <h1 className="k-hello-title">{greeting(n, now)}</h1>
        <p className="k-hello-sub">{greetingLine(n, { txToday: todayTx.length }, now)}</p>
      </header>

      {/* TEK odak: kavanoz + büyük rakam */}
      <section className="k-card hero k-focus" aria-label={st.hasBudget ? "Bugün harcayabileceğin" : "Bu dönem harcadığın"}>
        <button type="button" className="k-focus-main" onClick={() => app.navigate("daha-fazla/butce")} aria-label="Bütçeyi aç">
          <span className="k-focus-text">
            <span className="k-cap">
              {st.hasBudget ? "Bugün harcayabileceğin" : "Bu dönem harcadığın"}
              {todayState && <span className={`k-pill ${todayState}`}>{TODAY_STATE_LABEL[todayState]}</span>}
            </span>
            <Fit className={`k-num xxl ${todayState === "over" ? "k-state-over" : ""}`}>
              <Amt>{money(st.hasBudget ? st.todayLeft : month.expense)}</Amt>
            </Fit>
            <span className="k-focus-line">{budgetLine(n, st, (m) => formatMoneyText(m, "TRY", { hideZeroDecimals: true }))}</span>
          </span>
          <Jar level={level} size={100} state={todayState === "ok" ? undefined : todayState} label={st.hasBudget ? `Bugünkü payın %${Math.round(Math.min(1, level) * 100)}'i duruyor` : undefined} />
        </button>
        {st.hasBudget ? (
          <dl className="k-focus-facts">
            <div><dt>Ay sonuna</dt><dd>{st.daysLeft} gün</dd></div>
            <div><dt>Kalan bütçe</dt><dd className={st.free < 0 ? "k-state-over" : ""}><Amt>{money(st.free)}</Amt></dd></div>
            <div><dt>Bugün</dt><dd><Amt>{money(st.spentToday)}</Amt></dd></div>
          </dl>
        ) : (
          <button type="button" className="k-btn tonal sm k-focus-cta" onClick={() => app.navigate("daha-fazla/butce")}>Bütçe belirle</button>
        )}
      </section>

      {/* Hızlı ekle */}
      <section className="k-section" aria-label="Hızlı ekle">
        <div className="k-section-head">
          <h2>Tek dokunuşla</h2>
          <button type="button" className="k-link" onClick={() => app.openTemplate({})}><Plus size={15} /> Kısayol</button>
        </div>
        {quicks.length > 0 ? (
          <div className="k-quick-row no-scrollbar">
            {quicks.map((t) => <QuickButton key={t.id} tpl={t} />)}
          </div>
        ) : (
          <div className="k-ideas">
            <p>Her gün aldığın şeyleri kısayol yap, tek dokunuşla eklensin. Bir fikir:</p>
            <div className="k-chips wrap">
              {STARTER_IDEAS.map((i) => (
                <button key={i.name} type="button" className="k-chip" onClick={() => app.openTemplate({ initial: { ...i, quick: true } })}>
                  <Icon name={i.icon} size={16} /> {i.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {suggestions.map((g) => {
          const t = g.sample;
          const label = t.merchant || (t.subcategoryId && k.catById(t.subcategoryId).name) || k.catById(t.categoryId).name;
          return (
            <div key={g.key} className="k-suggest-card">
              <Sparkles size={16} aria-hidden="true" />
              <button type="button" onClick={() => shortcutFrom(g)}>
                <b>{label}</b> {g.count} kez <Amt>{formatMoney(t.amountMinor)}</Amt>, kısayol yapalım mı?
              </button>
              <button type="button" className="k-icon-btn sm" aria-label="Önerme" onClick={() => k.updateSettings({ dismissedSuggestions: [...settings.dismissedSuggestions, g.key] })}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </section>

      {/* Bugün / son kayıtlar */}
      <section className="k-section" aria-label={todayTx.length ? "Bugün" : "Son kayıtlar"}>
        <div className="k-section-head">
          <h2>{todayTx.length ? "Bugün" : "Son kayıtlar"}{todayTx.length > 0 && <small> · <Amt>{money(todaySpent)}</Amt></small>}</h2>
          {transactions.length > 0 && <button type="button" className="k-link" onClick={() => app.navigate("harcamalar")}>Tümü</button>}
        </div>
        {list.length ? (
          <div className="k-list">
            {list.map((t) => <TxRow key={t.id} tx={t} showDay={!todayTx.length} onClick={() => app.navigate(`harcamalar/${t.id}`)} />)}
          </div>
        ) : (
          <EmptyState art="piggy" compact {...E.homeRecent} />
        )}
      </section>

      {/* Sakin notlar */}
      <section className="k-section" aria-label="Küçük notlar">
        <div className="k-list">
          {isSpecial && <NoteRow icon={Heart} tone="special" {...specialDayNote(n)} />}
          {goal && gp && (
            <button type="button" className="k-note-row" onClick={() => app.navigate(`kumbara/${goal.id}`)}>
              <span className="k-note-ico jar"><Jar level={gp.pct} size={24} coins={false} tag={false} color={goal.color} /></span>
              <span className="k-note-main">
                <b>{goal.name}</b>
                <span>%{Math.round(gp.pct * 100)} doldu · <Amt>{money(gp.saved)}</Amt> / <Amt>{money(goal.targetMinor)}</Amt></span>
              </span>
              <ChevronRight size={16} className="k-chev" aria-hidden="true" />
            </button>
          )}
          <NoteRow icon={Flame} title="Harcamasız seri" text={streakLine(n, f.streak)} onClick={() => app.navigate("daha-fazla/rozetler")} />
          {next && (
            <NoteRow icon={CalendarClock} title={next.title} text={<>{relativeDayLabel(next.days)} · <Amt>{formatMoney(next.amountMinor, next.currency, { hideZeroDecimals: true })}</Amt></>} tone={next.status === "overdue" ? "bad" : ""} onClick={() => app.navigate("daha-fazla/takvim")} />
          )}
          {lastAdded && (
            <NoteRow
              icon={Repeat}
              title="Son eklenen"
              text={<>{lastAdded.merchant || k.catById(lastAdded.categoryId).name} · <Amt>{formatMoney(lastAdded.amountMinor, lastAdded.currency)}</Amt></>}
              trailing={<button type="button" className="k-btn tonal sm" onClick={() => k.repeatTransaction(lastAdded)}>Tekrarla</button>}
            />
          )}
          {needBackup && <NoteRow icon={CloudDownload} {...backupReminder(n)} onClick={() => app.navigate("daha-fazla/ayarlar")} />}
        </div>
      </section>
      <div className="k-page-end" />
    </div>
  );
}

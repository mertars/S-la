import { useState } from "react";
import { Amt } from "../ui/Amt";
import { ChevronRight, Edit3, Gift, Heart, Minus, Plus, Trash2 } from "lucide-react";
import { Page, AmountSheet, AmountField, SplitView } from "../ui/parts";
import Sheet from "../ui/Sheet";
import { Bubble, ICONS, COLOR_KEYS } from "../ui/icons";
import { Jar } from "../ui/art";
import { Fit } from "../ui/Fit";
import { EmptyState } from "../ui/common";
import { useApp } from "../ui/appctx";
import { useKesem } from "../state/store";
import { goalProjection, goalSaved } from "../model/finance";
import { baseOf, formatMoney, formatMoneyText } from "../model/money";
import { shortDate, fromDateInput, toDateInput, dateTimeLabel } from "../model/dates";
import { uid } from "../model/schema";
import { depositMessage, empty, firstGoalNote, goalCelebration, goalLine } from "../texts";

const GOAL_ICONS = ["plane", "smartphone", "gift", "home", "car", "piggy", "graduation", "heart", "star", "sofa", "shirt", "flower"];
const money = (m, c = "TRY") => formatMoney(m, c, { hideZeroDecimals: true });
const pctText = (v) => `%${Math.round(Math.max(0, v) * 100)}`;

function GoalEditor({ initial, onClose }) {
  const k = useKesem();
  const [name, setName] = useState(initial.name || "");
  const [icon, setIcon] = useState(initial.icon || "piggy");
  const [color, setColor] = useState(initial.color || "rose");
  const [target, setTarget] = useState(initial.targetMinor || 0);
  const [plan, setPlan] = useState(initial.monthlyPlanMinor || 0);
  const [date, setDate] = useState(initial.targetDate || null);
  const valid = name.trim() && target > 0;
  const save = async () => {
    const rec = await k.saveRecord("goals", { ...initial, name: name.trim().slice(0, 28), icon, color, targetMinor: target, currency: initial.currency || "TRY", monthlyPlanMinor: plan || null, targetDate: date, deposits: initial.deposits || [] }, "kumbara kaydı");
    if (rec) onClose(rec);
  };
  return (
    <Sheet open onClose={() => onClose()} title={initial.id ? "Kumbarayı düzenle" : "Yeni kumbara"} size="sm" footer={<div className="k-footbar"><button type="button" className="k-btn primary full" disabled={!valid} onClick={save}>Kaydet</button></div>}>
      <div className="k-form">
        <div className="k-preview-row">
          <Bubble icon={icon} color={color} size={52} />
          <input className="k-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Neye biriktiriyorsun?" maxLength={28} aria-label="Kumbara adı" />
        </div>
        <div className="k-label">Hedef tutar</div>
        <AmountField label="Hedef" value={target} onChange={setTarget} />
        <div className="k-label">İkon</div>
        <div className="k-icon-grid">
          {GOAL_ICONS.map((i) => {
            const C = ICONS[i];
            return (
              <button key={i} type="button" className={icon === i ? "on" : ""} style={{ "--c": `var(--kc-${color})` }} onClick={() => setIcon(i)} aria-label={i} aria-pressed={icon === i}>
                <C size={20} strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
        <div className="k-label">Renk</div>
        <div className="k-color-row">
          {COLOR_KEYS.map((c) => <button key={c} type="button" className={color === c ? "on" : ""} style={{ "--c": `var(--kc-${c})` }} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} />)}
        </div>
        <div className="k-label">Hedef tarih (isteğe bağlı)</div>
        <input type="date" className="k-input" value={date ? toDateInput(date) : ""} min={toDateInput(Date.now())} onChange={(e) => setDate(e.target.value ? fromDateInput(e.target.value) : null)} aria-label="Hedef tarih" />
        <div className="k-label">Her ay ayırmak istediğin (isteğe bağlı)</div>
        <AmountField label="Aylık" value={plan} onChange={setPlan} placeholder="Yok" />
        {initial.id && (
          <button type="button" className="k-btn danger-ghost full k-gap" onClick={async () => { onClose(null, true); await k.removeRecord("goals", initial.id, "kumbara silme"); }}>
            <Trash2 size={16} /> Kumbarayı sil
          </button>
        )}
      </div>
    </Sheet>
  );
}

function etaText(p) {
  if (p.done) return "Hedefe ulaştın";
  if (p.etaTs) return `Tahmini ${shortDate(p.etaTs)} ${new Date(p.etaTs).getFullYear()}`;
  return "Biriktirdikçe tahmin çıkar";
}

// Hedef dolunca kutlama (+ ilk hedefte Mert'ten küçük not). Bildirim/ses/titreşim yok.
function Celebration({ goal, withNote, onClose }) {
  const app = useApp();
  const n = app.names;
  const [c] = useState(() => goalCelebration(n, goal.name));
  const note = withNote ? firstGoalNote(n) : null;
  return (
    <Sheet open onClose={onClose} title={goal.name} size="sm" footer={<div className="k-footbar"><button type="button" className="k-btn primary full" onClick={onClose}>Teşekkürler</button></div>}>
      <div className="k-celebrate">
        <div className="k-celebrate-art"><Jar level={1} size={130} color={goal.color} /></div>
        <h3>{c.title}</h3>
        <p>{c.text}</p>
        {note && (
          <figure className="k-letter">
            <Heart size={16} strokeWidth={1.75} aria-hidden="true" />
            <figcaption>{note.from}</figcaption>
            <blockquote>{note.text}</blockquote>
          </figure>
        )}
      </div>
    </Sheet>
  );
}

function GoalDetail({ id, onBack }) {
  const k = useKesem();
  const app = useApp();
  const n = app.names;
  const goal = k.goals.find((g) => g.id === id);
  const [sheet, setSheet] = useState(null);
  const [party, setParty] = useState(null);
  if (!goal) return <Page title="Kumbara" onBack={onBack}><EmptyState art="jar" {...empty(n).notFound} /></Page>;
  const p = goalProjection(goal);
  const addDeposit = async (amountMinor) => {
    const before = goalSaved(goal);
    const rec = await k.saveRecord("goals", { id: goal.id, deposits: [...goal.deposits, { id: uid(), amountMinor, at: Date.now(), note: "" }] }, amountMinor >= 0 ? "kumbaraya ekleme" : "kumbaradan çekme");
    if (!rec) return;
    const after = before + amountMinor;
    const celebrated = k.settings.celebrated || [];
    if (amountMinor > 0 && before < goal.targetMinor && after >= goal.targetMinor && !celebrated.includes(goal.id)) {
      // kutlama sayfası şeridin yerine geçer (üst üste binmesin)
      const withNote = !k.settings.firstGoalNoteSeen;
      setParty({ withNote });
      k.updateSettings({ celebrated: [...celebrated, goal.id], firstGoalNoteSeen: true });
    } else if (amountMinor > 0) {
      k.notify({ message: depositMessage(n, formatMoneyText(amountMinor, goal.currency)), actionLabel: "Geri al", action: "undo" });
    }
  };
  const delDeposit = (did) => k.saveRecord("goals", { id: goal.id, deposits: goal.deposits.filter((d) => d.id !== did) }, "hareket silme");
  return (
    <Page title={goal.name} subtitle={goalLine(n, p)} onBack={onBack} right={<button type="button" className="k-icon-btn plain" aria-label="Düzenle" onClick={() => setSheet({ type: "edit" })}><Edit3 size={19} strokeWidth={1.75} /></button>}>
      <section className="k-card hero k-goal-hero" aria-label={`${goal.name}: ${pctText(p.pct)} doldu`}>
        <Jar level={p.pct} size={150} color={goal.color} label={`${goal.name}: ${pctText(p.pct)} doldu`} />
        <div className="k-goal-hero-text">
          <Fit className="k-num xxl">{pctText(p.pct)}</Fit>
          <span className="k-goal-amounts"><Amt>{money(p.saved, goal.currency)}</Amt> / <Amt>{money(goal.targetMinor, goal.currency)}</Amt></span>
          {!p.done && <span className="k-muted">Kalan <Amt>{money(p.remaining, goal.currency)}</Amt></span>}
        </div>
      </section>
      <div className="k-pair">
        <button type="button" className="k-btn primary" onClick={() => setSheet({ type: "dep" })}><Plus size={18} /> Kumbaraya at</button>
        <button type="button" className="k-btn tonal" onClick={() => setSheet({ type: "wd" })} disabled={!p.saved}><Minus size={18} /> Çek</button>
      </div>
      <div className="k-list k-gap">
        <div className="k-row"><span>Tahmin</span><b>{etaText(p)}</b></div>
        <div className="k-row"><span>Aylık gereken</span><b>{p.neededPerMonth ? <Amt>{money(p.neededPerMonth, goal.currency)}</Amt> : "—"}</b></div>
        <div className="k-row"><span>Hedef tarih</span><b>{goal.targetDate ? shortDate(goal.targetDate) + " " + new Date(goal.targetDate).getFullYear() : "Yok"}</b></div>
      </div>
      <h2 className="k-section-title">Hareketler</h2>
      {goal.deposits.length ? (
        <div className="k-list">
          {[...goal.deposits].sort((a, b) => b.at - a.at).map((d) => (
            <div key={d.id} className="k-row">
              <span className="k-grow">
                <b className={d.amountMinor < 0 ? "k-state-over" : "pos"}><Amt>{formatMoney(d.amountMinor, goal.currency, { sign: true })}</Amt></b>
                <small>{dateTimeLabel(d.at)}</small>
              </span>
              <button type="button" className="k-icon-btn sm plain" aria-label="Hareketi sil" onClick={() => delDeposit(d.id)}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      ) : <p className="k-hint">Henüz bir şey atılmadı. İlk bozukluk en tatlısı.</p>}
      {sheet?.type === "dep" && <AmountSheet title="Kumbaraya at" currency={goal.currency} submitLabel="At" onSubmit={addDeposit} onClose={() => setSheet(null)} />}
      {sheet?.type === "wd" && <AmountSheet title="Kumbaradan çek" currency={goal.currency} submitLabel="Çek" onSubmit={(v) => addDeposit(-Math.min(v, p.saved))} onClose={() => setSheet(null)} />}
      {sheet?.type === "edit" && <GoalEditor initial={goal} onClose={(_, deleted) => { setSheet(null); if (deleted) onBack(); }} />}
      {party && <Celebration goal={goal} withNote={party.withNote} onClose={() => setParty(null)} />}
    </Page>
  );
}

export default function GoalsPage({ id }) {
  const k = useKesem();
  const app = useApp();
  const n = app.names;
  const [creating, setCreating] = useState(false);
  const totalSaved = k.goals.reduce((s, g) => s + baseOf({ amountMinor: goalSaved(g), currency: g.currency }, k.rates), 0);
  const totalTarget = k.goals.reduce((s, g) => s + baseOf({ amountMinor: g.targetMinor, currency: g.currency }, k.rates), 0);
  const wishes = k.wishes.filter((w) => !w.boughtAt).length;
  const go = (gid) => app.navigate(`kumbara/${gid}`, { replace: app.isTablet && !!id });
  const master = (
    <Page title="Kumbara" subtitle={k.goals.length ? `${k.goals.length} hedef` : "Birikimlerin"} right={<button type="button" className="k-btn primary sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni</button>}>
      {k.goals.length === 0 ? (
        <EmptyState art="piggy" {...empty(n).goals} action={<button type="button" className="k-btn primary" onClick={() => setCreating(true)}><Plus size={18} /> İlk kumbarayı aç</button>} />
      ) : (
        <>
          <section className="k-card hero k-goal-hero" aria-label="Toplam birikim">
            <Jar level={totalTarget ? totalSaved / totalTarget : 0} size={132} />
            <div className="k-goal-hero-text">
              <span className="k-cap">Toplam biriken</span>
              <Fit className="k-num xxl"><Amt>{money(totalSaved)}</Amt></Fit>
              <span className="k-muted">Hedeflerin toplamı <Amt>{money(totalTarget)}</Amt></span>
            </div>
          </section>
          <div className="k-jars">
            {k.goals.map((g) => {
              const p = goalProjection(g);
              return (
                <button key={g.id} type="button" className={`k-jar-tile ${id === g.id ? "on" : ""}`} style={{ "--c": `var(--kc-${g.color})` }} onClick={() => go(g.id)} aria-current={id === g.id ? "true" : undefined} aria-label={`${g.name}, ${pctText(p.pct)} doldu`}>
                  <Jar level={p.pct} size={64} color={g.color} />
                  <span className="k-jar-name">{g.name}</span>
                  <span className="k-jar-pct">{pctText(p.pct)}</span>
                  <span className="k-jar-sub"><Amt>{money(p.saved, g.currency)}</Amt> / {formatMoneyText(g.targetMinor, g.currency, { hideZeroDecimals: true })}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="k-list k-gap">
        <button type="button" className="k-note-row" onClick={() => app.navigate("daha-fazla/istekler")}>
          <span className="k-note-ico"><Gift size={18} strokeWidth={1.75} /></span>
          <span className="k-note-main"><b>İstek listesi</b><span>{wishes ? `${wishes} şey gözünde` : "Gözüne kestirdiklerini yaz"}</span></span>
          <ChevronRight size={16} className="k-chev" aria-hidden="true" />
        </button>
      </div>
      {creating && <GoalEditor initial={{}} onClose={(rec) => { setCreating(false); if (rec) go(rec.id); }} />}
    </Page>
  );
  return <SplitView master={master} hasDetail={!!id} detail={<GoalDetail id={id} onBack={() => app.goBack("kumbara")} />} empty={<div className="k-page"><EmptyState art="jar" title="Bir kumbara seç" text="Ayrıntısı, hareketleri ve tahmini bitişi burada görünür." /></div>} />;
}

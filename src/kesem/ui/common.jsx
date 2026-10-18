import { useEffect, useRef } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { useKesem } from "../state/store";
import { Spot } from "./art";

// Kayan seçili zeminli bölümlü düğme (seçim değişince zemin yumuşakça kayar).
export function Segmented({ value, onChange, options, label, small = false }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`k-seg ${small ? "sm" : ""}`} role="tablist" aria-label={label} style={{ "--n": options.length, "--i": i }}>
      <span className="k-seg-ind" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Boş ekran: küçük sade çizim + kısa metin (metinler texts.js'te).
export function EmptyState({ art = "receipt", title, text, action, compact = false }) {
  return (
    <div className={`k-empty ${compact ? "compact" : ""}`}>
      <div className="k-empty-art"><Spot name={art} size={compact ? 96 : 120} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

// Geri al / Yinele: yalnızca bir işlem varken görünür, ne yaptığı yazıyla belli.
export function UndoRedoButtons() {
  const { canUndo, canRedo, undo, redo } = useKesem();
  if (!canUndo && !canRedo) return null;
  return (
    <div className="k-undo-group">
      {canUndo && (
        <button type="button" className="k-undo" onClick={undo} aria-label="Son işlemi geri al">
          <Undo2 size={16} strokeWidth={2} aria-hidden="true" />
          <span>Geri al</span>
        </button>
      )}
      {canRedo && (
        <button type="button" className="k-icon-btn" onClick={redo} aria-label="Geri alınanı yinele">
          <Redo2 size={17} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// Geri Al şeridi — yalnızca uygulama İÇİNDE görünür (bildirim/ses/titreşim yok).
export function Toast() {
  const { toast, dismissToast, undo, redo } = useKesem();
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    if (toast) timer.current = setTimeout(dismissToast, toast.action ? 6500 : 3200);
    return () => clearTimeout(timer.current);
  }, [toast, dismissToast]);
  if (!toast) return null;
  const run = () => {
    dismissToast();
    if (toast.action === "undo") undo();
    else if (toast.action === "redo") redo();
  };
  return (
    <div className="k-toast-wrap" role="status" aria-live="polite">
      <div className={`k-toast ${toast.tone === "error" ? "err" : ""}`} key={toast.id}>
        <span>{toast.message}</span>
        {toast.actionLabel && (
          <button type="button" onClick={run}>
            {toast.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function ConfirmSheetBody({ text, confirmLabel, onConfirm, onCancel, danger = true }) {
  return (
    <div className="k-confirm">
      <p>{text}</p>
      <div className="k-confirm-actions">
        <button type="button" className="k-btn ghost" onClick={onCancel}>
          Vazgeç
        </button>
        <button type="button" className={`k-btn ${danger ? "danger" : "primary"}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

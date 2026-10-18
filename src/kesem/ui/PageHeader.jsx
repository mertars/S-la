import { ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useKesem } from "../state/store";

// Gizlilik (tutarları bulanıklaştır) düğmesi — her sayfanın sağ üstünde.
export function PrivacyButton() {
  const { settings, updateSettings } = useKesem();
  const on = !!settings.privacy;
  return (
    <button type="button" className={`k-icon-btn plain k-privacy ${on ? "on" : ""}`} aria-pressed={on} aria-label={on ? "Tutarları göster" : "Tutarları gizle"} onClick={() => updateSettings({ privacy: !on })}>
      {on ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
    </button>
  );
}

export default function PageHeader({ title, subtitle, left, right, onBack, below }) {
  return (
    <header className="k-head">
      <div className="k-head-bar">
        <div className="k-head-side">
          {onBack ? (
            <button type="button" className="k-back" onClick={onBack} aria-label="Geri">
              <ChevronLeft size={22} strokeWidth={2} />
              <span>Geri</span>
            </button>
          ) : (
            left
          )}
        </div>
        <div className="k-head-side right">
          {right}
          <PrivacyButton />
        </div>
      </div>
      <h1 className="k-title">{title}</h1>
      {subtitle && <p className="k-subtitle">{subtitle}</p>}
      {below}
    </header>
  );
}

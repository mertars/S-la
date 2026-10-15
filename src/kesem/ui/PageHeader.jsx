import { ChevronLeft } from "lucide-react";

export default function PageHeader({ title, subtitle, left, right, onBack, large = true }) {
  return (
    <header className={`k-head ${large ? "large" : ""}`}>
      <div className="k-head-bar">
        <div className="k-head-side">
          {onBack ? (
            <button type="button" className="k-back" onClick={onBack} aria-label="Geri">
              <ChevronLeft size={22} />
              <span>Geri</span>
            </button>
          ) : (
            left
          )}
        </div>
        <div className="k-head-side right">{right}</div>
      </div>
      <h1 className="k-title">{title}</h1>
      {subtitle && <p className="k-subtitle">{subtitle}</p>}
    </header>
  );
}

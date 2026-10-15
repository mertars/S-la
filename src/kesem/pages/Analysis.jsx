import { BarChart3, PieChart, TrendingUp, CalendarRange } from "lucide-react";
import PageHeader from "../ui/PageHeader";
import { EmptyState } from "../ui/common";

export default function AnalysisPage() {
  return (
    <div className="k-page">
      <PageHeader title="Analiz" subtitle="Harcamalarını anla" />
      <EmptyState
        icon={<BarChart3 size={32} />}
        title="Analiz yakında burada"
        text="Kategori dağılımı, aylık trend, en çok harcanan yerler ve dönem karşılaştırmaları sonraki adımda eklenecek. Şimdilik kayıtlarını girmeye devam et — veriler birikiyor."
      />
      <div className="k-soon-grid" aria-hidden="true">
        {[
          [PieChart, "Kategori dağılımı"],
          [TrendingUp, "Aylık trend"],
          [CalendarRange, "Dönem karşılaştırma"],
        ].map(([I, t]) => (
          <div key={t} className="k-soon">
            <I size={20} />
            <span>{t}</span>
          </div>
        ))}
      </div>
      <div className="k-page-end" />
    </div>
  );
}

import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Page({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <motion.div
      data-testid={testId}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow && <div className="label-caps mb-2 text-[#D99B56]">{eyebrow}</div>}
        <h1 data-testid="page-title" className="text-3xl font-semibold tracking-tight text-[#F5EDE4] md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-[#A89887]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  default: "text-[#F5EDE4]",
  accent: "text-[#F3A261]",
  positive: "text-[#86EFAC]",
  negative: "text-[#FCA5A5]",
  warning: "text-[#E5A83B]",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default", testId, className }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: keyof typeof TONES; testId: string; className?: string;
}) {
  return (
    <div data-testid={testId} className={cn("panel relative overflow-hidden p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="label-caps">{label}</span>
        {Icon && <Icon className="size-4 text-[#C96D2D]" strokeWidth={1.75} />}
      </div>
      <div data-testid={`${testId}-value`} className={cn("num mt-3 text-2xl md:text-[28px]", TONES[tone])}>{value}</div>
      {hint && <div className="mt-2 text-xs text-[#A89887]">{hint}</div>}
    </div>
  );
}

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-[#C8B8A6]">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-[#7D6E60]">{hint}</p>}
    </div>
  );
}

export function NativeSelect({ value, onChange, options, testId, placeholder, className }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; testId: string; placeholder?: string; className?: string;
}) {
  return (
    <select data-testid={testId} value={value} onChange={(e) => onChange(e.target.value)} className={cn("native-select", className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Panel({ title, action, children, className, testId }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section data-testid={testId} className={cn("panel p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h3 className="text-lg font-semibold text-[#F5EDE4]">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ text, testId = "empty-state" }: { text: string; testId?: string }) {
  return <div data-testid={testId} className="rounded-lg border border-dashed border-[#38291F] px-4 py-10 text-center text-sm text-[#7D6E60]">{text}</div>;
}

export function StockBadge({ quantity, critical, unit, testId }: { quantity: number; critical: number; unit: string; testId?: string }) {
  const low = critical > 0 && quantity <= critical;
  return (
    <span
      data-testid={testId}
      className={cn(
        "num inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs",
        low ? "bg-[#361412] text-[#FCA5A5]" : "bg-[#132D1D] text-[#86EFAC]",
      )}
    >
      {low && <span className="size-1.5 rounded-full bg-[#F87171]" />}
      {new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(quantity)} {unit}
    </span>
  );
}

export function Pill({ children, tone = "neutral", testId }: { children: ReactNode; tone?: "neutral" | "accent" | "positive" | "negative" | "warning"; testId?: string }) {
  const t = {
    neutral: "bg-[#261C15] text-[#C8B8A6] border-[#3D2E24]",
    accent: "bg-[#3B2616] text-[#F7CA88] border-[#543C2E]",
    positive: "bg-[#132D1D] text-[#86EFAC] border-[#1F4A30]",
    negative: "bg-[#361412] text-[#FCA5A5] border-[#5A1F1C]",
    warning: "bg-[#33250C] text-[#F5C76A] border-[#5A4316]",
  }[tone];
  return <span data-testid={testId} className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium", t)}>{children}</span>;
}

export const STATUS_TONE: Record<string, "neutral" | "accent" | "positive" | "negative" | "warning"> = {
  "Hazırlanıyor": "warning", "Kargolandı": "accent", "Teslim Edildi": "positive", "Tamamlandı": "positive", "İptal": "negative",
};

export const tableWrap = "overflow-hidden rounded-xl border border-[#35271E] bg-[#1C140F]";
export const thClass = "bg-[#160F0B] text-[11px] font-semibold uppercase tracking-wider text-[#A89887]";

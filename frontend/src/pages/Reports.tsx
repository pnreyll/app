import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/lib/api";
import { useMoney } from "@/lib/currency";
import { fmtBucket, fmtNum } from "@/lib/format";
import { useToday } from "@/lib/hooks";
import type { ProfitReport } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, NativeSelect, Page, PageHeader, Panel, StatCard, tableWrap, thClass } from "@/components/shared";
import { tooltipStyle } from "@/pages/Dashboard";
import { cn } from "@/lib/utils";

const COLORS = ["#C96D2D", "#D99B56", "#4E9F6E", "#E5A83B", "#8C6A52", "#B5523A", "#6E8B74", "#A8743F"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function presetRange(p: string, today: string): [string, string] {
  const [y, m] = today.split("-").map(Number);
  switch (p) {
    case "last_month": return [iso(new Date(y, m - 2, 1)), iso(new Date(y, m - 1, 0))];
    case "3m": return [iso(new Date(y, m - 3, 1)), today];
    case "year": return [`${y}-01-01`, today];
    case "7d": { const d = new Date(y, m - 1, Number(today.slice(8, 10)) - 6); return [iso(d), today]; }
    default: return [`${today.slice(0, 7)}-01`, today];
  }
}
const PRESETS = [
  { value: "7d", label: "Son 7 Gün" }, { value: "month", label: "Bu Ay" }, { value: "last_month", label: "Geçen Ay" },
  { value: "3m", label: "Son 3 Ay" }, { value: "year", label: "Bu Yıl" }, { value: "custom", label: "Özel Aralık" },
];

export default function Reports() {
  const today = useToday();
  const { money } = useMoney();
  const [preset, setPreset] = useState("month");
  const [custom, setCustom] = useState<[string, string]>(["", ""]);
  const [group, setGroup] = useState<"day" | "week" | "month">("day");
  const [start, end] = preset === "custom" && custom[0] && custom[1] ? custom : presetRange(preset, today);
  const q = useQuery({ queryKey: ["report", start, end, group], queryFn: () => apiGet<ProfitReport>(`/reports/profit?start=${start}&end=${end}&group=${group}`) });
  const r = q.data;
  const v = (n?: number) => (r && n !== undefined ? money(n) : "—");
  const axis = { stroke: "#7D6E60", fontSize: 11, tickLine: false, axisLine: false } as const;
  const kfmt = (n: number) => fmtNum(n / 1000, 0) + "k";

  const pl: [string, number | undefined, string?][] = [
    ["Brüt Satış (KDV dahil)", r?.gross_sales], ["− KDV", r && -r.vat_total, "muted"], ["Net Satış Geliri", r?.revenue_net, "bold"],
    ["− Satılan Malın Maliyeti (COGS)", r && -r.cogs, "muted"], ["Brüt Kâr", r?.gross_profit, "bold"],
    ["− Sabit Giderler", r && -r.fixed_expenses, "muted"], ["− Değişken Giderler", r && -r.variable_expenses, "muted"], ["Net Kâr / Zarar", r?.net_profit, "total"],
  ];

  return (
    <Page testId="reports-page">
      <PageHeader eyebrow="Ön Muhasebe" title="Kârlılık & Raporlar" subtitle="Net kâr = Net satış − ürün maliyetleri (COGS) − sabit ve değişken giderler. Hammadde alımları stok yatırımı olarak ayrı izlenir; maliyete satış anında yansır."
        actions={<>
          <NativeSelect testId="report-preset-select" value={preset} onChange={(p) => { setPreset(p); if (p === "custom") setCustom(presetRange("month", today)); }} options={PRESETS} className="w-40" />
          <NativeSelect testId="report-group-select" value={group} onChange={(g) => setGroup(g as typeof group)} options={[{ value: "day", label: "Günlük" }, { value: "week", label: "Haftalık" }, { value: "month", label: "Aylık" }]} className="w-32" />
        </>} />
      {preset === "custom" && (
        <div className="flex flex-wrap gap-2">
          <Input data-testid="report-start-input" type="date" value={custom[0]} onChange={(e) => setCustom([e.target.value, custom[1]])} className="w-44" />
          <Input data-testid="report-end-input" type="date" value={custom[1]} onChange={(e) => setCustom([custom[0], e.target.value])} className="w-44" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testId="report-revenue" label="Net Satış Geliri" value={v(r?.revenue_net)} tone="accent" hint={r ? `${r.order_count} sipariş · brüt ${money(r.gross_sales)}` : undefined} />
        <StatCard testId="report-gross-profit" label="Brüt Kâr" value={v(r?.gross_profit)} hint={r ? `COGS ${money(r.cogs)}` : undefined} />
        <StatCard testId="report-opex" label="Faaliyet Giderleri" value={v(r?.opex)} tone="negative" hint={r ? `Hammadde alımı (ayrı): ${money(r.purchases)}` : undefined} />
        <StatCard testId="report-net-profit" label="Net Kâr / Zarar" value={v(r?.net_profit)} tone={r && r.net_profit < 0 ? "negative" : "positive"} hint={r ? `Net marj %${fmtNum(r.margin_pct, 1)}` : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Gelir · Gider · Kâr" className="xl:col-span-2" testId="report-pl-chart">
          <div className="h-72">
            {r?.series.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.series} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#2D221A" vertical={false} />
                  <XAxis dataKey="key" tickFormatter={fmtBucket} {...axis} />
                  <YAxis tickFormatter={kfmt} {...axis} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#261C15" }} labelFormatter={(l: string) => fmtBucket(l)} formatter={(val: number, n: string) => [money(val), n]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#C8B8A6" }} />
                  <Bar name="Net Gelir" dataKey="revenue" fill="#C96D2D" radius={[3, 3, 0, 0]} />
                  <Bar name="Gider" dataKey="expenses" fill="#8C6A52" radius={[3, 3, 0, 0]} />
                  <Bar name="Kâr" dataKey="profit" fill="#4E9F6E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text={q.isLoading ? "Yükleniyor…" : "Veri yok"} />}
          </div>
        </Panel>
        <Panel title="Kâr / Zarar Tablosu" testId="report-pl-table">
          <div className="space-y-1.5">
            {pl.map(([label, val, kind]) => (
              <div key={label} className={cn("flex justify-between text-sm", kind === "muted" && "text-[#A89887]", kind === "bold" && "border-t border-[#35271E] pt-1.5 font-semibold", kind === "total" && "mt-2 border-t-2 border-[#C96D2D] pt-2 text-base font-semibold")}>
                <span>{label}</span>
                <span className={cn("num", kind === "total" && ((val ?? 0) < 0 ? "text-[#FCA5A5]" : "text-[#86EFAC]"))}>{v(val)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Tahsilat Türüne Göre Gelir (Nakit / Kart / Havale / Veresiye)" className="xl:col-span-2" testId="report-income-chart">
          <div className="h-64">
            {r?.series.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.series} margin={{ left: -10 }}>
                  <CartesianGrid stroke="#2D221A" vertical={false} />
                  <XAxis dataKey="key" tickFormatter={fmtBucket} {...axis} />
                  <YAxis tickFormatter={kfmt} {...axis} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#261C15" }} labelFormatter={(l: string) => fmtBucket(l)} formatter={(val: number, n: string) => [money(val), n]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar name="Nakit" dataKey="cash" stackId="a" fill="#D99B56" />
                  <Bar name="Kredi Kartı" dataKey="card" stackId="a" fill="#C96D2D" />
                  <Bar name="Havale/EFT" dataKey="transfer" stackId="a" fill="#4E9F6E" />
                  <Bar name="Veresiye" dataKey="credit" stackId="a" fill="#E5A83B" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Veri yok" />}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {r?.by_method.map((m) => <span key={m.name} className="text-[#A89887]">{m.name}: <span className="num text-[#F5EDE4]">{money(m.amount)}</span></span>)}
          </div>
        </Panel>
        <Panel title="Gider Dağılımı" testId="report-expense-pie">
          <div className="h-48">
            {r?.expenses_by_category.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={r.expenses_by_category} dataKey="amount" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
                    {r.expenses_by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => money(val)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Gider yok" />}
          </div>
          <div className="mt-2 space-y-1">
            {r?.expenses_by_category.map((e, i) => (
              <div key={e.name} className="flex justify-between text-xs"><span className="flex items-center gap-2 text-[#C8B8A6]"><span className="size-2 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />{e.name}</span><span className="num">{money(e.amount)}</span></div>
            ))}
          </div>
        </Panel>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Ürün Bazında Kâr Marjı</h3>
        <div className={tableWrap}>
          <Table data-testid="report-products-table">
            <TableHeader><TableRow className="border-[#2E2118] hover:bg-transparent">{["Ürün", "Satılan", "Net Gelir", "Maliyet", "Brüt Kâr", "Marj"].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {r?.products.map((p) => (
                <TableRow key={p.product_id} className="border-[#281D16] hover:bg-[#231812]">
                  <TableCell className="text-[#F5EDE4]">{p.name}</TableCell>
                  <TableCell className="num text-[#C8B8A6]">{fmtNum(p.quantity)}</TableCell>
                  <TableCell className="num">{money(p.revenue)}</TableCell>
                  <TableCell className="num text-[#A89887]">{money(p.cogs)}</TableCell>
                  <TableCell className="num text-[#86EFAC]">{money(p.revenue - p.cogs)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-[#261C15]"><div className="h-full rounded-full bg-[#C96D2D]" style={{ width: `${Math.max(0, Math.min(100, p.margin_pct))}%` }} /></div><span className="num text-xs">%{fmtNum(p.margin_pct, 1)}</span></div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!r?.products.length && <div className="p-4"><EmptyState text="Bu dönemde satış yok" /></div>}
        </div>
      </div>
    </Page>
  );
}

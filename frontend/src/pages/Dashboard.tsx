import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Flame, Landmark, TrendingUp, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/lib/api";
import { useMoney } from "@/lib/currency";
import { fmtBucket, fmtDate, fmtNum, METHOD_LABELS } from "@/lib/format";
import type { Dashboard as DashboardData } from "@/lib/types";
import { EmptyState, Page, PageHeader, Panel, Pill, STATUS_TONE, StatCard } from "@/components/shared";

const PIE_COLORS = ["#C96D2D", "#D99B56", "#4E9F6E", "#E5A83B"];
export const tooltipStyle = { background: "#1C140F", border: "1px solid #38291F", borderRadius: 8, color: "#F5EDE4", fontSize: 12 };

export default function Dashboard() {
  const { money } = useMoney();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<DashboardData>("/dashboard") });
  const d = q.data;
  const dash = (v?: number) => (d && v !== undefined ? money(v) : "—");

  return (
    <Page testId="dashboard-page">
      <PageHeader
        eyebrow={d ? `Bugün · ${fmtDate(d.today)}` : "Genel Bakış"}
        title="Yönetim Paneli"
        subtitle="Roastery ve kafe operasyonlarının anlık özeti: satış, kârlılık, üretim ve kritik stoklar."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testId="kpi-today-sales" label="Bugünkü Satış" icon={Wallet} tone="accent" value={dash(d?.today_sales)}
          hint={d ? `${d.today_orders} sipariş · ${d.today_by_method.map((m) => `${m.name} ${money(m.amount)}`).join(" · ") || "henüz satış yok"}` : undefined} />
        <StatCard testId="kpi-month-profit" label="Bu Ay Net Kâr" icon={TrendingUp} tone={d && d.month.net_profit < 0 ? "negative" : "positive"} value={dash(d?.month.net_profit)}
          hint={d ? `Net gelir ${money(d.month.revenue_net)} · Marj %${fmtNum(d.month.margin_pct, 1)}` : undefined} />
        <StatCard testId="kpi-roasted" label="Kavrulan (Bu Ay)" icon={Flame} value={d ? `${fmtNum(d.roasted_kg_month)} KG` : "—"}
          hint={d ? `${d.roast_count_month} parti · Ort. fire %${fmtNum(d.avg_loss_pct, 1)}` : undefined} />
        <StatCard testId="kpi-low-stock" label="Kritik Stok Uyarısı" icon={AlertTriangle} tone={d?.low_stock.length ? "warning" : "default"} value={d ? `${d.low_stock.length} kalem` : "—"}
          hint="Kritik seviyenin altındaki ürün & hammaddeler" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Son 14 Gün · Satış & Kâr" className="xl:col-span-2" testId="chart-last14">
          <div className="h-72">
            {d ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.last14} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C96D2D" stopOpacity={0.45} /><stop offset="100%" stopColor="#C96D2D" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4E9F6E" stopOpacity={0.35} /><stop offset="100%" stopColor="#4E9F6E" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2D221A" vertical={false} />
                  <XAxis dataKey="key" tickFormatter={fmtBucket} stroke="#7D6E60" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7D6E60" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(v / 1000, 0) + "k"} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: string) => fmtDate(l)} formatter={(v: number, n: string) => [money(v), n === "revenue" ? "Net Gelir" : "Günlük Kâr"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#C96D2D" strokeWidth={2} fill="url(#gRev)" />
                  <Area type="monotone" dataKey="profit" stroke="#4E9F6E" strokeWidth={2} fill="url(#gProf)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Veri yükleniyor…" />}
          </div>
        </Panel>
        <Panel title="Bu Ay · Kanal Dağılımı" testId="chart-channel">
          <div className="h-52">
            {d && d.month.by_channel.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.month.by_channel} dataKey="amount" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                    {d.month.by_channel.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Bu ay satış yok" />}
          </div>
          <div className="mt-2 space-y-2">
            {d?.month.by_channel.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#C8B8A6]"><span className="size-2.5 rounded-sm" style={{ background: PIE_COLORS[i] }} />{c.name}</span>
                <span className="num text-[#F5EDE4]">{money(c.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Kritik Stoklar" action={<Link to="/green-beans" className="text-xs text-[#E28743] hover:underline">Stoklara git</Link>} testId="dashboard-low-stock">
          {d?.low_stock.length ? (
            <div className="space-y-2">
              {d.low_stock.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-lg border border-[#3A1A17] bg-[#22110F] px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[#F5EDE4]">{i.name}</div>
                    <div className="text-[11px] text-[#A89887]">{i.kind === "product" ? "Ürün" : i.kind === "green_bean" ? "Yeşil Çekirdek" : "Malzeme"}</div>
                  </div>
                  <span className="num shrink-0 text-xs text-[#FCA5A5]">{fmtNum(i.quantity)} / {fmtNum(i.critical_level)} {i.unit}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState text="Tüm stoklar yeterli seviyede" />}
        </Panel>

        <Panel title="Son Kavurma Partileri" action={<Link to="/roasting" className="text-xs text-[#E28743] hover:underline">Tümü</Link>} testId="dashboard-recent-roasts">
          {d?.recent_roasts.length ? (
            <ol className="relative space-y-4 border-l border-[#35271E] pl-4">
              {d.recent_roasts.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-[#C96D2D] ring-4 ring-[#1E1611]" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-[#F3A261]">{r.batch_no}</span>
                    <span className="text-xs text-[#7D6E60]">{fmtDate(r.date)}</span>
                  </div>
                  <div className="text-sm text-[#EADCCE]">{r.output_product_name}</div>
                  <div className="text-[11px] text-[#A89887]">{fmtNum(r.green_kg)} kg yeşil → {fmtNum(r.output_quantity)} {r.output_unit}{r.loss_pct ? ` · fire %${fmtNum(r.loss_pct, 1)}` : ""}</div>
                </li>
              ))}
            </ol>
          ) : <EmptyState text="Henüz kavurma kaydı yok" />}
        </Panel>

        <Panel title="Kasa · Cari Durumu" action={<Link to="/finance" className="text-xs text-[#E28743] hover:underline">Kasa & Banka</Link>} testId="dashboard-finance">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#132D1D] p-3"><div className="label-caps text-[#86EFAC]/80">Alacaklar</div><div className="num mt-1 text-lg text-[#86EFAC]" data-testid="dashboard-receivables">{dash(d?.receivables)}</div></div>
            <div className="rounded-lg bg-[#361412] p-3"><div className="label-caps text-[#FCA5A5]/80">Borçlar</div><div className="num mt-1 text-lg text-[#FCA5A5]" data-testid="dashboard-payables">{dash(d?.payables)}</div></div>
          </div>
          <div className="mt-4 space-y-2">
            {d?.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-[#C8B8A6]"><Landmark className="size-3.5 text-[#7D6E60]" />{a.name}</span>
                <span className="num text-[#F5EDE4]">{money(a.balance_try)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-[#35271E] pt-2 text-sm font-semibold">
              <span className="text-[#F5EDE4]">Toplam Varlık</span><span className="num text-[#F3A261]" data-testid="dashboard-cash-total">{dash(d?.cash_total)}</span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Son Satışlar" className="lg:col-span-3" action={<Link to="/orders" className="text-xs text-[#E28743] hover:underline">Tüm siparişler</Link>} testId="dashboard-recent-sales">
          <div className="divide-y divide-[#281D16]">
            {d?.recent_sales.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm"><span className="font-mono text-xs text-[#A89887]">{s.number}</span><Pill tone={s.channel === "B2B" ? "accent" : "neutral"}>{s.channel}</Pill></div>
                  <div className="truncate text-sm text-[#EADCCE]">{s.customer_name || "Perakende"} · {METHOD_LABELS[s.payment_method]}</div>
                </div>
                <div className="text-right">
                  <div className="num text-sm text-[#F5EDE4]">{money(s.total)}</div>
                  <Pill tone={STATUS_TONE[s.status]}>{s.status}</Pill>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Bu Ayın En İyi Müşterileri" className="lg:col-span-2" testId="dashboard-top-customers">
          {d?.top_customers.length ? (
            <div className="space-y-3">
              {d.top_customers.map((c, i) => {
                const max = d.top_customers[0].amount || 1;
                return (
                  <div key={c.name}>
                    <div className="flex justify-between text-sm"><span className="text-[#EADCCE]">{i + 1}. {c.name}</span><span className="num text-[#F3A261]">{money(c.amount)}</span></div>
                    <div className="mt-1 h-1.5 rounded-full bg-[#261C15]"><div className="h-full rounded-full bg-gradient-to-r from-[#8C4A1E] to-[#D99B56]" style={{ width: `${(c.amount / max) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState text="Bu ay kayıtlı müşteri satışı yok" />}
        </Panel>
      </div>
    </Page>
  );
}

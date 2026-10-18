import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Coffee, Plus, Search } from "lucide-react";
import { fmtDate, fmtMoney, opt } from "@/lib/format";
import { useContacts } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, NativeSelect, Page, PageHeader, Pill, StatCard } from "@/components/shared";
import { ContactFormDialog, SEGMENTS } from "@/components/ContactFormDialog";
import { BalanceText } from "@/pages/Cari";

export default function Crm() {
  const q = useContacts("customer");
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [open, setOpen] = useState(false);
  const all = q.data ?? [];
  const rows = useMemo(() => all.filter((c) => (!segment || c.segment === segment) && (c.name + c.contact_person + c.favorite_beans + c.city).toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))).sort((a, b) => b.total_sales - a.total_sales), [all, search, segment]);
  const totalVolume = all.reduce((s, c) => s + c.total_sales, 0);
  const b2b = all.filter((c) => c.segment.includes("B2B")).length;

  return (
    <Page testId="crm-page">
      <PageHeader eyebrow="CRM" title="Müşteri Portföyü" subtitle="Düzenli toptan alan kafeler ve VIP perakende müşteriler: iletişim, notlar, favori çekirdekler, özel fiyatlar ve satış hacmi."
        actions={<Button data-testid="add-customer-button" onClick={() => setOpen(true)}><Plus className="size-4" />Yeni Müşteri</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard testId="crm-customer-count" label="Müşteri" value={all.length} hint={`${b2b} B2B · ${all.length - b2b} perakende`} />
        <StatCard testId="crm-total-volume" label="Toplam Satış Hacmi" value={fmtMoney(totalVolume)} tone="accent" />
        <StatCard testId="crm-avg-volume" label="Müşteri Başı Ortalama" value={fmtMoney(all.length ? totalVolume / all.length : 0)} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7D6E60]" />
          <Input data-testid="crm-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Müşteri, yetkili, şehir veya favori çekirdek ara…" className="pl-9" />
        </div>
        <NativeSelect testId="crm-segment-filter" value={segment} onChange={setSegment} placeholder="Tüm segmentler" options={opt(SEGMENTS)} className="sm:w-56" />
      </div>
      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="crm-customer-list">
          {rows.map((c, i) => (
            <Link key={c.id} to={`/crm/${c.id}`} data-testid={`crm-customer-card-${c.id}`}
              className="panel group flex flex-col p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">{i < 3 && totalVolume > 0 && <span className="font-mono text-[10px] text-[#D99B56]">#{i + 1}</span>}<h3 className="truncate text-lg font-semibold">{c.name}</h3></div>
                  <div className="text-xs text-[#A89887]">{c.company_type}{c.city && ` · ${c.city}`}</div>
                </div>
                <ArrowUpRight className="size-4 shrink-0 text-[#7D6E60] transition-colors group-hover:text-[#F3A261]" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5"><Pill tone={c.segment.includes("B2B") ? "accent" : c.segment.includes("VIP") ? "warning" : "neutral"}>{c.segment || "Standart"}</Pill>{c.special_prices.length > 0 && <Pill tone="positive">Özel fiyat ×{c.special_prices.length}</Pill>}</div>
              {c.favorite_beans && <div className="mt-3 flex items-center gap-2 text-xs text-[#C8B8A6]"><Coffee className="size-3.5 text-[#C96D2D]" />{c.favorite_beans}</div>}
              <div className="mt-auto grid grid-cols-3 gap-2 border-t border-[#35271E] pt-3 text-xs">
                <div><div className="label-caps text-[9px]">Hacim</div><div className="num text-[#F5EDE4]">{fmtMoney(c.total_sales)}</div></div>
                <div><div className="label-caps text-[9px]">Sipariş</div><div className="num text-[#F5EDE4]">{c.order_count} · {fmtDate(c.last_order_date)}</div></div>
                <div><div className="label-caps text-[9px]">Bakiye</div><BalanceText value={c.balance} /></div>
              </div>
            </Link>
          ))}
        </div>
      ) : <EmptyState text={q.isLoading ? "Yükleniyor…" : "Müşteri bulunamadı"} />}
      <ContactFormDialog open={open} onOpenChange={setOpen} contact={null} type="customer" />
    </Page>
  );
}

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Coffee, FileDown, HandCoins, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet } from "@/lib/api";
import { fmtBucket, fmtDate, fmtMoney, fmtNum, METHOD_LABELS } from "@/lib/format";
import { useProducts } from "@/lib/hooks";
import type { ContactDetail as Detail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Page, Panel, Pill, STATUS_TONE, StatCard, tableWrap, thClass } from "@/components/shared";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import { BalanceText } from "@/pages/Cari";
import { pdfUrl } from "@/pages/Sales";
import { tooltipStyle } from "@/pages/Dashboard";

export default function ContactDetail() {
  const { id } = useParams();
  const q = useQuery({ queryKey: ["contact", id], queryFn: () => apiGet<Detail>(`/contacts/${id}`) });
  const products = useProducts();
  const [edit, setEdit] = useState(false);
  const [pay, setPay] = useState(false);
  const d = q.data;
  const c = d?.contact;

  // running balance (oldest → newest), displayed newest first
  const movements = d ? [...d.movements].reverse().reduce<{ m: Detail["movements"][number]; bal: number }[]>((acc, m) => [...acc, { m, bal: (acc.at(-1)?.bal ?? 0) + m.amount }], []).reverse() : [];

  return (
    <Page testId="contact-detail-page">
      <Link to={c?.type === "supplier" ? "/cari" : "/crm"} data-testid="contact-back-link" className="inline-flex items-center gap-1.5 text-sm text-[#A89887] hover:text-[#F3A261]"><ArrowLeft className="size-4" />Geri</Link>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="label-caps mb-2 text-[#D99B56]">{c?.type === "supplier" ? "Tedarikçi" : "Müşteri"} · {c?.company_type}</div>
          <h1 data-testid="contact-name" className="text-3xl font-semibold md:text-4xl">{c?.name ?? "…"}</h1>
          {c && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-[#C8B8A6]">
              {c.contact_person && <span>{c.contact_person}</span>}
              {c.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5 text-[#7D6E60]" />{c.phone}</span>}
              {c.email && <span className="flex items-center gap-1.5"><Mail className="size-3.5 text-[#7D6E60]" />{c.email}</span>}
              {(c.address || c.city) && <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-[#7D6E60]" />{[c.address, c.city].filter(Boolean).join(", ")}</span>}
            </div>
          )}
        </div>
        {c && <div className="flex gap-2">
          <Button variant="secondary" data-testid="contact-edit-button" onClick={() => setEdit(true)}><Pencil className="size-4" />Düzenle</Button>
          <Button data-testid="contact-payment-button" onClick={() => setPay(true)}><HandCoins className="size-4" />{c.type === "customer" ? "Tahsilat Al" : "Ödeme Yap"}</Button>
        </div>}
      </div>

      {c && d && <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard testId="contact-total-sales" label="Toplam Satış Hacmi" value={fmtMoney(c.total_sales)} tone="accent" />
          <StatCard testId="contact-order-count" label="Sipariş Sayısı" value={c.order_count} hint={`Son sipariş: ${fmtDate(c.last_order_date)}`} />
          <StatCard testId="contact-avg-order" label="Ortalama Sipariş" value={fmtMoney(d.avg_order)} hint={`${fmtNum(d.total_quantity)} birim ürün`} />
          <StatCard testId="contact-balance" label="Cari Bakiye" value={<BalanceText value={c.balance} />} hint={c.payment_term_days ? `Vade: ${c.payment_term_days} gün` : "Peşin çalışır"} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Aylık Satış Hacmi" className="lg:col-span-2" testId="contact-monthly-chart">
            <div className="h-60">
              {d.monthly.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.monthly} margin={{ left: -10 }}>
                    <CartesianGrid stroke="#2D221A" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={fmtBucket} stroke="#7D6E60" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#7D6E60" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(v / 1000, 0) + "k"} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#261C15" }} formatter={(v: number) => [fmtMoney(v), "Satış"]} labelFormatter={(l: string) => fmtBucket(l)} />
                    <Bar dataKey="total" fill="#C96D2D" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState text="Satış geçmişi yok" />}
            </div>
          </Panel>
          <Panel title="Profil & Notlar" testId="contact-profile">
            <div className="space-y-4 text-sm">
              {c.segment && <Pill tone="accent">{c.segment}</Pill>}
              {c.favorite_beans && <div><div className="label-caps mb-1">Favori Çekirdekler</div><div className="flex items-center gap-2 text-[#EADCCE]"><Coffee className="size-3.5 text-[#C96D2D]" />{c.favorite_beans}</div></div>}
              <div><div className="label-caps mb-1">Özel Notlar</div><p className="whitespace-pre-line leading-relaxed text-[#C8B8A6]">{c.notes || "—"}</p></div>
              {c.special_prices.length > 0 && (
                <div>
                  <div className="label-caps mb-1">Özel Fiyatlar</div>
                  {c.special_prices.map((s) => (
                    <div key={s.product_id} className="flex justify-between py-0.5 text-xs"><span className="text-[#C8B8A6]">{products.data?.find((p) => p.id === s.product_id)?.name ?? "Ürün"}</span><span className="num text-[#86EFAC]">{fmtMoney(s.price)}</span></div>
                  ))}
                </div>
              )}
              {d.top_products.length > 0 && (
                <div>
                  <div className="label-caps mb-1">En Çok Aldığı Ürünler</div>
                  {d.top_products.map((p) => <div key={p.name} className="flex justify-between py-0.5 text-xs"><span className="text-[#C8B8A6]">{p.name} ×{fmtNum(p.quantity)}</span><span className="num text-[#F5EDE4]">{fmtMoney(p.total)}</span></div>)}
                </div>
              )}
            </div>
          </Panel>
        </div>

        <Tabs defaultValue={c.type === "customer" ? "orders" : "statement"}>
          <TabsList>
            <TabsTrigger value="orders" data-testid="contact-tab-orders">Sipariş Geçmişi ({d.sales.length})</TabsTrigger>
            <TabsTrigger value="statement" data-testid="contact-tab-statement">Cari Ekstre ({d.movements.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-4">
            <div className={tableWrap}>
              <Table data-testid="contact-orders-table">
                <TableHeader><TableRow className="border-[#2E2118] hover:bg-transparent">{["Sipariş No", "Tarih", "Kalemler", "Ödeme", "Tutar", "Durum", ""].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {d.sales.map((s) => (
                    <TableRow key={s.id} className="border-[#281D16] hover:bg-[#231812]">
                      <TableCell className="font-mono text-xs text-[#F3A261]">{s.number}</TableCell>
                      <TableCell className="text-[#C8B8A6]">{fmtDate(s.date)}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-[#C8B8A6]">{s.items.map((i) => `${i.name} ×${fmtNum(i.quantity)}`).join(", ")}</TableCell>
                      <TableCell className="text-xs text-[#A89887]">{METHOD_LABELS[s.payment_method]}</TableCell>
                      <TableCell className="num text-[#F5EDE4]">{fmtMoney(s.total)}</TableCell>
                      <TableCell><Pill tone={STATUS_TONE[s.status]}>{s.status}</Pill></TableCell>
                      <TableCell className="text-right"><a href={pdfUrl(s.id)} title="PDF" className="inline-flex size-7 items-center justify-center rounded-md text-[#D99B56] hover:bg-[#2B1B13]"><FileDown className="size-4" /></a></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!d.sales.length && <div className="p-4"><EmptyState text="Sipariş yok" /></div>}
            </div>
          </TabsContent>
          <TabsContent value="statement" className="mt-4">
            <div className={tableWrap}>
              <Table data-testid="contact-statement-table">
                <TableHeader><TableRow className="border-[#2E2118] hover:bg-transparent">{["Tarih", "Açıklama", "Borç / Alacak", "Bakiye"].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {movements.map(({ m, bal }) => (
                    <TableRow key={m.id} className="border-[#281D16] hover:bg-[#231812]">
                      <TableCell className="text-[#C8B8A6]">{fmtDate(m.date)}</TableCell>
                      <TableCell className="text-[#F5EDE4]">{m.description}</TableCell>
                      <TableCell className={`num ${m.amount > 0 ? "text-[#86EFAC]" : "text-[#FCA5A5]"}`}>{m.amount > 0 ? "+" : "−"}{fmtMoney(Math.abs(m.amount))}</TableCell>
                      <TableCell><BalanceText value={bal} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!movements.length && <div className="p-4"><EmptyState text="Cari hareket yok" /></div>}
            </div>
          </TabsContent>
        </Tabs>
        <ContactFormDialog open={edit} onOpenChange={setEdit} contact={c} type={c.type} />
        <PaymentDialog contact={pay ? c : null} onClose={() => setPay(false)} />
      </>}
      {q.isError && <EmptyState text="Kayıt yüklenemedi" />}
    </Page>
  );
}

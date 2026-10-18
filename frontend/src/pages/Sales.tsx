import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, Minus, Plus, Search, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { fmtDate, fmtMoney, fmtNum, METHOD_LABELS, SALE_STATUSES } from "@/lib/format";
import { toNum, useAccounts, useApiMutation, useContacts, useProducts, useToday } from "@/lib/hooks";
import type { PaymentMethod, Sale, SaleIn, SaleStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, NativeSelect, Page, PageHeader, Pill, STATUS_TONE, StatCard, tableWrap, thClass } from "@/components/shared";
import { cn } from "@/lib/utils";

export const pdfUrl = (id: string) => `/api/sales/${id}/pdf`;
type Line = { product_id: string; quantity: string; unit_price: string };
const METHODS: PaymentMethod[] = ["cash", "card", "transfer", "credit"];
const ACCOUNT_TYPES_FOR: Record<PaymentMethod, string[]> = { cash: ["cash"], card: ["pos", "bank"], transfer: ["bank"], credit: [] };

function NewSaleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const today = useToday();
  const products = useProducts();
  const customers = useContacts("customer");
  const accounts = useAccounts();
  const [channel, setChannel] = useState<"B2B" | "B2C">("B2C");
  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [accountId, setAccountId] = useState("");
  const [status, setStatus] = useState<SaleStatus>("Tamamlandı");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setChannel("B2C"); setCustomerId(""); setDate(today); setLines([{ product_id: "", quantity: "1", unit_price: "" }]); setMethod("card"); setStatus("Tamamlandı"); setNotes("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const customer = customers.data?.find((c) => c.id === customerId);
  const priceFor = (pid: string, ch = channel, cust = customer) => {
    const p = products.data?.find((x) => x.id === pid);
    if (!p) return "";
    const sp = cust?.special_prices.find((s) => s.product_id === pid);
    return String(sp ? sp.price : ch === "B2B" ? p.price_b2b : p.price_b2c);
  };
  const accountOpts = (accounts.data ?? []).filter((a) => ACCOUNT_TYPES_FOR[method].includes(a.type));
  useEffect(() => { setAccountId(accountOpts[0]?.id ?? ""); }, [method, accounts.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const repriceAll = (ch: "B2B" | "B2C", custId: string) => {
    const cust = customers.data?.find((c) => c.id === custId);
    setLines((ls) => ls.map((l) => ({ ...l, unit_price: l.product_id ? priceFor(l.product_id, ch, cust) : "" })));
  };
  const total = lines.reduce((s, l) => s + toNum(l.quantity) * toNum(l.unit_price), 0);
  const vat = lines.reduce((s, l) => {
    const p = products.data?.find((x) => x.id === l.product_id);
    const t = toNum(l.quantity) * toNum(l.unit_price);
    return s + (p ? t - t / (1 + p.vat_rate / 100) : 0);
  }, 0);

  const create = useApiMutation((b: SaleIn) => apiPost<Sale>("/sales", b), {
    onSuccess: (s) => {
      onOpenChange(false);
      toast.success(`Satış ${s.number} kaydedildi`, { action: { label: "PDF İndir", onClick: () => window.open(pdfUrl(s.id), "_blank") } });
    },
  });
  const valid = lines.length > 0 && lines.every((l) => l.product_id && toNum(l.quantity) > 0) && (method === "credit" ? !!customerId : !!accountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-[#38291F] bg-[#1C140F] sm:max-w-3xl">
        <DialogHeader><DialogTitle className="font-heading text-xl">Yeni Satış / Sipariş</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Satış Kanalı">
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#38291F] bg-[#140E0A] p-1">
                {(["B2C", "B2B"] as const).map((c) => (
                  <button key={c} data-testid={`sale-channel-${c}`} onClick={() => { setChannel(c); repriceAll(c, customerId); }}
                    className={cn("rounded-md py-1.5 text-xs font-medium transition-colors", channel === c ? "bg-[#C96D2D] text-white" : "text-[#A89887] hover:text-[#F5EDE4]")}>
                    {c === "B2C" ? "B2C Perakende" : "B2B Toptan"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Müşteri / Cari">
              <NativeSelect testId="sale-customer-select" value={customerId} placeholder={channel === "B2C" ? "Perakende (kayıtsız)" : "Müşteri seçin"} onChange={(v) => { setCustomerId(v); repriceAll(channel, v); }}
                options={(customers.data ?? []).map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="Tarih"><Input data-testid="sale-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>

          <div>
            <div className="label-caps mb-2">Kalemler (fiyatlar KDV dahil)</div>
            <div className="space-y-2">
              {lines.map((l, i) => {
                const p = products.data?.find((x) => x.id === l.product_id);
                return (
                  <div key={i} className="grid grid-cols-[1fr_72px_100px_36px] items-center gap-2 sm:grid-cols-[1fr_80px_120px_110px_36px]">
                    <NativeSelect testId={`sale-item-product-${i}`} value={l.product_id} placeholder="Ürün seçin"
                      onChange={(v) => setLines(lines.map((x, j) => (j === i ? { ...x, product_id: v, unit_price: priceFor(v) } : x)))}
                      options={(products.data ?? []).map((pp) => ({ value: pp.id, label: `${pp.name}${pp.track_stock ? ` · stok ${fmtNum(pp.stock)}` : ""}` }))} />
                    <Input data-testid={`sale-item-qty-${i}`} inputMode="decimal" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                    <Input data-testid={`sale-item-price-${i}`} inputMode="decimal" value={l.unit_price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_price: e.target.value } : x)))} />
                    <div className="num hidden text-right text-sm text-[#F5EDE4] sm:block">{fmtMoney(toNum(l.quantity) * toNum(l.unit_price))}</div>
                    <Button size="icon-sm" variant="ghost" disabled={lines.length === 1} data-testid={`sale-item-remove-${i}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}><Minus className="size-3.5" /></Button>
                    {p?.track_stock && toNum(l.quantity) > p.stock && <div className="col-span-full text-[11px] text-[#FCA5A5]">Yetersiz stok (mevcut {fmtNum(p.stock)} {p.unit})</div>}
                  </div>
                );
              })}
            </div>
            <Button size="sm" variant="ghost" className="mt-2 text-[#E28743]" data-testid="sale-add-item-button" onClick={() => setLines([...lines, { product_id: "", quantity: "1", unit_price: "" }])}><Plus className="size-3.5" />Kalem ekle</Button>
          </div>

          <div>
            <div className="label-caps mb-2">Ödeme Yöntemi</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {METHODS.map((m) => (
                <button key={m} data-testid={`sale-method-${m}`} onClick={() => setMethod(m)}
                  className={cn("rounded-lg border px-3 py-2 text-sm transition-colors", method === m ? "border-[#C96D2D] bg-[#2B1B13] text-[#F3A261]" : "border-[#38291F] text-[#A89887] hover:text-[#F5EDE4]")}>
                  {METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {method !== "credit" ? (
                <Field label="Tahsilat Hesabı"><NativeSelect testId="sale-account-select" value={accountId} onChange={setAccountId} options={accountOpts.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))} placeholder={accountOpts.length ? undefined : "Uygun hesap yok"} /></Field>
              ) : (
                <div className="self-end rounded-lg border border-[#5A4316] bg-[#33250C] p-2.5 text-xs text-[#F5C76A]">{customerId ? "Tutar müşterinin cari hesabına alacak olarak yazılır." : "Veresiye için müşteri seçmelisiniz."}</div>
              )}
              <Field label="Sipariş Durumu"><NativeSelect testId="sale-status-select" value={status} onChange={(v) => setStatus(v as SaleStatus)} options={SALE_STATUSES.filter((s) => s !== "İptal").map((s) => ({ value: s, label: s }))} /></Field>
            </div>
          </div>
          <Field label="Not"><Textarea data-testid="sale-notes-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg bg-[#261C15] p-4">
            <div className="text-xs text-[#A89887]">KDV: <span className="num text-[#C8B8A6]">{fmtMoney(vat)}</span> · Ara toplam: <span className="num text-[#C8B8A6]">{fmtMoney(total - vat)}</span></div>
            <div className="text-right"><div className="label-caps">Genel Toplam</div><div data-testid="sale-total" className="num text-2xl text-[#F3A261]">{fmtMoney(total)}</div></div>
          </div>
        </div>
        <DialogFooter>
          <Button data-testid="sale-save-button" disabled={create.isPending || !valid}
            onClick={() => create.mutate({ date: date || today, channel, customer_id: customerId || null, items: lines.map((l) => ({ product_id: l.product_id, quantity: toNum(l.quantity), unit_price: l.unit_price === "" ? null : toNum(l.unit_price) })), payment_method: method, account_id: method === "credit" ? null : accountId, status, notes })}>
            Satışı Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Sales() {
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState("");
  const [method, setMethod] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Sale | null>(null);
  const q = useQuery({ queryKey: ["sales"], queryFn: () => apiGet<Sale[]>("/sales") });
  useEffect(() => { if (params.get("new") === "1") { setOpen(true); setParams({}, { replace: true }); } }, [params, setParams]);

  const setStatus = useApiMutation((v: { id: string; status: SaleStatus }) => apiPatch<Sale>(`/sales/${v.id}/status`, { status: v.status }), { success: "Durum güncellendi" });
  const remove = useApiMutation((id: string) => apiDelete(`/sales/${id}`), { success: "Satış silindi; stok ve kasa geri alındı" });

  const rows = useMemo(() => (q.data ?? []).filter((s) => (!channel || s.channel === channel) && (!method || s.payment_method === method) && (s.number + s.customer_name).toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))), [q.data, channel, method, search]);
  const active = rows.filter((s) => s.status !== "İptal");
  const sum = (arr: Sale[]) => arr.reduce((a, s) => a + s.total, 0);

  return (
    <Page testId="sales-page">
      <PageHeader eyebrow="ERP & Satış" title="Satış & Siparişler" subtitle="B2B toptan ve B2C perakende/kafe satışları. Kayıtla birlikte stok anında düşer, kasa veya cari hesap güncellenir."
        actions={<Button data-testid="new-sale-button" onClick={() => setOpen(true)}><Plus className="size-4" />Yeni Satış</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testId="sales-count" label="Sipariş" value={active.length} />
        <StatCard testId="sales-total" label="Toplam Ciro" value={fmtMoney(sum(active))} tone="accent" />
        <StatCard testId="sales-b2b-total" label="B2B Toptan" value={fmtMoney(sum(active.filter((s) => s.channel === "B2B")))} />
        <StatCard testId="sales-b2c-total" label="B2C Perakende" value={fmtMoney(sum(active.filter((s) => s.channel === "B2C")))} />
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7D6E60]" />
          <Input data-testid="sales-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Sipariş no veya müşteri ara…" className="pl-9" />
        </div>
        <NativeSelect testId="sales-channel-filter" value={channel} onChange={setChannel} placeholder="Tüm kanallar" options={[{ value: "B2B", label: "B2B Toptan" }, { value: "B2C", label: "B2C Perakende" }]} className="md:w-48" />
        <NativeSelect testId="sales-method-filter" value={method} onChange={setMethod} placeholder="Tüm ödeme tipleri" options={METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))} className="md:w-52" />
      </div>
      <div className={tableWrap}>
        <Table data-testid="sales-order-table">
          <TableHeader>
            <TableRow className="border-[#2E2118] hover:bg-transparent">
              {["Sipariş No", "Tarih", "Müşteri", "Kanal", "Ödeme", "Tutar", "Durum", ""].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 300).map((s) => (
              <TableRow key={s.id} data-testid={`sale-row-${s.number}`} className={cn("border-[#281D16] hover:bg-[#231812]", s.status === "İptal" && "opacity-50")}>
                <TableCell><button data-testid={`sale-detail-${s.number}`} onClick={() => setDetail(s)} className="font-mono text-xs text-[#F3A261] hover:underline">{s.number}</button></TableCell>
                <TableCell className="text-[#C8B8A6]">{fmtDate(s.date)}</TableCell>
                <TableCell className="text-[#F5EDE4]">{s.customer_name || <span className="text-[#7D6E60]">Perakende</span>}</TableCell>
                <TableCell><Pill tone={s.channel === "B2B" ? "accent" : "neutral"}>{s.channel}</Pill></TableCell>
                <TableCell className="text-xs text-[#C8B8A6]">{METHOD_LABELS[s.payment_method]}</TableCell>
                <TableCell className="num text-[#F5EDE4]">{fmtMoney(s.total)}</TableCell>
                <TableCell>
                  {s.status === "İptal" ? <Pill tone="negative">İptal</Pill> : (
                    <select data-testid={`sale-status-${s.number}`} value={s.status} onChange={(e) => { const v = e.target.value as SaleStatus; if (v !== "İptal" || confirm("Satış iptal edilsin mi? Stok ve kasa/cari geri alınır.")) setStatus.mutate({ id: s.id, status: v }); }}
                      className="rounded-md border border-[#38291F] bg-[#140E0A] px-2 py-1 text-xs text-[#EADCCE]">
                      {SALE_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <a href={pdfUrl(s.id)} data-testid={`invoice-download-btn-${s.number}`} title="PDF Fiş / Fatura" className="inline-flex size-7 items-center justify-center rounded-md text-[#D99B56] transition-colors hover:bg-[#2B1B13]"><FileDown className="size-4" /></a>
                  <Button size="icon-sm" variant="ghost" title="Sil" data-testid={`sale-delete-${s.number}`} onClick={() => confirm(`${s.number} silinsin mi?`) && remove.mutate(s.id)}><Trash2 className="size-3.5 text-[#FCA5A5]" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <div className="p-4"><EmptyState text={q.isLoading ? "Yükleniyor…" : "Satış bulunamadı"} /></div>}
      </div>

      <NewSaleDialog open={open} onOpenChange={setOpen} />

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#38291F] bg-[#1C140F] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading text-xl">Sipariş {detail?.number}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4" data-testid="sale-detail-dialog">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><div className="label-caps">Tarih</div><div className="text-[#F5EDE4]">{fmtDate(detail.date)}</div></div>
                <div><div className="label-caps">Müşteri</div><div className="text-[#F5EDE4]">{detail.customer_name || "Perakende"}</div></div>
                <div><div className="label-caps">Ödeme</div><div className="text-[#F5EDE4]">{METHOD_LABELS[detail.payment_method]}</div></div>
                <div><div className="label-caps">Durum</div><Pill tone={STATUS_TONE[detail.status]}>{detail.status}</Pill></div>
              </div>
              <div className="divide-y divide-[#281D16] rounded-lg border border-[#35271E]">
                {detail.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <div><div className="text-[#F5EDE4]">{it.name}</div><div className="text-[11px] text-[#7D6E60]">{fmtNum(it.quantity)} {it.unit} × {fmtMoney(it.unit_price)} · KDV %{it.vat_rate}</div></div>
                    <div className="num text-[#F5EDE4]">{fmtMoney(it.total)}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1 text-right text-sm text-[#C8B8A6]">
                <div>Ara Toplam: <span className="num">{fmtMoney(detail.subtotal)}</span></div>
                <div>KDV: <span className="num">{fmtMoney(detail.vat_total)}</span></div>
                <div className="text-lg text-[#F3A261]">Toplam: <span className="num">{fmtMoney(detail.total)}</span></div>
              </div>
            </div>
          )}
          <DialogFooter>
            {detail && <a href={pdfUrl(detail.id)} data-testid="invoice-download-btn" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#C96D2D] px-4 text-sm font-medium text-white transition-colors hover:bg-[#DF7D39]"><FileDown className="size-4" />PDF Fiş / Fatura İndir</a>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

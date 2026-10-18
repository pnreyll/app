import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, HandCoins, Pencil, Plus, Search } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useContacts } from "@/lib/hooks";
import type { Contact } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Page, PageHeader, StatCard, tableWrap, thClass } from "@/components/shared";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { PaymentDialog } from "@/components/PaymentDialog";

export function BalanceText({ value, testId }: { value: number; testId?: string }) {
  if (Math.abs(value) < 0.01) return <span data-testid={testId} className="num text-[#7D6E60]">0,00 ₺</span>;
  return (
    <span data-testid={testId} className={`num ${value > 0 ? "text-[#86EFAC]" : "text-[#FCA5A5]"}`}>
      {fmtMoney(Math.abs(value))} <span className="text-[10px] uppercase">{value > 0 ? "Alacak" : "Borç"}</span>
    </span>
  );
}

export default function Cari() {
  const [type, setType] = useState<"customer" | "supplier">("customer");
  const q = useContacts();
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [edit, setEdit] = useState<{ open: boolean; contact: Contact | null }>({ open: false, contact: null });
  const [pay, setPay] = useState<Contact | null>(null);
  const all = q.data ?? [];
  const rows = useMemo(() => all.filter((c) => c.type === type && (!onlyOpen || Math.abs(c.balance) > 0.01) && c.name.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))), [all, type, search, onlyOpen]);
  const receivable = all.filter((c) => c.balance > 0).reduce((s, c) => s + c.balance, 0);
  const payable = all.filter((c) => c.balance < 0).reduce((s, c) => s - c.balance, 0);

  return (
    <Page testId="cari-page">
      <PageHeader eyebrow="Ön Muhasebe" title="Cari Hesaplar" subtitle="Müşterilerden alacaklar ve tedarikçilere borçlar. Veresiye satışlar ve vadeli alımlar otomatik işlenir."
        actions={<Button data-testid="add-contact-button" onClick={() => setEdit({ open: true, contact: null })}><Plus className="size-4" />{type === "customer" ? "Yeni Müşteri" : "Yeni Tedarikçi"}</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard testId="cari-receivables" label="Toplam Alacak" value={fmtMoney(receivable)} tone="positive" hint="Müşterilerin bize borcu" />
        <StatCard testId="cari-payables" label="Toplam Borç" value={fmtMoney(payable)} tone="negative" hint="Tedarikçilere borcumuz" />
        <StatCard testId="cari-net" label="Net Pozisyon" value={fmtMoney(receivable - payable)} tone={receivable - payable >= 0 ? "accent" : "negative"} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={type} onValueChange={(v) => setType(v as "customer" | "supplier")}>
          <TabsList>
            <TabsTrigger value="customer" data-testid="cari-tab-customers">Müşteriler (Alacak)</TabsTrigger>
            <TabsTrigger value="supplier" data-testid="cari-tab-suppliers">Tedarikçiler (Borç)</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7D6E60]" />
          <Input data-testid="cari-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ünvan ara…" className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-[#C8B8A6]"><input data-testid="cari-open-only" type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} className="accent-[#C96D2D]" />Sadece açık bakiyeler</label>
      </div>
      <div className={tableWrap}>
        <Table data-testid="cari-table">
          <TableHeader>
            <TableRow className="border-[#2E2118] hover:bg-transparent">
              {["Ünvan", "Firma Türü", "İletişim", "Vade", "Son Sipariş", "Bakiye", ""].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} data-testid="cari-row" className="border-[#281D16] hover:bg-[#231812]">
                <TableCell className="font-medium text-[#F5EDE4]">{c.name}{c.tax_no && <div className="font-mono text-[10px] text-[#7D6E60]">VKN {c.tax_no}</div>}</TableCell>
                <TableCell className="text-[#C8B8A6]">{c.company_type}</TableCell>
                <TableCell className="text-xs text-[#A89887]">{c.phone}<div>{c.email}</div></TableCell>
                <TableCell className="num text-[#C8B8A6]">{c.payment_term_days ? `${c.payment_term_days} gün` : "Peşin"}</TableCell>
                <TableCell className="text-[#C8B8A6]">{fmtDate(c.last_order_date)}</TableCell>
                <TableCell><BalanceText value={c.balance} /></TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="sm" variant="secondary" data-testid="cari-payment-button" onClick={() => setPay(c)}><HandCoins className="size-3.5" />{c.type === "customer" ? "Tahsilat" : "Ödeme"}</Button>
                  <Link to={`/crm/${c.id}`} data-testid="cari-statement-link" title="Ekstre" className="ml-1 inline-flex size-7 items-center justify-center rounded-md text-[#D99B56] hover:bg-[#2B1B13]"><FileText className="size-3.5" /></Link>
                  <Button size="icon-sm" variant="ghost" data-testid="cari-edit-button" onClick={() => setEdit({ open: true, contact: c })}><Pencil className="size-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <div className="p-4"><EmptyState text={q.isLoading ? "Yükleniyor…" : "Kayıt bulunamadı"} /></div>}
      </div>
      <ContactFormDialog open={edit.open} onOpenChange={(o) => setEdit({ ...edit, open: o })} contact={edit.contact} type={type} />
      <PaymentDialog contact={pay} onClose={() => setPay(null)} />
    </Page>
  );
}

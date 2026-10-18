import { useMemo, useState } from "react";
import { PackagePlus, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { CURRENCIES, fmtMoney, fmtNum, opt } from "@/lib/format";
import { toNum, useAccounts, useApiMutation, useContacts, useForm, useMaterials, useToday } from "@/lib/hooks";
import type { Currency, Material, MaterialIn, PurchaseIn, StockAdjustIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, NativeSelect, Page, PageHeader, StatCard, StockBadge, tableWrap, thClass } from "@/components/shared";
import { StockAdjustDialog } from "@/components/StockAdjustDialog";

type Kind = "green_bean" | "material";
type FormState = Omit<MaterialIn, "purchase_price" | "quantity" | "critical_level"> & { purchase_price: string; quantity: string; critical_level: string };
const emptyForm = (kind: Kind): FormState => ({
  kind, name: "", category: kind === "green_bean" ? "Yeşil Çekirdek" : "Ambalaj", lot_no: "", origin: "", variety: "", process: kind === "green_bean" ? "Yıkanmış" : "",
  supplier_id: null, purchase_price: "", currency: kind === "green_bean" ? "USD" : "TRY", unit: kind === "green_bean" ? "KG" : "Adet",
  quantity: "0", critical_level: "0", notes: "",
});
const PROCESSES = ["Yıkanmış", "Natural", "Honey", "Anaerobik", "Semi-Washed"];
const MAT_CATEGORIES = ["Ambalaj", "Etiket", "Kafe Sarf", "Kargo", "Temizlik", "Diğer"];

export default function Materials({ kind }: { kind: Kind }) {
  const isGreen = kind === "green_bean";
  const q = useMaterials(kind);
  const suppliers = useContacts("supplier");
  const accounts = useAccounts();
  const today = useToday();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [adjust, setAdjust] = useState<Material | null>(null);
  const [buy, setBuy] = useState<Material | null>(null);
  const { form, setForm, set } = useForm<FormState>(emptyForm(kind));
  const [p, setP] = useState({ quantity: "", unit_price: "", currency: "TRY" as Currency, payment: "account" as PurchaseIn["payment"], account_id: "", date: "" });

  const rows = useMemo(() => (q.data ?? []).filter((m) => (m.name + m.origin + m.lot_no + m.supplier_name).toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))), [q.data, search]);
  const totalQty = rows.reduce((s, m) => s + (m.unit === "KG" ? m.quantity : 0), 0);
  const lowCount = rows.filter((m) => m.critical_level > 0 && m.quantity <= m.critical_level).length;
  const supplierOpts = (suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }));

  const save = useApiMutation((b: MaterialIn) => (editing ? apiPut(`/materials/${editing.id}`, b) : apiPost("/materials", b)), { success: "Kayıt kaydedildi", onSuccess: () => setOpen(false) });
  const remove = useApiMutation((id: string) => apiDelete(`/materials/${id}`), { success: "Kayıt silindi" });
  const adj = useApiMutation((v: { id: string; body: StockAdjustIn }) => apiPost(`/materials/${v.id}/adjust`, v.body), { success: "Stok güncellendi", onSuccess: () => setAdjust(null) });
  const purchase = useApiMutation((v: { id: string; body: PurchaseIn }) => apiPost(`/materials/${v.id}/purchase`, v.body), { success: "Alım kaydedildi; stok ve gider/cari güncellendi", onSuccess: () => setBuy(null) });

  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({ ...m, purchase_price: String(m.purchase_price), quantity: String(m.quantity), critical_level: String(m.critical_level) });
    setOpen(true);
  };
  const openBuy = (m: Material) => {
    setP({ quantity: "", unit_price: String(m.purchase_price), currency: m.currency, payment: "account", account_id: accounts.data?.[0]?.id ?? "", date: today });
    setBuy(m);
  };

  return (
    <Page testId={isGreen ? "green-beans-page" : "materials-page"}>
      <PageHeader
        eyebrow="ERP & Stok"
        title={isGreen ? "Yeşil Çekirdek Stoku" : "Ambalaj & Sarf Malzeme"}
        subtitle={isGreen ? "Lot bazında yeşil kahve: menşei, varyete, işleme yöntemi, tedarikçi ve alış fiyatı (döviz destekli)." : "Kahve torbaları, valfler, etiketler, bardak, süt, şurup ve diğer sarf malzemeleri."}
        actions={<Button data-testid="add-material-button" onClick={() => { setEditing(null); setForm(emptyForm(kind)); setOpen(true); }}><Plus className="size-4" />{isGreen ? "Yeni Lot" : "Yeni Malzeme"}</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard testId="materials-count" label="Kayıtlı Kalem" value={rows.length} />
        {isGreen ? <StatCard testId="materials-total-kg" label="Toplam Yeşil Stok" value={`${fmtNum(totalQty)} KG`} tone="accent" /> : <StatCard testId="materials-suppliers" label="Tedarikçi" value={new Set(rows.map((r) => r.supplier_id)).size} />}
        <StatCard testId="materials-low" label="Kritik Seviyede" value={lowCount} tone={lowCount ? "warning" : "default"} />
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7D6E60]" />
        <Input data-testid="material-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara…" className="pl-9" />
      </div>
      <div className={tableWrap}>
        <Table data-testid="materials-table">
          <TableHeader>
            <TableRow className="border-[#2E2118] hover:bg-transparent">
              {(isGreen ? ["Lot / Çeşit", "Menşei", "Varyete", "İşleme", "Tedarikçi", "Alış Fiyatı", "Stok", ""] : ["Malzeme", "Kategori", "Tedarikçi", "Birim Maliyet", "Stok", "Kritik", ""]).map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id} data-testid="material-row" className="border-[#281D16] hover:bg-[#231812]">
                <TableCell className="font-medium text-[#F5EDE4]">{m.name}{m.lot_no && <div className="font-mono text-[11px] text-[#7D6E60]">{m.lot_no}</div>}</TableCell>
                {isGreen ? <>
                  <TableCell className="text-[#C8B8A6]">{m.origin}</TableCell>
                  <TableCell className="text-[#C8B8A6]">{m.variety}</TableCell>
                  <TableCell className="text-[#C8B8A6]">{m.process}</TableCell>
                </> : <TableCell className="text-[#C8B8A6]">{m.category}</TableCell>}
                <TableCell className="text-[#A89887]">{m.supplier_name || "—"}</TableCell>
                <TableCell className="num text-[#F5EDE4]">{fmtMoney(m.purchase_price, m.currency)}<span className="text-[11px] text-[#7D6E60]"> /{m.unit}</span></TableCell>
                <TableCell><StockBadge quantity={m.quantity} critical={m.critical_level} unit={m.unit} /></TableCell>
                {!isGreen && <TableCell className="num text-[#7D6E60]">{fmtNum(m.critical_level)}</TableCell>}
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="sm" variant="secondary" data-testid="material-purchase-button" onClick={() => openBuy(m)}><PackagePlus className="size-3.5" />Alım</Button>
                  <Button size="icon-sm" variant="ghost" title="Stok düzelt" data-testid="material-adjust-button" onClick={() => setAdjust(m)}><SlidersHorizontal className="size-3.5" /></Button>
                  <Button size="icon-sm" variant="ghost" title="Düzenle" data-testid="material-edit-button" onClick={() => openEdit(m)}><Pencil className="size-3.5" /></Button>
                  <Button size="icon-sm" variant="ghost" title="Sil" data-testid="material-delete-button" onClick={() => confirm(`${m.name} silinsin mi?`) && remove.mutate(m.id)}><Trash2 className="size-3.5 text-[#FCA5A5]" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <div className="p-4"><EmptyState text={q.isLoading ? "Yükleniyor…" : "Kayıt bulunamadı"} /></div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#38291F] bg-[#1C140F] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading text-xl">{editing ? "Kaydı Düzenle" : isGreen ? "Yeni Yeşil Çekirdek Lotu" : "Yeni Malzeme"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isGreen ? "Çeşit Adı" : "Malzeme Adı"} className="sm:col-span-2"><Input data-testid="material-name-input" value={form.name} onChange={(e) => set("name")(e.target.value)} /></Field>
            {isGreen ? <>
              <Field label="Lot No"><Input data-testid="material-lot-input" value={form.lot_no} onChange={(e) => set("lot_no")(e.target.value)} /></Field>
              <Field label="Menşei"><Input data-testid="material-origin-input" value={form.origin} onChange={(e) => set("origin")(e.target.value)} placeholder="Etiyopya, Kolombiya…" /></Field>
              <Field label="Varyete"><Input data-testid="material-variety-input" value={form.variety} onChange={(e) => set("variety")(e.target.value)} /></Field>
              <Field label="İşleme Yöntemi"><NativeSelect testId="material-process-select" value={form.process} onChange={set("process")} options={opt(PROCESSES)} /></Field>
            </> : <>
              <Field label="Kategori"><NativeSelect testId="material-category-select" value={form.category} onChange={set("category")} options={opt(MAT_CATEGORIES)} /></Field>
              <Field label="Birim"><NativeSelect testId="material-unit-select" value={form.unit} onChange={set("unit")} options={opt(["Adet", "KG", "Litre", "Rulo", "Şişe", "Koli"])} /></Field>
            </>}
            <Field label="Tedarikçi"><NativeSelect testId="material-supplier-select" value={form.supplier_id ?? ""} onChange={(v) => set("supplier_id")(v || null)} options={supplierOpts} placeholder="Seçiniz" /></Field>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label={`Alış Fiyatı (/${form.unit})`}><Input data-testid="material-price-input" inputMode="decimal" value={form.purchase_price} onChange={(e) => set("purchase_price")(e.target.value)} /></Field>
              <Field label="Döviz"><NativeSelect testId="material-currency-select" value={form.currency} onChange={(v) => set("currency")(v as Currency)} options={opt(CURRENCIES)} /></Field>
            </div>
            <Field label={`Mevcut Miktar (${form.unit})`}><Input data-testid="material-quantity-input" inputMode="decimal" value={form.quantity} onChange={(e) => set("quantity")(e.target.value)} /></Field>
            <Field label="Kritik Seviye"><Input data-testid="material-critical-input" inputMode="decimal" value={form.critical_level} onChange={(e) => set("critical_level")(e.target.value)} /></Field>
            <Field label="Notlar" className="sm:col-span-2"><Textarea data-testid="material-notes-input" rows={2} value={form.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button data-testid="material-save-button" disabled={save.isPending || !form.name}
              onClick={() => save.mutate({ ...form, purchase_price: toNum(form.purchase_price), quantity: toNum(form.quantity), critical_level: toNum(form.critical_level) })}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!buy} onOpenChange={(o) => !o && setBuy(null)}>
        <DialogContent className="border-[#38291F] bg-[#1C140F] sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-heading text-xl">Stok Alımı · {buy?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`Miktar (${buy?.unit ?? ""})`}><Input data-testid="purchase-quantity-input" inputMode="decimal" value={p.quantity} onChange={(e) => setP({ ...p, quantity: e.target.value })} /></Field>
            <div className="grid grid-cols-[1fr_84px] gap-2">
              <Field label="Birim Fiyat"><Input data-testid="purchase-price-input" inputMode="decimal" value={p.unit_price} onChange={(e) => setP({ ...p, unit_price: e.target.value })} /></Field>
              <Field label="Döviz"><NativeSelect testId="purchase-currency-select" value={p.currency} onChange={(v) => setP({ ...p, currency: v as Currency })} options={opt(CURRENCIES)} /></Field>
            </div>
            <Field label="Tarih"><Input data-testid="purchase-date-input" type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></Field>
            <Field label="Ödeme"><NativeSelect testId="purchase-payment-select" value={p.payment} onChange={(v) => setP({ ...p, payment: v as PurchaseIn["payment"] })} options={[{ value: "account", label: "Peşin (Kasa/Banka)" }, { value: "credit", label: "Vadeli (Tedarikçi Cari)" }]} /></Field>
            {p.payment === "account" && (
              <Field label="Ödeme Hesabı" className="sm:col-span-2"><NativeSelect testId="purchase-account-select" value={p.account_id} onChange={(v) => setP({ ...p, account_id: v })} options={(accounts.data ?? []).map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))} /></Field>
            )}
            <div className="rounded-lg bg-[#261C15] p-3 text-sm text-[#C8B8A6] sm:col-span-2">
              Toplam: <span className="num text-[#F3A261]">{fmtMoney(toNum(p.quantity) * toNum(p.unit_price), p.currency)}</span>
              {p.payment === "credit" && <span className="block text-xs text-[#A89887]">Tedarikçi: {buy?.supplier_name || "— (önce tedarikçi tanımlayın)"}</span>}
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="purchase-save-button" disabled={purchase.isPending || !toNum(p.quantity)}
              onClick={() => buy && purchase.mutate({ id: buy.id, body: { quantity: toNum(p.quantity), unit_price: toNum(p.unit_price), currency: p.currency, date: p.date || today, payment: p.payment, account_id: p.payment === "account" ? p.account_id || null : null, supplier_id: buy.supplier_id } })}>
              Alımı Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StockAdjustDialog target={adjust ? { name: adjust.name, unit: adjust.unit, current: adjust.quantity } : null} onClose={() => setAdjust(null)} pending={adj.isPending} onSubmit={(body) => adjust && adj.mutate({ id: adjust.id, body })} />
    </Page>
  );
}

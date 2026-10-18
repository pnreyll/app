import { useMemo, useState } from "react";
import { Pencil, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { apiDelete, apiPost, apiPut } from "@/lib/api";
import { fmtMoney, opt, PRODUCT_CATEGORIES, VAT_RATES } from "@/lib/format";
import { toNum, useApiMutation, useForm, useProducts } from "@/lib/hooks";
import type { Product, ProductIn, StockAdjustIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, NativeSelect, Page, PageHeader, StockBadge, tableWrap, thClass } from "@/components/shared";
import { StockAdjustDialog } from "@/components/StockAdjustDialog";

type FormState = Omit<ProductIn, "vat_rate" | "price_b2c" | "price_b2b" | "unit_cost" | "stock" | "critical_level"> & {
  vat_rate: string; price_b2c: string; price_b2b: string; unit_cost: string; stock: string; critical_level: string;
};
const EMPTY: FormState = {
  name: "", sku: "", category: PRODUCT_CATEGORIES[0], unit: "Paket", vat_rate: "10", price_b2c: "", price_b2b: "",
  unit_cost: "", stock: "0", critical_level: "0", track_stock: true, description: "",
};

export default function Products() {
  const q = useProducts();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [adjust, setAdjust] = useState<Product | null>(null);
  const { form, setForm, set } = useForm<FormState>(EMPTY);

  const rows = useMemo(() => (q.data ?? []).filter((p) => (!cat || p.category === cat) && (p.name + p.sku).toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))), [q.data, cat, search]);

  const toBody = (): ProductIn => ({
    ...form, vat_rate: toNum(form.vat_rate), price_b2c: toNum(form.price_b2c), price_b2b: toNum(form.price_b2b),
    unit_cost: toNum(form.unit_cost), stock: toNum(form.stock), critical_level: toNum(form.critical_level),
  });
  const save = useApiMutation(
    (b: ProductIn) => (editing ? apiPut<Product>(`/products/${editing.id}`, b) : apiPost<Product>("/products", b)),
    { success: "Ürün kaydedildi", onSuccess: () => setOpen(false) },
  );
  const remove = useApiMutation((id: string) => apiDelete(`/products/${id}`), { success: "Ürün silindi" });
  const adj = useApiMutation((v: { id: string; body: StockAdjustIn }) => apiPost<Product>(`/products/${v.id}/adjust`, v.body), { success: "Stok güncellendi", onSuccess: () => setAdjust(null) });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ ...p, vat_rate: String(p.vat_rate), price_b2c: String(p.price_b2c), price_b2b: String(p.price_b2b), unit_cost: String(p.unit_cost), stock: String(p.stock), critical_level: String(p.critical_level) });
    setOpen(true);
  };

  return (
    <Page testId="products-page">
      <PageHeader eyebrow="ERP & Stok" title="Ürün Kataloğu & Fiyatlar" subtitle="Paket kahveler, kafe menüsü ve ekipmanlar. B2C perakende ve B2B toptan fiyatları KDV dahildir."
        actions={<Button data-testid="add-product-button" onClick={openNew}><Plus className="size-4" />Yeni Ürün</Button>} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7D6E60]" />
          <Input data-testid="product-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün adı veya SKU ara…" className="pl-9" />
        </div>
        <NativeSelect testId="product-category-filter" value={cat} onChange={setCat} options={opt(PRODUCT_CATEGORIES)} placeholder="Tüm kategoriler" className="sm:w-60" />
      </div>

      <div className={tableWrap}>
        <Table data-testid="products-table">
          <TableHeader>
            <TableRow className="border-[#2E2118] hover:bg-transparent">
              {["Ürün", "SKU", "Kategori", "KDV", "B2C Fiyat", "B2B Fiyat", "Maliyet", "Stok", ""].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id} data-testid={`product-row-${p.sku}`} className="border-[#281D16] hover:bg-[#231812]">
                <TableCell className="font-medium text-[#F5EDE4]">{p.name}<div className="text-[11px] text-[#7D6E60]">{p.unit}</div></TableCell>
                <TableCell className="font-mono text-xs text-[#A89887]">{p.sku}</TableCell>
                <TableCell className="text-[#C8B8A6]">{p.category}</TableCell>
                <TableCell className="num text-[#C8B8A6]">%{p.vat_rate}</TableCell>
                <TableCell className="num text-[#F5EDE4]">{fmtMoney(p.price_b2c)}</TableCell>
                <TableCell className="num text-[#F3A261]">{fmtMoney(p.price_b2b)}</TableCell>
                <TableCell className="num text-[#A89887]">{fmtMoney(p.unit_cost)}</TableCell>
                <TableCell>{p.track_stock ? <StockBadge testId={`product-stock-${p.sku}`} quantity={p.stock} critical={p.critical_level} unit={p.unit} /> : <span className="text-xs text-[#7D6E60]">Takipsiz</span>}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {p.track_stock && <Button size="icon-sm" variant="ghost" title="Stok düzelt" data-testid={`product-adjust-${p.sku}`} onClick={() => setAdjust(p)}><SlidersHorizontal className="size-3.5" /></Button>}
                  <Button size="icon-sm" variant="ghost" title="Düzenle" data-testid={`product-edit-${p.sku}`} onClick={() => openEdit(p)}><Pencil className="size-3.5" /></Button>
                  <Button size="icon-sm" variant="ghost" title="Sil" data-testid={`product-delete-${p.sku}`} onClick={() => confirm(`${p.name} silinsin mi?`) && remove.mutate(p.id)}><Trash2 className="size-3.5 text-[#FCA5A5]" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <div className="p-4"><EmptyState text={q.isLoading ? "Yükleniyor…" : "Ürün bulunamadı"} /></div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#38291F] bg-[#1C140F] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading text-xl">{editing ? "Ürünü Düzenle" : "Yeni Ürün"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ürün Adı" className="sm:col-span-2"><Input data-testid="product-name-input" value={form.name} onChange={(e) => set("name")(e.target.value)} /></Field>
            <Field label="SKU / Stok Kodu"><Input data-testid="product-sku-input" value={form.sku} onChange={(e) => set("sku")(e.target.value)} /></Field>
            <Field label="Kategori"><NativeSelect testId="product-category-select" value={form.category} onChange={set("category")} options={opt(PRODUCT_CATEGORIES)} /></Field>
            <Field label="Birim"><NativeSelect testId="product-unit-select" value={form.unit} onChange={(v) => set("unit")(v as ProductIn["unit"])} options={opt(["KG", "Adet", "Paket"])} /></Field>
            <Field label="KDV Oranı"><NativeSelect testId="product-vat-select" value={form.vat_rate} onChange={set("vat_rate")} options={VAT_RATES.map((v) => ({ value: String(v), label: `%${v}` }))} /></Field>
            <Field label="B2C Perakende / Kafe Fiyatı (₺, KDV dahil)"><Input data-testid="product-price-b2c-input" inputMode="decimal" value={form.price_b2c} onChange={(e) => set("price_b2c")(e.target.value)} /></Field>
            <Field label="B2B Toptan Fiyatı (₺, KDV dahil)"><Input data-testid="product-price-b2b-input" inputMode="decimal" value={form.price_b2b} onChange={(e) => set("price_b2b")(e.target.value)} /></Field>
            <Field label="Birim Maliyet (₺)" hint="Kârlılık raporlarında satılan malın maliyeti olarak kullanılır"><Input data-testid="product-cost-input" inputMode="decimal" value={form.unit_cost} onChange={(e) => set("unit_cost")(e.target.value)} /></Field>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox data-testid="product-track-stock-checkbox" checked={form.track_stock} onCheckedChange={(v) => set("track_stock")(Boolean(v))} />
              <span className="text-sm text-[#C8B8A6]">Stok takibi yap</span>
            </div>
            {form.track_stock && <>
              <Field label="Mevcut Stok"><Input data-testid="product-stock-input" inputMode="decimal" value={form.stock} onChange={(e) => set("stock")(e.target.value)} /></Field>
              <Field label="Kritik Stok Seviyesi"><Input data-testid="product-critical-input" inputMode="decimal" value={form.critical_level} onChange={(e) => set("critical_level")(e.target.value)} /></Field>
            </>}
            <Field label="Açıklama" className="sm:col-span-2"><Textarea data-testid="product-description-input" value={form.description} onChange={(e) => set("description")(e.target.value)} rows={2} /></Field>
          </div>
          <DialogFooter>
            <Button data-testid="product-save-button" disabled={save.isPending || !form.name || !form.sku} onClick={() => save.mutate(toBody())}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StockAdjustDialog
        target={adjust ? { name: adjust.name, unit: adjust.unit, current: adjust.stock } : null}
        onClose={() => setAdjust(null)}
        pending={adj.isPending}
        onSubmit={(body) => adjust && adj.mutate({ id: adjust.id, body })}
      />
    </Page>
  );
}

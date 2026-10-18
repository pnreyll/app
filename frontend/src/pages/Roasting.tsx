import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Flame, Minus, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { fmtDate, fmtNum } from "@/lib/format";
import { toNum, useApiMutation, useMaterials, useProducts, useToday } from "@/lib/hooks";
import type { Roast, RoastIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, NativeSelect, Page, PageHeader, StatCard, tableWrap, thClass } from "@/components/shared";

export default function Roasting() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const roasts = useQuery({ queryKey: ["roasts"], queryFn: () => apiGet<Roast[]>("/roasts") });
  const materials = useMaterials();
  const products = useProducts();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [inputs, setInputs] = useState<{ material_id: string; quantity: string }[]>([{ material_id: "", quantity: "" }]);
  const [out, setOut] = useState({ product_id: "", quantity: "", notes: "" });

  const openNew = () => { setDate(today); setInputs([{ material_id: "", quantity: "" }]); setOut({ product_id: "", quantity: "", notes: "" }); setOpen(true); };
  useEffect(() => { if (params.get("new") === "1") { openNew(); setParams({}, { replace: true }); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useApiMutation((b: RoastIn) => apiPost<Roast>("/roasts", b), { success: "Kavurma kaydedildi; stoklar güncellendi", onSuccess: () => setOpen(false) });
  const remove = useApiMutation((id: string) => apiDelete(`/roasts/${id}`), { success: "Kayıt silindi, stoklar geri alındı" });

  const matMap = new Map((materials.data ?? []).map((m) => [m.id, m]));
  const greenKg = inputs.reduce((s, i) => s + (matMap.get(i.material_id)?.kind === "green_bean" ? toNum(i.quantity) : 0), 0);
  const outProduct = products.data?.find((p) => p.id === out.product_id);
  const loss = greenKg > 0 && outProduct?.unit === "KG" && toNum(out.quantity) ? ((greenKg - toNum(out.quantity)) / greenKg) * 100 : null;

  const list = roasts.data ?? [];
  const month = today.slice(0, 7);
  const monthList = list.filter((r) => r.date.startsWith(month));
  const losses = monthList.filter((r) => r.loss_pct > 0).map((r) => r.loss_pct);

  return (
    <Page testId="roasting-page">
      <PageHeader eyebrow="ERP & Üretim" title="Kavurma & Üretim Takibi"
        subtitle="Kullanılan yeşil çekirdek ve blend bileşenleri stoktan manuel düşülür; elde edilen kavrulmuş kahve ürün stoğuna eklenir."
        actions={<Button data-testid="add-roast-batch-button" onClick={openNew}><Flame className="size-4" />Yeni Kavurma Girişi</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard testId="roast-month-count" label="Bu Ay Parti" value={monthList.length} icon={Flame} />
        <StatCard testId="roast-month-kg" label="Bu Ay Yeşil Kullanım" value={`${fmtNum(monthList.reduce((s, r) => s + r.green_kg, 0))} KG`} tone="accent" />
        <StatCard testId="roast-avg-loss" label="Ortalama Fire" value={`%${fmtNum(losses.length ? losses.reduce((a, b) => a + b, 0) / losses.length : 0, 1)}`} />
      </div>

      <div className={tableWrap}>
        <Table data-testid="roasts-table">
          <TableHeader>
            <TableRow className="border-[#2E2118] hover:bg-transparent">
              {["Parti No", "Tarih", "Kullanılan Hammadde", "Yeşil (KG)", "Elde Edilen", "Fire", "Not", ""].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id} data-testid={`roast-row-${r.batch_no}`} className="border-[#281D16] hover:bg-[#231812]">
                <TableCell className="font-mono text-[#F3A261]">{r.batch_no}</TableCell>
                <TableCell className="text-[#C8B8A6]">{fmtDate(r.date)}</TableCell>
                <TableCell className="max-w-xs text-xs text-[#C8B8A6]">{r.inputs.map((i) => `${i.name} ${fmtNum(i.quantity)} ${i.unit}`).join(" + ")}</TableCell>
                <TableCell className="num text-[#F5EDE4]">{fmtNum(r.green_kg)}</TableCell>
                <TableCell className="text-[#F5EDE4]">{r.output_product_name}<div className="num text-xs text-[#86EFAC]">+{fmtNum(r.output_quantity)} {r.output_unit}</div></TableCell>
                <TableCell className="num text-[#E5A83B]">{r.loss_pct ? `%${fmtNum(r.loss_pct, 1)}` : "—"}</TableCell>
                <TableCell className="max-w-[180px] truncate text-xs text-[#A89887]">{r.notes}</TableCell>
                <TableCell className="text-right"><Button size="icon-sm" variant="ghost" title="Sil ve stokları geri al" data-testid={`roast-delete-${r.batch_no}`} onClick={() => confirm(`${r.batch_no} silinsin ve stoklar geri alınsın mı?`) && remove.mutate(r.id)}><Trash2 className="size-3.5 text-[#FCA5A5]" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!list.length && <div className="p-4"><EmptyState text={roasts.isLoading ? "Yükleniyor…" : "Henüz kavurma kaydı yok"} /></div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#38291F] bg-[#1C140F] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading text-xl">Yeni Kavurma / Blend Girişi</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <Field label="Tarih" className="max-w-[200px]"><Input data-testid="roast-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <div>
              <div className="label-caps mb-2">1 · Stoktan Düşülecekler (yeşil çekirdek / malzeme)</div>
              <div className="space-y-2">
                {inputs.map((inp, idx) => {
                  const m = matMap.get(inp.material_id);
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_110px_36px] items-center gap-2">
                      <NativeSelect testId={`roast-input-material-${idx}`} value={inp.material_id} placeholder="Hammadde seçin"
                        onChange={(v) => setInputs(inputs.map((x, i) => (i === idx ? { ...x, material_id: v } : x)))}
                        options={(materials.data ?? []).map((mm) => ({ value: mm.id, label: `${mm.kind === "green_bean" ? "[Yeşil] " : ""}${mm.name} (${fmtNum(mm.quantity)} ${mm.unit})` }))} />
                      <Input data-testid={`roast-input-qty-${idx}`} inputMode="decimal" placeholder={m?.unit ?? "Miktar"} value={inp.quantity} onChange={(e) => setInputs(inputs.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} />
                      <Button size="icon-sm" variant="ghost" disabled={inputs.length === 1} onClick={() => setInputs(inputs.filter((_, i) => i !== idx))} data-testid={`roast-input-remove-${idx}`}><Minus className="size-3.5" /></Button>
                    </div>
                  );
                })}
              </div>
              <Button size="sm" variant="ghost" className="mt-2 text-[#E28743]" data-testid="roast-add-input-button" onClick={() => setInputs([...inputs, { material_id: "", quantity: "" }])}><Plus className="size-3.5" />Bileşen ekle (blend)</Button>
            </div>
            <div>
              <div className="label-caps mb-2">2 · Stoğa Eklenecek Kavrulmuş Ürün</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                <NativeSelect testId="roast-output-product-select" value={out.product_id} onChange={(v) => setOut({ ...out, product_id: v })} placeholder="Hedef ürün / blend"
                  options={(products.data ?? []).filter((p) => p.track_stock).map((p) => ({ value: p.id, label: `${p.name} (${fmtNum(p.stock)} ${p.unit})` }))} />
                <Input data-testid="roast-output-qty-input" inputMode="decimal" placeholder={outProduct?.unit ?? "Miktar"} value={out.quantity} onChange={(e) => setOut({ ...out, quantity: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#261C15] p-3 text-sm">
              <div><div className="label-caps">Yeşil Toplam</div><div className="num text-[#F5EDE4]">{fmtNum(greenKg)} KG</div></div>
              <div><div className="label-caps">Fire Oranı</div><div data-testid="roast-loss-preview" className="num text-[#E5A83B]">{loss !== null ? `%${fmtNum(loss, 1)}` : "—"}</div></div>
            </div>
            <Field label="Not"><Textarea data-testid="roast-notes-input" rows={2} value={out.notes} onChange={(e) => setOut({ ...out, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button data-testid="roast-save-button" disabled={create.isPending || !out.product_id || !toNum(out.quantity) || inputs.some((i) => !i.material_id || !toNum(i.quantity))}
              onClick={() => create.mutate({ date: date || today, inputs: inputs.map((i) => ({ material_id: i.material_id, quantity: toNum(i.quantity) })), output_product_id: out.product_id, output_quantity: toNum(out.quantity), notes: out.notes })}>
              Kaydet & Stokları Güncelle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

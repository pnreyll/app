import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { CURRENCIES, EXPENSE_CATEGORIES, fmtDate, fmtMoney, opt, RAW_PURCHASE_CATEGORY } from "@/lib/format";
import { toNum, useAccounts, useApiMutation, useContacts, useForm, useToday } from "@/lib/hooks";
import type { Currency, Expense, ExpenseIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, NativeSelect, Page, PageHeader, Panel, Pill, StatCard, tableWrap, thClass } from "@/components/shared";

type FormState = Omit<ExpenseIn, "amount"> & { amount: string };

function monthRange(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(y, mo, 0).getDate();
  return { start: `${m}-01`, end: `${m}-${String(last).padStart(2, "0")}` };
}

export default function Expenses() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [month, setMonth] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(false);
  const accounts = useAccounts();
  const suppliers = useContacts("supplier");
  const m = month || today.slice(0, 7);
  const { start, end } = monthRange(m);
  const q = useQuery({ queryKey: ["expenses", start, end], queryFn: () => apiGet<Expense[]>(`/expenses?start=${start}&end=${end}`) });
  const initial = (): FormState => ({ date: today, category: "Kira", description: "", amount: "", currency: "TRY", is_fixed: true, payment: "account", account_id: accounts.data?.find((a) => a.type === "bank")?.id ?? null, supplier_id: null, document_no: "" });
  const { form, setForm, set } = useForm<FormState>(initial());
  const openNew = () => { setForm(initial()); setOpen(true); };
  useEffect(() => { if (params.get("new") === "1") { openNew(); setParams({}, { replace: true }); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useApiMutation((b: ExpenseIn) => apiPost<Expense>("/expenses", b), { success: "Gider kaydedildi", onSuccess: () => setOpen(false) });
  const remove = useApiMutation((id: string) => apiDelete(`/expenses/${id}`), { success: "Gider silindi" });

  const all = q.data ?? [];
  const rows = useMemo(() => all.filter((e) => !cat || e.category === cat), [all, cat]);
  const opex = all.filter((e) => e.category !== RAW_PURCHASE_CATEGORY);
  const sum = (arr: Expense[]) => arr.reduce((s, e) => s + e.amount_try, 0);
  const byCat = Object.entries(all.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amount_try }), {})).sort((a, b) => b[1] - a[1]);
  const max = byCat[0]?.[1] ?? 1;

  return (
    <Page testId="expenses-page">
      <PageHeader eyebrow="Ön Muhasebe" title="Gider Yönetimi" subtitle="Kira, faturalar, personel maaşları, ek ödemeler ve tedarikçi alımları. Peşin giderler kasadan düşer, vadeli giderler tedarikçi carisine yazılır."
        actions={<>
          <Input data-testid="expense-month-filter" type="month" value={m} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <Button data-testid="add-expense-button" onClick={openNew}><Plus className="size-4" />Gider Ekle</Button>
        </>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testId="expense-total" label="Toplam Gider" value={fmtMoney(sum(all))} tone="negative" />
        <StatCard testId="expense-fixed" label="Sabit Giderler" value={fmtMoney(sum(opex.filter((e) => e.is_fixed)))} />
        <StatCard testId="expense-variable" label="Değişken Giderler" value={fmtMoney(sum(opex.filter((e) => !e.is_fixed)))} />
        <StatCard testId="expense-purchases" label="Hammadde / Tedarikçi Alımı" value={fmtMoney(sum(all.filter((e) => e.category === RAW_PURCHASE_CATEGORY)))} tone="accent" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <NativeSelect testId="expense-category-filter" value={cat} onChange={setCat} placeholder="Tüm kategoriler" options={opt(EXPENSE_CATEGORIES)} className="sm:w-72" />
          <div className={tableWrap}>
            <Table data-testid="expenses-table">
              <TableHeader>
                <TableRow className="border-[#2E2118] hover:bg-transparent">
                  {["Tarih", "Kategori", "Açıklama", "Ödeme", "Tutar", ""].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id} data-testid="expense-row" className="border-[#281D16] hover:bg-[#231812]">
                    <TableCell className="text-[#C8B8A6]">{fmtDate(e.date)}</TableCell>
                    <TableCell><div className="text-[#F5EDE4]">{e.category}</div><Pill tone={e.is_fixed ? "accent" : "neutral"}>{e.is_fixed ? "Sabit" : "Değişken"}</Pill></TableCell>
                    <TableCell className="max-w-xs text-xs text-[#C8B8A6]">{e.description}{e.document_no && <div className="font-mono text-[10px] text-[#7D6E60]">{e.document_no}</div>}</TableCell>
                    <TableCell className="text-xs text-[#A89887]">{e.payment === "account" ? e.account_name : <span className="text-[#F5C76A]">Vadeli · {e.supplier_name}</span>}</TableCell>
                    <TableCell className="num text-[#FCA5A5]">{fmtMoney(e.amount, e.currency)}{e.currency !== "TRY" && <div className="text-[10px] text-[#7D6E60]">≈ {fmtMoney(e.amount_try)}</div>}</TableCell>
                    <TableCell className="text-right"><Button size="icon-sm" variant="ghost" data-testid="expense-delete-button" onClick={() => confirm("Gider silinsin mi?") && remove.mutate(e.id)}><Trash2 className="size-3.5 text-[#FCA5A5]" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rows.length && <div className="p-4"><EmptyState text={q.isLoading ? "Yükleniyor…" : "Bu dönemde gider yok"} /></div>}
          </div>
        </div>
        <Panel title="Kategori Dağılımı" testId="expense-category-breakdown">
          <div className="space-y-3">
            {byCat.map(([name, v]) => (
              <div key={name}>
                <div className="flex justify-between text-xs"><span className="text-[#C8B8A6]">{name}</span><span className="num text-[#F5EDE4]">{fmtMoney(v)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-[#261C15]"><div className="h-full rounded-full bg-[#C96D2D]" style={{ width: `${(v / max) * 100}%` }} /></div>
              </div>
            ))}
            {!byCat.length && <EmptyState text="Veri yok" />}
          </div>
        </Panel>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#38291F] bg-[#1C140F] sm:max-w-xl">
          <DialogHeader><DialogTitle className="font-heading text-xl">Yeni Gider</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tarih"><Input data-testid="expense-date-input" type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} /></Field>
            <Field label="Kategori"><NativeSelect testId="expense-category-select" value={form.category} onChange={set("category")} options={opt(EXPENSE_CATEGORIES)} /></Field>
            <Field label="Açıklama" className="sm:col-span-2"><Input data-testid="expense-description-input" value={form.description} onChange={(e) => set("description")(e.target.value)} placeholder="Örn. Ekim ayı kira, Barista maaşı – Elif" /></Field>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Field label="Tutar"><Input data-testid="expense-amount-input" inputMode="decimal" value={form.amount} onChange={(e) => set("amount")(e.target.value)} /></Field>
              <Field label="Döviz"><NativeSelect testId="expense-currency-select" value={form.currency} onChange={(v) => set("currency")(v as Currency)} options={opt(CURRENCIES)} /></Field>
            </div>
            <Field label="Belge / Fatura No"><Input data-testid="expense-document-input" value={form.document_no} onChange={(e) => set("document_no")(e.target.value)} /></Field>
            <Field label="Ödeme Şekli"><NativeSelect testId="expense-payment-select" value={form.payment} onChange={(v) => set("payment")(v as ExpenseIn["payment"])} options={[{ value: "account", label: "Peşin (Kasa/Banka)" }, { value: "credit", label: "Vadeli (Tedarikçi Cari)" }]} /></Field>
            {form.payment === "account" ? (
              <Field label="Ödeme Hesabı"><NativeSelect testId="expense-account-select" value={form.account_id ?? ""} onChange={(v) => set("account_id")(v || null)} placeholder="Hesap seçin" options={(accounts.data ?? []).map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))} /></Field>
            ) : <div />}
            <Field label={form.payment === "credit" ? "Tedarikçi (zorunlu)" : "Tedarikçi (opsiyonel)"}><NativeSelect testId="expense-supplier-select" value={form.supplier_id ?? ""} onChange={(v) => set("supplier_id")(v || null)} placeholder="—" options={(suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }))} /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-[#C8B8A6]">
              <Checkbox data-testid="expense-fixed-checkbox" checked={form.is_fixed} onCheckedChange={(v) => set("is_fixed")(Boolean(v))} />Sabit gider
            </label>
          </div>
          <DialogFooter>
            <Button data-testid="expense-save-button" disabled={save.isPending || !toNum(form.amount)} onClick={() => save.mutate({ ...form, amount: toNum(form.amount), account_id: form.payment === "account" ? form.account_id : null })}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

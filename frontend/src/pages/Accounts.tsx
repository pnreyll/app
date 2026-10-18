import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, CreditCard, Landmark, Plus, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { ACCOUNT_TYPES, CURRENCIES, fmtDate, fmtMoney, opt } from "@/lib/format";
import { toNum, useAccounts, useApiMutation, useToday } from "@/lib/hooks";
import type { Account, AccountIn, Currency, ManualTxIn, Transaction, TransferIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Field, NativeSelect, Page, PageHeader, StatCard, tableWrap, thClass } from "@/components/shared";
import { cn } from "@/lib/utils";

const ICONS = { cash: Banknote, bank: Landmark, pos: CreditCard };

export default function Accounts() {
  const today = useToday();
  const accounts = useAccounts();
  const [selected, setSelected] = useState("");
  const txs = useQuery({ queryKey: ["transactions", selected], queryFn: () => apiGet<Transaction[]>(`/transactions${selected ? `?account_id=${selected}` : ""}`) });
  const [dlg, setDlg] = useState<"" | "account" | "transfer" | "manual">("");
  const [acc, setAcc] = useState({ name: "", type: "bank" as AccountIn["type"], currency: "TRY" as Currency, opening_balance: "0", iban: "" });
  const [tr, setTr] = useState({ from: "", to: "", amount: "", to_amount: "", note: "" });
  const [mt, setMt] = useState({ account_id: "", direction: "in" as ManualTxIn["direction"], amount: "", category: "Diğer Gelir", description: "" });
  const close = () => setDlg("");

  const saveAcc = useApiMutation((b: AccountIn) => apiPost<Account>("/accounts", b), { success: "Hesap eklendi", onSuccess: close });
  const transfer = useApiMutation((b: TransferIn) => apiPost("/accounts/transfer", b), { success: "Virman yapıldı", onSuccess: close });
  const manual = useApiMutation((b: ManualTxIn) => apiPost<Transaction>("/transactions", b), { success: "Hareket kaydedildi", onSuccess: close });
  const delTx = useApiMutation((id: string) => apiDelete(`/transactions/${id}`), { success: "Hareket silindi" });

  const list = accounts.data ?? [];
  const accOpts = list.map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }));
  const total = list.reduce((s, a) => s + a.balance_try, 0);
  const from = list.find((a) => a.id === tr.from);
  const to = list.find((a) => a.id === tr.to);

  return (
    <Page testId="finance-page">
      <PageHeader eyebrow="Ön Muhasebe" title="Kasa & Banka" subtitle="Nakit kasa, banka ve POS hesaplarının anlık durumu. Satış, gider, tahsilat ve ödemeler otomatik işlenir."
        actions={<>
          <Button variant="secondary" data-testid="manual-tx-button" onClick={() => { setMt({ account_id: list[0]?.id ?? "", direction: "in", amount: "", category: "Diğer Gelir", description: "" }); setDlg("manual"); }}><ArrowDownLeft className="size-4" />Giriş / Çıkış</Button>
          <Button variant="secondary" data-testid="transfer-button" onClick={() => { setTr({ from: list[0]?.id ?? "", to: list[1]?.id ?? "", amount: "", to_amount: "", note: "" }); setDlg("transfer"); }}><ArrowLeftRight className="size-4" />Virman</Button>
          <Button data-testid="add-account-button" onClick={() => { setAcc({ name: "", type: "bank", currency: "TRY", opening_balance: "0", iban: "" }); setDlg("account"); }}><Plus className="size-4" />Yeni Hesap</Button>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard testId="accounts-total" label="Toplam Varlık (₺)" value={fmtMoney(total)} tone="accent" className="xl:col-span-1" />
        {list.map((a) => {
          const Icon = ICONS[a.type];
          return (
            <button key={a.id} data-testid={`account-card-${a.id}`} onClick={() => setSelected(selected === a.id ? "" : a.id)}
              className={cn("panel p-5 text-left transition-[border-color,transform] duration-200 active:scale-[0.99]", selected === a.id && "border-[#C96D2D]")}>
              <div className="flex items-center justify-between"><span className="label-caps">{ACCOUNT_TYPES[a.type]}</span><Icon className="size-4 text-[#C96D2D]" strokeWidth={1.75} /></div>
              <div className="mt-2 truncate text-sm text-[#EADCCE]">{a.name}</div>
              <div className={cn("num mt-1 text-xl", a.balance < 0 ? "text-[#FCA5A5]" : "text-[#F5EDE4]")} data-testid="account-balance">{fmtMoney(a.balance, a.currency)}</div>
              {a.currency !== "TRY" && <div className="num text-[11px] text-[#7D6E60]">≈ {fmtMoney(a.balance_try)}</div>}
            </button>
          );
        })}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Hesap Hareketleri {selected && <span className="text-sm font-normal text-[#A89887]">· {list.find((a) => a.id === selected)?.name}</span>}</h3>
          {selected && <Button size="sm" variant="ghost" onClick={() => setSelected("")} data-testid="clear-account-filter">Tümünü göster</Button>}
        </div>
        <div className={tableWrap}>
          <Table data-testid="transactions-table">
            <TableHeader>
              <TableRow className="border-[#2E2118] hover:bg-transparent">
                {["Tarih", "Hesap", "Kategori", "Açıklama", "Tutar", ""].map((h) => <TableHead key={h} className={thClass}>{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(txs.data ?? []).map((t) => (
                <TableRow key={t.id} data-testid="transaction-row" className="border-[#281D16] hover:bg-[#231812]">
                  <TableCell className="text-[#C8B8A6]">{fmtDate(t.date)}</TableCell>
                  <TableCell className="text-xs text-[#A89887]">{t.account_name}</TableCell>
                  <TableCell className="text-[#F5EDE4]">{t.category}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-[#C8B8A6]">{t.description}</TableCell>
                  <TableCell className={cn("num whitespace-nowrap", t.direction === "in" ? "text-[#86EFAC]" : "text-[#FCA5A5]")}>
                    {t.direction === "in" ? <ArrowDownLeft className="mr-1 inline size-3" /> : <ArrowUpRight className="mr-1 inline size-3" />}{fmtMoney(t.amount, t.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(t.ref_type === "manual" || t.ref_type === "transfer") && <Button size="icon-sm" variant="ghost" data-testid="transaction-delete-button" onClick={() => confirm("Hareket silinsin mi?") && delTx.mutate(t.id)}><Trash2 className="size-3.5 text-[#FCA5A5]" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!txs.data?.length && <div className="p-4"><EmptyState text={txs.isLoading ? "Yükleniyor…" : "Hareket yok"} /></div>}
        </div>
      </div>

      <Dialog open={dlg === "account"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="border-[#38291F] bg-[#1C140F] sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading text-xl">Yeni Kasa / Banka Hesabı</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hesap Adı" className="sm:col-span-2"><Input data-testid="account-name-input" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} /></Field>
            <Field label="Tür"><NativeSelect testId="account-type-select" value={acc.type} onChange={(v) => setAcc({ ...acc, type: v as AccountIn["type"] })} options={Object.entries(ACCOUNT_TYPES).map(([value, label]) => ({ value, label }))} /></Field>
            <Field label="Para Birimi"><NativeSelect testId="account-currency-select" value={acc.currency} onChange={(v) => setAcc({ ...acc, currency: v as Currency })} options={opt(CURRENCIES)} /></Field>
            <Field label="Açılış Bakiyesi"><Input data-testid="account-opening-input" inputMode="decimal" value={acc.opening_balance} onChange={(e) => setAcc({ ...acc, opening_balance: e.target.value })} /></Field>
            <Field label="IBAN"><Input data-testid="account-iban-input" value={acc.iban} onChange={(e) => setAcc({ ...acc, iban: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button data-testid="account-save-button" disabled={!acc.name || saveAcc.isPending} onClick={() => saveAcc.mutate({ ...acc, opening_balance: toNum(acc.opening_balance) })}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "transfer"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="border-[#38291F] bg-[#1C140F] sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading text-xl">Hesaplar Arası Virman</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Field label="Çıkış Hesabı"><NativeSelect testId="transfer-from-select" value={tr.from} onChange={(v) => setTr({ ...tr, from: v })} options={accOpts} /></Field>
            <Field label="Giriş Hesabı"><NativeSelect testId="transfer-to-select" value={tr.to} onChange={(v) => setTr({ ...tr, to: v })} options={accOpts} /></Field>
            <Field label={`Tutar (${from?.currency ?? ""})`}><Input data-testid="transfer-amount-input" inputMode="decimal" value={tr.amount} onChange={(e) => setTr({ ...tr, amount: e.target.value })} /></Field>
            {from && to && from.currency !== to.currency && (
              <Field label={`Hesaba geçen tutar (${to.currency})`} hint="Boş bırakılırsa güncel kurdan hesaplanır"><Input data-testid="transfer-to-amount-input" inputMode="decimal" value={tr.to_amount} onChange={(e) => setTr({ ...tr, to_amount: e.target.value })} /></Field>
            )}
            <Field label="Açıklama"><Input data-testid="transfer-note-input" value={tr.note} onChange={(e) => setTr({ ...tr, note: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button data-testid="transfer-save-button" disabled={!toNum(tr.amount) || transfer.isPending} onClick={() => transfer.mutate({ from_account_id: tr.from, to_account_id: tr.to, amount: toNum(tr.amount), to_amount: tr.to_amount ? toNum(tr.to_amount) : null, date: today, note: tr.note })}>Virman Yap</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === "manual"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="border-[#38291F] bg-[#1C140F] sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading text-xl">Kasa Giriş / Çıkış</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["in", "out"] as const).map((d) => (
                <button key={d} data-testid={`manual-direction-${d}`} onClick={() => setMt({ ...mt, direction: d, category: d === "in" ? "Diğer Gelir" : "Diğer Çıkış" })}
                  className={cn("rounded-lg border px-3 py-2 text-sm transition-colors", mt.direction === d ? "border-[#C96D2D] bg-[#2B1B13] text-[#F3A261]" : "border-[#38291F] text-[#A89887]")}>{d === "in" ? "Para Girişi" : "Para Çıkışı"}</button>
              ))}
            </div>
            <Field label="Hesap"><NativeSelect testId="manual-account-select" value={mt.account_id} onChange={(v) => setMt({ ...mt, account_id: v })} options={accOpts} /></Field>
            <Field label="Tutar (hesap para biriminde)"><Input data-testid="manual-amount-input" inputMode="decimal" value={mt.amount} onChange={(e) => setMt({ ...mt, amount: e.target.value })} /></Field>
            <Field label="Kategori"><Input data-testid="manual-category-input" value={mt.category} onChange={(e) => setMt({ ...mt, category: e.target.value })} /></Field>
            <Field label="Açıklama"><Input data-testid="manual-description-input" value={mt.description} onChange={(e) => setMt({ ...mt, description: e.target.value })} /></Field>
          </div>
          <DialogFooter><Button data-testid="manual-save-button" disabled={!toNum(mt.amount) || !mt.account_id || manual.isPending} onClick={() => manual.mutate({ ...mt, amount: toNum(mt.amount), date: today })}>Kaydet</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

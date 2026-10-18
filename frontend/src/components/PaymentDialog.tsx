import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { fmtMoney } from "@/lib/format";
import { toNum, useAccounts, useApiMutation, useToday } from "@/lib/hooks";
import type { Contact, ContactPaymentIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/shared";

/** Tahsilat (customer) or Ödeme (supplier) against a cari account, posted to a Kasa/Banka account. */
export function PaymentDialog({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const accounts = useAccounts();
  const today = useToday();
  const [f, setF] = useState({ amount: "", account_id: "", date: "", note: "" });
  useEffect(() => {
    if (contact) setF({ amount: String(Math.abs(contact.balance) || ""), account_id: accounts.data?.find((a) => a.currency === "TRY")?.id ?? "", date: today, note: "" });
  }, [contact]); // eslint-disable-line react-hooks/exhaustive-deps
  const isCustomer = contact?.type === "customer";
  const pay = useApiMutation((b: ContactPaymentIn) => apiPost(`/contacts/${contact?.id}/payment`, b), { success: isCustomer ? "Tahsilat kaydedildi" : "Ödeme kaydedildi", onSuccess: onClose });
  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-[#38291F] bg-[#1C140F] sm:max-w-md">
        <DialogHeader><DialogTitle className="font-heading text-xl">{isCustomer ? "Tahsilat Al" : "Tedarikçiye Ödeme"} · {contact?.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-[#261C15] p-3 text-sm text-[#C8B8A6]">
            Güncel bakiye: <span className={`num ${(contact?.balance ?? 0) >= 0 ? "text-[#86EFAC]" : "text-[#FCA5A5]"}`}>{fmtMoney(Math.abs(contact?.balance ?? 0))} {(contact?.balance ?? 0) >= 0 ? "(Alacak)" : "(Borç)"}</span>
          </div>
          <Field label="Tutar (₺)"><Input data-testid="payment-amount-input" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label={isCustomer ? "Tahsil Edilen Hesap" : "Ödeme Yapılan Hesap"}>
            <NativeSelect testId="payment-account-select" value={f.account_id} onChange={(v) => setF({ ...f, account_id: v })} placeholder="Hesap seçin" options={(accounts.data ?? []).map((a) => ({ value: a.id, label: `${a.name} (${a.currency})` }))} />
          </Field>
          <Field label="Tarih"><Input data-testid="payment-date-input" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Açıklama"><Input data-testid="payment-note-input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button data-testid="payment-save-button" disabled={pay.isPending || !toNum(f.amount) || !f.account_id} onClick={() => pay.mutate({ amount: toNum(f.amount), account_id: f.account_id, date: f.date || today, note: f.note })}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
import { Minus, Plus } from "lucide-react";
import { apiPost, apiPut } from "@/lib/api";
import { opt } from "@/lib/format";
import { toNum, useApiMutation, useForm, useProducts } from "@/lib/hooks";
import type { Contact, ContactIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, NativeSelect } from "@/components/shared";

const CUSTOMER_TYPES = ["Butik Kafe", "Kafe Zinciri", "Restoran / Otel", "Ofis", "Son Tüketici", "Diğer"];
const SUPPLIER_TYPES = ["İthalatçı", "Çiftlik / Üretici", "Ambalaj Tedarikçisi", "Gıda Tedarikçisi", "Hizmet", "Diğer"];
export const SEGMENTS = ["Sadık Kafe (B2B)", "Yeni B2B", "Kurumsal (B2B)", "VIP Perakende", "B2C Abonman", "Standart"];

type FormState = Omit<ContactIn, "payment_term_days" | "special_prices"> & { payment_term_days: string; special_prices: { product_id: string; price: string }[] };
const empty = (type: ContactIn["type"]): FormState => ({
  type, name: "", company_type: type === "customer" ? CUSTOMER_TYPES[0] : SUPPLIER_TYPES[0], segment: type === "customer" ? "Standart" : "",
  contact_person: "", phone: "", email: "", address: "", city: "İstanbul", tax_no: "", notes: "", favorite_beans: "", payment_term_days: "0", special_prices: [],
});

export function ContactFormDialog({ open, onOpenChange, contact, type }: { open: boolean; onOpenChange: (o: boolean) => void; contact: Contact | null; type: ContactIn["type"] }) {
  const products = useProducts();
  const { form, setForm, set } = useForm<FormState>(empty(type));
  useEffect(() => {
    if (!open) return;
    setForm(contact ? { ...contact, payment_term_days: String(contact.payment_term_days), special_prices: contact.special_prices.map((s) => ({ product_id: s.product_id, price: String(s.price) })) } : empty(type));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const isCustomer = form.type === "customer";
  const save = useApiMutation((b: ContactIn) => (contact ? apiPut(`/contacts/${contact.id}`, b) : apiPost("/contacts", b)), { success: "Kayıt kaydedildi", onSuccess: () => onOpenChange(false) });
  const sp = form.special_prices;
  const t = (k: keyof FormState, label: string, testId: string, className?: string) => (
    <Field label={label} className={className}><Input data-testid={testId} value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#38291F] bg-[#1C140F] sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-heading text-xl">{contact ? "Kaydı Düzenle" : isCustomer ? "Yeni Müşteri" : "Yeni Tedarikçi"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          {t("name", "Ünvan / İsim", "contact-name-input", "sm:col-span-2")}
          <Field label="Firma Türü"><NativeSelect testId="contact-company-type-select" value={form.company_type} onChange={set("company_type")} options={opt(isCustomer ? CUSTOMER_TYPES : SUPPLIER_TYPES)} /></Field>
          {isCustomer ? <Field label="Segment"><NativeSelect testId="contact-segment-select" value={form.segment} onChange={set("segment")} options={opt(SEGMENTS)} /></Field> : t("contact_person", "Yetkili Kişi", "contact-person-input")}
          {isCustomer && t("contact_person", "Yetkili Kişi", "contact-person-input")}
          {t("phone", "Telefon", "contact-phone-input")}
          {t("email", "E-posta", "contact-email-input")}
          {t("tax_no", "Vergi No / TCKN", "contact-tax-input")}
          {t("address", "Adres", "contact-address-input")}
          {t("city", "Şehir", "contact-city-input")}
          <Field label="Vade (gün)"><Input data-testid="contact-term-input" inputMode="numeric" value={form.payment_term_days} onChange={(e) => set("payment_term_days")(e.target.value)} /></Field>
          {isCustomer && t("favorite_beans", "Favori Çekirdekler / Damak Profili", "contact-favorites-input", "sm:col-span-2")}
          <Field label="Özel Notlar" className="sm:col-span-2"><Textarea data-testid="contact-notes-input" rows={3} value={form.notes} onChange={(e) => set("notes")(e.target.value)} /></Field>
          {isCustomer && (
            <div className="sm:col-span-2">
              <div className="label-caps mb-2">Özel Fiyatlandırma (KDV dahil ₺)</div>
              <div className="space-y-2">
                {sp.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_120px_36px] gap-2">
                    <NativeSelect testId={`special-price-product-${i}`} value={row.product_id} placeholder="Ürün seçin" onChange={(v) => set("special_prices")(sp.map((x, j) => (j === i ? { ...x, product_id: v } : x)))}
                      options={(products.data ?? []).map((p) => ({ value: p.id, label: `${p.name} (B2B ${p.price_b2b} ₺)` }))} />
                    <Input data-testid={`special-price-value-${i}`} inputMode="decimal" value={row.price} onChange={(e) => set("special_prices")(sp.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                    <Button size="icon-sm" variant="ghost" onClick={() => set("special_prices")(sp.filter((_, j) => j !== i))}><Minus className="size-3.5" /></Button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="ghost" className="mt-2 text-[#E28743]" data-testid="special-price-add-button" onClick={() => set("special_prices")([...sp, { product_id: "", price: "" }])}><Plus className="size-3.5" />Özel fiyat ekle</Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button data-testid="contact-save-button" disabled={save.isPending || !form.name}
            onClick={() => save.mutate({ ...form, payment_term_days: Math.round(toNum(form.payment_term_days)), special_prices: sp.filter((s) => s.product_id).map((s) => ({ product_id: s.product_id, price: toNum(s.price) })) })}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

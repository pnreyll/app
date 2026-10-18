import { useEffect, useState } from "react";
import { fmtNum } from "@/lib/format";
import { toNum } from "@/lib/hooks";
import type { StockAdjustIn } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared";
import { cn } from "@/lib/utils";

export function StockAdjustDialog({ target, onClose, onSubmit, pending }: {
  target: { name: string; unit: string; current: number } | null;
  onClose: () => void;
  onSubmit: (b: StockAdjustIn) => void;
  pending: boolean;
}) {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  useEffect(() => { if (target) { setMode("add"); setQty(""); setReason(""); } }, [target]);
  const delta = (mode === "add" ? 1 : -1) * toNum(qty);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-[#38291F] bg-[#1C140F] sm:max-w-md">
        <DialogHeader><DialogTitle className="font-heading text-xl">Manuel Stok Hareketi</DialogTitle></DialogHeader>
        {target && (
          <div className="space-y-4">
            <div className="rounded-lg bg-[#261C15] p-3 text-sm text-[#C8B8A6]">{target.name} · Mevcut: <span className="num text-[#F5EDE4]">{fmtNum(target.current)} {target.unit}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {(["add", "remove"] as const).map((m) => (
                <button key={m} data-testid={`adjust-mode-${m}`} onClick={() => setMode(m)}
                  className={cn("rounded-lg border px-3 py-2 text-sm transition-colors", mode === m ? "border-[#C96D2D] bg-[#2B1B13] text-[#F3A261]" : "border-[#38291F] text-[#A89887] hover:text-[#F5EDE4]")}>
                  {m === "add" ? "+ Stok Ekle" : "− Stoktan Düş"}
                </button>
              ))}
            </div>
            <Field label={`Miktar (${target.unit})`}><Input data-testid="adjust-quantity-input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Açıklama"><Input data-testid="adjust-reason-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. Sayım farkı, fire, blend hazırlığı" /></Field>
            <div className="text-xs text-[#A89887]">Yeni stok: <span className="num text-[#F5EDE4]">{fmtNum(target.current + delta)} {target.unit}</span></div>
          </div>
        )}
        <DialogFooter><Button data-testid="adjust-save-button" disabled={pending || !toNum(qty)} onClick={() => onSubmit({ delta, reason })}>Uygula</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

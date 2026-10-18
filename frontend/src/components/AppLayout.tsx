import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, Bean, Boxes, Contact2, Flame, Landmark, LayoutDashboard, LogOut, Menu, Package, Plus, Receipt,
  ShoppingCart, TrendingUp, Users,
} from "lucide-react";
import { ApiError, apiGet } from "@/lib/api";
import { endSession } from "@/lib/session";
import { CurrencyProvider, useMoney } from "@/lib/currency";
import { CURRENCIES, fmtNum } from "@/lib/format";
import { useApiMutation, toNum } from "@/lib/hooks";
import { apiPut } from "@/lib/api";
import type { AdminUser, LowStockItem, Rates, Currency } from "@/lib/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared";
import { cn } from "@/lib/utils";

const NAV = [
  { group: "Genel Bakış", items: [{ to: "/", label: "Yönetim Paneli", icon: LayoutDashboard, id: "dashboard" }] },
  {
    group: "ERP & Stok",
    items: [
      { to: "/products", label: "Ürün Kataloğu & Fiyatlar", icon: Package, id: "products" },
      { to: "/green-beans", label: "Yeşil Çekirdek", icon: Bean, id: "green-beans" },
      { to: "/materials", label: "Ambalaj & Sarf Malzeme", icon: Boxes, id: "materials" },
      { to: "/roasting", label: "Kavurma & Üretim", icon: Flame, id: "roasting" },
      { to: "/orders", label: "Satış & Siparişler", icon: ShoppingCart, id: "orders" },
    ],
  },
  {
    group: "Ön Muhasebe",
    items: [
      { to: "/finance", label: "Kasa & Banka", icon: Landmark, id: "finance" },
      { to: "/expenses", label: "Gider Yönetimi", icon: Receipt, id: "expenses" },
      { to: "/cari", label: "Cari Hesaplar", icon: Users, id: "cari" },
      { to: "/reports", label: "Karlılık & Raporlar", icon: TrendingUp, id: "reports" },
    ],
  },
  { group: "CRM", items: [{ to: "/crm", label: "Müşteri Portföyü", icon: Contact2, id: "crm" }] },
];

function Brand() {
  return (
    <Link to="/" data-testid="brand-link" className="flex items-center gap-3">
      <div className="relative grid size-10 place-items-center rounded-full border border-[#543C2E] bg-[#2B1B13]">
        <span className="font-heading text-lg font-semibold text-[#F3A261]">C</span>
        <span className="animate-steam absolute -top-1.5 left-1/2 h-2.5 w-px -translate-x-1/2 rounded bg-[#D99B56]/70" />
      </div>
      <div className="leading-tight">
        <div className="font-heading text-[15px] font-semibold text-[#F5EDE4]">Chrono Coffee House</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#9C8C7B]">Roastery · Café</div>
      </div>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-6">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="label-caps mb-2 px-3 text-[10px] text-[#7D6E60]">{g.group}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/"}
                onClick={onNavigate}
                data-testid={`nav-${it.id}`}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                    isActive ? "bg-[#2B1B13] text-[#F3A261]" : "text-[#C8B8A6] hover:bg-[#221812] hover:text-[#F5EDE4]",
                  )
                }
              >
                <it.icon className="size-4" strokeWidth={1.75} />
                {it.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function LowStockPill() {
  const q = useQuery({ queryKey: ["stock-alerts"], queryFn: () => apiGet<LowStockItem[]>("/stock/alerts") });
  const items = q.data ?? [];
  if (!items.length) return null;
  return (
    <Popover>
      <PopoverTrigger
        data-testid="low-stock-pill"
        className="inline-flex items-center gap-2 rounded-full border border-[#5A1F1C] bg-[#361412] px-3 py-1.5 text-xs font-medium text-[#FCA5A5] transition-colors hover:bg-[#451916]"
      >
        <AlertTriangle className="size-3.5" />
        <span className="hidden sm:inline">Kritik Stok:</span> {items.length}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-[#38291F] bg-[#1C140F] p-3">
        <div className="label-caps mb-2">Kritik seviyenin altındakiler</div>
        <div data-testid="low-stock-list" className="max-h-72 space-y-1 overflow-y-auto">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-[#261C15]">
              <span className="truncate text-[#EADCCE]">{i.name}</span>
              <span className="num shrink-0 text-xs text-[#FCA5A5]">{fmtNum(i.quantity)} / {fmtNum(i.critical_level)} {i.unit}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CurrencySwitcher() {
  const { currency, setCurrency, rates } = useMoney();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ USD: "", EUR: "" });
  const save = useApiMutation((r: Rates) => apiPut<Rates>("/settings/rates", r), { success: "Döviz kurları güncellendi", onSuccess: () => setOpen(false) });
  return (
    <div className="flex items-center gap-1 rounded-full border border-[#35271E] bg-[#1E1611] p-0.5">
      {CURRENCIES.map((c) => (
        <button
          key={c}
          data-testid={`currency-switch-${c}`}
          onClick={() => setCurrency(c as Currency)}
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", currency === c ? "bg-[#C96D2D] text-white" : "text-[#A89887] hover:text-[#F5EDE4]")}
        >
          {c === "TRY" ? "₺" : c === "USD" ? "$" : "€"}
        </button>
      ))}
      <button
        data-testid="rates-edit-button"
        onClick={() => { setForm({ USD: String(rates.USD), EUR: String(rates.EUR) }); setOpen(true); }}
        className="hidden px-2 text-[11px] text-[#9C8C7B] hover:text-[#F3A261] lg:block"
      >
        $ {fmtNum(rates.USD)} · € {fmtNum(rates.EUR)}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[#38291F] bg-[#1C140F] sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-heading">Döviz Kurları (₺ karşılığı)</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="1 USD ="><Input data-testid="rate-usd-input" value={form.USD} onChange={(e) => setForm({ ...form, USD: e.target.value })} /></Field>
            <Field label="1 EUR ="><Input data-testid="rate-eur-input" value={form.EUR} onChange={(e) => setForm({ ...form, EUR: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button data-testid="rates-save-button" disabled={save.isPending} onClick={() => save.mutate({ USD: toNum(form.USD), EUR: toNum(form.EUR) })}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<AdminUser>("/auth/me"), retry: false });
  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace />;

  return (
    <CurrencyProvider>
      <div className="min-h-screen bg-[#120D0A]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#2D221A] bg-[#1A130E] lg:flex">
          <div className="px-5 py-5"><Brand /></div>
          <div className="flex-1 overflow-y-auto px-3 pb-6"><NavList /></div>
          <div className="border-t border-[#2D221A] p-4 text-xs text-[#7D6E60]">
            <div className="truncate text-[#C8B8A6]" data-testid="admin-email">{me.data?.email ?? "admin"}</div>
            Yönetici
          </div>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-[#2D221A] bg-[#1A130E] p-0">
            <SheetTitle className="sr-only">Menü</SheetTitle>
            <div className="px-5 py-5"><Brand /></div>
            <div className="overflow-y-auto px-3 pb-6"><NavList onNavigate={() => setMobileOpen(false)} /></div>
          </SheetContent>
        </Sheet>

        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#2D221A] bg-[#1A130E]/85 px-4 backdrop-blur-xl md:px-6">
            <button data-testid="mobile-menu-button" className="rounded-lg p-2 text-[#C8B8A6] hover:bg-[#261C15] lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="size-5" />
            </button>
            <div className="hidden items-center gap-2 md:flex">
              <Button data-testid="quick-new-sale" size="sm" onClick={() => navigate("/orders?new=1")}><Plus className="size-3.5" />Yeni Satış</Button>
              <Button data-testid="quick-new-roast" size="sm" variant="secondary" onClick={() => navigate("/roasting?new=1")}><Flame className="size-3.5" />Kavurma</Button>
              <Button data-testid="quick-new-expense" size="sm" variant="secondary" onClick={() => navigate("/expenses?new=1")}><Receipt className="size-3.5" />Gider</Button>
            </div>
            <Button data-testid="quick-new-sale-mobile" size="sm" className="md:hidden" onClick={() => navigate("/orders?new=1")}><Plus className="size-3.5" />Satış</Button>
            <div className="ml-auto flex items-center gap-2">
              <LowStockPill />
              <CurrencySwitcher />
              <button data-testid="logout-button" title="Çıkış Yap" onClick={() => void endSession("/login")} className="rounded-lg p-2 text-[#A89887] transition-colors hover:bg-[#261C15] hover:text-[#FCA5A5]">
                <LogOut className="size-4" />
              </button>
            </div>
          </header>
          <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </CurrencyProvider>
  );
}

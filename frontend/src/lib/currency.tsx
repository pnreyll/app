import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "./api";
import { fmtMoney } from "./format";
import type { Currency, Rates } from "./types";

interface CurrencyCtx {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: Rates;
  /** Format a TRY amount in the selected display currency. */
  money: (amountTry: number) => string;
}

const Ctx = createContext<CurrencyCtx | null>(null);
const DEFAULT_RATES: Rates = { USD: 41.5, EUR: 48.2 };

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCur] = useState<Currency>(() => (localStorage.getItem("cch-currency") as Currency) || "TRY");
  const q = useQuery({ queryKey: ["rates"], queryFn: () => apiGet<Rates>("/settings/rates") });
  const rates = q.data ?? DEFAULT_RATES;
  const value = useMemo<CurrencyCtx>(
    () => ({
      currency,
      setCurrency: (c) => {
        localStorage.setItem("cch-currency", c);
        setCur(c);
      },
      rates,
      money: (n) => fmtMoney(currency === "TRY" ? n : n / rates[currency], currency),
    }),
    [currency, rates],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMoney(): CurrencyCtx {
  const c = useContext(Ctx);
  if (!c) return { currency: "TRY", setCurrency: () => {}, rates: DEFAULT_RATES, money: (n) => fmtMoney(n) };
  return c;
}

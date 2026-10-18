import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errorMessage } from "@/lib/hooks";
import type { AdminUser } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/shared";

const HERO = "https://images.unsplash.com/photo-1447933601403-0c6688de566e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => apiPost<AdminUser>("/auth/login", { email, password }),
    onSuccess: () => {
      beginSession();
      navigate("/", { replace: true });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate();
  };

  return (
    <div className="grid min-h-screen bg-[#120D0A] lg:grid-cols-[1.15fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO} alt="Kavrulmuş kahve çekirdekleri" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(18,13,10,0.92) 0%, rgba(26,19,14,0.8) 60%, rgba(18,13,10,0.96) 100%)" }} />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="label-caps text-[#D99B56]">Est. Roastery · Café · İstanbul</div>
          <div className="max-w-lg">
            <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight text-[#FAF5EF]">
              Zamanı kavuran, <span className="italic text-[#E28743]">lezzeti</span> yöneten panel.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-[#C8B8A6]">
              Yeşil çekirdekten fincana; stok, kavurma, satış, cari ve kârlılık tek bir yerde.
            </p>
          </div>
          <div className="grid max-w-md grid-cols-3 gap-6 border-t border-[#3D2E24] pt-6">
            {[["ERP", "Stok & Üretim"], ["CRM", "Müşteri Portföyü"], ["Finans", "Ön Muhasebe"]].map(([a, b]) => (
              <div key={a}>
                <div className="font-heading text-2xl text-[#F3A261]">{a}</div>
                <div className="text-xs text-[#A89887]">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
          data-testid="login-form"
        >
          <div className="mb-10">
            <div className="mb-6 grid size-12 place-items-center rounded-full border border-[#543C2E] bg-[#2B1B13] font-heading text-xl text-[#F3A261]">C</div>
            <h2 className="text-3xl font-semibold text-[#F5EDE4]">Chrono Coffee House</h2>
            <p className="mt-2 text-sm text-[#A89887]">Yönetici paneline giriş yapın.</p>
          </div>
          <div className="space-y-4">
            <Field label="E-posta">
              <Input data-testid="login-email-input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@chronocoffee.com" className="h-11" />
            </Field>
            <Field label="Şifre">
              <Input data-testid="login-password-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11" />
            </Field>
            {login.isError && (
              <div data-testid="login-error" className="rounded-lg border border-[#5A1F1C] bg-[#361412] px-3 py-2 text-sm text-[#FCA5A5]">
                {errorMessage(login.error)}
              </div>
            )}
            <Button data-testid="login-submit-button" type="submit" disabled={login.isPending} className="h-11 w-full text-sm">
              {login.isPending && <Loader2 className="size-4 animate-spin" />}Giriş Yap
            </Button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}

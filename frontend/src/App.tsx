import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Materials from "@/pages/Materials";
import Roasting from "@/pages/Roasting";
import Sales from "@/pages/Sales";
import Expenses from "@/pages/Expenses";
import Accounts from "@/pages/Accounts";
import Cari from "@/pages/Cari";
import Reports from "@/pages/Reports";
import Crm from "@/pages/Crm";
import ContactDetail from "@/pages/ContactDetail";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/green-beans" element={<Materials key="green" kind="green_bean" />} />
          <Route path="/materials" element={<Materials key="mat" kind="material" />} />
          <Route path="/roasting" element={<Roasting />} />
          <Route path="/orders" element={<Sales />} />
          <Route path="/finance" element={<Accounts />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/cari" element={<Cari />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/crm" element={<Crm />} />
          <Route path="/crm/:id" element={<ContactDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster richColors position="bottom-right" />
    </>
  );
}

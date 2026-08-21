import { supabase } from "./client";
import type { Tx, Monthly, Debt, DebtPayment, Settings } from "../types";

function rowToTx(r: Record<string, unknown>): Tx {
  return {
    id: r.id as string,
    type: r.type as Tx["type"],
    amount: Number(r.amount),
    description: r.description as string,
    category: r.category as string,
    date: r.date as string,
    notes: (r.notes as string) ?? undefined,
    currency: r.currency as string,
    createdAt: r.created_at as string,
    myShare: r.my_share != null ? Number(r.my_share) : undefined,
    payment: (r.payment as Tx["payment"]) ?? undefined,
    card: (r.card as string) ?? undefined,
  };
}

function rowToMonthly(r: Record<string, unknown>): Monthly {
  return {
    id: r.id as string,
    scope: r.scope as Monthly["scope"],
    name: r.name as string,
    amount: Number(r.amount),
    currency: r.currency as string,
    dueDay: r.due_day as number,
    category: r.category as string,
    notes: (r.notes as string) ?? undefined,
    active: r.active as boolean,
    createdAt: r.created_at as string,
  };
}

function rowToDebtPayment(r: Record<string, unknown>): DebtPayment {
  return {
    id: r.id as string,
    date: r.date as string,
    amount: Number(r.amount),
    note: (r.note as string) ?? undefined,
  };
}

function rowToDebt(r: Record<string, unknown>, payments: DebtPayment[]): Debt {
  return {
    id: r.id as string,
    personBank: r.person_bank as string,
    totalAmount: Number(r.total_amount),
    currency: r.currency as string,
    description: r.description as string,
    dueDate: (r.due_date as string) ?? undefined,
    notes: (r.notes as string) ?? undefined,
    payments,
    createdAt: r.created_at as string,
  };
}

export async function fetchAll(userId: string) {
  const [txRes, monRes, debtRes, payRes, setRes] = await Promise.all([
    supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("monthly_expenses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("debts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("debt_payments").select("*").eq("user_id", userId),
    supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (txRes.error) throw txRes.error;
  if (monRes.error) throw monRes.error;
  if (debtRes.error) throw debtRes.error;
  if (payRes.error) throw payRes.error;
  if (setRes.error) throw setRes.error;

  const paymentsByDebt = new Map<string, DebtPayment[]>();
  for (const row of payRes.data ?? []) {
    const debtId = row.debt_id as string;
    const list = paymentsByDebt.get(debtId) ?? [];
    list.push(rowToDebtPayment(row));
    paymentsByDebt.set(debtId, list);
  }

  const debts: Debt[] = (debtRes.data ?? []).map((r) =>
    rowToDebt(r, (paymentsByDebt.get(r.id as string) ?? []).sort((a, b) => a.date.localeCompare(b.date)))
  );

  const settings: Settings = setRes.data
    ? { currency: setRes.data.currency as string, name: setRes.data.name as string }
    : { currency: "USD", name: "" };

  return {
    txs: (txRes.data ?? []).map(rowToTx),
    monthly: (monRes.data ?? []).map(rowToMonthly),
    debts,
    settings,
  };
}

export async function insertTx(userId: string, t: Omit<Tx, "id" | "createdAt">): Promise<Tx> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: t.type,
      amount: t.amount,
      description: t.description,
      category: t.category,
      date: t.date,
      notes: t.notes ?? null,
      currency: t.currency,
      my_share: t.myShare ?? null,
      payment: t.payment ?? null,
      card: t.card ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTx(data);
}

export async function deleteTx(id: string) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function insertMonthly(userId: string, m: Omit<Monthly, "id" | "createdAt">): Promise<Monthly> {
  const { data, error } = await supabase
    .from("monthly_expenses")
    .insert({
      user_id: userId,
      scope: m.scope,
      name: m.name,
      amount: m.amount,
      currency: m.currency,
      due_day: m.dueDay,
      category: m.category,
      notes: m.notes ?? null,
      active: m.active,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToMonthly(data);
}

export async function deleteMonthly(id: string) {
  const { error } = await supabase.from("monthly_expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function setMonthlyActive(id: string, active: boolean) {
  const { error } = await supabase.from("monthly_expenses").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function insertDebt(userId: string, d: Omit<Debt, "id" | "createdAt" | "payments">): Promise<Debt> {
  const { data, error } = await supabase
    .from("debts")
    .insert({
      user_id: userId,
      person_bank: d.personBank,
      total_amount: d.totalAmount,
      currency: d.currency,
      description: d.description,
      due_date: d.dueDate ?? null,
      notes: d.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToDebt(data, []);
}

export async function deleteDebt(id: string) {
  const { error } = await supabase.from("debts").delete().eq("id", id);
  if (error) throw error;
}

export async function setDebtTotal(id: string, totalAmount: number) {
  const { error } = await supabase.from("debts").update({ total_amount: totalAmount }).eq("id", id);
  if (error) throw error;
}

export async function insertDebtPayment(userId: string, debtId: string, amount: number, note: string, date: string): Promise<DebtPayment> {
  const { data, error } = await supabase
    .from("debt_payments")
    .insert({ user_id: userId, debt_id: debtId, date, amount, note: note || null })
    .select()
    .single();
  if (error) throw error;
  return rowToDebtPayment(data);
}

export async function upsertSettings(userId: string, s: Settings) {
  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: userId, currency: s.currency, name: s.name }, { onConflict: "user_id" });
  if (error) throw error;
}

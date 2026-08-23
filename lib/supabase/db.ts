import { supabase } from "./client";
import type { Tx, Monthly, Debt, DebtPayment, Settings, Account } from "../types";

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
    accountId: (r.account_id as string) ?? undefined,
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
    accountId: (r.account_id as string) ?? undefined,
  };
}

function rowToAccount(r: Record<string, unknown>): Account {
  return {
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as Account["kind"],
    creditLimit: r.credit_limit != null ? Number(r.credit_limit) : undefined,
    balance: r.balance != null ? Number(r.balance) : undefined,
    currency: r.currency as string,
    createdAt: r.created_at as string,
    sortOrder: r.sort_order != null ? Number(r.sort_order) : undefined,
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

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

export async function fetchAll(userId: string) {
  const [txRes, monRes, debtRes, payRes, setRes, acctRes] = await withRetry(() =>
    Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("monthly_expenses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("debts").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("debt_payments").select("*").eq("user_id", userId),
      supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("accounts").select("*").eq("user_id", userId).order("sort_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
    ]).then((results) => {
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      return results;
    })
  );
  if (txRes.error) throw txRes.error;
  if (monRes.error) throw monRes.error;
  if (debtRes.error) throw debtRes.error;
  if (payRes.error) throw payRes.error;
  if (setRes.error) throw setRes.error;
  if (acctRes.error) throw acctRes.error;

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
    ? { currency: setRes.data.currency as string, name: setRes.data.name as string, savings: Number(setRes.data.savings ?? 0), username: (setRes.data.username as string) ?? undefined, companyCategories: (setRes.data.company_categories as string[]) ?? [], usdTryRate: setRes.data.usd_try_rate != null ? Number(setRes.data.usd_try_rate) : undefined, usdLbpRate: setRes.data.usd_lbp_rate != null ? Number(setRes.data.usd_lbp_rate) : undefined }
    : { currency: "USD", name: "", savings: 0, companyCategories: [] };

  return {
    txs: (txRes.data ?? []).map(rowToTx),
    monthly: (monRes.data ?? []).map(rowToMonthly),
    debts,
    settings,
    accounts: (acctRes.data ?? []).map(rowToAccount),
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
      account_id: t.accountId ?? null,
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

export async function updateTx(id: string, t: Omit<Tx, "id" | "createdAt">): Promise<Tx> {
  const { data, error } = await supabase
    .from("transactions")
    .update({
      type: t.type,
      amount: t.amount,
      description: t.description,
      category: t.category,
      date: t.date,
      notes: t.notes ?? null,
      currency: t.currency,
      my_share: t.myShare ?? null,
      account_id: t.accountId ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToTx(data);
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
      account_id: m.accountId ?? null,
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

export async function updateMonthly(id: string, m: Omit<Monthly, "id" | "createdAt">): Promise<Monthly> {
  const { data, error } = await supabase
    .from("monthly_expenses")
    .update({
      scope: m.scope,
      name: m.name,
      amount: m.amount,
      currency: m.currency,
      due_day: m.dueDay,
      category: m.category,
      notes: m.notes ?? null,
      active: m.active,
      account_id: m.accountId ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToMonthly(data);
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

export async function updateDebt(id: string, d: Omit<Debt, "id" | "createdAt" | "payments">): Promise<void> {
  const { error } = await supabase
    .from("debts")
    .update({
      person_bank: d.personBank,
      total_amount: d.totalAmount,
      currency: d.currency,
      description: d.description,
      due_date: d.dueDate ?? null,
      notes: d.notes ?? null,
    })
    .eq("id", id);
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
    .upsert({ user_id: userId, currency: s.currency, name: s.name, savings: s.savings, username: s.username || null, company_categories: s.companyCategories, usd_try_rate: s.usdTryRate ?? null, usd_lbp_rate: s.usdLbpRate ?? null }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function resolveUsernameEmail(username: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_username_email", { p_username: username });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function insertAccount(userId: string, a: Omit<Account, "id" | "createdAt">): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name: a.name, kind: a.kind, credit_limit: a.creditLimit ?? null, balance: a.balance ?? null, currency: a.currency })
    .select()
    .single();
  if (error) throw error;
  return rowToAccount(data);
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function updateAccount(id: string, a: Omit<Account, "id" | "createdAt">): Promise<Account> {
  const { data, error } = await supabase
    .from("accounts")
    .update({ name: a.name, kind: a.kind, credit_limit: a.creditLimit ?? null, balance: a.balance ?? null, currency: a.currency })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToAccount(data);
}

export async function setAccountBalance(id: string, balance: number) {
  const { error } = await supabase.from("accounts").update({ balance }).eq("id", id);
  if (error) throw error;
}

export async function reorderAccounts(orderedIds: string[]) {
  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from("accounts").update({ sort_order: i }).eq("id", id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

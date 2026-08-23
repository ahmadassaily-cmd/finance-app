import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const EXTRACTION_PROMPT = `You are reading a bank receipt, a screenshot of a banking app's transaction list, an ATM deposit/withdrawal confirmation, or a screenshot of a crypto exchange. Extract EVERY distinct transaction visible — both money going OUT (expenses, purchases, withdrawals, transfers sent) and money coming IN (deposits, transfers received, ATM deposits, income).

If a transfer, withdrawal, or transaction shows a separate commission/fee line (e.g. "MASRAF", "KOMİSYON", "KOMİSYON TOPLAMI", "BSMV", "ücret", "fee", "commission"), include that fee as its OWN separate "out" entry — do not fold it into the main transaction's amount and do not drop it.

For each transaction (and each fee/commission line) found, return an object with:
- "date": the transaction date as YYYY-MM-DD (the calendar year may not be printed — if missing, infer the most recent plausible year)
- "description": a short label (merchant name, counterparty, or the transaction type if neither is shown; for a fee line use something like "Transfer Commission")
- "amount": a positive number (no currency symbol, no thousands separators, decimal point not comma)
- "currency": a 3-letter code inferred from context (TL/TRY = TRY, LBP = LBP, $ or USDT = USD, EUR, etc.)
- "direction": "out" if money left the account (spent, sent, withdrawn, fee), "in" if money entered it (received, deposited, income)

Respond with ONLY a raw JSON array of these objects, nothing else — no markdown code fences, no explanation. If there are no transactions in the file, respond with [].`;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  if (userErr || !userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Import isn't configured yet (missing ANTHROPIC_API_KEY)." }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");
  const mediaType = file.type || "application/octet-stream";
  const isPdf = mediaType === "application/pdf";

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 2048,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: EXTRACTION_PROMPT }] }],
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: "Couldn't reach the AI service", detail: String(err) }, { status: 502 });
  }

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text();
    return NextResponse.json({ error: "AI extraction failed", detail }, { status: 502 });
  }

  const data = await anthropicRes.json();
  const text: string = data?.content?.[0]?.text ?? "[]";
  let transactions: unknown;
  try {
    transactions = JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    try {
      transactions = match ? JSON.parse(match[0]) : [];
    } catch {
      transactions = [];
    }
  }
  if (!Array.isArray(transactions)) transactions = [];

  return NextResponse.json({ transactions });
}

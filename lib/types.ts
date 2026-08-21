export type TxType = "company_in" | "company_out" | "personal_in" | "personal_out";
export interface Tx { id:string; type:TxType; amount:number; description:string; category:string; date:string; notes?:string; currency:string; createdAt:string; myShare?:number; payment?:"cash"|"debit"|"credit"; card?:string; }
export interface Monthly { id:string; scope:"personal"|"company"; name:string; amount:number; currency:string; dueDay:number; category:string; notes?:string; active:boolean; createdAt:string; }
export interface DebtPayment { id:string; date:string; amount:number; note?:string; }
export interface Debt { id:string; personBank:string; totalAmount:number; currency:string; description:string; dueDate?:string; notes?:string; payments:DebtPayment[]; createdAt:string; }
export interface Settings { currency:string; name:string; }

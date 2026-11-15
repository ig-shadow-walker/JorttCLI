import type { Endpoint } from "./catalog-types.ts";

/** Endpoints whose effect reaches outside the administration or is hard to undo. */
const RISKY: Record<string, string> = {
  "send-invoice-v3": "Sends the invoice to the customer (email or Peppol). It can't be unsent, and a sent invoice is final.",
  "send-estimate-v3": "Sends the estimate to the customer by email. It can't be unsent.",
  "send-direct-debit-authorization-to-a-customer": "Emails the customer a direct debit authorization request.",
  "creates-and-optionally-sends-a-credit-invoice": "Creates a credit invoice against this invoice (a draft unless send_method is given).",
  "accept-estimate-v2": "Marks the estimate as accepted by the customer.",
  "reject-estimate-v2": "Marks the estimate as rejected by the customer.",
  "invoice-project": "Creates an invoice from these project line items.",
  "create-invoice-from-estimate-v2": "Creates an invoice from this estimate.",
  "register-payment-v3": "Books a payment in the administration.",
  "deregister-payment-v3": "Removes a booked payment from the administration.",
  "create-a-loonjournaalpost": "Changes payroll bookings.",
  "update-a-loonjournaalpost": "Changes payroll bookings.",
  "delete-a-loonjournaalpost": "Deletes a payroll booking.",
};

export function riskReasons(endpoint: Endpoint | undefined, method: string, body: unknown): string[] {
  const reasons: string[] = [];
  if (endpoint && RISKY[endpoint.id]) reasons.push(RISKY[endpoint.id]!);
  if (method.toUpperCase() === "DELETE") reasons.push("Deletes this in Jortt. This can't be undone.");
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.send_method && !endpoint?.id.startsWith("send-")) {
    reasons.push(`Also sends it to the customer right away (send_method=${String(b.send_method)}).`);
  }
  if (endpoint?.id === "delete-an-expense") reasons.push("Deleting an expense removes it from the books.");
  return [...new Set(reasons)];
}

import { BaseModule } from "./base-module.ts";
import {
  formatTimestamp,
  amountWithCurrency,
} from "../output/table.ts";

/**
 * Payment Intents module.
 *
 * Stripe API: /v1/payment_intents
 * Searchable: yes
 * ID prefix: pi_
 */
export const paymentIntentsModule = new BaseModule({
  name: "payment-intents",
  apiPath: "/payment_intents",
  alias: "pi",
  idPrefix: "pi_",
  searchable: true,
  listParams: ["customer"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    {
      header: "Amount",
      key: "amount",
      align: "right",
      transform: amountWithCurrency("amount", "currency"),
    },
    { header: "Status", key: "status", maxWidth: 20 },
    { header: "Customer", key: "customer", maxWidth: 22 },
    { header: "Description", key: "description", maxWidth: 30 },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

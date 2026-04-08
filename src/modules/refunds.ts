import { BaseModule } from "./base-module.ts";
import {
  formatTimestamp,
  amountWithCurrency,
} from "../output/table.ts";

/**
 * Refunds module.
 *
 * Stripe API: /v1/refunds
 * Searchable: no
 * ID prefix: re_
 */
export const refundsModule = new BaseModule({
  name: "refunds",
  apiPath: "/refunds",
  alias: "ref",
  idPrefix: "re_",
  searchable: false,
  listParams: ["charge", "payment_intent"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    {
      header: "Amount",
      key: "amount",
      align: "right",
      transform: amountWithCurrency("amount", "currency"),
    },
    { header: "Status", key: "status", maxWidth: 12 },
    { header: "Reason", key: "reason", maxWidth: 22 },
    { header: "Charge", key: "charge", maxWidth: 22 },
    { header: "Payment Intent", key: "payment_intent", maxWidth: 22 },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

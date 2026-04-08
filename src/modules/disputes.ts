import { BaseModule } from "./base-module.ts";
import {
  formatTimestamp,
  amountWithCurrency,
} from "../output/table.ts";

/**
 * Disputes module.
 *
 * Stripe API: /v1/disputes
 * Searchable: no
 * ID prefix: dp_
 */
export const disputesModule = new BaseModule({
  name: "disputes",
  apiPath: "/disputes",
  alias: "dis",
  idPrefix: "dp_",
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
    { header: "Status", key: "status", maxWidth: 20 },
    { header: "Reason", key: "reason", maxWidth: 25 },
    { header: "Charge", key: "charge", maxWidth: 22 },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

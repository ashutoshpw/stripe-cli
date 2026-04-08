import { BaseModule } from "./base-module.ts";
import {
  formatTimestamp,
  amountWithCurrency,
  formatBoolean,
} from "../output/table.ts";

/**
 * Charges module.
 *
 * Stripe API: /v1/charges
 * Searchable: yes
 * ID prefix: ch_
 */
export const chargesModule = new BaseModule({
  name: "charges",
  apiPath: "/charges",
  alias: "ch",
  idPrefix: "ch_",
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
    { header: "Status", key: "status", maxWidth: 12 },
    { header: "Paid", key: "paid", transform: formatBoolean },
    { header: "Customer", key: "customer", maxWidth: 22 },
    { header: "Description", key: "description", maxWidth: 30 },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

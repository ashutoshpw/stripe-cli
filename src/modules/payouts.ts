import { BaseModule } from "./base-module.ts";
import {
  formatTimestamp,
  amountWithCurrency,
} from "../output/table.ts";

/**
 * Payouts module.
 *
 * Stripe API: /v1/payouts
 * Searchable: no
 * ID prefix: po_
 */
export const payoutsModule = new BaseModule({
  name: "payouts",
  apiPath: "/payouts",
  alias: "po",
  idPrefix: "po_",
  searchable: false,
  listParams: ["status", "arrival_date"],
  listParamHints: {
    status: ["paid", "pending", "in_transit", "canceled", "failed"],
  },
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    {
      header: "Amount",
      key: "amount",
      align: "right",
      transform: amountWithCurrency("amount", "currency"),
    },
    { header: "Status", key: "status", maxWidth: 12 },
    { header: "Type", key: "type", maxWidth: 12 },
    { header: "Method", key: "method", maxWidth: 12 },
    { header: "Description", key: "description", maxWidth: 25 },
    {
      header: "Arrival",
      key: "arrival_date",
      transform: formatTimestamp,
    },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

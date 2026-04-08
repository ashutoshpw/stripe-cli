import { BaseModule } from "./base-module.ts";
import {
  formatTimestamp,
  amountWithCurrency,
  formatBoolean,
} from "../output/table.ts";

/**
 * Invoices module.
 *
 * Stripe API: /v1/invoices
 * Searchable: yes
 * ID prefix: in_
 */
export const invoicesModule = new BaseModule({
  name: "invoices",
  apiPath: "/invoices",
  alias: "inv",
  idPrefix: "in_",
  searchable: true,
  listParams: ["customer", "status", "subscription", "collection_method"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    { header: "Number", key: "number", maxWidth: 18 },
    {
      header: "Amount Due",
      key: "amount_due",
      align: "right",
      transform: amountWithCurrency("amount_due", "currency"),
    },
    {
      header: "Amount Paid",
      key: "amount_paid",
      align: "right",
      transform: amountWithCurrency("amount_paid", "currency"),
    },
    { header: "Status", key: "status", maxWidth: 14 },
    { header: "Paid", key: "paid", transform: formatBoolean },
    { header: "Customer", key: "customer", maxWidth: 22 },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

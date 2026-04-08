import { BaseModule } from "./base-module.ts";
import {
  formatTimestamp,
  amountWithCurrency,
} from "../output/table.ts";

/**
 * Customers module.
 *
 * Stripe API: /v1/customers
 * Searchable: yes
 * ID prefix: cus_
 */
export const customersModule = new BaseModule({
  name: "customers",
  apiPath: "/customers",
  alias: "cust",
  idPrefix: "cus_",
  searchable: true,
  listParams: ["email"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    { header: "Email", key: "email", maxWidth: 30 },
    { header: "Name", key: "name", maxWidth: 25 },
    {
      header: "Balance",
      key: "balance",
      align: "right",
      transform: amountWithCurrency("balance", "currency"),
    },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

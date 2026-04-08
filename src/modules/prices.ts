import { BaseModule } from "./base-module.ts";
import {
  formatTimestamp,
  formatBoolean,
  formatAmount,
} from "../output/table.ts";

/**
 * Prices module.
 *
 * Stripe API: /v1/prices
 * Searchable: yes
 * ID prefix: price_
 */
export const pricesModule = new BaseModule({
  name: "prices",
  apiPath: "/prices",
  alias: "pr",
  idPrefix: "price_",
  searchable: true,
  listParams: ["product", "active", "type", "currency"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    {
      header: "Unit Amount",
      key: "unit_amount",
      align: "right",
      transform: (val: unknown, row?: Record<string, unknown>) =>
        formatAmount(val, row?.currency),
    },
    { header: "Currency", key: "currency", maxWidth: 6 },
    { header: "Type", key: "type", maxWidth: 12 },
    { header: "Active", key: "active", transform: formatBoolean },
    { header: "Product", key: "product", maxWidth: 22 },
    { header: "Nickname", key: "nickname", maxWidth: 20 },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

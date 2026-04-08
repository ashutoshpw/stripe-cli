import { BaseModule } from "./base-module.ts";
import { formatTimestamp } from "../output/table.ts";

/**
 * Subscriptions module.
 *
 * Stripe API: /v1/subscriptions
 * Searchable: yes
 * ID prefix: sub_
 */
export const subscriptionsModule = new BaseModule({
  name: "subscriptions",
  apiPath: "/subscriptions",
  alias: "sub",
  idPrefix: "sub_",
  searchable: true,
  listParams: ["customer", "price", "status", "collection_method"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    { header: "Status", key: "status", maxWidth: 16 },
    { header: "Customer", key: "customer", maxWidth: 22 },
    { header: "Collection", key: "collection_method", maxWidth: 18 },
    {
      header: "Current Period Start",
      key: "current_period_start",
      transform: formatTimestamp,
    },
    {
      header: "Current Period End",
      key: "current_period_end",
      transform: formatTimestamp,
    },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

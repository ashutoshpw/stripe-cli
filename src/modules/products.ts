import { BaseModule } from "./base-module.ts";
import { formatTimestamp, formatBoolean } from "../output/table.ts";

/**
 * Products module.
 *
 * Stripe API: /v1/products
 * Searchable: yes
 * ID prefix: prod_
 */
export const productsModule = new BaseModule({
  name: "products",
  apiPath: "/products",
  alias: "prod",
  idPrefix: "prod_",
  searchable: true,
  listParams: ["active"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    { header: "Name", key: "name", maxWidth: 30 },
    { header: "Active", key: "active", transform: formatBoolean },
    { header: "Type", key: "type", maxWidth: 12 },
    { header: "Description", key: "description", maxWidth: 35 },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

import { BaseModule } from "./base-module.ts";
import { formatTimestamp } from "../output/table.ts";

/**
 * Payment Methods module.
 *
 * Stripe API: /v1/payment_methods
 * Searchable: no
 * ID prefix: pm_
 *
 * Note: Listing payment methods REQUIRES a `customer` parameter.
 */
export const paymentMethodsModule = new BaseModule({
  name: "payment-methods",
  apiPath: "/payment_methods",
  alias: "pm",
  idPrefix: "pm_",
  searchable: false,
  listParams: ["customer", "type"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    { header: "Type", key: "type", maxWidth: 16 },
    { header: "Customer", key: "customer", maxWidth: 22 },
    {
      header: "Card Brand",
      key: "card",
      maxWidth: 12,
      transform: (val: unknown) => {
        if (val && typeof val === "object" && "brand" in (val as Record<string, unknown>)) {
          return String((val as Record<string, unknown>).brand ?? "");
        }
        return "";
      },
    },
    {
      header: "Last 4",
      key: "card",
      maxWidth: 6,
      transform: (val: unknown) => {
        if (val && typeof val === "object" && "last4" in (val as Record<string, unknown>)) {
          return String((val as Record<string, unknown>).last4 ?? "");
        }
        return "";
      },
    },
    { header: "Created", key: "created", transform: formatTimestamp },
  ],
});

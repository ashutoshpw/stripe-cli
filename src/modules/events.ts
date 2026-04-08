import { BaseModule } from "./base-module.ts";
import { formatTimestamp } from "../output/table.ts";

/**
 * Events module.
 *
 * Stripe API: /v1/events
 * Searchable: no
 * ID prefix: evt_
 */
export const eventsModule = new BaseModule({
  name: "events",
  apiPath: "/events",
  alias: "ev",
  idPrefix: "evt_",
  searchable: false,
  listParams: ["type"],
  columns: [
    { header: "ID", key: "id", minWidth: 22 },
    { header: "Type", key: "type", maxWidth: 40 },
    { header: "Created", key: "created", transform: formatTimestamp },
    { header: "Livemode", key: "livemode", transform: (v: unknown) => v ? "live" : "test" },
    {
      header: "Request ID",
      key: "request",
      maxWidth: 22,
      transform: (val: unknown) => {
        if (val && typeof val === "object" && "id" in (val as Record<string, unknown>)) {
          return String((val as Record<string, unknown>).id ?? "");
        }
        return "";
      },
    },
  ],
});

import type { FulfillmentProvider, MessagingProvider } from "./types";
import { LogzzProvider } from "./logzz/logzz.provider";
import { WhatsAppProvider } from "./whatsapp/whatsapp.provider";

/**
 * Integration registry.
 *
 * A single access point that hands out provider instances. Today it returns the
 * placeholder providers; when real implementations (or alternative vendors)
 * arrive, only this file changes — callers depend on the interfaces, not the
 * concrete classes.
 */
export const integrations = {
  messaging(): MessagingProvider {
    return new WhatsAppProvider();
  },
  fulfillment(): FulfillmentProvider {
    return new LogzzProvider();
  },
};

export * from "./types";

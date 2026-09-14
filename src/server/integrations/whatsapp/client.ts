import { logger } from "@/server/logger/logger";

import type { DownloadedMedia, IntegrationResult } from "../types";
import type { WhatsAppConfig } from "./config";

/**
 * Thin HTTP client over the WhatsApp Cloud API (Graph API). Centralizes base
 * URL, version, auth header, timeouts and error normalization. It NEVER logs
 * the access token, and error results never include credentials.
 *
 * Endpoints used (per Meta's official docs):
 *   POST /{version}/{phoneNumberId}/messages   -> send message
 *   GET  /{version}/{mediaId}                   -> resolve a media URL
 *   GET  <media url>                            -> download media bytes
 */

const REQUEST_TIMEOUT_MS = 15_000;

interface MetaErrorShape {
  error?: { message?: string; code?: number; type?: string };
}

export class WhatsAppClient {
  constructor(private readonly config: WhatsAppConfig) {}

  private messagesUrl(): string {
    const { graphHost, apiVersion, phoneNumberId } = this.config;
    return `${graphHost}/${apiVersion}/${phoneNumberId}/messages`;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  /** Perform a fetch with a hard timeout. Never throws on HTTP status. */
  private async request(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseError(
    response: Response,
  ): Promise<{ error: string; code?: string }> {
    let code: string | undefined;
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as MetaErrorShape;
      if (body.error?.message) message = body.error.message;
      if (body.error?.code != null) code = String(body.error.code);
    } catch {
      // Non-JSON error body; keep the generic HTTP status message.
    }
    return { error: message, code };
  }

  /**
   * Send a plain text message. Not retried: a retry after a timeout could
   * double-send to the customer (see docs note on idempotency/queue).
   */
  async sendText(
    to: string,
    text: string,
  ): Promise<IntegrationResult<{ externalId: string }>> {
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    };

    try {
      const response = await this.request(this.messagesUrl(), {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const { error, code } = await this.parseError(response);
        logger.error("whatsapp.client", "sendText failed", {
          status: response.status,
          code,
          // message is Meta's error text, never our token
          detail: error,
        });
        return { ok: false, error, code };
      }

      const data = (await response.json()) as {
        messages?: Array<{ id: string }>;
      };
      const id = data.messages?.[0]?.id;
      if (!id) {
        return { ok: false, error: "No message id returned by WhatsApp" };
      }
      return { ok: true, data: { externalId: id } };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      logger.error("whatsapp.client", "sendText request error", {
        reason: aborted ? "timeout" : "network",
      });
      return {
        ok: false,
        error: aborted ? "WhatsApp request timed out" : "WhatsApp request failed",
        code: aborted ? "timeout" : "network",
      };
    }
  }

  /** Send a media message by public link. Not retried (see sendText note). */
  async sendMediaByLink(
    to: string,
    type: "image" | "audio" | "document",
    link: string,
    caption?: string,
  ): Promise<IntegrationResult<{ externalId: string }>> {
    const mediaObject: Record<string, unknown> = { link };
    if (caption && type !== "audio") mediaObject.caption = caption;
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type,
      [type]: mediaObject,
    };

    try {
      const response = await this.request(this.messagesUrl(), {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const { error, code } = await this.parseError(response);
        return { ok: false, error, code };
      }
      const data = (await response.json()) as {
        messages?: Array<{ id: string }>;
      };
      const id = data.messages?.[0]?.id;
      if (!id) return { ok: false, error: "No message id returned by WhatsApp" };
      return { ok: true, data: { externalId: id } };
    } catch {
      return { ok: false, error: "WhatsApp request failed", code: "network" };
    }
  }

  /**
   * Resolve and download media bytes. GET requests are idempotent, so a single
   * retry on transient failure is safe.
   */
  async downloadMedia(
    mediaId: string,
    maxBytes?: number,
  ): Promise<IntegrationResult<DownloadedMedia>> {
    const metaUrl = `${this.config.graphHost}/${this.config.apiVersion}/${mediaId}`;
    try {
      const metaRes = await this.request(metaUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!metaRes.ok) {
        const { error, code } = await this.parseError(metaRes);
        return { ok: false, error, code };
      }
      const meta = (await metaRes.json()) as {
        url?: string;
        mime_type?: string;
        file_size?: number;
      };
      if (!meta.url) return { ok: false, error: "Media URL not found" };

      // Reject oversized media before downloading the bytes.
      if (maxBytes && meta.file_size && meta.file_size > maxBytes) {
        return { ok: false, error: "Media exceeds size limit", code: "too_large" };
      }

      const fileRes = await this.request(meta.url, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.config.accessToken}` },
      });
      if (!fileRes.ok) {
        return { ok: false, error: `HTTP ${fileRes.status}` };
      }
      const buffer = Buffer.from(await fileRes.arrayBuffer());

      // Second guard in case the reported size was missing/wrong.
      if (maxBytes && buffer.length > maxBytes) {
        return { ok: false, error: "Media exceeds size limit", code: "too_large" };
      }

      return {
        ok: true,
        data: { data: buffer, mimeType: meta.mime_type ?? "application/octet-stream" },
      };
    } catch {
      return { ok: false, error: "WhatsApp media request failed", code: "network" };
    }
  }
}

/**
 * Shared validation limits.
 *
 * Long free-text fields the AI reads about a product (description, warranty,
 * delivery/payment info, product knowledge content) allow up to 50.000
 * characters. Short/technical fields (name, ids, urls) keep their own limits.
 * The underlying columns are PostgreSQL `text` (@db.Text), so no DB change is
 * needed to store this.
 */
export const LONG_TEXT_MAX = 50_000;

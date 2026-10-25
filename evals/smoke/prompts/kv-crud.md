Build a Cloudflare Worker that exposes a small JSON key/value API backed by **Workers KV**.

Each entry is stored under a string key and holds an arbitrary JSON value.

Endpoints:

- `PUT /kv/:key` with body `{ "value": <any JSON value> }` → `200` with `{ "key": string, "value": <the stored value> }`, persisting the value. The value round-trips (an object stays an object, an array stays an array on read).
- `GET /kv/:key` → `200` with `{ key, value }` if the key exists, or `404` if it does not.
- `GET /kv` → `200` with a JSON array of the currently-stored keys `["a", "b", ...]` (any order; `[]` when empty).
- `DELETE /kv/:key` → `204` with an empty body if the key existed, or `404` if it did not.

Requirements:

- Use the KV binding named `KV`. Do not create the namespace — it already exists and starts empty.
- All responses are JSON (except `204`, which has an empty body). Set appropriate status codes.
- A malformed/invalid request body on `PUT` (unparseable JSON, or no `value` field) must return `400`, never a `500`.
- Any other path or method → `404`.
- Your entry point must be `src/index.ts` exporting a default `fetch` handler.

The automated tests will make HTTP requests to these endpoints and assert on status codes and bodies.

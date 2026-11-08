# A2A endpoint

Exposes Skillit's internal agents to outside agents over the [A2A protocol v1.0](https://a2a-protocol.org/latest/specification/) (JSON-RPC binding). `a2aRouter(makeDirectory)` serves:

- `GET /.well-known/agent-card.json` — public card; one A2A skill per internal skill, tagged with its agent.
- `POST /a2a` — signed in with the same `Authorization: Bearer` token as `/api/*`; the user is always the session's, never the body's. Send `A2A-Version: 1.0`.

Methods: `SendMessage` (runs one skill, at most once per user per 10 s), `GetTask`, `CancelTask` (always not-cancelable: runs finish inside `SendMessage`). Streaming, push notifications and the extended card answer with their A2A "unsupported" errors. A skill is chosen only by the message's data part `{ skillId, input }`; text parts are ignored.

```http
POST /a2a
Authorization: Bearer <token>
A2A-Version: 1.0

{"jsonrpc":"2.0","id":1,"method":"SendMessage","params":{"message":{"messageId":"m1","role":"ROLE_USER",
 "parts":[{"data":{"skillId":"research-company","input":{"company":"acme"}},"mediaType":"application/json"}]}}}
```

```json
{"jsonrpc":"2.0","id":1,"result":{"task":{"id":"run-1","contextId":"run-1","status":{"state":"TASK_STATE_COMPLETED"},
 "artifacts":[{"artifactId":"output","name":"output","parts":[{"data":{"...":"..."},"mediaType":"application/json"}]}]}}}
```

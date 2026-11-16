# Public launch

LUNA AI currently has a verified local full-stack implementation. A public deployment needs a hosting environment, production database configuration, account recovery, operational controls and privacy review.

## Deployment topology

Use one HTTPS origin for the static Vite build and FastAPI routes under `/api/`. A reverse proxy routes the API to a private process and serves the compiled frontend. Keep PostgreSQL on a private network. This design uses self-hosted fonts and avoids third-party trackers.

1. Build with `npm ci && npm run build`. Copy `dist/` into the proxy's static root.
2. Set `LUNA_MODE=production`, `LUNA_ORIGIN=https://your-domain.example`, `LUNA_DATABASE_URL` and `LUNA_RATE_SECRET` using the host's secret store. Generate the rate secret using `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Keep it stable across API replicas. Prefer a database connection with TLS and certificate verification in production.
3. Install `backend/requirements.txt`. Run `python -m luna.db` from `backend/` as a database role with schema-migration privileges. Run the application as a separate role limited to application tables and sequences.
4. Start FastAPI on a private listener. If the reverse proxy shares the host, run from `backend/` with `python -m uvicorn luna.main:app --host 127.0.0.1 --port 8000 --no-access-log --proxy-headers --forwarded-allow-ips 127.0.0.1`. Only trust forwarded addresses from the actual proxy.
5. Route `/api/*` to FastAPI while preserving the public `Host` and `Origin`. Everything else serves `dist/`. Check `/api/health` and exercise the full flow with a synthetic staging account.

Example Caddy configuration for a same-host API:

```caddyfile
your-domain.example {
    encode zstd gzip
    header {
        Strict-Transport-Security "max-age=31536000"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "no-referrer"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
    handle /api/* {
        request_body {
            max_size 16KB
        }
        reverse_proxy 127.0.0.1:8000
    }
    handle {
        header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
        root * /srv/luna/dist
        file_server
    }
}
```

## Implemented protections

- Passwords use Argon2id. Opaque session tokens live in HttpOnly, SameSite=Strict cookies and are stored only as hashes in PostgreSQL. Production cookies are also Secure and use the `__Host-` prefix. Sessions expire after eight hours and sign-out revokes the current token.
- Exact-origin checks cover all browser writes. The API accepts the configured host and sends `Cache-Control: no-store`. It suppresses submitted values in validation messages.
- Login, registration and deletion confirmation have database-backed IP and identity limits. The rate limiter stores keyed digests in place of raw email and address values.
- Queries are parameterized and scoped to the authenticated account. Account deletion cascades to periods, check-ins and sessions in the active database. Public launch requires a backup retention policy that explains when deleted records age out of encrypted backups.

## Work before accepting public users

- Add email verification, secure password reset and account recovery. Test abuse cases including registration enumeration, throttling abuse and service outages.
- Set up encryption at rest, key management, least-privilege credentials, access reviews, backup restoration tests and a deletion policy for restored data. Avoid logging bodies, cookies or sensitive URL fields. Establish retention, consent and privacy notices appropriate to launch jurisdictions.
- Schedule bounded cleanup of expired `sessions` and `auth_limits` rows. Add reverse-proxy rate limits, connection pooling where appropriate, monitoring and load testing for the chosen infrastructure.
- Verify production proxy headers, Secure cookie transport, retention and operational controls in staging. Run dependency review, independent security review and accessibility testing before launch.

Security design reference: [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

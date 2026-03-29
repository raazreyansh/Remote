# SmartTable OS Operations Notes

## Health endpoints

- `GET /api/health`
- `GET /api/health/ready`

Use `/api/health/ready` for load balancer and container readiness checks because it verifies database reachability.

## Multi-tenant scaling

- Keep all queries scoped by `restaurantId`.
- Add connection pooling for PostgreSQL.
- Move analytics aggregation and campaign delivery to queue workers.
- Introduce Redis for cache, rate limits, and hot counters.
- Shard tenants regionally when restaurant volume requires it.

## Third-party integrations to wire next

- Stripe Payment Intents + webhooks
- UPI provider
- WhatsApp Business provider
- Object storage and CDN for menu photography
- Background jobs for receipts, campaigns, and AI feature computation

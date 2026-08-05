# Proposed self-service weekly order editing

The safest design is to edit the existing Web Orders row rather than create a replacement order.

1. Dashboard button opens `/orders/?edit=<Web Order row ID>&token=...`.
2. The orders page requests the current order from the authenticated member API and preloads `Item JSON` into the basket.
3. On confirmation, a dedicated server endpoint validates the member, ordering week, deadline, current stock and collection restrictions.
4. It computes a **delta** between the original and edited quantities.
5. Baserow writes stock adjustment movements only for the delta:
   - increased quantity → additional negative stock movement;
   - reduced quantity → positive release/adjustment movement.
6. The Account Transaction for the order is adjusted by the difference rather than adding a second full order charge.
7. The existing Web Orders row receives the new Item JSON / Order total and an `Updated at` timestamp.
8. The operation uses an edit idempotency key and rejects changes after the weekly deadline or while another edit is processing.

This avoids duplicate weekly orders and preserves a clean audit trail. It does require extending the present create-only Baserow order automation before the dashboard button should be allowed to modify an order.

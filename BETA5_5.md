# Beta 5.5 — Bulk facts / Focused extraction

- **GM → Синхронизация:** separate **Очистить ошибки и диагностику** and **Сбросить прогресс проверки**. Neither deletes facts. Error clearing preserves cursor; reset progress preserves all proposal statuses and their linked records, but resets counters and stale scan warning.
- **Mass editing:** checkboxes on each card, select all in current tab or across all statuses; choose **Удалить выбранные** (soft delete / recoverable) or **Удалить выбранные навсегда** (permanent purge of chosen proposals and their linked auto facts). Both require confirmation; no chat messages or manual records are deleted. Export a full JSON backup first.
- **Less spam:** user-selectable detail level in GM & Computer. Focused is default for new settings, up to ~2 changes per 10 and ~4 per 25 messages. The model ranks durable state changes first. No postprocessing hard cuts, so unique facts are not silently discarded.
- **Intra-block dedup:** compare candidates inside same response as well as existing statuses; don't collapse different facts backed by same quote if scope differs.
- **Compatibility:** keep the state schema and existing IDs, statuses, data, API profiles, import/export and offset behavior. No full scan performed on installation. 5.4 imported-chat reader fixes remain.

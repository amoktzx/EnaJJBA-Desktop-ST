# Ena Desktop v1.0 Beta 5 — Resume Diagnostic Fix

- Fixed crash/silent pause reporting: GM Sync shows persistent reason and failed message number.
- Saved cursor is preserved across updates; Resume starts at the last completed chunk.
- Stable chatId is used to detect actual chat switches, with metadata reference as fallback.
- If a model produces invalid JSON or exceeds context, automatic chunk reduction 50→25→12→8 on the same position.
- No automatic retries for API errors, 429, auth, or quota; error chain exposed.
- Modest 900ms spacing between successful blocks.
- No changes to fact journal, accepted/deleted records, import/export or source hashes.

To install: upload contents to same GitHub repo, update extension in SillyTavern and reload. BACK UP JSON first. Click `Продолжить полную проверку`, NOT `Проверить весь чат`. If paused again, the cause now appears in GM Sync, share that message.

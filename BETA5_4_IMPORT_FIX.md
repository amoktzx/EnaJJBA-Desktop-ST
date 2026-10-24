# Beta 5.4 — imported-chat role flags and high-contrast diagnostics

## Root cause
The user's imported SillyTavern chat has long `mes` text and `name`/`is_user`, but **is_system=true on all 100 sampled roleplay messages**. Older versions treated the flag alone as proof of a service message, discarding every line before GLM received it. Thus 42 processed chunks / 0 proposals were not a reliable scan.

## Fix
- Recognize a genuine named RP actor (both name and boolean is_user) despite unreliable is_system flag; still exclude explicit system role/type/name, anonymous is_system notices, and empty messages.
- Use the same rule in messageKey and source validation so swipe/edit/delete rollback still works.
- Diagnostics show flagged system messages and recovered roleplay messages separately.
- Increase contrast and size of diagnostics; eliminate unreadable pale text imposed by host CSS.
- Flag old progress from pre-5.4 readers as untrusted, block unsafe Resume, keep all proposal/record statuses intact. Run a brief 10-message dry test, then start a **fresh whole-chat scan** (from zero) after JSON backup.
- The earlier HTTP 400 `Bad Request` may still be a separate API issue. Never blindly keep hitting Resume; obtain response details if it occurs after actual messages reach GLM.

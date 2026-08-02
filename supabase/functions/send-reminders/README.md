# send-reminders

Benötigte Supabase-Secrets:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (z. B. `mailto:deine-adresse@example.com`)
- `CRON_SECRET` (langer zufälliger Wert)

`{ "action": "test" }` darf nur ein angemeldeter Nutzer für die eigenen Geräte
ausführen. Der normale, idempotente Fälligkeitslauf benötigt im Header
`x-cron-secret` den gleichnamigen Function-Secret.

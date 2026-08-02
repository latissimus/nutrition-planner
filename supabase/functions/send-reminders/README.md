# send-reminders

Benötigte Supabase-Secrets:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (z. B. `mailto:deine-adresse@example.com`)
- `CRON_SECRET` (langer zufälliger Wert)

`{ "action": "test" }` darf nur ein angemeldeter Nutzer für die eigenen Geräte
ausführen. Der normale, idempotente Fälligkeitslauf benötigt im Header
`x-cron-secret` den gleichnamigen Function-Secret.

Deployment:

```bash
npx supabase functions deploy send-reminders --no-verify-jwt
```

Die Gateway-JWT-Prüfung bleibt bewusst aus: Nutzer-Testaufrufe werden in der
Function mit `admin.auth.getUser()` geprüft; der automatische Lauf benötigt
stattdessen zwingend den geheimen `x-cron-secret`-Header.

Wichtig: Ein vorhandenes Push-Abo startet keine Erinnerungen von selbst. Im
Supabase Dashboard muss unter **Integrations → Cron** ein minütlicher HTTP-Job
auf `/functions/v1/send-reminders` existieren. Er sendet den Header
`x-cron-secret` mit exakt demselben Wert wie das Function-Secret `CRON_SECRET`.

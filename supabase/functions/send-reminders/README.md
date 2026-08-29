# send-reminders

Benötigte Supabase-Secrets:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (z. B. `mailto:deine-adresse@example.com`)
- `CRON_SECRET` (langer zufälliger Wert)

`{ "action": "test" }` darf nur ein angemeldeter Nutzer für die eigenen Geräte
ausführen. Der normale, idempotente Fälligkeitslauf benötigt im Header
`x-cron-secret` den gleichnamigen Function-Secret.

Der Cronjob soll die Function einmal pro Minute aufrufen. Ein Lauf darf bis zu
drei Minuten verspaetet eintreffen; die Function holt den fachlichen Termin
nach und verwendet dessen stabilen `occurrence_key`, sodass derselbe Termin
trotzdem nur einmal pro registriertem Geraet zugestellt wird. Das gilt auch
fuer Trinkintervalle, Snooze und die doppelte lokale Stunde beim Wechsel zur
Winterzeit.

Supplements besitzen keinen eigenen einstellbaren Zeitpunkt. Alle aktiven
Supplements eines Mahlzeitenblocks werden in einer gemeinsamen Meldung exakt
zehn Minuten nach der aktuellen Uhrzeit dieser Mahlzeit versendet. Die normale
Mahlzeitenmeldung bleibt davon getrennt. Die Push-Payloads enthalten bewusst
keine Aktionsbuttons.

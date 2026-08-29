# 🇵🇱 Podanie-GROM

Bot Discord do rekrutacji GROM.

## Funkcje

- `/podanie-grom` — publikuje panel rekrutacyjny.
- Kandydat odpowiada na **44 pytania** w 9 formularzach.
- Automatyczna punktacja: **100 pkt**.
- Pytania 1–5 są formalne i nie dają punktów.
- Wynik trafia na kanał rekrutacyjny.
- Rekruter może kliknąć **Przyjmij**, **Odrzuć** albo **Pełne odpowiedzi**.
- `/grom-status` — kandydat sprawdza swój wynik.
- Opcjonalne automatyczne nadawanie roli po przyjęciu/odrzuceniu.
- Dane są zapisywane w `data/applications.json`.

## Uruchomienie

```bash
npm install
node index.js
```

## `.env`

Skopiuj `.env.example` do `.env` i uzupełnij:

```env
TOKEN=TOKEN_BOTA
CLIENT_ID=ID_BOTA
GUILD_ID=ID_SERWERA
REVIEW_CHANNEL_ID=ID_KANAŁU_REKRUTACJI
ACCEPTED_ROLE_ID=ID_ROLI_PRZYJĘTY
REJECTED_ROLE_ID=ID_ROLI_ODRZUCONY
```

`ACCEPTED_ROLE_ID` i `REJECTED_ROLE_ID` mogą pozostać puste.

## Uprawnienia bota

Bot potrzebuje przede wszystkim:

- View Channels
- Send Messages
- Embed Links
- Read Message History
- Use Application Commands
- Manage Roles — tylko jeśli chcesz automatycznie nadawać role.

Bot korzysta wyłącznie z intentu `Guilds`, więc nie trzeba włączać Message Content Intent.

> Automatyczna punktacja jest wstępną oceną techniczną opartą na długości i zawartości odpowiedzi. Ostateczna decyzja powinna należeć do komisji rekrutacyjnej.

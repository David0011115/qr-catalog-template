# SQL для Supabase

Все миграции по порядку появления. Запускаются в Supabase → SQL Editor. Почти все можно запускать повторно без вреда;
исключения помечены «один раз».

| № | Файл | Что делает |
|---|------|------------|
| 01 | PLAYER-IDS-MIGRATION | публичные ID игроков |
| 02 | FRIENDS-DM-MIGRATION | друзья, личные сообщения, чёрный список, подарки, «в сети» |
| 03 | DM-THREADS-MIGRATION | вкладка «Сообщения» (список переписок) |
| 04 | RBUILD-RECORDS-MIGRATION | рекорды «Случайного билда» |
| 05 | PRIVACY-CONSENT-MIGRATION | согласие с политикой конфиденциальности |
| 06 | RATING-FIX | исправление правил рейтинга |
| 07 | DUO-RECORDS-MIGRATION | рекорды режимов вдвоём |
| 08 | SHOWCASE-FIELDS-MIGRATION | витрина профиля |
| 09 | SECURITY-MIGRATION | значки, промокоды и отчёты об ошибках на сервере |
| 10 | RECORDS-GUARD-MIGRATION | рекорды «на проверке» |
| 11 | RECORDS-REVIEW-MIGRATION | проверка рекордов создателем в игре |
| 12 | WALLET-MIGRATION | кошелёк монет на сервере |
| 13 | COINS-RATING-MIGRATION | рейтинг «◆ Монеты» |
| 14 | DB-CLEANUP-MIGRATION | уборка базы |
| 15 | TIMED-RESET-MIGRATION | сброс рекордов «На время» (2.7) — **один раз** |
| 16 | ABIL-REFUND-MIGRATION | возврат монет за уровни способностей (2.7) — **один раз**, сначала шаг 1 |
| 17 | ONLINE-SERVER-RESULTS-MIGRATION | итоги онлайн-матчей (нужен для полного онлайна) |
| 18 | RECORDS-DETAILS-MIGRATION | отчёт о рекорде |
| 19 | RECORDS-REJECT-MIGRATION | причина отклонения, «Отклонённые» 7 дней, переписка с создателем |
| 20 | HARDCORE-RESET-MIGRATION | сброс рейтинга «Хардкора» (2.7.5, планка 250 000) — **один раз** |

Новая миграция получает следующий номер: `21-ИМЯ-MIGRATION.sql`.

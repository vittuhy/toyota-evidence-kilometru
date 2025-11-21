# Nastavení externího CRONu pro Netlify Free Plan

Protože Netlify Scheduled Functions vyžadují Pro plán, použijeme externí CRON službu pro automatické spouštění.

## URL endpointu pro CRON:

```
https://evidence.vtuhy.cz/api/cron-fetch-mileage
```

**Metoda:** POST  
**Bez autentizace** - funkce běží na serveru

## Doporučená služba: cron-job.org

1. **Zaregistrujte se na https://cron-job.org** (bezplatné)

2. **Vytvořte nový CRON job:**
   - **Title:** Toyota Mileage Fetch
   - **Address:** `https://evidence.vtuhy.cz/api/cron-fetch-mileage`
   - **Schedule:** 
     - Pro zimní čas (CET): `48 12 * * *` (každý den v 12:48 CET)
     - Pro letní čas (CEST): `48 10 * * *` (každý den v 12:48 CEST = 10:48 UTC)
     - Nebo použijte Timezone: **Europe/Prague** (automaticky se přizpůsobí letnímu/zimnímu času)
   - **Request method:** POST
   - **Save**

3. **Testování:**
   - Můžete kliknout na "Run now" pro okamžité testování
   - Zkontrolujte logy v Netlify Dashboard → Functions → cron-fetch-mileage → Logs
   - Zkontrolujte aplikaci - měl by se objevit nový záznam s labely "API" a ikonkou hodinek

## Alternativní služby:

- **EasyCron** (https://www.easycron.com) - bezplatný plán s limitem
- **UptimeRobot** - má také CRON funkce
- **cron-job.org** - doporučeno, bezplatné a spolehlivé

## Poznámka o časových pásmech:

- **Zimní čas (CET):** UTC+1 → 12:48 CET = 11:48 UTC
- **Letní čas (CEST):** UTC+2 → 12:48 CEST = 10:48 UTC

Pokud použijete Timezone: Europe/Prague, služba automaticky přepne mezi letním a zimním časem.

## Co CRON dělá:

1. Zavolá Toyota API a získá aktuální stav tachometru
2. Zkontroluje, zda už existuje záznam pro dnešní den
3. Pokud existuje stejná hodnota → přeskočí (nebo aktualizuje source na CRON)
4. Pokud existuje jiná hodnota → aktualizuje záznam
5. Pokud neexistuje → vytvoří nový záznam s source: 'CRON'


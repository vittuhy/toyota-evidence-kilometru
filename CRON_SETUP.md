# Nastavení externího CRONu pro Netlify Free Plan

Protože Netlify Scheduled Functions vyžadují Pro plán a GitHub Actions mají zpoždění, použijeme externí CRON službu pro přesnější časování.

## Doporučená služba: cron-job.org

1. **Zaregistrujte se na https://cron-job.org** (bezplatné)

2. **Vytvořte nový CRON job:**
   - **Title:** Toyota Mileage Fetch
   - **Address:** `https://evidence.vtuhy.cz/api/cron-fetch-mileage`
   - **Schedule:** 
     - Pro zimní čas (CET): `48 12 * * *` (každý den v 12:48)
     - Pro letní čas (CEST): `48 10 * * *` (každý den v 12:48 CEST = 10:48 UTC)
   - **Request method:** POST
   - **Timezone:** Europe/Prague (automaticky se přizpůsobí letnímu/zimnímu času)
   - **Save**

3. **Testování:**
   - Můžete kliknout na "Run now" pro okamžité testování
   - Zkontrolujte logy v Netlify Dashboard → Functions → cron-fetch-mileage → Logs

## Alternativa: GitHub Actions (má zpoždění 3-10 minut)

GitHub Actions scheduled workflows mohou mít zpoždění až 10 minut nebo více, zejména při vysokém zatížení. Pro přesnější časování použijte externí CRON službu.

## Alternativní služby:

- **EasyCron** (https://www.easycron.com) - bezplatný plán s limitem
- **GitHub Actions** - pokud máte repozitář na GitHubu, můžete použít GitHub Actions s schedule
- **UptimeRobot** - má také CRON funkce

## GitHub Actions řešení (pokud máte GitHub repo):

Vytvořte soubor `.github/workflows/cron-fetch-mileage.yml`:

```yaml
name: CRON Fetch Mileage

on:
  schedule:
    - cron: '30 11 * * *'  # 12:30 CET (zimní čas)
  workflow_dispatch:  # Pro manuální spuštění

jobs:
  fetch-mileage:
    runs-on: ubuntu-latest
    steps:
      - name: Call Netlify Function
        run: |
          curl -X POST https://your-site.netlify.app/api/cron-fetch-mileage
```

## Poznámka o časových pásmech:

- **Zimní čas (CET):** UTC+1 → 12:30 CET = 11:30 UTC
- **Letní čas (CEST):** UTC+2 → 12:30 CEST = 10:30 UTC

Nezapomeňte změnit čas při přechodu na letní/zimní čas!


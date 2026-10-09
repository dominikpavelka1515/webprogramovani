# ETS2 Logbook & Telemetry Dashboard

Moderní webová aplikace pro hráče a virtuální autodopravce v simulátoru **Euro Truck Simulator 2 (ETS2)**. Slouží k evidenci vlastněného vozového parku, zaznamenávání odjetých zakázek, přesným ekonomickým výpočtům (spotřeba, nafta, čistý zisk) a analytickému dashboardu.

---

## Rychlé spuštění na Localhostu

### 1. Požadavky
- Python 3.10+
- Knihovna Flask (`pip install flask`)

### 2. Spuštění serveru
V terminálu přejděte do této složky a spusťte:

```bash
python app.py
```

Následně otevřete webový prohlížeč na adrese:
[http://127.0.0.1:5000](http://127.0.0.1:5000)

Databáze SQLite (`ets2_logbook.db`) se při prvním spuštění automaticky vytvoří a naplní základními daty (3 tahače a 2 vzorové jízdy), takže můžete dashboard okamžitě testovat.

---

## Struktura projektu

```text
ets2-logbook/
├── app.py                 # Flask server, routing, REST API
├── database.py            # Databázová vrstva SQLite, transakce, statistiky
├── calculations.py        # Business logika (spotřeba, váha nákladu, zisk)
├── schema.sql             # SQL DDL schéma tabulek a indexů
├── requirements.txt       # Python závislosti (flask)
├── static/
│   ├── css/
│   │   └── style.css      # Dark cockpit design systém, sklo, neon akcenty
│   └── js/
│       └── app.js         # Živý výpočet v reálném čase, vyhledávání, mazání
└── templates/
    ├── base.html          # Hlavní šablona, sidebar, navigace
    ├── dashboard.html     # Statistický dashboard a interaktivní grafy (Chart.js)
    ├── logbook.html       # Formulář pro zadání trasy + historie jízd
    └── trucks.html        # Evidence a správa tahačů ve flotile
```

---

## Vzorce pro výpočet

1. **Efektivní spotřeba ($C_{eff}$):**
   $$C_{eff} = C_{base} + (W_{cargo} \times 0.25)$$
   *(Základní spotřeba tahače + 0.25 l/100km za každou tunu nákladu).*

2. **Spálené palivo ($V_{palivo}$ v litrech):**
   $$V_{palivo} = \frac{D \times C_{eff}}{100}$$
   *(D = vzdálenost v km).*

3. **Náklady na palivo ($N_{palivo}$):**
   $$N_{palivo} = V_{palivo} \times Cena_{nafta}$$

4. **Čistý zisk ($Zisk_{cisty}$):**
   $$Zisk_{cisty} = Odmena - N_{palivo}$$

5. **Aktualizace tachometru:**
   $$Tachometr_{novy} = Tachometr_{puvodni} + D$$
   *(Aktualizuje se atomicky v databázové transakci při uložení jízdy).*

---

## Budoucí napojení na ETS2 Telemetry API (Automatizace)

Pro plně automatické ukládání bez ručního přepisování hodnot se v ETS2 komunitě používá:
1. **SCS SDK Plugin** (DLL knihovna umístěná v `Euro Truck Simulator 2/bin/win_x64/plugins/ats-ets2-telemetry.dll`).
2. Tento plugin čte přímo sdílenou paměť hry (*Memory Mapped File*) v reálném čase (60 fps).
3. Poskytuje lokální REST API nebo WebSocket server (např. *Funbit ETS2 Telemetry Server* nebo Python knihovna `trucksim-telemetry`).
4. **Architektura napojení:**
   - Malý background Python skript na localhostu poslouchá WebSocket ze hry.
   - Detekuje event `job_delivered` / `job_finished`.
   - Vytáhne ze hry: ujeté km, skutečně spálenou naftu z plováku, odměnu a cílové město.
   - Pošle HTTP POST na náš připravený webhook: `POST http://127.0.0.1:5000/api/telemetry/job-finished`.

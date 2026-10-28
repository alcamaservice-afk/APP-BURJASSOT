# 📋 Guida Aggiornamento Google Apps Script (Versione 3: Sincronizzazione Real-Time + Finanziamenti)

L'app **Casa Burjassot** è già collegata direttamente al tuo URL Web App:
`https://script.google.com/macros/s/AKfycbxA6uG7zWv4GIJPiy5YTBuCmgWo0baDoi01cG5k3zpVpHkgTlNzJQ9O9Blt9yEERg-Khg/exec`

---

### ⚠️ Perché prima non si sincronizzava tra cellulare e web:
Google Apps Script restituiva l'errore:
`TypeError: Cannot read properties of null (reading 'getSheetByName')`
Questo accadeva perché lo script non riusciva a individuare automaticamente il foglio attivo associato. 
Il nuovo codice [`Code.gs`](Code.gs) risolve il problema alla radice con un meccanismo a prova di errore: se non trova il foglio, cerca l'ID salvato e se necessario lo crea direttamente su Google Drive, senza mai bloccare la sincronizzazione.

Inoltre nell'app è stato inserito il **polling continuo automatico (ogni 10 secondi)** e il **risveglio istantaneo su focus**: ogni volta che apri l'app o cambi finestra, i dati vengono scaricati e allineati all'istante tra PC e cellulare!

---

### 🚀 Come Aggiornare lo Script in 1 Minuto:

1. Apri Google Drive ed entra nel tuo progetto **Apps Script** (o dal menu *Estensioni* > *Apps Script* del tuo foglio).
2. Seleziona tutto il codice presente nell'editor e cancellalo.
3. Apri il file [`Code.gs`](Code.gs), copia tutto il suo contenuto e incollalo nell'editor di Google Apps Script.
4. Clicca sull'icona del floppy disk **Salva** (`Ctrl + S`).
5. **FONDAMENTALE**: In alto a destra clicca su **Distribuisci** > **Gestisci distribuzioni** (Manage deployments).
6. Clicca sull'icona della **Matita (Modifica)** in alto a destra.
7. Nel menu a tendina "Versione", scegli **"Nuova versione"**.
8. Clicca sul pulsante blu in basso a destra **"Distribuisci"**.

*(Così facendo l'URL rimane esattamente lo stesso, ma utilizzerà subito il nuovo motore privo di errori!)*

---

### 📊 Le 3 Schede che Troverai nel tuo Google Sheet:

1. **`ListaAcquisti`**: tutti i materiali, mobili, battiscopa con negozio (Brico Depôt 1°, Leroy Merlin 2°, IKEA 3°), stato di pagamento e collegamento al finanziamento.
2. **`Lavori`**: manodopera (cucina, battiscopa, sanitari), prezzi concordati, acconti pagati e residuo dovuto.
3. **`Finanziamenti`**: piani rateali con capitale, numero rate, tasso/interessi, costo totale e rata mensile esatta calcolata.

# 🏠 Casa Burjassot - Web App Lista Acquisti & Arredo

App Progressive Web App (PWA) moderna, veloce e condivisibile, pensata per gestire e sincronizzare in tempo reale tutti gli acquisti per l'appartamento di **Burjassot** (mobili, elementi bagno, battiscopa, cucina, elettrodomestici, finiture e accessori).

---

## ✨ Funzionalità Principali

- **📱 Installabile all'istante (PWA)**: Si installa con 1 tap sulla schermata Home del cellulare (Android e iPhone) come un'app nativa completa di icona personalizzata. Funziona a schermo intero e anche senza internet!
- **☁️ Sincronizzazione Online Automatica (Google Sheet)**: Tramite **Google Apps Script**, ogni volta che aggiungi, modifichi o spunti un elemento, i dati vengono sincronizzati istantaneamente in cloud su un foglio Google condiviso.
- **🏷️ Scheda Dettagli Completa per ogni oggetto**:
  - Nome elemento
  - Destinazione / Stanza (Salone, Cucina, Bagno Principale, Bagno di Servizio, Camera Matrimoniale, Corridoio/Battiscopa, Terrazzo, Altro)
  - Negozio (IKEA, Leroy Merlin, Bauhaus, Obramat/Bricomart, Amazon, Conforama, ecc.)
  - Prezzo visto (€) & Quantità
  - Dimensioni (es. `80x120 cm`, `35 metri lineari`)
  - Colore e finitura (es. `Rovere chiaro`, `Nero opaco`, `Cromo`)
  - Priorità (🔴 Alta, 🟡 Media, 🟢 Bassa)
  - Stato (⏳ Da comprare, 🤔 In dubbio, ✅ Comprato)
  - Link diretto al prodotto (apribile con un click)
  - Note aggiuntive
- **📊 Calcolo Automatico del Budget**:
  - Totale preventivato (€)
  - Già speso (€)
  - Rimanente da spendere (€)
  - Percentuale di avanzamento acquisti
- **🔍 Ricerca & Filtri Avanzati**:
  - Cerca istantaneamente per testo libero (nome, negozio, colore, note)
  - Filtro per stanza con chip orizzontali touch
  - Filtro per stato (da comprare / comprati)
  - Filtro per negozio
  - Ordinamento per priorità o prezzo
- **📤 Condivisione Rapida**:
  - Invio con 1 click del riepilogo formattato su **WhatsApp**
  - Copia negli appunti
  - Download tabella **CSV (Excel)**
  - Backup e ripristino locale in JSON

---

## 🚀 Guida: Come Caricare l'App su GitHub e Renderla Pubblica (Gratis)

Segui questi 4 semplici passaggi:

### 1. Crea il Repository su GitHub
1. Vai su [github.com](https://github.com/) ed esegui l'accesso.
2. In alto a destra clicca sul pulsante verde **"New"** (oppure clicca sul `+` > *New repository*).
3. Dai un nome al repository, ad esempio: `casa-burjassot`.
4. Impostalo su **Public**.
5. **Non** selezionare "Add a README file" (abbiamo già tutti i file pronti).
6. Clicca su **"Create repository"**.

### 2. Carica i File
1. Nella pagina del nuovo repository creato, clicca sul link **"uploading an existing file"**.
2. Trascina all'interno della finestra di GitHub **tutti i file e le cartelle** presenti in questa cartella (`C:\Users\Nature AlCaMaService\Desktop\casa-burjassot`):
   - `index.html`
   - `style.css`
   - `app.js`
   - `sw.js`
   - `manifest.json`
   - `favicon.png`
   - `apple-touch-icon.png`
   - la cartella `icons`
   - la cartella `google-apps-script`
3. In basso, scrivi nel messaggio di commit: `Prima versione Casa Burjassot` e clicca sul pulsante verde **"Commit changes"**.

### 3. Attiva GitHub Pages (Per avere il link pubblico https)
1. Nel tuo repository su GitHub, vai nella scheda in alto **"Settings"** (Impostazioni).
2. Nel menu a sinistra, clicca su **"Pages"**.
3. Sotto **"Build and deployment"** > **"Branch"**:
   - Seleziona il branch **`main`** (oppure `master`).
   - Lascia la cartella su **`/ (root)`**.
   - Clicca sul pulsante **"Save"**.
4. Attendi circa 1-2 minuti. Aggiorna la pagina: vedrai comparire un riquadro verde con il link della tua app, ad esempio:
   👉 `https://tuo-username.github.io/casa-burjassot/`

---

## 📲 Come Installare l'App sul Cellulare (Android & iPhone)

### Su Android (Google Chrome / Edge / Samsung Internet):
1. Apri il link di GitHub Pages sul browser del telefono.
2. Comparirà automaticamente in basso il banner con l'icona: **"Installa Casa Burjassot"**.
3. Clicca su **"Installa"** (oppure tocca il pulsante "📲 Installa" in alto a destra).
4. Troverai l'icona con la casa e la poltroncina direttamente nella schermata Home del cellulare!

### Su iPhone (Safari):
1. Apri il link con Safari.
2. Tocca l'icona **Condividi** in basso al centro (il quadrato con la freccia rivolta verso l'alto).
3. Scorri verso il basso nel menu e tocca **"Aggiungi a schermata Home"**.
4. Tocca **"Aggiungi"** in alto a destra. L'icona dell'app comparirà sulla tua Home screen e si aprirà a schermo intero senza barre del browser!

---

## ☁️ Come Attivare la Sincronizzazione con Google Sheet

Per sincronizzare tutti i dispositivi su uno stesso foglio Google:
1. Segui la guida dettagliata con tutti i passaggi nel file:
   [`google-apps-script/ISTRUZIONI_GOOGLE_SCRIPT.md`](google-apps-script/ISTRUZIONI_GOOGLE_SCRIPT.md)
2. Incolla l'URL della Web App generata da Google dentro l'app (icona **🔄 Sincronizza** in alto a destra).

---

## 📁 Struttura della Cartella

```text
casa-burjassot/
│
├── index.html                   # Interfaccia grafica principale dell'app
├── style.css                    # Design moderno, responsive e mobile-first
├── app.js                       # Logica di calcolo budget, filtri, PWA e sync
├── sw.js                        # Service Worker per funzionamento offline e PWA
├── manifest.json                # Manifesto PWA per installazione su Android/iOS
├── favicon.png                  # Icona browser
├── apple-touch-icon.png         # Icona per dispositivi iOS Apple
├── .gitignore                   # File ignorati da Git
├── README.md                    # Questa documentazione
│
├── icons/                       # Icone ad alta risoluzione
│   ├── icon-192.png             # Icona 192x192 per Android
│   ├── icon-512.png             # Icona 512x512 per Splash Screen e Store
│   ├── apple-touch-icon.png     # Icona 180x180 per iPhone/iPad
│   └── favicon.png              # Icona 64x64
│
└── google-apps-script/          # Backend cloud Google
    ├── Code.gs                  # Codice Apps Script da incollare in Google Sheet
    └── ISTRUZIONI_GOOGLE_SCRIPT.md # Guida passo-passo alla configurazione
```

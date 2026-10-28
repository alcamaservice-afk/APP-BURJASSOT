/**
 * CASA BURJASSOT - Progressive Web App (Versione 2: Materiali + Lavori + Finanziamenti)
 * Sincronizzazione automatica Google Sheet, gestione budget, filtri e PWA installabile.
 */

(function () {
  'use strict';

  // --- CONFIGURAZIONE & URL GOOGLE APPS SCRIPT ---
  const DEFAULT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbxA6uG7zWv4GIJPiy5YTBuCmgWo0baDoi01cG5k3zpVpHkgTlNzJQ9O9Blt9yEERg-Khg/exec';
  const STORAGE_ITEMS_KEY = 'burjassot_shopping_items_v2';
  const STORAGE_WORKS_KEY = 'burjassot_renovation_works_v2';
  
  // --- STATO APPLICAZIONE ---
  let items = [];
  let works = [];
  let currentTab = 'materials'; // 'materials' | 'works'

  // Filtri Materiali
  let currentFilterRoom = 'all';
  let currentFilterStatus = 'all';
  let currentFilterStore = 'all';
  let currentFilterPayment = 'all';
  let currentSearchQuery = '';
  let currentSort = 'priority-desc';

  // Filtri Lavori
  let currentWorksSearchQuery = '';
  let currentWorksStatus = 'all';
  let currentWorksDue = 'all';

  // Flag stato
  let deferredInstallPrompt = null;
  let isSyncing = false;
  let autoSyncTimeout = null;

  // Lavoro selezionato per acconto rapido
  let selectedWorkForPayment = null;

  // --- ELEMENTI DOM ---
  const elements = {
    // Header
    btnInstallHeader: document.getElementById('btn-install-header'),
    btnOpenShare: document.getElementById('btn-open-share'),
    btnOpenSync: document.getElementById('btn-open-sync'),
    syncIcon: document.getElementById('sync-icon'),
    syncStatusIndicator: document.getElementById('sync-status-indicator'),

    // Quadro Globale
    statGrandTotal: document.getElementById('stat-grand-total'),
    statGlobalProgress: document.getElementById('stat-global-progress'),
    statGlobalFinanced: document.getElementById('stat-global-financed'),
    statFinancedCount: document.getElementById('stat-financed-count'),
    statGlobalPaidCash: document.getElementById('stat-global-paid-cash'),
    statGlobalRemainCash: document.getElementById('stat-global-remain-cash'),

    // Tab switcher
    tabMaterials: document.getElementById('tab-materials'),
    tabWorks: document.getElementById('tab-works'),
    badgeMaterialsCount: document.getElementById('badge-materials-count'),
    badgeWorksCount: document.getElementById('badge-works-count'),

    // Metriche Sub-tab
    submetricsMaterials: document.getElementById('submetrics-materials'),
    statMatTotal: document.getElementById('stat-mat-total'),
    statMatCount: document.getElementById('stat-mat-count'),
    statMatPaid: document.getElementById('stat-mat-paid'),
    statMatFinanced: document.getElementById('stat-mat-financed'),

    submetricsWorks: document.getElementById('submetrics-works'),
    statWorksTotal: document.getElementById('stat-works-total'),
    statWorksCount: document.getElementById('stat-works-count'),
    statWorksPaid: document.getElementById('stat-works-paid'),
    statWorksDue: document.getElementById('stat-works-due'),

    // Sezioni Filtri
    filtersMaterialsSection: document.getElementById('filters-materials-section'),
    filtersWorksSection: document.getElementById('filters-works-section'),

    // Filtri Materiali
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    roomPills: document.querySelectorAll('#room-pills-container .filter-pill'),
    filterStore: document.getElementById('filter-store'),
    filterPayment: document.getElementById('filter-payment'),
    filterStatus: document.getElementById('filter-status'),
    sortItems: document.getElementById('sort-items'),

    // Filtri Lavori
    searchWorksInput: document.getElementById('search-works-input'),
    searchWorksClearBtn: document.getElementById('search-works-clear-btn'),
    filterWorksStatus: document.getElementById('filter-works-status'),
    filterWorksDue: document.getElementById('filter-works-due'),

    // Contenitori Liste
    itemsContainer: document.getElementById('items-list-container'),
    worksContainer: document.getElementById('works-list-container'),

    // FAB
    fabAddMain: document.getElementById('fab-add-main'),
    fabLabel: document.getElementById('fab-label'),

    // Modal Materiale
    modalItem: document.getElementById('modal-item'),
    modalItemTitle: document.getElementById('modal-item-title'),
    formItem: document.getElementById('form-item'),
    itemIdInput: document.getElementById('item-id'),
    itemNameInput: document.getElementById('item-name'),
    itemRoomSelect: document.getElementById('item-room'),
    itemStoreInput: document.getElementById('item-store'),
    itemPriceInput: document.getElementById('item-price'),
    itemQuantityInput: document.getElementById('item-quantity'),
    itemPaymentStatusSelect: document.getElementById('item-payment-status'),
    groupFinancedDetails: document.getElementById('group-financed-details'),
    itemFinancedDetailsInput: document.getElementById('item-financed-details'),
    itemDimensionsInput: document.getElementById('item-dimensions'),
    itemColorInput: document.getElementById('item-color'),
    itemPrioritySelect: document.getElementById('item-priority'),
    itemStatusSelect: document.getElementById('item-status'),
    itemLinkInput: document.getElementById('item-link'),
    itemNotesInput: document.getElementById('item-notes'),
    btnCloseItemModal: document.getElementById('btn-close-item-modal'),
    btnCancelItem: document.getElementById('btn-cancel-item'),

    // Modal Lavoro
    modalWork: document.getElementById('modal-work'),
    modalWorkTitle: document.getElementById('modal-work-title'),
    formWork: document.getElementById('form-work'),
    workIdInput: document.getElementById('work-id'),
    workTitleInput: document.getElementById('work-title'),
    workWorkerInput: document.getElementById('work-worker'),
    workTotalPriceInput: document.getElementById('work-total-price'),
    workPaidAmountInput: document.getElementById('work-paid-amount'),
    workLiveDue: document.getElementById('work-live-due'),
    workStatusSelect: document.getElementById('work-status'),
    workNotesInput: document.getElementById('work-notes'),
    btnCloseWorkModal: document.getElementById('btn-close-work-modal'),
    btnCancelWork: document.getElementById('btn-cancel-work'),

    // Modal Acconto Rapido Lavoro
    modalWorkPayment: document.getElementById('modal-work-payment'),
    workPaySubtitle: document.getElementById('work-pay-subtitle'),
    workQuickPayAmount: document.getElementById('work-quick-pay-amount'),
    btnWorkPayFull: document.getElementById('btn-work-pay-full'),
    btnCloseWorkPayModal: document.getElementById('btn-close-work-pay-modal'),
    btnCancelWorkPay: document.getElementById('btn-cancel-work-pay'),
    btnConfirmWorkPay: document.getElementById('btn-confirm-work-pay'),

    // Modal Sync
    modalSync: document.getElementById('modal-sync'),
    syncScriptUrlInput: document.getElementById('sync-script-url'),
    btnForceSync: document.getElementById('btn-force-sync'),
    btnCloseSyncModal: document.getElementById('btn-close-sync-modal'),
    btnCloseSync: document.getElementById('btn-close-sync'),
    btnExportBackup: document.getElementById('btn-export-backup'),
    btnImportBackupTrigger: document.getElementById('btn-import-backup-trigger'),
    importBackupFile: document.getElementById('import-backup-file'),
    iosHelper: document.getElementById('ios-helper'),

    // Modal Share
    modalShare: document.getElementById('modal-share'),
    btnCloseShareModal: document.getElementById('btn-close-share-modal'),
    btnCloseShare: document.getElementById('btn-close-share'),
    btnShareWhatsapp: document.getElementById('btn-share-whatsapp'),
    btnCopyClipboard: document.getElementById('btn-copy-clipboard'),
    btnExportCsv: document.getElementById('btn-export-csv'),

    // PWA Banner & Toast
    pwaInstallBanner: document.getElementById('pwa-install-banner'),
    btnPwaInstall: document.getElementById('btn-pwa-install'),
    btnPwaDismiss: document.getElementById('btn-pwa-dismiss'),
    toastContainer: document.getElementById('toast-container')
  };

  // --- DATI DI PARTENZA REALISTICI PER BURJASSOT ---
  const DEFAULT_ITEMS = [
    {
      id: 'burj-item-1',
      name: 'Battiscopa rovere/PVC (stanze e corridoio)',
      room: 'corridoio',
      store: 'Brico Depôt',
      price: 110,
      quantity: 1,
      paymentStatus: 'to_pay',
      financedDetails: '',
      dimensions: 'ca. 35 metri lineari',
      color: 'Rovere naturale',
      priority: 'Alta',
      status: 'pending',
      link: 'https://www.bricodepot.es',
      notes: 'Verificare spessore per coprire giunto pavimento',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-item-2',
      name: 'Box doccia rettangolare cristallo 6mm',
      room: 'bagno',
      store: 'Leroy Merlin',
      price: 240,
      quantity: 1,
      paymentStatus: 'paid_cash',
      financedDetails: '',
      dimensions: '80 x 120 cm (H 195 cm)',
      color: 'Cromo lucido',
      priority: 'Alta',
      status: 'bought',
      link: 'https://www.leroymerlin.es',
      notes: 'Acquistato con scontrino in negozio',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-item-3',
      name: 'Mobile lavabo bagno con specchio LED e 2 cassetti',
      room: 'bagno',
      store: 'IKEA',
      price: 195,
      quantity: 1,
      paymentStatus: 'to_pay',
      financedDetails: '',
      dimensions: '80 x 47 x 68 cm',
      color: 'Effetto rovere chiaro',
      priority: 'Media',
      status: 'pending',
      link: 'https://www.ikea.com/es/es/',
      notes: 'Controllare distanza scarico a parete',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-item-4',
      name: 'Divano letto 3 posti con contenitore',
      room: 'salone',
      store: 'IKEA',
      price: 520,
      quantity: 1,
      paymentStatus: 'financed',
      financedDetails: '10 rate da 52,00€ a tasso 0',
      dimensions: '225 x 95 cm',
      color: 'Grigio antracite',
      priority: 'Alta',
      status: 'bought',
      link: '',
      notes: 'Finanziato direttamente da IKEA',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-item-5',
      name: 'Miscelatore lavello cucina orientabile',
      room: 'cucina',
      store: 'Brico Depôt',
      price: 48,
      quantity: 1,
      paymentStatus: 'to_pay',
      financedDetails: '',
      dimensions: 'Altezza 35 cm',
      color: 'Nero opaco',
      priority: 'Media',
      status: 'pending',
      link: 'https://www.bricodepot.es',
      notes: 'Con canna alta orientabile',
      updatedAt: new Date().toISOString()
    }
  ];

  const DEFAULT_WORKS = [
    {
      id: 'burj-work-1',
      title: 'Collocazione battiscopa tutta la casa',
      worker: 'Muratore Juan',
      totalPrice: 180,
      paidAmount: 50,
      dueAmount: 130,
      status: 'in_progress',
      notes: '50€ dati di acconto all\'inizio, saldo al termine',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-work-2',
      title: 'Installazione cucina e allacci elettrodomestici',
      worker: 'Squadra Montatori',
      totalPrice: 350,
      paidAmount: 0,
      dueAmount: 350,
      status: 'pending',
      notes: 'Previsto dopo l\'arrivo della cucina',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-work-3',
      title: 'Collocazione water, bidet e box doccia',
      worker: 'Idraulico Carlos',
      totalPrice: 200,
      paidAmount: 100,
      dueAmount: 100,
      status: 'in_progress',
      notes: 'Water e bidet già montati, manca solo il box doccia',
      updatedAt: new Date().toISOString()
    }
  ];

  // --- AVVIO APP ---
  function init() {
    loadLocalData();
    setupEventListeners();
    setupPWA();
    renderAll();

    // Sincronizzazione automatica all'avvio
    updateSyncBadge('syncing');
    syncWithCloud({ silent: true });
  }

  // --- CARICAMENTO & SALVATAGGIO LOCALE ---
  function loadLocalData() {
    try {
      const rawItems = localStorage.getItem(STORAGE_ITEMS_KEY);
      items = rawItems ? JSON.parse(rawItems) : [...DEFAULT_ITEMS];
    } catch (e) {
      items = [...DEFAULT_ITEMS];
    }

    try {
      const rawWorks = localStorage.getItem(STORAGE_WORKS_KEY);
      works = rawWorks ? JSON.parse(rawWorks) : [...DEFAULT_WORKS];
    } catch (e) {
      works = [...DEFAULT_WORKS];
    }

    saveLocalData(false);
  }

  function saveLocalData(triggerSync = true) {
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
    localStorage.setItem(STORAGE_WORKS_KEY, JSON.stringify(works));
    renderAll();

    if (triggerSync && !isSyncing) {
      debounceAutoSync();
    }
  }

  function debounceAutoSync() {
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = setTimeout(() => {
      syncWithCloud({ silent: true });
    }, 1500);
  }

  // --- SINCRONIZZAZIONE AUTOMATICA CON GOOGLE APPS SCRIPT ---
  async function syncWithCloud(options = {}) {
    if (isSyncing) return;
    isSyncing = true;
    updateSyncBadge('syncing');

    try {
      // 1. GET: Scarica sia Materiali che Lavori
      const getRes = await fetch(DEFAULT_SYNC_URL + '?t=' + Date.now(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const data = await getRes.json();

      if (data && data.status === 'success') {
        // Unione intelligente Materiali
        if (Array.isArray(data.items) && data.items.length > 0) {
          const map = new Map();
          data.items.forEach(it => map.set(it.id, it));
          items.forEach(local => {
            if (!map.has(local.id)) {
              map.set(local.id, local);
            } else {
              const cloud = map.get(local.id);
              if (new Date(local.updatedAt || 0) > new Date(cloud.updatedAt || 0)) {
                map.set(local.id, local);
              }
            }
          });
          items = Array.from(map.values());
        }

        // Unione intelligente Lavori
        if (Array.isArray(data.works) && data.works.length > 0) {
          const wMap = new Map();
          data.works.forEach(w => wMap.set(w.id, w));
          works.forEach(localW => {
            if (!wMap.has(localW.id)) {
              wMap.set(localW.id, localW);
            } else {
              const cloudW = wMap.get(localW.id);
              if (new Date(localW.updatedAt || 0) > new Date(cloudW.updatedAt || 0)) {
                wMap.set(localW.id, localW);
              }
            }
          });
          works = Array.from(wMap.values());
        }

        localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
        localStorage.setItem(STORAGE_WORKS_KEY, JSON.stringify(works));

        // 2. POST: Invia al Google Sheet l'elenco completo per sincronizzarlo
        await fetch(DEFAULT_SYNC_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'sync_all',
            items: items,
            works: works
          })
        });

        updateSyncBadge('online');
        if (!options.silent) {
          showToast('✅ Sincronizzato con il tuo Google Sheet!');
        }
      } else {
        // Se il foglio è appena creato o vuoto, mandiamo i nostri dati
        await fetch(DEFAULT_SYNC_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'sync_all',
            items: items,
            works: works
          })
        });
        updateSyncBadge('online');
        if (!options.silent) {
          showToast('✅ Dati inviati al Google Sheet!');
        }
      }
    } catch (err) {
      console.warn('Errore sync:', err);
      updateSyncBadge('offline');
      if (!options.silent) {
        showToast('⚠️ Non connesso al foglio Google. I dati sono salvati in locale.');
      }
    } finally {
      isSyncing = false;
      renderAll();
    }
  }

  function updateSyncBadge(status) {
    elements.syncStatusIndicator.className = 'sync-status-dot';
    if (status === 'online') {
      elements.syncStatusIndicator.classList.add('status-online');
      elements.syncStatusIndicator.title = 'Sincronizzato online con Google Sheet';
      elements.syncIcon.style.animation = 'none';
    } else if (status === 'syncing') {
      elements.syncStatusIndicator.classList.add('status-syncing');
      elements.syncStatusIndicator.title = 'Sincronizzazione in corso...';
      elements.syncIcon.style.animation = 'spin 1s linear infinite';
    } else {
      elements.syncStatusIndicator.classList.add('status-offline');
      elements.syncStatusIndicator.title = 'Offline o errore sincronizzazione';
      elements.syncIcon.style.animation = 'none';
    }
  }

  // --- RENDER GENERALE & CONTABILITÀ ---
  function renderAll() {
    renderGlobalAccounting();
    if (currentTab === 'materials') {
      renderMaterialsSubmetrics();
      renderMaterialsList();
    } else {
      renderWorksSubmetrics();
      renderWorksList();
    }
  }

  // 1. QUADRO ECONOMICO GLOBALE (Materiali + Lavori + Finanziamenti)
  function renderGlobalAccounting() {
    let matTotal = 0;
    let matFinanced = 0;
    let matPaidCash = 0;
    let matToPayCash = 0;
    let financedCount = 0;

    items.forEach(it => {
      const cost = (Number(it.price) || 0) * (Number(it.quantity) || 1);
      matTotal += cost;
      if (it.paymentStatus === 'financed') {
        matFinanced += cost;
        financedCount++;
      } else if (it.paymentStatus === 'paid_cash') {
        matPaidCash += cost;
      } else {
        matToPayCash += cost;
      }
    });

    let worksTotal = 0;
    let worksPaid = 0;
    let worksDue = 0;

    works.forEach(w => {
      const conc = Number(w.totalPrice) || 0;
      const pag = Number(w.paidAmount) || 0;
      worksTotal += conc;
      worksPaid += pag;
      worksDue += Math.max(0, conc - pag);
    });

    const grandTotal = matTotal + worksTotal;
    const globalPaidCash = matPaidCash + worksPaid;
    const globalRemainCash = matToPayCash + worksDue;

    // Percentuale completamento spesa pagata/finanziata rispetto al totale
    const completedBudget = matPaidCash + matFinanced + worksPaid;
    const progressPercent = grandTotal > 0 ? Math.min(100, Math.round((completedBudget / grandTotal) * 100)) : 0;

    elements.statGrandTotal.textContent = formatCurrency(grandTotal);
    elements.statGlobalFinanced.textContent = formatCurrency(matFinanced);
    elements.statFinancedCount.textContent = `${financedCount} articol${financedCount === 1 ? 'o' : 'i'} a rate`;
    elements.statGlobalPaidCash.textContent = formatCurrency(globalPaidCash);
    elements.statGlobalRemainCash.textContent = formatCurrency(globalRemainCash);
    elements.statGlobalProgress.textContent = progressPercent + '%';

    // Badge contatori sui tab
    elements.badgeMaterialsCount.textContent = items.length;
    elements.badgeWorksCount.textContent = works.length;
  }

  // Submetriche Materiali
  function renderMaterialsSubmetrics() {
    let matTotal = 0;
    let matPaid = 0;
    let matFinanced = 0;

    items.forEach(it => {
      const cost = (Number(it.price) || 0) * (Number(it.quantity) || 1);
      matTotal += cost;
      if (it.paymentStatus === 'paid_cash') matPaid += cost;
      if (it.paymentStatus === 'financed') matFinanced += cost;
    });

    elements.statMatTotal.textContent = formatCurrency(matTotal);
    elements.statMatCount.textContent = `${items.length} articoli`;
    elements.statMatPaid.textContent = formatCurrency(matPaid);
    elements.statMatFinanced.textContent = formatCurrency(matFinanced);
  }

  // Submetriche Lavori
  function renderWorksSubmetrics() {
    let worksTotal = 0;
    let worksPaid = 0;
    let worksDue = 0;

    works.forEach(w => {
      const conc = Number(w.totalPrice) || 0;
      const pag = Number(w.paidAmount) || 0;
      worksTotal += conc;
      worksPaid += pag;
      worksDue += Math.max(0, conc - pag);
    });

    elements.statWorksTotal.textContent = formatCurrency(worksTotal);
    elements.statWorksCount.textContent = `${works.length} interventi`;
    elements.statWorksPaid.textContent = formatCurrency(worksPaid);
    elements.statWorksDue.textContent = formatCurrency(worksDue);
  }

  // --- RENDER LISTA MATERIALI ---
  function renderMaterialsList() {
    let filtered = items.filter(item => {
      // Stanza
      if (currentFilterRoom !== 'all') {
        if ((item.room || '').toLowerCase() !== currentFilterRoom.toLowerCase()) return false;
      }
      // Stato
      if (currentFilterStatus !== 'all') {
        if (item.status !== currentFilterStatus) return false;
      }
      // Pagamento
      if (currentFilterPayment !== 'all') {
        if (item.paymentStatus !== currentFilterPayment) return false;
      }
      // Negozio (Brico Depôt primo)
      if (currentFilterStore !== 'all') {
        const itemStore = (item.store || '').toLowerCase();
        if (currentFilterStore === 'Altro') {
          const known = ['brico depôt', 'bricodepot', 'leroy merlin', 'ikea', 'bauhaus', 'obramat', 'amazon', 'conforama', 'maisons du monde'];
          if (known.some(k => itemStore.includes(k))) return false;
        } else if (!itemStore.includes(currentFilterStore.toLowerCase())) {
          return false;
        }
      }
      // Ricerca
      if (currentSearchQuery) {
        const full = `${item.name} ${item.store} ${item.room} ${item.color} ${item.dimensions} ${item.financedDetails} ${item.notes}`.toLowerCase();
        if (!full.includes(currentSearchQuery)) return false;
      }
      return true;
    });

    // Ordinamento
    filtered.sort((a, b) => {
      if (currentSort === 'priority-desc') {
        const pOrder = { 'Alta': 3, 'Media': 2, 'Bassa': 1 };
        return (pOrder[b.priority] || 2) - (pOrder[a.priority] || 2);
      }
      if (currentSort === 'price-asc') {
        return ((a.price || 0) * (a.quantity || 1)) - ((b.price || 0) * (b.quantity || 1));
      }
      if (currentSort === 'price-desc') {
        return ((b.price || 0) * (b.quantity || 1)) - ((a.price || 0) * (a.quantity || 1));
      }
      if (currentSort === 'date-desc') {
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      }
      if (currentSort === 'name-asc') {
        return a.name.localeCompare(b.name, 'it');
      }
      return 0;
    });

    if (filtered.length === 0) {
      elements.itemsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛋️</div>
          <h3 class="empty-state-title">Nessun materiale trovato</h3>
          <p class="empty-state-desc">Nessun articolo corrisponde ai filtri selezionati. Aggiungine uno nuovo!</p>
          <button class="btn btn-primary" id="btn-empty-add-mat">+ Aggiungi Materiale</button>
        </div>
      `;
      const btn = document.getElementById('btn-empty-add-mat');
      if (btn) btn.addEventListener('click', openAddMaterialModal);
      return;
    }

    let html = '';
    filtered.forEach(item => {
      const isBought = item.status === 'bought';
      const isEvaluating = item.status === 'evaluating';
      const unitPrice = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;
      const totalPrice = unitPrice * quantity;
      
      const roomClass = getRoomBadgeClass(item.room);
      const roomLabel = getRoomLabel(item.room);
      const priorityClass = getPriorityClass(item.priority);
      const isBricoDepot = (item.store || '').toLowerCase().includes('brico');

      // Tag Pagamento
      let paymentBadge = '';
      if (item.paymentStatus === 'financed') {
        paymentBadge = '<span class="tag-badge tag-payment-financed">💳 Finanziato</span>';
      } else if (item.paymentStatus === 'paid_cash') {
        paymentBadge = '<span class="tag-badge tag-payment-paid">💵 Pagato Cash</span>';
      } else {
        paymentBadge = '<span class="tag-badge tag-payment-topay">⏳ Da Pagare Cash</span>';
      }

      html += `
        <article class="item-card ${isBought ? 'is-bought' : ''}" data-id="${item.id}">
          <div class="item-header">
            <div class="item-main-info">
              <button class="btn-checkbox" data-action="toggle-bought" title="${isBought ? 'Segna come da comprare' : 'Segna come comprato'}">
                ${isBought ? '✓' : ''}
              </button>
              <div class="item-title-wrap">
                <span class="item-title-text">${escapeHtml(item.name)}</span>
                <div class="item-tags-row">
                  <span class="tag-badge ${roomClass}">${roomLabel}</span>
                  ${item.store ? `<span class="tag-badge ${isBricoDepot ? 'tag-store-bricodepot' : 'tag-store'}">🏪 ${escapeHtml(item.store)}</span>` : ''}
                  ${paymentBadge}
                  <span class="tag-badge ${priorityClass}">● ${escapeHtml(item.priority || 'Media')}</span>
                  ${isBought ? '<span class="tag-badge tag-payment-paid">✅ Comprato</span>' : ''}
                  ${isEvaluating ? '<span class="tag-badge" style="background:#E0E7FF;color:#3730A3;">🤔 In dubbio</span>' : ''}
                </div>
              </div>
            </div>
            
            <div class="item-price-box">
              <div class="item-price-main">${formatCurrency(totalPrice)}</div>
              ${quantity > 1 ? `<div class="item-quantity-text">${quantity} × ${formatCurrency(unitPrice)}</div>` : ''}
            </div>
          </div>

          <!-- Dettagli Finanziamento se presente -->
          ${item.paymentStatus === 'financed' && item.financedDetails ? `
            <div class="item-financed-box">
              <span>💳 <strong>Rate:</strong> ${escapeHtml(item.financedDetails)}</span>
            </div>
          ` : ''}

          <!-- Dimensioni e Colore -->
          ${(item.dimensions || item.color) ? `
            <div class="item-details-grid">
              ${item.dimensions ? `<span class="detail-item">📐 <strong>Misura:</strong> ${escapeHtml(item.dimensions)}</span>` : ''}
              ${item.color ? `<span class="detail-item">🎨 <strong>Colore:</strong> <span class="color-dot" style="background-color:${getColorStyle(item.color)}"></span> ${escapeHtml(item.color)}</span>` : ''}
            </div>
          ` : ''}

          <!-- Note -->
          ${item.notes ? `
            <div class="item-notes">
              📝 ${escapeHtml(item.notes)}
            </div>
          ` : ''}

          <!-- Footer: Link & Azioni -->
          <div class="item-footer">
            ${item.link ? `
              <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="item-link-btn">
                🔗 Scheda Negozio
              </a>
            ` : '<span></span>'}

            <div class="item-actions-btns">
              <button class="btn-card-action" data-action="edit" title="Modifica materiale">✏️</button>
              <button class="btn-card-action btn-delete" data-action="delete" title="Elimina materiale">🗑️</button>
            </div>
          </div>
        </article>
      `;
    });

    elements.itemsContainer.innerHTML = html;
  }

  // --- RENDER LISTA LAVORI (MANODOPERA) ---
  function renderWorksList() {
    let filtered = works.filter(w => {
      // Stato
      if (currentWorksStatus !== 'all' && w.status !== currentWorksStatus) return false;
      // Saldo dovuto
      const dovuto = Math.max(0, (w.totalPrice || 0) - (w.paidAmount || 0));
      if (currentWorksDue === 'with_due' && dovuto <= 0) return false;
      if (currentWorksDue === 'fully_paid' && dovuto > 0) return false;
      // Ricerca
      if (currentWorksSearchQuery) {
        const full = `${w.title} ${w.worker} ${w.notes}`.toLowerCase();
        if (!full.includes(currentWorksSearchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      elements.worksContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔨</div>
          <h3 class="empty-state-title">Nessun lavoro registrato</h3>
          <p class="empty-state-desc">Aggiungi i lavori di manodopera (cucina, battiscopa, idraulico...) e tieni traccia degli acconti!</p>
          <button class="btn btn-primary" id="btn-empty-add-work">+ Aggiungi Lavoro</button>
        </div>
      `;
      const btn = document.getElementById('btn-empty-add-work');
      if (btn) btn.addEventListener('click', openAddWorkModal);
      return;
    }

    let html = '';
    filtered.forEach(work => {
      const concordato = Number(work.totalPrice) || 0;
      const pagato = Number(work.paidAmount) || 0;
      const dovuto = Math.max(0, concordato - pagato);
      const isCompleted = work.status === 'completed';
      const isFullyPaid = dovuto === 0 && concordato > 0;

      let statusBadge = '';
      if (work.status === 'completed') {
        statusBadge = '<span class="tag-badge" style="background:#ECFDF5; color:#065F46;">✅ Terminato</span>';
      } else if (work.status === 'in_progress') {
        statusBadge = '<span class="tag-badge" style="background:#EFF6FF; color:#1D4ED8;">🔄 In corso</span>';
      } else {
        statusBadge = '<span class="tag-badge" style="background:#FFFBEB; color:#92400E;">⏳ Da iniziare</span>';
      }

      html += `
        <article class="work-card ${isCompleted ? 'is-completed' : ''}" data-id="${work.id}">
          <div class="work-header">
            <div class="work-title-wrap">
              <span class="work-title-text">${escapeHtml(work.title)}</span>
              <div class="item-tags-row">
                ${work.worker ? `<span class="tag-badge tag-store">👷‍♂️ ${escapeHtml(work.worker)}</span>` : ''}
                ${statusBadge}
                ${isFullyPaid ? '<span class="tag-badge tag-payment-paid">💰 Saldato al 100%</span>' : ''}
              </div>
            </div>
          </div>

          <!-- Striscia Contabile Lavoro -->
          <div class="work-accounting-strip">
            <div class="work-acc-col">
              <span class="work-acc-label">Concordato</span>
              <span class="work-acc-val">${formatCurrency(concordato)}</span>
            </div>
            <div class="work-acc-col">
              <span class="work-acc-label">Già Pagato</span>
              <span class="work-acc-val val-paid">${formatCurrency(pagato)}</span>
            </div>
            <div class="work-acc-col">
              <span class="work-acc-label">Residuo Dovuto</span>
              <span class="work-acc-val val-due">${formatCurrency(dovuto)}</span>
            </div>
          </div>

          <!-- Note -->
          ${work.notes ? `
            <div class="item-notes">
              📝 ${escapeHtml(work.notes)}
            </div>
          ` : ''}

          <!-- Footer Lavoro -->
          <div class="item-footer">
            ${dovuto > 0 ? `
              <button class="btn btn-secondary" style="font-size:0.8rem; padding: 6px 12px;" data-action="quick-pay">
                💵 Registra Acconto / Salda
              </button>
            ` : '<span style="font-size:0.8rem; color:var(--success); font-weight:600;">✅ Completamente saldato</span>'}

            <div class="item-actions-btns">
              <button class="btn-card-action" data-action="edit-work" title="Modifica lavoro">✏️</button>
              <button class="btn-card-action btn-delete" data-action="delete-work" title="Elimina lavoro">🗑️</button>
            </div>
          </div>
        </article>
      `;
    });

    elements.worksContainer.innerHTML = html;
  }

  // --- MODALI & FORM CONTROLLI ---
  function openModal(modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // Materiale Modal
  function openAddMaterialModal() {
    elements.modalItemTitle.textContent = 'Aggiungi Materiale / Arredo';
    elements.itemIdInput.value = '';
    elements.formItem.reset();
    elements.itemQuantityInput.value = '1';
    elements.itemPrioritySelect.value = 'Media';
    elements.itemStatusSelect.value = 'pending';
    elements.itemPaymentStatusSelect.value = 'to_pay';
    toggleFinancedDetails();
    openModal(elements.modalItem);
    setTimeout(() => elements.itemNameInput.focus(), 150);
  }

  function openEditMaterialModal(item) {
    elements.modalItemTitle.textContent = 'Modifica Materiale';
    elements.itemIdInput.value = item.id;
    elements.itemNameInput.value = item.name || '';
    elements.itemRoomSelect.value = item.room || 'salone';
    elements.itemStoreInput.value = item.store || '';
    elements.itemPriceInput.value = item.price || '';
    elements.itemQuantityInput.value = item.quantity || 1;
    elements.itemPaymentStatusSelect.value = item.paymentStatus || 'to_pay';
    elements.itemFinancedDetailsInput.value = item.financedDetails || '';
    elements.itemDimensionsInput.value = item.dimensions || '';
    elements.itemColorInput.value = item.color || '';
    elements.itemPrioritySelect.value = item.priority || 'Media';
    elements.itemStatusSelect.value = item.status || 'pending';
    elements.itemLinkInput.value = item.link || '';
    elements.itemNotesInput.value = item.notes || '';
    toggleFinancedDetails();
    openModal(elements.modalItem);
  }

  function toggleFinancedDetails() {
    const isFinanced = elements.itemPaymentStatusSelect.value === 'financed';
    elements.groupFinancedDetails.style.display = isFinanced ? 'flex' : 'none';
  }

  // Lavoro Modal
  function openAddWorkModal() {
    elements.modalWorkTitle.textContent = 'Aggiungi Lavoro / Manodopera';
    elements.workIdInput.value = '';
    elements.formWork.reset();
    elements.workPaidAmountInput.value = '0';
    updateLiveWorkDue();
    openModal(elements.modalWork);
    setTimeout(() => elements.workTitleInput.focus(), 150);
  }

  function openEditWorkModal(work) {
    elements.modalWorkTitle.textContent = 'Modifica Lavoro / Manodopera';
    elements.workIdInput.value = work.id;
    elements.workTitleInput.value = work.title || '';
    elements.workWorkerInput.value = work.worker || '';
    elements.workTotalPriceInput.value = work.totalPrice || '';
    elements.workPaidAmountInput.value = work.paidAmount || '0';
    elements.workStatusSelect.value = work.status || 'pending';
    elements.workNotesInput.value = work.notes || '';
    updateLiveWorkDue();
    openModal(elements.modalWork);
  }

  function updateLiveWorkDue() {
    const conc = parseFloat(elements.workTotalPriceInput.value) || 0;
    const pag = parseFloat(elements.workPaidAmountInput.value) || 0;
    const dovuto = Math.max(0, conc - pag);
    elements.workLiveDue.textContent = formatCurrency(dovuto);
  }

  // Acconto Rapido Modal
  function openQuickPayModal(work) {
    selectedWorkForPayment = work;
    const dovuto = Math.max(0, (work.totalPrice || 0) - (work.paidAmount || 0));
    elements.workPaySubtitle.textContent = `${work.title} - Residuo da saldare: ${formatCurrency(dovuto)}`;
    elements.workQuickPayAmount.value = dovuto;
    openModal(elements.modalWorkPayment);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Tab switching
    elements.tabMaterials.addEventListener('click', () => switchTab('materials'));
    elements.tabWorks.addEventListener('click', () => switchTab('works'));

    // FAB
    elements.fabAddMain.addEventListener('click', () => {
      if (currentTab === 'materials') openAddMaterialModal();
      else openAddWorkModal();
    });

    // Modal Materiale
    elements.btnCloseItemModal.addEventListener('click', () => closeModal(elements.modalItem));
    elements.btnCancelItem.addEventListener('click', () => closeModal(elements.modalItem));
    elements.itemPaymentStatusSelect.addEventListener('change', toggleFinancedDetails);

    elements.formItem.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = elements.itemIdInput.value || 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const isExisting = items.some(it => it.id === id);

      const newItem = {
        id: id,
        name: elements.itemNameInput.value.trim(),
        room: elements.itemRoomSelect.value,
        store: elements.itemStoreInput.value.trim(),
        price: parseFloat(elements.itemPriceInput.value) || 0,
        quantity: parseInt(elements.itemQuantityInput.value, 10) || 1,
        paymentStatus: elements.itemPaymentStatusSelect.value,
        financedDetails: elements.itemPaymentStatusSelect.value === 'financed' ? elements.itemFinancedDetailsInput.value.trim() : '',
        dimensions: elements.itemDimensionsInput.value.trim(),
        color: elements.itemColorInput.value.trim(),
        priority: elements.itemPrioritySelect.value,
        status: elements.itemStatusSelect.value,
        link: elements.itemLinkInput.value.trim(),
        notes: elements.itemNotesInput.value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isExisting) {
        items = items.map(it => it.id === id ? newItem : it);
        showToast('✏️ Materiale aggiornato!');
      } else {
        items.unshift(newItem);
        showToast('✨ Materiale aggiunto alla lista!');
      }

      saveLocalData(true);
      closeModal(elements.modalItem);
    });

    // Materiali Card Delegation (toggle comprato, edit, delete)
    elements.itemsContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.item-card');
      if (!card) return;
      const itemId = card.dataset.id;
      const item = items.find(it => it.id === itemId);
      if (!item) return;

      if (e.target.closest('[data-action="toggle-bought"]')) {
        item.status = item.status === 'bought' ? 'pending' : 'bought';
        item.updatedAt = new Date().toISOString();
        saveLocalData(true);
        showToast(item.status === 'bought' ? '✅ Segnato come comprato!' : '⏳ Rimesso da comprare');
        return;
      }

      if (e.target.closest('[data-action="edit"]')) {
        openEditMaterialModal(item);
        return;
      }

      if (e.target.closest('[data-action="delete"]')) {
        if (confirm(`Vuoi eliminare "${item.name}"?`)) {
          items = items.filter(it => it.id !== itemId);
          saveLocalData(true);
          showToast('🗑️ Materiale eliminato');
        }
        return;
      }
    });

    // Modal Lavoro
    elements.btnCloseWorkModal.addEventListener('click', () => closeModal(elements.modalWork));
    elements.btnCancelWork.addEventListener('click', () => closeModal(elements.modalWork));
    elements.workTotalPriceInput.addEventListener('input', updateLiveWorkDue);
    elements.workPaidAmountInput.addEventListener('input', updateLiveWorkDue);

    elements.formWork.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = elements.workIdInput.value || 'work-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const isExisting = works.some(w => w.id === id);
      const total = parseFloat(elements.workTotalPriceInput.value) || 0;
      const paid = parseFloat(elements.workPaidAmountInput.value) || 0;

      const newWork = {
        id: id,
        title: elements.workTitleInput.value.trim(),
        worker: elements.workWorkerInput.value.trim(),
        totalPrice: total,
        paidAmount: paid,
        dueAmount: Math.max(0, total - paid),
        status: elements.workStatusSelect.value,
        notes: elements.workNotesInput.value.trim(),
        updatedAt: new Date().toISOString()
      };

      if (isExisting) {
        works = works.map(w => w.id === id ? newWork : w);
        showToast('✏️ Lavoro aggiornato!');
      } else {
        works.unshift(newWork);
        showToast('🔨 Lavoro aggiunto alla lista!');
      }

      saveLocalData(true);
      closeModal(elements.modalWork);
    });

    // Lavori Card Delegation (quick-pay, edit, delete)
    elements.worksContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.work-card');
      if (!card) return;
      const workId = card.dataset.id;
      const work = works.find(w => w.id === workId);
      if (!work) return;

      if (e.target.closest('[data-action="quick-pay"]')) {
        openQuickPayModal(work);
        return;
      }

      if (e.target.closest('[data-action="edit-work"]')) {
        openEditWorkModal(work);
        return;
      }

      if (e.target.closest('[data-action="delete-work"]')) {
        if (confirm(`Vuoi eliminare il lavoro "${work.title}"?`)) {
          works = works.filter(w => w.id !== workId);
          saveLocalData(true);
          showToast('🗑️ Lavoro rimosso');
        }
        return;
      }
    });

    // Acconto rapido buttons
    elements.btnCloseWorkPayModal.addEventListener('click', () => closeModal(elements.modalWorkPayment));
    elements.btnCancelWorkPay.addEventListener('click', () => closeModal(elements.modalWorkPayment));

    elements.btnWorkPayFull.addEventListener('click', () => {
      if (!selectedWorkForPayment) return;
      selectedWorkForPayment.paidAmount = selectedWorkForPayment.totalPrice;
      selectedWorkForPayment.dueAmount = 0;
      selectedWorkForPayment.status = 'completed';
      selectedWorkForPayment.updatedAt = new Date().toISOString();
      saveLocalData(true);
      showToast('💰 Lavoro saldato al 100%!');
      closeModal(elements.modalWorkPayment);
    });

    elements.btnConfirmWorkPay.addEventListener('click', () => {
      if (!selectedWorkForPayment) return;
      const amountToAdd = parseFloat(elements.workQuickPayAmount.value) || 0;
      selectedWorkForPayment.paidAmount = Math.min(selectedWorkForPayment.totalPrice, (selectedWorkForPayment.paidAmount || 0) + amountToAdd);
      selectedWorkForPayment.dueAmount = Math.max(0, selectedWorkForPayment.totalPrice - selectedWorkForPayment.paidAmount);
      if (selectedWorkForPayment.dueAmount === 0) selectedWorkForPayment.status = 'completed';
      selectedWorkForPayment.updatedAt = new Date().toISOString();
      saveLocalData(true);
      showToast('💵 Acconto registrato!');
      closeModal(elements.modalWorkPayment);
    });

    // Filtri Materiali
    elements.searchInput.addEventListener('input', () => {
      currentSearchQuery = elements.searchInput.value.trim().toLowerCase();
      elements.searchClearBtn.style.display = currentSearchQuery ? 'block' : 'none';
      renderMaterialsList();
    });

    elements.searchClearBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      currentSearchQuery = '';
      elements.searchClearBtn.style.display = 'none';
      renderMaterialsList();
    });

    elements.roomPills.forEach(pill => {
      pill.addEventListener('click', () => {
        elements.roomPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilterRoom = pill.dataset.room;
        renderMaterialsList();
      });
    });

    elements.filterStore.addEventListener('change', () => {
      currentFilterStore = elements.filterStore.value;
      renderMaterialsList();
    });

    elements.filterPayment.addEventListener('change', () => {
      currentFilterPayment = elements.filterPayment.value;
      renderMaterialsList();
    });

    elements.filterStatus.addEventListener('change', () => {
      currentFilterStatus = elements.filterStatus.value;
      renderMaterialsList();
    });

    elements.sortItems.addEventListener('change', () => {
      currentSort = elements.sortItems.value;
      renderMaterialsList();
    });

    // Filtri Lavori
    elements.searchWorksInput.addEventListener('input', () => {
      currentWorksSearchQuery = elements.searchWorksInput.value.trim().toLowerCase();
      elements.searchWorksClearBtn.style.display = currentWorksSearchQuery ? 'block' : 'none';
      renderWorksList();
    });

    elements.searchWorksClearBtn.addEventListener('click', () => {
      elements.searchWorksInput.value = '';
      currentWorksSearchQuery = '';
      elements.searchWorksClearBtn.style.display = 'none';
      renderWorksList();
    });

    elements.filterWorksStatus.addEventListener('change', () => {
      currentWorksStatus = elements.filterWorksStatus.value;
      renderWorksList();
    });

    elements.filterWorksDue.addEventListener('change', () => {
      currentWorksDue = elements.filterWorksDue.value;
      renderWorksList();
    });

    // Header Actions
    elements.btnOpenSync.addEventListener('click', () => openModal(elements.modalSync));
    elements.btnCloseSyncModal.addEventListener('click', () => closeModal(elements.modalSync));
    elements.btnCloseSync.addEventListener('click', () => closeModal(elements.modalSync));

    elements.btnForceSync.addEventListener('click', () => {
      syncWithCloud({ silent: false });
    });

    elements.btnExportBackup.addEventListener('click', exportBackupJson);
    elements.btnImportBackupTrigger.addEventListener('click', () => elements.importBackupFile.click());
    elements.importBackupFile.addEventListener('change', importBackupJson);

    elements.btnOpenShare.addEventListener('click', () => openModal(elements.modalShare));
    elements.btnCloseShareModal.addEventListener('click', () => closeModal(elements.modalShare));
    elements.btnCloseShare.addEventListener('click', () => closeModal(elements.modalShare));

    elements.btnShareWhatsapp.addEventListener('click', shareViaWhatsApp);
    elements.btnCopyClipboard.addEventListener('click', copyListToClipboard);
    elements.btnExportCsv.addEventListener('click', exportCsv);

    // Chiudi modali cliccando sul backdrop
    [elements.modalItem, elements.modalWork, elements.modalWorkPayment, elements.modalSync, elements.modalShare].forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) closeModal(m);
      });
    });

    // Online / Offline
    window.addEventListener('online', () => {
      showToast('🌐 Connessione internet ripristinata!');
      syncWithCloud({ silent: true });
    });

    window.addEventListener('offline', () => {
      showToast('📶 Sei offline. Le modifiche sono memorizzate sul telefono.');
      updateSyncBadge('offline');
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    if (tab === 'materials') {
      elements.tabMaterials.classList.add('active');
      elements.tabWorks.classList.remove('active');
      elements.submetricsMaterials.style.display = 'grid';
      elements.submetricsWorks.style.display = 'none';
      elements.filtersMaterialsSection.style.display = 'flex';
      elements.filtersWorksSection.style.display = 'none';
      elements.itemsContainer.style.display = 'flex';
      elements.worksContainer.style.display = 'none';
      elements.fabLabel.textContent = 'Aggiungi Materiale';
      renderMaterialsSubmetrics();
      renderMaterialsList();
    } else {
      elements.tabWorks.classList.add('active');
      elements.tabMaterials.classList.remove('active');
      elements.submetricsWorks.style.display = 'grid';
      elements.submetricsMaterials.style.display = 'none';
      elements.filtersWorksSection.style.display = 'flex';
      elements.filtersMaterialsSection.style.display = 'none';
      elements.worksContainer.style.display = 'flex';
      elements.itemsContainer.style.display = 'none';
      elements.fabLabel.textContent = 'Aggiungi Lavoro';
      renderWorksSubmetrics();
      renderWorksList();
    }
  }

  // --- SHARE WHATSAPP & EXPORT ---
  function generateShareText() {
    let text = `🏠 *CASA BURJASSOT - RIEPILOGO SPESE & LAVORI*\n`;
    text += `Aggiornato al: ${new Date().toLocaleDateString('it-IT')}\n\n`;

    // Calcoli totali
    let matTotal = 0, matFinanced = 0, matPaid = 0, matDue = 0;
    items.forEach(it => {
      const c = (it.price || 0) * (it.quantity || 1);
      matTotal += c;
      if (it.paymentStatus === 'financed') matFinanced += c;
      else if (it.paymentStatus === 'paid_cash') matPaid += c;
      else matDue += c;
    });

    let worksTotal = 0, worksPaid = 0, worksDue = 0;
    works.forEach(w => {
      worksTotal += (w.totalPrice || 0);
      worksPaid += (w.paidAmount || 0);
      worksDue += Math.max(0, (w.totalPrice || 0) - (w.paidAmount || 0));
    });

    const grand = matTotal + worksTotal;
    const totPaid = matPaid + worksPaid;
    const totDue = matDue + worksDue;

    text += `💰 *QUADRO ECONOMICO:*\n`;
    text += `• Totale Preventivato: *${formatCurrency(grand)}*\n`;
    text += `• Totale Finanziato: *${formatCurrency(matFinanced)}*\n`;
    text += `• Già Pagato Cash: *${formatCurrency(totPaid)}*\n`;
    text += `• Rimanente da Saldare Cash: *${formatCurrency(totDue)}*\n\n`;

    text += `🔨 *LAVORI & MANODOPERA (${works.length}):*\n`;
    works.forEach(w => {
      const dovuto = Math.max(0, (w.totalPrice || 0) - (w.paidAmount || 0));
      text += `• ${w.title} (${w.worker || 'Professionista'}): Concordato ${formatCurrency(w.totalPrice)} | Pagato: ${formatCurrency(w.paidAmount)} | Da saldare: *${formatCurrency(dovuto)}*\n`;
    });
    text += `\n`;

    const pendingMat = items.filter(it => it.status !== 'bought');
    text += `📦 *MATERIALI DA COMPRARE (${pendingMat.length}):*\n`;
    pendingMat.forEach(it => {
      const cost = it.price ? ` - ${formatCurrency(it.price * (it.quantity || 1))}` : '';
      const st = it.store ? ` (${it.store})` : '';
      const fin = it.paymentStatus === 'financed' ? ' [Finanziato]' : '';
      text += `• ${it.name}${cost}${st}${fin}\n`;
    });

    return text;
  }

  function shareViaWhatsApp() {
    const text = generateShareText();
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function copyListToClipboard() {
    const text = generateShareText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Testo riepilogo copiato!');
        closeModal(elements.modalShare);
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('📋 Testo riepilogo copiato!');
    closeModal(elements.modalShare);
  }

  function exportCsv() {
    let csv = '\uFEFF';
    // Sezione Materiali
    csv += 'SEZIONE MATERIALI & MOBILI\r\n';
    csv += 'Nome;Stanza;Negozio;Prezzo;Quantita;Totale;Modalita Pagamento;Rate Finanziamento;Dimensioni;Colore;Priorita;Stato;Note\r\n';
    items.forEach(it => {
      csv += [
        `"${(it.name || '').replace(/"/g, '""')}"`,
        `"${(it.room || '').replace(/"/g, '""')}"`,
        `"${(it.store || '').replace(/"/g, '""')}"`,
        it.price || 0,
        it.quantity || 1,
        (it.price || 0) * (it.quantity || 1),
        it.paymentStatus === 'financed' ? 'Finanziato' : (it.paymentStatus === 'paid_cash' ? 'Pagato Cash' : 'Da Pagare Cash'),
        `"${(it.financedDetails || '').replace(/"/g, '""')}"`,
        `"${(it.dimensions || '').replace(/"/g, '""')}"`,
        `"${(it.color || '').replace(/"/g, '""')}"`,
        `"${(it.priority || '').replace(/"/g, '""')}"`,
        `"${(it.status || '').replace(/"/g, '""')}"`,
        `"${(it.notes || '').replace(/"/g, '""')}"`
      ].join(';') + '\r\n';
    });

    csv += '\r\n\r\nSEZIONE LAVORI & MANODOPERA\r\n';
    csv += 'Titolo Lavoro;Professionista;Prezzo Concordato;Gia Pagato;Residuo Dovuto;Stato;Note\r\n';
    works.forEach(w => {
      const conc = w.totalPrice || 0;
      const pag = w.paidAmount || 0;
      const dov = Math.max(0, conc - pag);
      csv += [
        `"${(w.title || '').replace(/"/g, '""')}"`,
        `"${(w.worker || '').replace(/"/g, '""')}"`,
        conc,
        pag,
        dov,
        `"${(w.status || '').replace(/"/g, '""')}"`,
        `"${(w.notes || '').replace(/"/g, '""')}"`
      ].join(';') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `casa-burjassot-completo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('📊 File Excel CSV scaricato!');
  }

  function exportBackupJson() {
    const backup = {
      version: 2,
      exportDate: new Date().toISOString(),
      items: items,
      works: works
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `casa-burjassot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showToast('📥 Backup JSON scaricato!');
  }

  function importBackupJson(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        if (json.items && Array.isArray(json.items)) {
          items = json.items;
        } else if (Array.isArray(json)) {
          items = json;
        }
        if (json.works && Array.isArray(json.works)) {
          works = json.works;
        }
        saveLocalData(true);
        showToast('📤 Backup ripristinato con successo!');
        closeModal(elements.modalSync);
      } catch (err) {
        showToast('❌ Errore nella lettura del file di backup');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // --- PWA LOGIC ---
  function setupPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      elements.btnInstallHeader.style.display = 'inline-flex';
      elements.pwaInstallBanner.style.display = 'flex';
    });

    const triggerInstall = async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('🎉 App installata sulla home!');
          elements.pwaInstallBanner.style.display = 'none';
          elements.btnInstallHeader.style.display = 'none';
        }
        deferredInstallPrompt = null;
      } else {
        const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
        if (isIos) {
          openModal(elements.modalSync);
          elements.iosHelper.style.display = 'block';
        } else {
          showToast('💡 Clicca sui 3 puntini del browser > "Installa applicazione"');
        }
      }
    };

    elements.btnInstallHeader.addEventListener('click', triggerInstall);
    elements.btnPwaInstall.addEventListener('click', triggerInstall);
    elements.btnPwaDismiss.addEventListener('click', () => {
      elements.pwaInstallBanner.style.display = 'none';
    });

    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      elements.iosHelper.style.display = 'block';
      elements.btnInstallHeader.style.display = 'inline-flex';
    }
  }

  // --- HELPERS ---
  function formatCurrency(n) {
    if (isNaN(n) || n === 0) return '0 €';
    return Number(n).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  }

  function getRoomBadgeClass(r) {
    const s = (r || '').toLowerCase();
    if (s.includes('salone')) return 'tag-room-salone';
    if (s.includes('cucina')) return 'tag-room-cucina';
    if (s.includes('bagno')) return 'tag-room-bagno';
    if (s.includes('camera')) return 'tag-room-camera';
    if (s.includes('corridoio')) return 'tag-room-corridoio';
    if (s.includes('terrazzo')) return 'tag-room-terrazzo';
    return 'tag-room-altro';
  }

  function getRoomLabel(r) {
    const s = (r || '').toLowerCase();
    if (s === 'salone') return '🛋️ Salone';
    if (s === 'cucina') return '🍳 Cucina';
    if (s === 'bagno') return '🚿 Bagno';
    if (s === 'camera') return '🛏️ Camera';
    if (s === 'corridoio') return '🚪 Corridoio';
    if (s === 'terrazzo') return '🪴 Terrazzo';
    if (s === 'altro') return '📦 Altro';
    return r ? '🏠 ' + r : '🏠 Casa';
  }

  function getPriorityClass(p) {
    if (p === 'Alta') return 'tag-priority-alta';
    if (p === 'Bassa') return 'tag-priority-bassa';
    return 'tag-priority-media';
  }

  function getColorStyle(c) {
    const s = (c || '').toLowerCase();
    if (s.includes('bianco')) return '#ffffff';
    if (s.includes('nero')) return '#18181b';
    if (s.includes('grigio') || s.includes('antracite')) return '#475569';
    if (s.includes('rovere') || s.includes('legno') || s.includes('marrone')) return '#b45309';
    if (s.includes('cromo') || s.includes('argento')) return '#cbd5e1';
    if (s.includes('oro')) return '#f59e0b';
    return '#94a3b8';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  init();
})();

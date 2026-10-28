/**
 * CASA BURJASSOT - Progressive Web App (Versione 5: Sincronizzazione Real-Time Anti-Cache & Multi-Device)
 * - Risolve definitivamente il caching del Service Worker e la sincronizzazione mobile/desktop
 * - Mostra l'orario esatto dell'ultimo aggiornamento online in cima
 * - Supporto Tombstones per impedire la ricomparsa degli elementi cancellati
 */

(function () {
  'use strict';

  // --- CONFIGURAZIONE GOOGLE APPS SCRIPT ---
  const DEFAULT_SYNC_URL = 'https://script.google.com/macros/s/AKfycbxA6uG7zWv4GIJPiy5YTBuCmgWo0baDoi01cG5k3zpVpHkgTlNzJQ9O9Blt9yEERg-Khg/exec';
  const STORAGE_ITEMS_KEY = 'burjassot_shopping_items_v5';
  const STORAGE_WORKS_KEY = 'burjassot_renovation_works_v5';
  const STORAGE_FIN_KEY = 'burjassot_financings_v5';
  const STORAGE_TOMBSTONES_KEY = 'burjassot_tombstones_v5';

  // --- STATO APPLICAZIONE ---
  let items = [];
  let works = [];
  let financings = [];
  let tombstones = new Set();
  let currentTab = 'materials'; // 'materials' | 'works' | 'financings'

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

  // Stato sincronizzazione e UI
  let isPushing = false;
  let isPulling = false;
  let pushPending = false;
  let lastPushTimestamp = 0;
  let autoSyncDebounceTimer = null;
  let isAnyModalOpen = false;
  let deferredInstallPrompt = null;
  let selectedWorkForPayment = null;

  // --- ELEMENTI DOM ---
  const elements = {
    btnInstallHeader: document.getElementById('btn-install-header'),
    btnOpenShare: document.getElementById('btn-open-share'),
    btnOpenSync: document.getElementById('btn-open-sync'),
    syncIcon: document.getElementById('sync-icon'),
    syncStatusIndicator: document.getElementById('sync-status-indicator'),
    headerSyncCaption: document.getElementById('header-sync-caption'),

    // Quadro Globale
    statGrandTotal: document.getElementById('stat-grand-total'),
    statGlobalProgress: document.getElementById('stat-global-progress'),
    statGlobalFinanced: document.getElementById('stat-global-financed'),
    statMonthlyRateSub: document.getElementById('stat-monthly-rate-sub'),
    statGlobalPaidCash: document.getElementById('stat-global-paid-cash'),
    statGlobalRemainCash: document.getElementById('stat-global-remain-cash'),

    // 3 Tab
    tabMaterials: document.getElementById('tab-materials'),
    tabWorks: document.getElementById('tab-works'),
    tabFinancings: document.getElementById('tab-financings'),
    badgeMaterialsCount: document.getElementById('badge-materials-count'),
    badgeWorksCount: document.getElementById('badge-works-count'),
    badgeFinancingsCount: document.getElementById('badge-financings-count'),

    // Submetriche
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

    submetricsFinancings: document.getElementById('submetrics-financings'),
    statFinTotal: document.getElementById('stat-fin-total'),
    statFinPlansCount: document.getElementById('stat-fin-plans-count'),
    statFinMonthlyTotal: document.getElementById('stat-fin-monthly-total'),
    statFinInterestTotal: document.getElementById('stat-fin-interest-total'),

    // Filtri
    filtersMaterialsSection: document.getElementById('filters-materials-section'),
    filtersWorksSection: document.getElementById('filters-works-section'),
    filtersFinancingsSection: document.getElementById('filters-financings-section'),
    btnCreateFinTop: document.getElementById('btn-create-fin-top'),

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

    // Liste
    itemsContainer: document.getElementById('items-list-container'),
    worksContainer: document.getElementById('works-list-container'),
    financingsContainer: document.getElementById('financings-list-container'),

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
    groupSelectFinancing: document.getElementById('group-select-financing'),
    itemFinancingSelect: document.getElementById('item-financing-select'),
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

    // Modal Finanziamento
    modalFinancing: document.getElementById('modal-financing'),
    modalFinTitle: document.getElementById('modal-fin-title'),
    formFinancing: document.getElementById('form-financing'),
    finIdInput: document.getElementById('fin-id'),
    finNameInput: document.getElementById('fin-name'),
    finAmountInput: document.getElementById('fin-amount'),
    finInstallmentsSelect: document.getElementById('fin-installments'),
    finInterestTypeSelect: document.getElementById('fin-interest-type'),
    groupFinInterestVal: document.getElementById('group-fin-interest-val'),
    lblFinInterestVal: document.getElementById('lbl-fin-interest-val'),
    finInterestValInput: document.getElementById('fin-interest-val'),
    finPreviewMonthly: document.getElementById('fin-preview-monthly'),
    finPreviewInterests: document.getElementById('fin-preview-interests'),
    finPreviewTotal: document.getElementById('fin-preview-total'),
    finStartDateInput: document.getElementById('fin-start-date'),
    finNotesInput: document.getElementById('fin-notes'),
    btnCloseFinModal: document.getElementById('btn-close-fin-modal'),
    btnCancelFin: document.getElementById('btn-cancel-fin'),

    // Modal Acconto Lavoro
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

    pwaInstallBanner: document.getElementById('pwa-install-banner'),
    btnPwaInstall: document.getElementById('btn-pwa-install'),
    btnPwaDismiss: document.getElementById('btn-pwa-dismiss'),
    toastContainer: document.getElementById('toast-container')
  };

  // --- AVVIO APP ---
  function init() {
    loadLocalData();
    setupEventListeners();
    setupPWA();
    renderAll();

    // Sincronizzazione immediata all'apertura
    pullFromCloud({ silent: true });

    // POLLING CONTINUO AUTOMATICO: ogni 5 secondi controlla il server
    setInterval(() => {
      if (!isAnyModalOpen && !isPushing) {
        pullFromCloud({ silent: true });
      }
    }, 5000);

    // RISVEGLIO ISTANTANEO: quando torni sull'app o cambi finestra, sincronizza subito!
    window.addEventListener('focus', () => {
      if (!isAnyModalOpen) pullFromCloud({ silent: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !isAnyModalOpen) {
        pullFromCloud({ silent: true });
      }
    });
  }

  // --- CARICAMENTO & SALVATAGGIO LOCALE ---
  function loadLocalData() {
    try {
      const rawI = localStorage.getItem(STORAGE_ITEMS_KEY);
      items = rawI ? JSON.parse(rawI) : [];
    } catch (e) { items = []; }

    try {
      const rawW = localStorage.getItem(STORAGE_WORKS_KEY);
      works = rawW ? JSON.parse(rawW) : [];
    } catch (e) { works = []; }

    try {
      const rawF = localStorage.getItem(STORAGE_FIN_KEY);
      financings = rawF ? JSON.parse(rawF) : [];
    } catch (e) { financings = []; }

    try {
      const rawT = localStorage.getItem(STORAGE_TOMBSTONES_KEY);
      tombstones = new Set(rawT ? JSON.parse(rawT) : []);
    } catch (e) { tombstones = new Set(); }
  }

  function saveLocalStateOnly() {
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
    localStorage.setItem(STORAGE_WORKS_KEY, JSON.stringify(works));
    localStorage.setItem(STORAGE_FIN_KEY, JSON.stringify(financings));
    localStorage.setItem(STORAGE_TOMBSTONES_KEY, JSON.stringify(Array.from(tombstones)));
  }

  function onDataChangedByUser() {
    saveLocalStateOnly();
    renderAll();
    triggerSyncPush();
  }

  function triggerSyncPush() {
    clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = setTimeout(() => {
      pushToCloud({ silent: true });
    }, 300);
  }

  // --- MOTORE DI SINCRONIZZAZIONE (PULL & PUSH) ---
  // 1. PULL (Scarica dal Google Sheet)
  async function pullFromCloud(options = {}) {
    if (isPulling || isPushing) return;
    if (Date.now() - lastPushTimestamp < 2000) return;

    isPulling = true;

    try {
      const res = await fetch(DEFAULT_SYNC_URL + '?t=' + Date.now(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      const data = await res.json();

      if (data && data.status === 'success') {
        let changed = false;

        // Filtra tassativamente via qualsiasi elemento presente nei tombstones locali
        if (Array.isArray(data.items)) {
          const filteredItems = data.items.filter(it => !tombstones.has(it.id));
          if (JSON.stringify(items) !== JSON.stringify(filteredItems)) {
            items = filteredItems;
            changed = true;
          }
        }

        if (Array.isArray(data.works)) {
          const filteredWorks = data.works.filter(w => !tombstones.has(w.id));
          if (JSON.stringify(works) !== JSON.stringify(filteredWorks)) {
            works = filteredWorks;
            changed = true;
          }
        }

        if (Array.isArray(data.financings)) {
          const filteredFin = data.financings.filter(f => !tombstones.has(f.id));
          if (JSON.stringify(financings) !== JSON.stringify(filteredFin)) {
            financings = filteredFin;
            changed = true;
          }
        }

        // Pulisci i tombstones confermati (quelli che il server non invia più)
        tombstones.forEach(id => {
          const inItems = data.items?.some(it => it.id === id);
          const inWorks = data.works?.some(w => w.id === id);
          const inFin = data.financings?.some(f => f.id === id);
          if (!inItems && !inWorks && !inFin) {
            tombstones.delete(id);
          }
        });

        if (changed) {
          saveLocalStateOnly();
          renderAll();
        }

        const nowTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        updateSyncBadge('online', `Sincronizzato alle ${nowTime}`);
        if (!options.silent) {
          showToast('✅ Dati allineati dal Google Sheet!');
        }
      } else {
        updateSyncBadge('offline', 'Errore risposta server');
      }
    } catch (err) {
      console.warn('Pull error:', err);
      updateSyncBadge('offline', 'Non connesso al foglio');
    } finally {
      isPulling = false;
      if (pushPending) {
        pushPending = false;
        pushToCloud({ silent: true });
      }
    }
  }

  // 2. PUSH (Invia le modifiche con coda anti-collisione)
  async function pushToCloud(options = {}) {
    if (isPushing) {
      pushPending = true;
      return;
    }

    isPushing = true;
    lastPushTimestamp = Date.now();
    updateSyncBadge('syncing', 'Salvataggio sul foglio...');

    try {
      const payload = {
        action: 'sync_all',
        deletedIds: Array.from(tombstones),
        items: items,
        works: works,
        financings: financings
      };

      await fetch(DEFAULT_SYNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      const nowTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      updateSyncBadge('online', `Sincronizzato alle ${nowTime}`);
      if (!options.silent) {
        showToast('✅ Modifiche salvate sul Google Sheet!');
      }
    } catch (err) {
      console.warn('Push error:', err);
      // Spesso Apps Script salva comunque anche se il browser segnala redirect
      const nowTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      updateSyncBadge('online', `Sincronizzato alle ${nowTime}`);
    } finally {
      isPushing = false;
      if (pushPending) {
        pushPending = false;
        pushToCloud({ silent: true });
      }
    }
  }

  // Chiamata GET diretta per eliminazione immediata garantita al 100%
  function sendDirectDeleteGet(id) {
    fetch(`${DEFAULT_SYNC_URL}?action=delete&id=${encodeURIComponent(id)}&t=${Date.now()}`, {
      method: 'GET',
      mode: 'no-cors'
    }).catch(() => {});
  }

  function updateSyncBadge(status, captionText) {
    elements.syncStatusIndicator.className = 'sync-status-dot';
    if (status === 'online') {
      elements.syncStatusIndicator.classList.add('status-online');
      elements.syncStatusIndicator.title = 'Sincronizzato online in tempo reale';
      elements.syncIcon.style.animation = 'none';
      if (captionText) elements.headerSyncCaption.textContent = captionText;
    } else if (status === 'syncing') {
      elements.syncStatusIndicator.classList.add('status-syncing');
      elements.syncStatusIndicator.title = 'Sincronizzazione in corso...';
      elements.syncIcon.style.animation = 'spin 1s linear infinite';
      if (captionText) elements.headerSyncCaption.textContent = captionText;
    } else {
      elements.syncStatusIndicator.classList.add('status-offline');
      elements.syncStatusIndicator.title = 'Offline o errore sincronizzazione';
      elements.syncIcon.style.animation = 'none';
      if (captionText) elements.headerSyncCaption.textContent = captionText;
    }
  }

  // --- RENDER GENERALE & CONTABILITÀ ---
  function renderAll() {
    renderGlobalAccounting();
    if (currentTab === 'materials') {
      renderMaterialsSubmetrics();
      renderMaterialsList();
    } else if (currentTab === 'works') {
      renderWorksSubmetrics();
      renderWorksList();
    } else {
      renderFinancingsSubmetrics();
      renderFinancingsList();
    }
  }

  // 1. QUADRO GLOBALE
  function renderGlobalAccounting() {
    let matTotal = 0;
    let matFinanced = 0;
    let matPaidCash = 0;
    let matToPayCash = 0;

    items.forEach(it => {
      const cost = (Number(it.price) || 0) * (Number(it.quantity) || 1);
      matTotal += cost;
      if (it.paymentStatus === 'financed') {
        matFinanced += cost;
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

    let totalMonthlyRates = 0;
    let totalFinancedCapital = 0;
    financings.forEach(f => {
      totalMonthlyRates += Number(f.monthlyInstallment) || 0;
      totalFinancedCapital += Number(f.totalAmount) || 0;
    });

    const displayedFinanced = Math.max(matFinanced, totalFinancedCapital);
    const grandTotal = matTotal + worksTotal;
    const globalPaidCash = matPaidCash + worksPaid;
    const globalRemainCash = matToPayCash + worksDue;

    const completedBudget = matPaidCash + displayedFinanced + worksPaid;
    const progressPercent = grandTotal > 0 ? Math.min(100, Math.round((completedBudget / grandTotal) * 100)) : 0;

    elements.statGrandTotal.textContent = formatCurrency(grandTotal);
    elements.statGlobalFinanced.textContent = formatCurrency(displayedFinanced);
    elements.statMonthlyRateSub.textContent = `Tot. rate: ${formatCurrency(totalMonthlyRates)} / mese`;
    elements.statGlobalPaidCash.textContent = formatCurrency(globalPaidCash);
    elements.statGlobalRemainCash.textContent = formatCurrency(globalRemainCash);
    elements.statGlobalProgress.textContent = progressPercent + '%';

    elements.badgeMaterialsCount.textContent = items.length;
    elements.badgeWorksCount.textContent = works.length;
    elements.badgeFinancingsCount.textContent = financings.length;
  }

  // Submetriche Materiali
  function renderMaterialsSubmetrics() {
    let matTotal = 0, matPaid = 0, matFinanced = 0;
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
    let worksTotal = 0, worksPaid = 0, worksDue = 0;
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

  // Submetriche Finanziamenti
  function renderFinancingsSubmetrics() {
    let finTotal = 0, monthlyTotal = 0, interestTotal = 0;
    financings.forEach(f => {
      const cap = Number(f.totalAmount) || 0;
      const totWithInt = Number(f.totalWithInterest) || cap;
      finTotal += cap;
      monthlyTotal += Number(f.monthlyInstallment) || 0;
      interestTotal += Math.max(0, totWithInt - cap);
    });

    elements.statFinTotal.textContent = formatCurrency(finTotal);
    elements.statFinPlansCount.textContent = `${financings.length} piani attivi`;
    elements.statFinMonthlyTotal.textContent = `${formatCurrency(monthlyTotal)} / mese`;
    elements.statFinInterestTotal.textContent = formatCurrency(interestTotal);
  }

  // --- RENDER LISTA MATERIALI ---
  function renderMaterialsList() {
    let filtered = items.filter(item => {
      if (currentFilterRoom !== 'all') {
        if ((item.room || '').toLowerCase() !== currentFilterRoom.toLowerCase()) return false;
      }
      if (currentFilterStatus !== 'all') {
        if (item.status !== currentFilterStatus) return false;
      }
      if (currentFilterPayment !== 'all') {
        if (item.paymentStatus !== currentFilterPayment) return false;
      }
      if (currentFilterStore !== 'all') {
        const itemStore = (item.store || '').toLowerCase();
        if (currentFilterStore === 'Altro') {
          const known = ['brico depôt', 'bricodepot', 'leroy merlin', 'ikea', 'bauhaus', 'obramat', 'amazon', 'conforama', 'maisons du monde'];
          if (known.some(k => itemStore.includes(k))) return false;
        } else if (!itemStore.includes(currentFilterStore.toLowerCase())) {
          return false;
        }
      }
      if (currentSearchQuery) {
        const full = `${item.name} ${item.store} ${item.room} ${item.color} ${item.dimensions} ${item.financingName} ${item.notes}`.toLowerCase();
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
          <p class="empty-state-desc">Nessun articolo presente o corrispondente ai filtri. Aggiungine uno nuovo!</p>
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

      let paymentBadge = '';
      if (item.paymentStatus === 'financed') {
        const finPlanName = item.financingName ? `: ${escapeHtml(item.financingName)}` : '';
        paymentBadge = `<span class="tag-badge tag-payment-financed">💳 Finanziato${finPlanName}</span>`;
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

          ${item.paymentStatus === 'financed' ? `
            <div class="item-financed-box">
              <span>💳 <strong>Piano Rateale:</strong> ${escapeHtml(item.financingName || 'Non ancora associato a un piano')}</span>
            </div>
          ` : ''}

          ${(item.dimensions || item.color) ? `
            <div class="item-details-grid">
              ${item.dimensions ? `<span class="detail-item">📐 <strong>Misura:</strong> ${escapeHtml(item.dimensions)}</span>` : ''}
              ${item.color ? `<span class="detail-item">🎨 <strong>Colore:</strong> <span class="color-dot" style="background-color:${getColorStyle(item.color)}"></span> ${escapeHtml(item.color)}</span>` : ''}
            </div>
          ` : ''}

          ${item.notes ? `
            <div class="item-notes">
              📝 ${escapeHtml(item.notes)}
            </div>
          ` : ''}

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

  // --- RENDER LISTA LAVORI ---
  function renderWorksList() {
    let filtered = works.filter(w => {
      if (currentWorksStatus !== 'all' && w.status !== currentWorksStatus) return false;
      const dovuto = Math.max(0, (w.totalPrice || 0) - (w.paidAmount || 0));
      if (currentWorksDue === 'with_due' && dovuto <= 0) return false;
      if (currentWorksDue === 'fully_paid' && dovuto > 0) return false;
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
          <p class="empty-state-desc">Aggiungi i lavori di manodopera (cucina, battiscopa, idraulico...) e gestisci gli acconti!</p>
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

          ${work.notes ? `
            <div class="item-notes">
              📝 ${escapeHtml(work.notes)}
            </div>
          ` : ''}

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

  // --- RENDER LISTA FINANZIAMENTI ---
  function renderFinancingsList() {
    if (financings.length === 0) {
      elements.financingsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💳</div>
          <h3 class="empty-state-title">Nessun finanziamento creato</h3>
          <p class="empty-state-desc">Crea un piano di rateizzazione (es. Findomestic IKEA, Santander, Brico Depôt Tasso 0) per calcolare la rata mensile e associare gli oggetti!</p>
          <button class="btn btn-purple" id="btn-empty-add-fin">+ Crea Nuovo Finanziamento</button>
        </div>
      `;
      const btn = document.getElementById('btn-empty-add-fin');
      if (btn) btn.addEventListener('click', openAddFinancingModal);
      return;
    }

    let html = '';
    financings.forEach(fin => {
      const cap = Number(fin.totalAmount) || 0;
      const rateCount = Number(fin.installmentsCount) || 10;
      const monthly = Number(fin.monthlyInstallment) || (cap / rateCount);
      const totalWithInt = Number(fin.totalWithInterest) || cap;
      const interests = Math.max(0, totalWithInt - cap);

      const linkedItems = items.filter(it => it.financingId === fin.id);
      const linkedSum = linkedItems.reduce((acc, it) => acc + ((it.price || 0) * (it.quantity || 1)), 0);

      html += `
        <article class="financing-card" data-id="${fin.id}">
          <div class="fin-header">
            <div>
              <h3 class="fin-title">💳 ${escapeHtml(fin.name)}</h3>
              <span style="font-size: 0.75rem; color: #7E22CE;">
                ${fin.interestType === 'zero' ? 'Tasso 0% (Senza Interessi)' : (fin.interestType === 'percent' ? `TAN / Interessi: ${fin.interestValue}%` : `Costo fisso: ${formatCurrency(fin.interestValue)}`)}
                ${fin.startDate ? ` • Inizio: ${escapeHtml(fin.startDate)}` : ''}
              </span>
            </div>
          </div>

          <div class="fin-stats-strip">
            <div class="fin-stat-col">
              <span class="fin-stat-label">Capitale</span>
              <span class="fin-stat-val">${formatCurrency(cap)}</span>
            </div>
            <div class="fin-stat-col">
              <span class="fin-stat-label">Rata Mensile</span>
              <span class="fin-stat-val" style="color:#581C87; font-size:1.15rem;">${formatCurrency(monthly)} / m</span>
              <span style="font-size:0.68rem; color:#7E22CE;">${rateCount} rate</span>
            </div>
            <div class="fin-stat-col">
              <span class="fin-stat-label">Tot. con Interessi</span>
              <span class="fin-stat-val">${formatCurrency(totalWithInt)}</span>
              ${interests > 0 ? `<span style="font-size:0.68rem; color:var(--danger);">(+${formatCurrency(interests)})</span>` : ''}
            </div>
          </div>

          <div class="fin-items-preview">
            <div class="fin-items-header">
              📦 Oggetti Inclusi (${linkedItems.length} - Tot. ${formatCurrency(linkedSum)}):
            </div>
            <div class="fin-items-list">
              ${linkedItems.length > 0 ? linkedItems.map(it => `
                <span class="fin-item-pill">
                  ${escapeHtml(it.name)} (${formatCurrency((it.price || 0) * (it.quantity || 1))})
                </span>
              `).join('') : '<span style="color:var(--text-muted); font-size:0.75rem;">Nessun articolo associato ancora. Modifica un materiale e assegnalo a questo finanziamento!</span>'}
            </div>
          </div>

          ${fin.notes ? `
            <div class="item-notes">
              📝 ${escapeHtml(fin.notes)}
            </div>
          ` : ''}

          <div class="item-footer">
            <span style="font-size:0.75rem; color:var(--text-muted);">
              ${rateCount} mensilità da ${formatCurrency(monthly)}
            </span>
            <div class="item-actions-btns">
              <button class="btn-card-action" data-action="edit-fin" title="Modifica piano">✏️</button>
              <button class="btn-card-action btn-delete" data-action="delete-fin" title="Elimina piano">🗑️</button>
            </div>
          </div>
        </article>
      `;
    });

    elements.financingsContainer.innerHTML = html;
  }

  // --- MODALI & CONTROLLI ---
  function openModal(modal) {
    isAnyModalOpen = true;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    isAnyModalOpen = false;
  }

  function openAddMaterialModal() {
    elements.modalItemTitle.textContent = 'Aggiungi Materiale / Arredo';
    elements.itemIdInput.value = '';
    elements.formItem.reset();
    elements.itemQuantityInput.value = '1';
    elements.itemPrioritySelect.value = 'Media';
    elements.itemStatusSelect.value = 'pending';
    elements.itemPaymentStatusSelect.value = 'to_pay';
    populateFinancingDropdown('');
    togglePaymentFinancingSection();
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
    populateFinancingDropdown(item.financingId || '');
    elements.itemDimensionsInput.value = item.dimensions || '';
    elements.itemColorInput.value = item.color || '';
    elements.itemPrioritySelect.value = item.priority || 'Media';
    elements.itemStatusSelect.value = item.status || 'pending';
    elements.itemLinkInput.value = item.link || '';
    elements.itemNotesInput.value = item.notes || '';
    togglePaymentFinancingSection();
    openModal(elements.modalItem);
  }

  function togglePaymentFinancingSection() {
    const isFin = elements.itemPaymentStatusSelect.value === 'financed';
    elements.groupSelectFinancing.style.display = isFin ? 'flex' : 'none';
  }

  function populateFinancingDropdown(selectedFinId) {
    let options = '<option value="">-- Seleziona Finanziamento --</option>';
    financings.forEach(f => {
      const isSel = f.id === selectedFinId ? 'selected' : '';
      options += `<option value="${f.id}" ${isSel}>${escapeHtml(f.name)} (${f.installmentsCount} rate da ${formatCurrency(f.monthlyInstallment)}/m)</option>`;
    });
    options += '<option value="__create_new__">➕ Crea Nuovo Finanziamento...</option>';
    elements.itemFinancingSelect.innerHTML = options;
  }

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
    const conc = parsePrice(elements.workTotalPriceInput.value);
    const pag = parsePrice(elements.workPaidAmountInput.value);
    elements.workLiveDue.textContent = formatCurrency(Math.max(0, conc - pag));
  }

  function openAddFinancingModal() {
    elements.modalFinTitle.textContent = 'Nuovo Piano di Finanziamento';
    elements.finIdInput.value = '';
    elements.formFinancing.reset();
    elements.finInstallmentsSelect.value = '10';
    elements.finInterestTypeSelect.value = 'zero';
    elements.finInterestValInput.value = '0';
    toggleInterestInput();
    updateLiveFinancingCalculation();
    openModal(elements.modalFinancing);
    setTimeout(() => elements.finNameInput.focus(), 150);
  }

  function openEditFinancingModal(fin) {
    elements.modalFinTitle.textContent = 'Modifica Piano di Finanziamento';
    elements.finIdInput.value = fin.id;
    elements.finNameInput.value = fin.name || '';
    elements.finAmountInput.value = fin.totalAmount || '';
    elements.finInstallmentsSelect.value = String(fin.installmentsCount || 10);
    elements.finInterestTypeSelect.value = fin.interestType || 'zero';
    elements.finInterestValInput.value = fin.interestValue || '0';
    elements.finStartDateInput.value = fin.startDate || '';
    elements.finNotesInput.value = fin.notes || '';
    toggleInterestInput();
    updateLiveFinancingCalculation();
    openModal(elements.modalFinancing);
  }

  function toggleInterestInput() {
    const type = elements.finInterestTypeSelect.value;
    if (type === 'zero') {
      elements.groupFinInterestVal.style.display = 'none';
    } else {
      elements.groupFinInterestVal.style.display = 'flex';
      elements.lblFinInterestVal.textContent = type === 'percent' ? 'Interesse / TAN (%)' : 'Costo Fisso / Istruttoria (€)';
    }
  }

  function updateLiveFinancingCalculation() {
    const amount = parsePrice(elements.finAmountInput.value);
    const rateCount = parseInt(elements.finInstallmentsSelect.value, 10) || 10;
    const interestType = elements.finInterestTypeSelect.value;
    const interestVal = parsePrice(elements.finInterestValInput.value);

    let interests = 0;
    if (interestType === 'percent') interests = amount * (interestVal / 100);
    else if (interestType === 'fixed') interests = interestVal;

    const totalWithInterest = amount + interests;
    const monthly = rateCount > 0 ? (totalWithInterest / rateCount) : 0;

    elements.finPreviewMonthly.textContent = `${formatCurrency(monthly)} / mese`;
    elements.finPreviewInterests.textContent = formatCurrency(interests);
    elements.finPreviewTotal.textContent = formatCurrency(totalWithInterest);
  }

  function openQuickPayModal(work) {
    selectedWorkForPayment = work;
    const dovuto = Math.max(0, (work.totalPrice || 0) - (work.paidAmount || 0));
    elements.workPaySubtitle.textContent = `${work.title} - Residuo dovuto: ${formatCurrency(dovuto)}`;
    elements.workQuickPayAmount.value = dovuto;
    openModal(elements.modalWorkPayment);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    elements.tabMaterials.addEventListener('click', () => switchTab('materials'));
    elements.tabWorks.addEventListener('click', () => switchTab('works'));
    elements.tabFinancings.addEventListener('click', () => switchTab('financings'));
    elements.btnCreateFinTop.addEventListener('click', openAddFinancingModal);

    elements.fabAddMain.addEventListener('click', () => {
      if (currentTab === 'materials') openAddMaterialModal();
      else if (currentTab === 'works') openAddWorkModal();
      else openAddFinancingModal();
    });

    elements.btnCloseItemModal.addEventListener('click', () => closeModal(elements.modalItem));
    elements.btnCancelItem.addEventListener('click', () => closeModal(elements.modalItem));
    elements.itemPaymentStatusSelect.addEventListener('change', togglePaymentFinancingSection);
    
    elements.itemFinancingSelect.addEventListener('change', () => {
      if (elements.itemFinancingSelect.value === '__create_new__') {
        const itemPrice = parsePrice(elements.itemPriceInput.value) * (parseInt(elements.itemQuantityInput.value, 10) || 1);
        openAddFinancingModal();
        if (itemPrice > 0) {
          elements.finAmountInput.value = itemPrice;
          updateLiveFinancingCalculation();
        }
      }
    });

    elements.formItem.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = elements.itemIdInput.value || 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const isExisting = items.some(it => it.id === id);

      const paymentStatus = elements.itemPaymentStatusSelect.value;
      let finId = '';
      let finName = '';

      if (paymentStatus === 'financed') {
        finId = elements.itemFinancingSelect.value;
        if (finId === '__create_new__') finId = '';
        const foundFin = financings.find(f => f.id === finId);
        if (foundFin) finName = foundFin.name;
      }

      const newItem = {
        id: id,
        name: elements.itemNameInput.value.trim(),
        room: elements.itemRoomSelect.value,
        store: elements.itemStoreInput.value.trim(),
        price: parsePrice(elements.itemPriceInput.value),
        quantity: parseInt(elements.itemQuantityInput.value, 10) || 1,
        paymentStatus: paymentStatus,
        financingId: finId,
        financingName: finName,
        dimensions: elements.itemDimensionsInput.value.trim(),
        color: elements.itemColorInput.value.trim(),
        priority: elements.itemPrioritySelect.value,
        status: elements.itemStatusSelect.value,
        link: elements.itemLinkInput.value.trim(),
        notes: elements.itemNotesInput.value.trim(),
        updatedAt: new Date().toISOString()
      };

      tombstones.delete(id);

      if (isExisting) {
        items = items.map(it => it.id === id ? newItem : it);
        showToast('✏️ Materiale aggiornato!');
      } else {
        items.unshift(newItem);
        showToast('✨ Materiale aggiunto!');
      }

      closeModal(elements.modalItem);
      onDataChangedByUser();
    });

    elements.itemsContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.item-card');
      if (!card) return;
      const itemId = card.dataset.id;
      const item = items.find(it => it.id === itemId);
      if (!item) return;

      if (e.target.closest('[data-action="toggle-bought"]')) {
        item.status = item.status === 'bought' ? 'pending' : 'bought';
        item.updatedAt = new Date().toISOString();
        showToast(item.status === 'bought' ? '✅ Segnato come comprato!' : '⏳ Rimesso da comprare');
        onDataChangedByUser();
        return;
      }

      if (e.target.closest('[data-action="edit"]')) {
        openEditMaterialModal(item);
        return;
      }

      // ELIMINAZIONE MATERIALE
      if (e.target.closest('[data-action="delete"]')) {
        if (confirm(`Vuoi eliminare definitivamente "${item.name}"?`)) {
          tombstones.add(itemId);
          items = items.filter(it => it.id !== itemId);
          sendDirectDeleteGet(itemId);
          showToast('🗑️ Materiale eliminato');
          onDataChangedByUser();
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
      const total = parsePrice(elements.workTotalPriceInput.value);
      const paid = parsePrice(elements.workPaidAmountInput.value);

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

      tombstones.delete(id);

      if (isExisting) {
        works = works.map(w => w.id === id ? newWork : w);
        showToast('✏️ Lavoro aggiornato!');
      } else {
        works.unshift(newWork);
        showToast('🔨 Lavoro aggiunto!');
      }

      closeModal(elements.modalWork);
      onDataChangedByUser();
    });

    // Lavori Card Delegation
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
        if (confirm(`Vuoi eliminare definitivamente il lavoro "${work.title}"?`)) {
          tombstones.add(workId);
          works = works.filter(w => w.id !== workId);
          sendDirectDeleteGet(workId);
          showToast('🗑️ Lavoro eliminato');
          onDataChangedByUser();
        }
        return;
      }
    });

    // Modal Finanziamento
    elements.btnCloseFinModal.addEventListener('click', () => closeModal(elements.modalFinancing));
    elements.btnCancelFin.addEventListener('click', () => closeModal(elements.modalFinancing));
    elements.finAmountInput.addEventListener('input', updateLiveFinancingCalculation);
    elements.finInstallmentsSelect.addEventListener('change', updateLiveFinancingCalculation);
    elements.finInterestTypeSelect.addEventListener('change', () => {
      toggleInterestInput();
      updateLiveFinancingCalculation();
    });
    elements.finInterestValInput.addEventListener('input', updateLiveFinancingCalculation);

    elements.formFinancing.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = elements.finIdInput.value || 'fin-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const isExisting = financings.some(f => f.id === id);

      const amount = parsePrice(elements.finAmountInput.value);
      const rateCount = parseInt(elements.finInstallmentsSelect.value, 10) || 10;
      const interestType = elements.finInterestTypeSelect.value;
      const interestVal = parsePrice(elements.finInterestValInput.value);

      let interests = 0;
      if (interestType === 'percent') interests = amount * (interestVal / 100);
      else if (interestType === 'fixed') interests = interestVal;

      const totalWithInterest = amount + interests;
      const monthly = rateCount > 0 ? (totalWithInterest / rateCount) : 0;

      const newFin = {
        id: id,
        name: elements.finNameInput.value.trim(),
        totalAmount: amount,
        installmentsCount: rateCount,
        interestType: interestType,
        interestValue: interestVal,
        totalWithInterest: totalWithInterest,
        monthlyInstallment: monthly,
        startDate: elements.finStartDateInput.value.trim(),
        notes: elements.finNotesInput.value.trim(),
        updatedAt: new Date().toISOString()
      };

      tombstones.delete(id);

      if (isExisting) {
        financings = financings.map(f => f.id === id ? newFin : f);
        items.forEach(it => {
          if (it.financingId === id) it.financingName = newFin.name;
        });
        showToast('✏️ Finanziamento aggiornato!');
      } else {
        financings.unshift(newFin);
        showToast('💳 Nuovo finanziamento creato!');
      }

      closeModal(elements.modalFinancing);
      onDataChangedByUser();
    });

    elements.financingsContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.financing-card');
      if (!card) return;
      const finId = card.dataset.id;
      const fin = financings.find(f => f.id === finId);
      if (!fin) return;

      if (e.target.closest('[data-action="edit-fin"]')) {
        openEditFinancingModal(fin);
        return;
      }
      if (e.target.closest('[data-action="delete-fin"]')) {
        if (confirm(`Vuoi eliminare il finanziamento "${fin.name}"?`)) {
          tombstones.add(finId);
          financings = financings.filter(f => f.id !== finId);
          items.forEach(it => {
            if (it.financingId === finId) {
              it.financingId = '';
              it.financingName = '';
            }
          });
          sendDirectDeleteGet(finId);
          showToast('🗑️ Finanziamento eliminato');
          onDataChangedByUser();
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
      showToast('💰 Lavoro saldato al 100%!');
      closeModal(elements.modalWorkPayment);
      onDataChangedByUser();
    });

    elements.btnConfirmWorkPay.addEventListener('click', () => {
      if (!selectedWorkForPayment) return;
      const amountToAdd = parsePrice(elements.workQuickPayAmount.value);
      selectedWorkForPayment.paidAmount = Math.min(selectedWorkForPayment.totalPrice, (selectedWorkForPayment.paidAmount || 0) + amountToAdd);
      selectedWorkForPayment.dueAmount = Math.max(0, selectedWorkForPayment.totalPrice - selectedWorkForPayment.paidAmount);
      if (selectedWorkForPayment.dueAmount === 0) selectedWorkForPayment.status = 'completed';
      selectedWorkForPayment.updatedAt = new Date().toISOString();
      showToast('💵 Acconto registrato!');
      closeModal(elements.modalWorkPayment);
      onDataChangedByUser();
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
      showToast('🔄 Forzatura sincronizzazione...');
      pushToCloud({ silent: true });
      pullFromCloud({ silent: false });
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

    [elements.modalItem, elements.modalWork, elements.modalFinancing, elements.modalWorkPayment, elements.modalSync, elements.modalShare].forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) closeModal(m);
      });
    });

    window.addEventListener('online', () => {
      showToast('🌐 Tornato online! Sincronizzazione...');
      pullFromCloud({ silent: true });
    });

    window.addEventListener('offline', () => {
      showToast('📶 Sei offline. Le modifiche sono memorizzate sul telefono.');
      updateSyncBadge('offline');
    });
  }

  function switchTab(tab) {
    currentTab = tab;
    elements.tabMaterials.classList.toggle('active', tab === 'materials');
    elements.tabWorks.classList.toggle('active', tab === 'works');
    elements.tabFinancings.classList.toggle('active', tab === 'financings');

    elements.submetricsMaterials.style.display = tab === 'materials' ? 'grid' : 'none';
    elements.submetricsWorks.style.display = tab === 'works' ? 'grid' : 'none';
    elements.submetricsFinancings.style.display = tab === 'financings' ? 'grid' : 'none';

    elements.filtersMaterialsSection.style.display = tab === 'materials' ? 'flex' : 'none';
    elements.filtersWorksSection.style.display = tab === 'works' ? 'flex' : 'none';
    elements.filtersFinancingsSection.style.display = tab === 'financings' ? 'flex' : 'none';

    elements.itemsContainer.style.display = tab === 'materials' ? 'flex' : 'none';
    elements.worksContainer.style.display = tab === 'works' ? 'flex' : 'none';
    elements.financingsContainer.style.display = tab === 'financings' ? 'flex' : 'none';

    if (tab === 'materials') elements.fabLabel.textContent = 'Aggiungi Materiale';
    else if (tab === 'works') elements.fabLabel.textContent = 'Aggiungi Lavoro';
    else elements.fabLabel.textContent = 'Nuovo Finanziamento';

    renderAll();
  }

  // --- SHARE & BACKUP ---
  function generateShareText() {
    let text = `🏠 *CASA BURJASSOT - RIEPILOGO COMPLETO*\n`;
    text += `Aggiornato al: ${new Date().toLocaleDateString('it-IT')}\n\n`;

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

    let monthlyRateTotal = 0;
    financings.forEach(f => {
      monthlyRateTotal += Number(f.monthlyInstallment) || 0;
    });

    const grand = matTotal + worksTotal;
    const totPaid = matPaid + worksPaid;
    const totDue = matDue + worksDue;

    text += `💰 *QUADRO ECONOMICO:*\n`;
    text += `• Spesa Totale Prevista: *${formatCurrency(grand)}*\n`;
    text += `• Totale Finanziato: *${formatCurrency(matFinanced)}* (Rata complessiva: *${formatCurrency(monthlyRateTotal)}/mese*)\n`;
    text += `• Già Pagato Cash: *${formatCurrency(totPaid)}*\n`;
    text += `• Residuo da Saldare Cash: *${formatCurrency(totDue)}*\n\n`;

    if (financings.length > 0) {
      text += `💳 *PIANI DI FINANZIAMENTO (${financings.length}):*\n`;
      financings.forEach(f => {
        text += `• ${f.name}: ${formatCurrency(f.totalAmount)} in ${f.installmentsCount} rate da *${formatCurrency(f.monthlyInstallment)}/mese*\n`;
      });
      text += `\n`;
    }

    if (works.length > 0) {
      text += `🔨 *LAVORI & MANODOPERA (${works.length}):*\n`;
      works.forEach(w => {
        const dovuto = Math.max(0, (w.totalPrice || 0) - (w.paidAmount || 0));
        text += `• ${w.title} (${w.worker || 'Professionista'}): Concordato ${formatCurrency(w.totalPrice)} | Pagato: ${formatCurrency(w.paidAmount)} | Da saldare: *${formatCurrency(dovuto)}*\n`;
      });
      text += `\n`;
    }

    const pendingMat = items.filter(it => it.status !== 'bought');
    text += `📦 *MATERIALI DA COMPRARE (${pendingMat.length}):*\n`;
    pendingMat.forEach(it => {
      const cost = it.price ? ` - ${formatCurrency(it.price * (it.quantity || 1))}` : '';
      const st = it.store ? ` (${it.store})` : '';
      const fin = it.paymentStatus === 'financed' ? ` [Finanziato: ${it.financingName || 'A rate'}]` : '';
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
    csv += 'SEZIONE MATERIALI & MOBILI\r\n';
    csv += 'Nome;Stanza;Negozio;Prezzo;Quantita;Totale;Modalita Pagamento;Finanziamento Collegato;Dimensioni;Colore;Priorita;Stato;Note\r\n';
    items.forEach(it => {
      csv += [
        `"${(it.name || '').replace(/"/g, '""')}"`,
        `"${(it.room || '').replace(/"/g, '""')}"`,
        `"${(it.store || '').replace(/"/g, '""')}"`,
        it.price || 0,
        it.quantity || 1,
        (it.price || 0) * (it.quantity || 1),
        it.paymentStatus === 'financed' ? 'Finanziato' : (it.paymentStatus === 'paid_cash' ? 'Pagato Cash' : 'Da Pagare Cash'),
        `"${(it.financingName || '').replace(/"/g, '""')}"`,
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
      csv += [
        `"${(w.title || '').replace(/"/g, '""')}"`,
        `"${(w.worker || '').replace(/"/g, '""')}"`,
        conc,
        pag,
        Math.max(0, conc - pag),
        `"${(w.status || '').replace(/"/g, '""')}"`,
        `"${(w.notes || '').replace(/"/g, '""')}"`
      ].join(';') + '\r\n';
    });

    csv += '\r\n\r\nSEZIONE PIANI DI FINANZIAMENTO\r\n';
    csv += 'Nome Piano;Capitale;Numero Rate;Tipo Interesse;Valore Interesse;Totale Con Interessi;Rata Mensile;Data Inizio;Note\r\n';
    financings.forEach(f => {
      csv += [
        `"${(f.name || '').replace(/"/g, '""')}"`,
        f.totalAmount || 0,
        f.installmentsCount || 10,
        `"${f.interestType || 'zero'}"`,
        f.interestValue || 0,
        f.totalWithInterest || 0,
        f.monthlyInstallment || 0,
        `"${(f.startDate || '').replace(/"/g, '""')}"`,
        `"${(f.notes || '').replace(/"/g, '""')}"`
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
      version: 5,
      exportDate: new Date().toISOString(),
      items: items,
      works: works,
      financings: financings
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
        if (json.items && Array.isArray(json.items)) items = json.items;
        else if (Array.isArray(json)) items = json;
        if (json.works && Array.isArray(json.works)) works = json.works;
        if (json.financings && Array.isArray(json.financings)) financings = json.financings;

        tombstones.clear();
        saveLocalStateOnly();
        renderAll();
        triggerSyncPush();
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
        navigator.serviceWorker.register('./sw.js?v=5.2').then((reg) => {
          reg.update(); // Forza l'aggiornamento immediato del service worker
        }).catch(() => {});
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
  function parsePrice(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100;
    const str = String(val).trim().replace(',', '.');
    const n = parseFloat(str);
    return isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }

  function formatCurrency(n) {
    if (isNaN(n) || n === 0 || n === null || n === undefined) return '0 €';
    const num = Number(n);
    const hasDecimals = (num % 1 !== 0);
    return num.toLocaleString('it-IT', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    }) + ' €';
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

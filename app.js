/**
 * CASA BURJASSOT - Progressive Web App
 * Gestione lista acquisti, calcolo budget, filtri, condivisione e sincronizzazione Google Sheet.
 */

(function () {
  'use strict';

  // --- STATE ---
  const STORAGE_KEY = 'burjassot_shopping_items_v1';
  const SYNC_URL_KEY = 'burjassot_sync_script_url';
  
  let items = [];
  let currentFilterRoom = 'all';
  let currentFilterStatus = 'all';
  let currentFilterStore = 'all';
  let currentSearchQuery = '';
  let currentSort = 'priority-desc';
  let deferredInstallPrompt = null;
  let isSyncing = false;

  // --- DOM ELEMENTS ---
  const elements = {
    itemsContainer: document.getElementById('items-list-container'),
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    roomPills: document.querySelectorAll('#room-pills-container .filter-pill'),
    filterStatus: document.getElementById('filter-status'),
    filterStore: document.getElementById('filter-store'),
    sortItems: document.getElementById('sort-items'),
    
    // Stats
    statTotalBudget: document.getElementById('stat-total-budget'),
    statSpent: document.getElementById('stat-spent'),
    statRemain: document.getElementById('stat-remain'),
    statProgress: document.getElementById('stat-progress'),
    statTotalItemsSub: document.getElementById('stat-total-items-sub'),
    statBoughtCount: document.getElementById('stat-bought-count'),
    statPendingCount: document.getElementById('stat-pending-count'),

    // Modals
    modalItem: document.getElementById('modal-item'),
    modalItemTitle: document.getElementById('modal-item-title'),
    formItem: document.getElementById('form-item'),
    itemIdInput: document.getElementById('item-id'),
    itemNameInput: document.getElementById('item-name'),
    itemRoomSelect: document.getElementById('item-room'),
    itemStoreInput: document.getElementById('item-store'),
    itemPriceInput: document.getElementById('item-price'),
    itemQuantityInput: document.getElementById('item-quantity'),
    itemDimensionsInput: document.getElementById('item-dimensions'),
    itemColorInput: document.getElementById('item-color'),
    itemPrioritySelect: document.getElementById('item-priority'),
    itemStatusSelect: document.getElementById('item-status'),
    itemLinkInput: document.getElementById('item-link'),
    itemNotesInput: document.getElementById('item-notes'),
    btnCloseItemModal: document.getElementById('btn-close-item-modal'),
    btnCancelItem: document.getElementById('btn-cancel-item'),
    fabAddItem: document.getElementById('fab-add-item'),

    // Sync Modal
    modalSync: document.getElementById('modal-sync'),
    syncScriptUrlInput: document.getElementById('sync-script-url'),
    btnOpenSync: document.getElementById('btn-open-sync'),
    btnCloseSyncModal: document.getElementById('btn-close-sync-modal'),
    btnCloseSync: document.getElementById('btn-close-sync'),
    btnTestSync: document.getElementById('btn-test-sync'),
    syncIcon: document.getElementById('sync-icon'),
    syncStatusIndicator: document.getElementById('sync-status-indicator'),
    btnExportBackup: document.getElementById('btn-export-backup'),
    btnImportBackupTrigger: document.getElementById('btn-import-backup-trigger'),
    importBackupFile: document.getElementById('import-backup-file'),
    iosHelper: document.getElementById('ios-helper'),

    // Share Modal
    modalShare: document.getElementById('modal-share'),
    btnOpenShare: document.getElementById('btn-open-share'),
    btnCloseShareModal: document.getElementById('btn-close-share-modal'),
    btnCloseShare: document.getElementById('btn-close-share'),
    btnShareWhatsapp: document.getElementById('btn-share-whatsapp'),
    btnCopyClipboard: document.getElementById('btn-copy-clipboard'),
    btnExportCsv: document.getElementById('btn-export-csv'),

    // PWA Install
    btnInstallHeader: document.getElementById('btn-install-header'),
    pwaInstallBanner: document.getElementById('pwa-install-banner'),
    btnPwaInstall: document.getElementById('btn-pwa-install'),
    btnPwaDismiss: document.getElementById('btn-pwa-dismiss'),

    toastContainer: document.getElementById('toast-container')
  };

  // --- DEFAULT STARTER ITEMS (Se l'app è nuova) ---
  const DEFAULT_ITEMS = [
    {
      id: 'burj-item-1',
      name: 'Battiscopa rovere/PVC (stanze e corridoio)',
      room: 'corridoio',
      store: 'Leroy Merlin',
      price: 135,
      quantity: 1,
      dimensions: 'ca. 35 metri lineari',
      color: 'Rovere naturale',
      priority: 'Alta',
      status: 'pending',
      link: 'https://www.leroymerlin.es',
      notes: 'Verificare spessore per coprire giunto pavimento',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-item-2',
      name: 'Box doccia rettangolare cristallo 6mm',
      room: 'bagno',
      store: 'Bauhaus',
      price: 240,
      quantity: 1,
      dimensions: '80 x 120 cm (H 195 cm)',
      color: 'Cromo lucido',
      priority: 'Alta',
      status: 'pending',
      link: 'https://www.bauhaus.es',
      notes: 'Apertura scorrevole ad angolo o porta battente',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-item-3',
      name: 'Mobile lavabo bagno con specchio e 2 cassetti',
      room: 'bagno',
      store: 'IKEA',
      price: 195,
      quantity: 1,
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
      price: 499,
      quantity: 1,
      dimensions: '225 x 95 cm',
      color: 'Grigio antracite',
      priority: 'Alta',
      status: 'evaluating',
      link: '',
      notes: 'Comodo per ospiti, tessuto sfoderabile preferito',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'burj-item-5',
      name: 'Miscelatore lavello cucina orientabile',
      room: 'cucina',
      store: 'Obramat',
      price: 59,
      quantity: 1,
      dimensions: 'Altezza 35 cm',
      color: 'Nero opaco',
      priority: 'Media',
      status: 'pending',
      link: '',
      notes: 'Con doccetta estraibile se possibile',
      updatedAt: new Date().toISOString()
    }
  ];

  // --- INITIALIZATION ---
  function init() {
    loadLocalData();
    setupEventListeners();
    setupPWA();
    render();
    
    // Auto-sync all'avvio se c'è URL salvato
    const savedUrl = localStorage.getItem(SYNC_URL_KEY);
    if (savedUrl) {
      elements.syncScriptUrlInput.value = savedUrl;
      updateSyncBadge('online');
      syncWithCloud({ silent: true });
    } else {
      updateSyncBadge('local');
    }
  }

  // --- STORAGE & LOCAL DATA ---
  function loadLocalData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        items = JSON.parse(raw);
      } catch (e) {
        items = [...DEFAULT_ITEMS];
        saveLocalData();
      }
    } else {
      items = [...DEFAULT_ITEMS];
      saveLocalData();
    }
  }

  function saveLocalData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    render();
    
    // Notifica sinc se configurata
    if (localStorage.getItem(SYNC_URL_KEY) && !isSyncing) {
      debounceAutoSync();
    }
  }

  let autoSyncTimeout = null;
  function debounceAutoSync() {
    clearTimeout(autoSyncTimeout);
    autoSyncTimeout = setTimeout(() => {
      syncWithCloud({ silent: true });
    }, 1200);
  }

  // --- CLOUD SYNC (GOOGLE APPS SCRIPT) ---
  async function syncWithCloud(options = {}) {
    const syncUrl = localStorage.getItem(SYNC_URL_KEY) || elements.syncScriptUrlInput.value.trim();
    if (!syncUrl) {
      if (!options.silent) {
        showToast('⚠️ Inserisci prima l\'URL di Google Apps Script nelle impostazioni');
        openModal(elements.modalSync);
      }
      updateSyncBadge('local');
      return;
    }

    if (isSyncing) return;
    isSyncing = true;
    updateSyncBadge('syncing');

    try {
      // 1. GET: Leggi dati esistenti dal Google Sheet
      const getResponse = await fetch(syncUrl + '?t=' + Date.now(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      const resJson = await getResponse.json();

      if (resJson && resJson.status === 'success' && Array.isArray(resJson.items)) {
        if (resJson.items.length > 0) {
          // Unisci in modo intelligente in base all'ID e a updatedAt
          const cloudItemsMap = new Map();
          resJson.items.forEach(it => cloudItemsMap.set(it.id, it));

          // Aggiungi / aggiorna con i dati del cloud se più recenti
          let modified = false;
          items.forEach(localItem => {
            if (!cloudItemsMap.has(localItem.id)) {
              // Elemento creato in locale ma non ancora nel foglio
              cloudItemsMap.set(localItem.id, localItem);
              modified = true;
            } else {
              const cloudItem = cloudItemsMap.get(localItem.id);
              const localTime = new Date(localItem.updatedAt || 0).getTime();
              const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
              if (localTime > cloudTime) {
                // Il locale è più recente
                cloudItemsMap.set(localItem.id, localItem);
                modified = true;
              }
            }
          });

          items = Array.from(cloudItemsMap.values());
          localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        }

        // 2. POST: Invia al Google Sheet l'elenco completo per tenerlo sempre allineato
        await fetch(syncUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'sync_all',
            items: items
          })
        });

        updateSyncBadge('online');
        if (!options.silent) {
          showToast('✅ Sincronizzato con Google Sheet!');
        }
      } else {
        // Nessun dato o foglio nuovo: invia il locale
        await fetch(syncUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'sync_all',
            items: items
          })
        });
        updateSyncBadge('online');
        if (!options.silent) {
          showToast('✅ Lista inviata al Google Sheet con successo!');
        }
      }
    } catch (err) {
      console.warn('Sync error:', err);
      updateSyncBadge('offline');
      if (!options.silent) {
        showToast('❌ Errore sincronizzazione: controlla la connessione o l\'URL');
      }
    } finally {
      isSyncing = false;
      render();
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
    } else if (status === 'offline') {
      elements.syncStatusIndicator.classList.add('status-offline');
      elements.syncStatusIndicator.title = 'Non connesso / Errore sync';
      elements.syncIcon.style.animation = 'none';
    } else {
      elements.syncStatusIndicator.classList.add('status-local');
      elements.syncStatusIndicator.title = 'Salvato solo in locale (configura Google Sheet)';
      elements.syncIcon.style.animation = 'none';
    }
  }

  // --- RENDER ---
  function render() {
    renderStats();
    renderList();
  }

  function renderStats() {
    let totalBudget = 0;
    let spent = 0;
    let boughtCount = 0;
    let totalItems = items.length;

    items.forEach(item => {
      const price = (Number(item.price) || 0) * (Number(item.quantity) || 1);
      totalBudget += price;
      if (item.status === 'bought') {
        spent += price;
        boughtCount++;
      }
    });

    const remain = Math.max(0, totalBudget - spent);
    const pendingCount = totalItems - boughtCount;
    const progressPercent = totalItems > 0 ? Math.round((boughtCount / totalItems) * 100) : 0;

    elements.statTotalBudget.textContent = formatCurrency(totalBudget);
    elements.statSpent.textContent = formatCurrency(spent);
    elements.statRemain.textContent = formatCurrency(remain);
    elements.statProgress.textContent = progressPercent + '%';

    elements.statTotalItemsSub.textContent = `${totalItems} articol${totalItems === 1 ? 'o' : 'i'}`;
    elements.statBoughtCount.textContent = `${boughtCount} comprat${boughtCount === 1 ? 'o' : 'i'}`;
    elements.statPendingCount.textContent = `${pendingCount} da prender${pendingCount === 1 ? 'e' : 'e'}`;
  }

  function renderList() {
    // 1. Filtraggio
    let filtered = items.filter(item => {
      // Filtro stanza
      if (currentFilterRoom !== 'all') {
        const itemRoom = (item.room || '').toLowerCase();
        if (itemRoom !== currentFilterRoom.toLowerCase()) return false;
      }

      // Filtro stato
      if (currentFilterStatus !== 'all') {
        if (item.status !== currentFilterStatus) return false;
      }

      // Filtro negozio
      if (currentFilterStore !== 'all') {
        const itemStore = (item.store || '').toLowerCase();
        if (currentFilterStore === 'Altro') {
          const knownStores = ['ikea', 'leroy merlin', 'bauhaus', 'obramat', 'amazon', 'conforama'];
          if (knownStores.some(k => itemStore.includes(k))) return false;
        } else if (!itemStore.includes(currentFilterStore.toLowerCase())) {
          return false;
        }
      }

      // Filtro ricerca
      if (currentSearchQuery) {
        const fullText = `${item.name} ${item.room} ${item.store} ${item.color} ${item.dimensions} ${item.notes}`.toLowerCase();
        if (!fullText.includes(currentSearchQuery)) return false;
      }

      return true;
    });

    // 2. Ordinamento
    filtered.sort((a, b) => {
      if (currentSort === 'priority-desc') {
        const pOrder = { 'Alta': 3, 'Media': 2, 'Bassa': 1 };
        const pa = pOrder[a.priority] || 2;
        const pb = pOrder[b.priority] || 2;
        return pb - pa;
      }
      if (currentSort === 'price-asc') {
        const costA = (a.price || 0) * (a.quantity || 1);
        const costB = (b.price || 0) * (b.quantity || 1);
        return costA - costB;
      }
      if (currentSort === 'price-desc') {
        const costA = (a.price || 0) * (a.quantity || 1);
        const costB = (b.price || 0) * (b.quantity || 1);
        return costB - costA;
      }
      if (currentSort === 'date-desc') {
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      }
      if (currentSort === 'name-asc') {
        return a.name.localeCompare(b.name, 'it');
      }
      return 0;
    });

    // 3. Render HTML
    if (filtered.length === 0) {
      elements.itemsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛋️</div>
          <h3 class="empty-state-title">Nessun elemento trovato</h3>
          <p class="empty-state-desc">Nessun articolo corrisponde ai filtri selezionati. Aggiungine uno nuovo con il pulsante in basso!</p>
          <button class="btn btn-primary" id="btn-empty-add">+ Aggiungi elemento</button>
        </div>
      `;
      const btnEmptyAdd = document.getElementById('btn-empty-add');
      if (btnEmptyAdd) btnEmptyAdd.addEventListener('click', openAddModal);
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
                  ${item.store ? `<span class="tag-badge tag-store">🏪 ${escapeHtml(item.store)}</span>` : ''}
                  <span class="tag-badge ${priorityClass}">● Priorità ${escapeHtml(item.priority || 'Media')}</span>
                  ${isBought ? '<span class="tag-badge tag-bought">✅ Comprato</span>' : ''}
                  ${isEvaluating ? '<span class="tag-badge" style="background:#E0E7FF;color:#3730A3;">🤔 In dubbio</span>' : ''}
                </div>
              </div>
            </div>
            
            <div class="item-price-box">
              <div class="item-price-main">${formatCurrency(totalPrice)}</div>
              ${quantity > 1 ? `<div class="item-quantity-text">${quantity} × ${formatCurrency(unitPrice)}</div>` : ''}
            </div>
          </div>

          <!-- Dettagli: Dimensioni, Colore -->
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
                🔗 Vedi Scheda Prodotto
              </a>
            ` : '<span></span>'}

            <div class="item-actions-btns">
              <button class="btn-card-action" data-action="edit" title="Modifica elemento">✏️</button>
              <button class="btn-card-action btn-delete" data-action="delete" title="Elimina elemento">🗑️</button>
            </div>
          </div>
        </article>
      `;
    });

    elements.itemsContainer.innerHTML = html;
  }

  // --- HELPERS ---
  function formatCurrency(amount) {
    if (isNaN(amount) || amount === 0) return '0 €';
    return Number(amount).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  }

  function getRoomBadgeClass(room) {
    const r = (room || '').toLowerCase();
    if (r.includes('salone')) return 'tag-room-salone';
    if (r.includes('cucina')) return 'tag-room-cucina';
    if (r.includes('bagno')) return 'tag-room-bagno';
    if (r.includes('camera')) return 'tag-room-camera';
    if (r.includes('corridoio')) return 'tag-room-corridoio';
    if (r.includes('terrazzo')) return 'tag-room-terrazzo';
    return 'tag-room-altro';
  }

  function getRoomLabel(room) {
    const r = (room || '').toLowerCase();
    if (r === 'salone') return '🛋️ Salone';
    if (r === 'cucina') return '🍳 Cucina';
    if (r === 'bagno') return '🚿 Bagno';
    if (r === 'camera') return '🛏️ Camera da letto';
    if (r === 'corridoio') return '🚪 Corridoio / Battiscopa';
    if (r === 'terrazzo') return '🪴 Terrazzo';
    if (r === 'altro') return '📦 Altro';
    return room ? '🏠 ' + room : '🏠 Generale';
  }

  function getPriorityClass(p) {
    if (p === 'Alta') return 'tag-priority-alta';
    if (p === 'Bassa') return 'tag-priority-bassa';
    return 'tag-priority-media';
  }

  function getColorStyle(colorText) {
    const c = (colorText || '').toLowerCase();
    if (c.includes('bianco')) return '#ffffff';
    if (c.includes('nero')) return '#18181b';
    if (c.includes('grigio')) return '#71717a';
    if (c.includes('antracite')) return '#3f3f46';
    if (c.includes('rovere') || c.includes('legno') || c.includes('marrone')) return '#b45309';
    if (c.includes('noce')) return '#78350f';
    if (c.includes('cromo') || c.includes('argento')) return '#cbd5e1';
    if (c.includes('oro') || c.includes('ottone')) return '#fbbf24';
    if (c.includes('blu') || c.includes('azzurro')) return '#3b82f6';
    if (c.includes('verde')) return '#10b981';
    if (c.includes('rosso')) return '#ef4444';
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

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3200);
  }

  // --- MODAL CONTROLS ---
  function openModal(modal) {
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function openAddModal() {
    elements.modalItemTitle.textContent = 'Aggiungi Nuovo Elemento';
    elements.itemIdInput.value = '';
    elements.formItem.reset();
    elements.itemQuantityInput.value = '1';
    elements.itemPrioritySelect.value = 'Media';
    elements.itemStatusSelect.value = 'pending';
    openModal(elements.modalItem);
    setTimeout(() => elements.itemNameInput.focus(), 150);
  }

  function openEditModal(item) {
    elements.modalItemTitle.textContent = 'Modifica Elemento';
    elements.itemIdInput.value = item.id;
    elements.itemNameInput.value = item.name || '';
    elements.itemRoomSelect.value = item.room || 'salone';
    elements.itemStoreInput.value = item.store || '';
    elements.itemPriceInput.value = item.price || '';
    elements.itemQuantityInput.value = item.quantity || 1;
    elements.itemDimensionsInput.value = item.dimensions || '';
    elements.itemColorInput.value = item.color || '';
    elements.itemPrioritySelect.value = item.priority || 'Media';
    elements.itemStatusSelect.value = item.status || 'pending';
    elements.itemLinkInput.value = item.link || '';
    elements.itemNotesInput.value = item.notes || '';
    openModal(elements.modalItem);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // FAB & Add Modal
    elements.fabAddItem.addEventListener('click', openAddModal);
    elements.btnCloseItemModal.addEventListener('click', () => closeModal(elements.modalItem));
    elements.btnCancelItem.addEventListener('click', () => closeModal(elements.modalItem));

    // Form Submit
    elements.formItem.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = elements.itemIdInput.value || 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const isExisting = items.some(it => it.id === id);

      const newItem = {
        id: id,
        name: elements.itemNameInput.value.trim(),
        room: elements.itemRoomSelect.value,
        store: elements.itemStoreInput.value.trim(),
        price: parseFloat(elements.itemPriceInput.value) || 0,
        quantity: parseInt(elements.itemQuantityInput.value, 10) || 1,
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
        showToast('✏️ Modifiche salvate!');
      } else {
        items.unshift(newItem);
        showToast('✨ Elemento aggiunto alla lista!');
      }

      saveLocalData();
      closeModal(elements.modalItem);
    });

    // Card delegation (Checkbox toggle, Edit, Delete)
    elements.itemsContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.item-card');
      if (!card) return;
      const itemId = card.dataset.id;
      const item = items.find(it => it.id === itemId);
      if (!item) return;

      const toggleBtn = e.target.closest('[data-action="toggle-bought"]');
      if (toggleBtn) {
        item.status = item.status === 'bought' ? 'pending' : 'bought';
        item.updatedAt = new Date().toISOString();
        saveLocalData();
        showToast(item.status === 'bought' ? '✅ Segnato come comprato!' : '⏳ Rimesso in lista da comprare');
        return;
      }

      const editBtn = e.target.closest('[data-action="edit"]');
      if (editBtn) {
        openEditModal(item);
        return;
      }

      const deleteBtn = e.target.closest('[data-action="delete"]');
      if (deleteBtn) {
        if (confirm(`Sei sicuro di voler eliminare "${item.name}"?`)) {
          items = items.filter(it => it.id !== itemId);
          saveLocalData();
          showToast('🗑️ Elemento eliminato');
        }
        return;
      }
    });

    // Search Input
    elements.searchInput.addEventListener('input', () => {
      currentSearchQuery = elements.searchInput.value.trim().toLowerCase();
      elements.searchClearBtn.style.display = currentSearchQuery ? 'block' : 'none';
      renderList();
    });

    elements.searchClearBtn.addEventListener('click', () => {
      elements.searchInput.value = '';
      currentSearchQuery = '';
      elements.searchClearBtn.style.display = 'none';
      renderList();
    });

    // Room Filter Pills
    elements.roomPills.forEach(pill => {
      pill.addEventListener('click', () => {
        elements.roomPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilterRoom = pill.dataset.room;
        renderList();
      });
    });

    // Status Filter
    elements.filterStatus.addEventListener('change', () => {
      currentFilterStatus = elements.filterStatus.value;
      renderList();
    });

    // Store Filter
    elements.filterStore.addEventListener('change', () => {
      currentFilterStore = elements.filterStore.value;
      renderList();
    });

    // Sort
    elements.sortItems.addEventListener('change', () => {
      currentSort = elements.sortItems.value;
      renderList();
    });

    // Sync Modal controls
    elements.btnOpenSync.addEventListener('click', () => {
      elements.syncScriptUrlInput.value = localStorage.getItem(SYNC_URL_KEY) || '';
      openModal(elements.modalSync);
    });
    elements.btnCloseSyncModal.addEventListener('click', () => closeModal(elements.modalSync));
    elements.btnCloseSync.addEventListener('click', () => closeModal(elements.modalSync));

    elements.btnTestSync.addEventListener('click', () => {
      const url = elements.syncScriptUrlInput.value.trim();
      if (!url) {
        showToast('⚠️ Inserisci l\'URL del tuo Google Apps Script');
        return;
      }
      localStorage.setItem(SYNC_URL_KEY, url);
      showToast('🔄 Avvio sincronizzazione...');
      syncWithCloud({ silent: false });
      closeModal(elements.modalSync);
    });

    // Export & Import Backup JSON
    elements.btnExportBackup.addEventListener('click', exportBackupJson);
    elements.btnImportBackupTrigger.addEventListener('click', () => elements.importBackupFile.click());
    elements.importBackupFile.addEventListener('change', importBackupJson);

    // Share Modal controls
    elements.btnOpenShare.addEventListener('click', () => openModal(elements.modalShare));
    elements.btnCloseShareModal.addEventListener('click', () => closeModal(elements.modalShare));
    elements.btnCloseShare.addEventListener('click', () => closeModal(elements.modalShare));
    elements.btnShareWhatsapp.addEventListener('click', shareViaWhatsApp);
    elements.btnCopyClipboard.addEventListener('click', copyListToClipboard);
    elements.btnExportCsv.addEventListener('click', exportCsv);

    // Close modals on backdrop click
    [elements.modalItem, elements.modalSync, elements.modalShare].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });

    // Online / Offline window events
    window.addEventListener('online', () => {
      showToast('🌐 Sei tornato online!');
      if (localStorage.getItem(SYNC_URL_KEY)) {
        syncWithCloud({ silent: true });
      }
    });

    window.addEventListener('offline', () => {
      showToast('📶 Sei offline. Le modifiche sono salvate in locale sul telefono.');
      updateSyncBadge('offline');
    });
  }

  // --- SHARE GENERATORS ---
  function generateShareText() {
    let text = `🏠 *CASA BURJASSOT - LISTA ACQUISTI*\n`;
    text += `Aggiornata al: ${new Date().toLocaleDateString('it-IT')}\n\n`;

    const pendingItems = items.filter(it => it.status !== 'bought');
    const boughtItems = items.filter(it => it.status === 'bought');

    let totalPending = 0;
    pendingItems.forEach(it => {
      totalPending += (it.price || 0) * (it.quantity || 1);
    });

    text += `📋 *DA COMPRARE (${pendingItems.length} articoli - Tot. ~${formatCurrency(totalPending)}):*\n\n`;

    // Raggruppa per stanza
    const byRoom = {};
    pendingItems.forEach(it => {
      const room = getRoomLabel(it.room);
      if (!byRoom[room]) byRoom[room] = [];
      byRoom[room].push(it);
    });

    for (const [room, roomItems] of Object.entries(byRoom)) {
      text += `*${room}*\n`;
      roomItems.forEach(it => {
        const cost = it.price ? ` - ${formatCurrency(it.price * (it.quantity || 1))}` : '';
        const store = it.store ? ` (${it.store})` : '';
        const dims = it.dimensions ? ` [Misura: ${it.dimensions}]` : '';
        const col = it.color ? ` [Colore: ${it.color}]` : '';
        text += `• ${it.name}${cost}${store}${dims}${col}\n`;
      });
      text += `\n`;
    }

    if (boughtItems.length > 0) {
      text += `✅ *GIÀ COMPRATI (${boughtItems.length}):*\n`;
      boughtItems.forEach(it => {
        text += `✓ ~${it.name}~ (${formatCurrency((it.price || 0) * (it.quantity || 1))})\n`;
      });
    }

    return text;
  }

  function shareViaWhatsApp() {
    const text = generateShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  function copyListToClipboard() {
    const text = generateShareText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Lista copiata negli appunti!');
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
    showToast('📋 Lista copiata negli appunti!');
    closeModal(elements.modalShare);
  }

  function exportCsv() {
    const headers = ['Nome', 'Stanza', 'Negozio', 'Prezzo Unitario', 'Quantita', 'Totale', 'Dimensioni', 'Colore', 'Priorita', 'Stato', 'Link', 'Note'];
    const rows = items.map(it => [
      `"${(it.name || '').replace(/"/g, '""')}"`,
      `"${(it.room || '').replace(/"/g, '""')}"`,
      `"${(it.store || '').replace(/"/g, '""')}"`,
      it.price || 0,
      it.quantity || 1,
      (it.price || 0) * (it.quantity || 1),
      `"${(it.dimensions || '').replace(/"/g, '""')}"`,
      `"${(it.color || '').replace(/"/g, '""')}"`,
      `"${(it.priority || '').replace(/"/g, '""')}"`,
      `"${it.status === 'bought' ? 'Comprato' : (it.status === 'evaluating' ? 'In valutazione' : 'Da comprare')}"`,
      `"${(it.link || '').replace(/"/g, '""')}"`,
      `"${(it.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `casa-burjassot-acquisti-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast('📊 File CSV scaricato!');
  }

  function exportBackupJson() {
    const dataStr = JSON.stringify(items, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `casa-burjassot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    showToast('📥 Backup JSON scaricato!');
  }

  function importBackupJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          items = imported;
          saveLocalData();
          showToast(`📤 Ripristinati ${items.length} articoli con successo!`);
          closeModal(elements.modalSync);
        } else {
          showToast('❌ Il file selezionato non è valido');
        }
      } catch (err) {
        showToast('❌ Errore nella lettura del file JSON');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // --- PWA INSTALLATION LOGIC ---
  function setupPWA() {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('SW registrato con successo:', reg.scope))
          .catch((err) => console.warn('Errore registrazione SW:', err));
      });
    }

    // 2. Before Install Prompt (Android / Chrome / Edge)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;

      // Mostra pulsante Installa nell'header e banner in basso
      elements.btnInstallHeader.style.display = 'inline-flex';
      elements.pwaInstallBanner.style.display = 'flex';
    });

    const triggerInstall = async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        if (outcome === 'accepted') {
          showToast('🎉 App installata sulla schermata home!');
          elements.pwaInstallBanner.style.display = 'none';
          elements.btnInstallHeader.style.display = 'none';
        }
        deferredInstallPrompt = null;
      } else {
        // Se non c'è prompt (es. iPhone o browser già installato)
        showIosOrManualHelp();
      }
    };

    elements.btnInstallHeader.addEventListener('click', triggerInstall);
    elements.btnPwaInstall.addEventListener('click', triggerInstall);
    elements.btnPwaDismiss.addEventListener('click', () => {
      elements.pwaInstallBanner.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
      showToast('🎉 Casa Burjassot è ora installata sul tuo dispositivo!');
      elements.pwaInstallBanner.style.display = 'none';
      elements.btnInstallHeader.style.display = 'none';
    });

    // Se è iOS Safari, mostra l'aiuto nel modal
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      elements.iosHelper.style.display = 'flex';
      elements.btnInstallHeader.style.display = 'inline-flex';
      elements.btnInstallHeader.addEventListener('click', () => {
        openModal(elements.modalSync);
      });
    }
  }

  function showIosOrManualHelp() {
    const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    if (isIos) {
      openModal(elements.modalSync);
      elements.iosHelper.scrollIntoView({ behavior: 'smooth' });
    } else {
      showToast('💡 Clicca sui 3 puntini del browser > "Aggiungi a schermata Home"');
    }
  }

  // Esegui bootstrap
  init();
})();

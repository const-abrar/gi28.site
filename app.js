/* ============================================================
   GI28 — app.js
   Main application: service rendering, UI interactions,
   modals, search, sidebar, cart state management
   ============================================================ */

'use strict';

/* ── State ── */
const GI28 = {
  services: [],
  categories: [],
  cart: [],
  activeCategory: 'all',
  searchQuery: '',
  cartOpen: false,
  installPrompt: null,

  /* Load services data */
  async init() {
    this.loadCart();
    await this.loadServices();
    this.renderSidebar();
    this.renderAllSections();
    this.bindEvents();
    this.updateCartUI();
    this.initServiceWorker();
    this.initInstallPrompt();
    this.initDragScroll();
    setTimeout(() => this.showInstallPrompt(), 4000);
  },

  async loadServices() {
    try {
      const res = await fetch('./services.json');
      this.services = await res.json();
      this.categories = [...new Set(this.services.map(s => s.category))];
    } catch(e) {
      console.error('Failed to load services:', e);
      this.services = [];
    }
  },

  loadCart() {
    try {
      this.cart = JSON.parse(localStorage.getItem('gi28_cart') || '[]');
    } catch(e) { this.cart = []; }
  },

  saveCart() {
    localStorage.setItem('gi28_cart', JSON.stringify(this.cart));
  },

  /* ── Sidebar ── */
  renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const categoryIcons = {
      Instagram: icons.instagram, YouTube: icons.youtube, Telegram: icons.telegram,
      Facebook: icons.facebook, Website: icons.website, SEO: icons.seo,
      Traffic: icons.traffic, Engagement: icons.engagement, Marketing: icons.marketing,
      Tools: icons.tools
    };

    const counts = {};
    this.services.forEach(s => { counts[s.category] = (counts[s.category] || 0) + 1; });

    let html = `
      <div class="sidebar__label">Platforms</div>
      <div class="sidebar__item ${this.activeCategory === 'all' ? 'active' : ''}"
           data-cat="all" onclick="GI28.filterCategory('all')">
        ${icons.grid}
        <span>All Services</span>
        <span class="count">${this.services.length}</span>
      </div>`;

    const platforms = ['Instagram','YouTube','Telegram','Facebook','Website'];
    const tools     = ['SEO','Traffic','Engagement','Marketing','Tools'];

    platforms.forEach(cat => {
      if (this.categories.includes(cat)) {
        html += this.sidebarItem(cat, categoryIcons[cat], counts[cat]);
      }
    });

    html += `<div class="sidebar__label" style="margin-top:8px">Services</div>`;
    tools.forEach(cat => {
      if (this.categories.includes(cat)) {
        html += this.sidebarItem(cat, categoryIcons[cat], counts[cat]);
      }
    });

    sidebar.innerHTML = html;
  },

  sidebarItem(cat, icon, count) {
    const active = this.activeCategory === cat ? 'active' : '';
    return `
      <div class="sidebar__item ${active}" data-cat="${cat}" onclick="GI28.filterCategory('${cat}')">
        ${icon}
        <span>${cat}</span>
        <span class="count">${count || 0}</span>
      </div>`;
  },

  filterCategory(cat) {
    this.activeCategory = cat;
    this.renderSidebar();
    if (cat === 'all') {
      document.querySelectorAll('.service-category').forEach(el => el.style.display = '');
    } else {
      document.querySelectorAll('.service-category').forEach(el => {
        el.style.display = el.dataset.category === cat ? '' : 'none';
      });
      const target = document.querySelector(`.service-category[data-category="${cat}"]`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  /* ── Render Services ── */
  renderAllSections() {
    const container = document.getElementById('services-container');
    if (!container) return;

    const html = this.categories.map(cat => {
      const catServices = this.services.filter(s => s.category === cat);
      return this.renderCategorySection(cat, catServices);
    }).join('');

    container.innerHTML = html;
  },

  renderCategorySection(cat, services) {
    const tilesHtml = services.map(s => this.renderTile(s)).join('');
    return `
      <section class="service-category" id="cat-${cat.toLowerCase()}" data-category="${cat}">
        <div class="section-header">
          <h2 class="section-header__title">${cat}</h2>
          <div class="section-header__line"></div>
          <span class="section-header__count">${services.length} service${services.length>1?'s':''}</span>
        </div>
        <div class="tiles-scroll" data-scroll-row>
          ${tilesHtml}
        </div>
      </section>`;
  },

renderTile(service) {
  const discountHtml = service.discount > 0
    ? `<div class="tile__discount">−${service.discount}%</div>`
    : `<div style="height:16px"></div>`;

  const badgeHtml = service.badge
    ? `<div class="tile__badge tile__badge--${service.badge.toLowerCase().replace(/\s+/g,'-')}">${service.badge}</div>`
    : '';

  const priceRs = `₹${service.price}`;

  return `
    <div class="service-tile" data-id="${service.id}" onclick="GI28.openAddModal('${service.id}')">
      ${badgeHtml}
      ${discountHtml}

      <div class="tile__title">${service.title}</div>

      <div class="tile__desc">
        ${service.description || ''}
      </div>

      <div class="tile__footer">
        <div>
          <div class="tile__price">${priceRs}  / Unit</div>
        </div>

        <button class="tile__add-btn"
          aria-label="Add to cart"
          onclick="event.stopPropagation();GI28.openAddModal('${service.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </div>`;
},

  /* ── Add to Cart Modal ── */
  openAddModal(serviceId) {
    const service = this.services.find(s => s.id === serviceId);
    if (!service) return;

    const modal = document.getElementById('add-modal');
    const overlay = document.getElementById('modal-overlay');
    if (!modal || !overlay) return;

    modal.dataset.serviceId = serviceId;

    modal.querySelector('#modal-title').textContent = service.title;
    modal.querySelector('#modal-category').textContent = service.category;
 modal.querySelector('#modal-description').textContent = service.description;
    modal.querySelector('#modal-qty').value = service.min;
    modal.querySelector('#modal-qty').min = service.min;
    modal.querySelector('#modal-qty').max = service.max;
    modal.querySelector('#modal-link').value = '';
    modal.querySelector('#modal-qty-hint').textContent = `Min: ${service.min.toLocaleString()} / Max: ${service.max.toLocaleString()}`;
    modal.querySelector('#modal-unit-price').textContent = `₹${service.price}`;
    modal.querySelector('#modal-qty-error').classList.remove('show');
    modal.querySelector('#modal-link-error').classList.remove('show');

    this.updateModalPrice(service);

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    setTimeout(() => modal.querySelector('#modal-qty').focus(), 200);
  },

  updateModalPrice(service) {
    const qtyEl = document.getElementById('modal-qty');
    const totalEl = document.getElementById('modal-total');
    const qtyDisp = document.getElementById('modal-qty-display');
    if (!qtyEl || !totalEl) return;

    const qty = parseInt(qtyEl.value) || 0;
    const total = (qty / 1000) * service.price;
    // Actually price per unit field
    const unitMultiplier = this.getUnitMultiplier(service.unit);
    const calcTotal = (qty / unitMultiplier) * service.price;
    totalEl.textContent = `₹${calcTotal.toFixed(2)}`;
    if (qtyDisp) qtyDisp.textContent = qty.toLocaleString();
  },

  getUnitMultiplier(unit) {
    if (unit.includes('1000') || unit === '1000') return 1000;
    if (unit.includes('100')) return 100;
    if (unit.includes('10')) return 10;
    return 1;
  },

  confirmAddToCart() {
    const modal = document.getElementById('add-modal');
    const serviceId = modal.dataset.serviceId;
    const service = this.services.find(s => s.id === serviceId);
    if (!service) return;

    const qty = parseInt(modal.querySelector('#modal-qty').value);
    const link = modal.querySelector('#modal-link').value.trim();

    let valid = true;

    if (isNaN(qty) || qty < service.min || qty > service.max) {
      modal.querySelector('#modal-qty-error').textContent = `Quantity must be between ${service.min} and ${service.max}`;
      modal.querySelector('#modal-qty-error').classList.add('show');
      valid = false;
    } else {
      modal.querySelector('#modal-qty-error').classList.remove('show');
    }

    if (!link) {
      modal.querySelector('#modal-link-error').textContent = 'Please enter a target link or username';
      modal.querySelector('#modal-link-error').classList.add('show');
      valid = false;
    } else {
      modal.querySelector('#modal-link-error').classList.remove('show');
    }

    if (!valid) return;

    const unitMultiplier = this.getUnitMultiplier(service.unit);
    const price = parseFloat(((qty / unitMultiplier) * service.price).toFixed(2));

    const cartItem = {
      id: service.id,
      title: service.title,
      category: service.category,
      qty,
      unit: service.unit,
      link,
      price,
      unitPrice: service.price,
      addedAt: Date.now()
    };

    // Check for duplicate
    const existingIdx = this.cart.findIndex(i => i.id === service.id && i.link === link);
    if (existingIdx >= 0) {
      this.cart[existingIdx] = cartItem;
    } else {
      this.cart.push(cartItem);
    }

    this.saveCart();
    this.updateCartUI();
    this.closeModal();
    this.showToast(`${service.title} added to cart`, 'success');
  },

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  },

  /* ── Cart UI ── */
  updateCartUI() {
    const count = this.cart.length;
    document.querySelectorAll('.cart-badge').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 300);
    });
    this.renderCartSidebar();
  },

  renderCartSidebar() {
    const itemsContainer = document.getElementById('cart-sidebar-items');
    const emptyEl = document.getElementById('cart-sidebar-empty');
    const footerEl = document.getElementById('cart-sidebar-footer');
    if (!itemsContainer) return;

    if (this.cart.length === 0) {
      itemsContainer.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'flex';
      if (footerEl) footerEl.style.display = 'none';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (footerEl) footerEl.style.display = 'block';

    const total = this.cart.reduce((sum, i) => sum + i.price, 0);

    itemsContainer.innerHTML = this.cart.map((item, idx) => `
      <div class="cart-item">
        <div class="cart-item__name">${item.title}</div>
        <div class="cart-item__meta" title="${item.link}">${item.link}</div>
        <div class="cart-item__row">
          <span class="cart-item__qty">${item.qty.toLocaleString()} × ₹${item.unitPrice}/${item.unit}</span>
          <span class="cart-item__price">₹${item.price.toFixed(2)}</span>
          <span class="cart-item__remove" onclick="GI28.removeFromCart(${idx})">✕</span>
        </div>
      </div>`).join('');

    const totalEl = document.getElementById('cart-sidebar-total');
    if (totalEl) totalEl.textContent = `₹${total.toFixed(2)}`;
  },

  removeFromCart(idx) {
    this.cart.splice(idx, 1);
    this.saveCart();
    this.updateCartUI();
    this.showToast('Item removed from cart', 'info');
  },

  toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    this.cartOpen = !this.cartOpen;
    sidebar.classList.toggle('open', this.cartOpen);
    if (this.cartOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
  },

  closeCart() {
    const sidebar = document.getElementById('cart-sidebar');
    this.cartOpen = false;
    sidebar.classList.remove('open');
    document.body.style.overflow = '';
  },

  /* ── Search ── */
  handleSearch(query) {
    this.searchQuery = query.toLowerCase().trim();
    const resultsEl = document.getElementById('search-results');
    if (!resultsEl) return;

    if (!this.searchQuery) {
      resultsEl.classList.remove('show');
      return;
    }

    const matches = this.services.filter(s =>
      s.title.toLowerCase().includes(this.searchQuery) ||
      s.category.toLowerCase().includes(this.searchQuery) ||
      s.description.toLowerCase().includes(this.searchQuery)
    ).slice(0, 8);

    if (matches.length === 0) {
      resultsEl.innerHTML = `<div style="padding:12px 16px;font-size:12px;color:rgba(172,200,162,0.4)">No results found</div>`;
      resultsEl.classList.add('show');
      return;
    }

    resultsEl.innerHTML = matches.map(s => `
      <div class="search-result-item" onclick="GI28.openAddModal('${s.id}');document.getElementById('search-results').classList.remove('show')">
        <div>
          <div class="search-result-name">${s.title}</div>
          <div class="search-result-cat">${s.category}</div>
        </div>
        <div class="search-result-price">₹${s.price}/${s.unit}</div>
      </div>`).join('');

    resultsEl.classList.add('show');
  },

  /* ── Events ── */
  bindEvents() {
    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => this.handleSearch(e.target.value));
      searchInput.addEventListener('blur', () => {
        setTimeout(() => document.getElementById('search-results')?.classList.remove('show'), 150);
      });
    }

    // Cart toggle button
    document.getElementById('cart-toggle')?.addEventListener('click', () => this.toggleCart());
    document.getElementById('cart-close')?.addEventListener('click', () => this.closeCart());
    document.getElementById('cart-mobile-toggle')?.addEventListener('click', () => this.toggleCart());

    // Modal qty input
    document.getElementById('modal-qty')?.addEventListener('input', () => {
      const modal = document.getElementById('add-modal');
      const service = this.services.find(s => s.id === modal.dataset.serviceId);
      if (service) this.updateModalPrice(service);
    });

    // Modal confirm
    document.getElementById('modal-confirm')?.addEventListener('click', () => this.confirmAddToCart());
    document.getElementById('modal-cancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());

    // Overlay click closes modal
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) this.closeModal();
    });

    // Cart overlay
    document.getElementById('cart-overlay')?.addEventListener('click', () => this.closeCart());

    // Go to cart button
    document.getElementById('go-to-cart')?.addEventListener('click', () => {
      window.location.href = '/cart/';
    });

    // Install prompt
    document.getElementById('install-btn')?.addEventListener('click', () => this.installApp());
    document.getElementById('install-dismiss')?.addEventListener('click', () => this.dismissInstall());

    // Keyboard close
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.closeModal();
        this.closeCart();
      }
    });

    // Enter to confirm modal
    document.getElementById('modal-link')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.confirmAddToCart();
    });
  },

  /* ── Drag Scroll ── */
  initDragScroll() {
    document.querySelectorAll('[data-scroll-row]').forEach(el => {
      let isDown = false, startX, scrollLeft;
      el.addEventListener('mousedown', e => {
        isDown = true; el.classList.add('dragging');
        startX = e.pageX - el.offsetLeft;
        scrollLeft = el.scrollLeft;
      });
      el.addEventListener('mouseleave', () => { isDown = false; el.classList.remove('dragging'); });
      el.addEventListener('mouseup', () => { isDown = false; el.classList.remove('dragging'); });
      el.addEventListener('mousemove', e => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX) * 1.5;
        el.scrollLeft = scrollLeft - walk;
      });
    });
  },

  /* ── PWA ── */
  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(console.error);
      });
    }
  },

  initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.installPrompt = e;
    });
  },

  showInstallPrompt() {
  const dismissed = localStorage.getItem('gi28_install_dismissed');
  if (dismissed) return;

  if (!this.installPrompt && !('standalone' in window.navigator)) return;

  document.getElementById('install-prompt')?.classList.add('show');
},

  async installApp() {
  if (!this.installPrompt) return;

  this.installPrompt.prompt();

  const result = await this.installPrompt.userChoice;

  if (result.outcome === 'accepted') {
    document.getElementById('install-prompt').classList.remove('show');
  }

  this.installPrompt = null;
},

  dismissInstall() {
    document.getElementById('install-prompt')?.classList.remove('show');
    localStorage.setItem('gi28_install_dismissed', '1');
  },

  /* ── Toasts ── */
  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

/* ── SVG Icon Library ── */
const icons = {
  instagram: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  youtube:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>`,
  telegram:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.8 2.15 2.4 9.62a.5.5 0 0 0 .03.94l4.57 1.57 1.77 5.58a.5.5 0 0 0 .83.19l2.57-2.44 4.97 3.65a.5.5 0 0 0 .78-.29L22.3 2.75a.5.5 0 0 0-.5-.6z"/></svg>`,
  facebook:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
  website:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  seo:       `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  traffic:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  engagement:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  marketing: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  tools:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  grid:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  search:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  cart:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
  close:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  whatsapp:  `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>`,
  telegram_icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>`
};

/* Boot */
document.addEventListener('DOMContentLoaded', () => GI28.init());

/* ============================================================
   GI28 — cart.js
   Full cart page: order review, coupon, checkout flow,
   order ID generation, payment, receipt
   ============================================================ */

'use strict';

const CartPage = {
  cart: [],
  coupons: [],
  appliedCoupon: null,
  subtotal: 0,
  discount: 0,
  total: 0,
  orderId: null,
  upiId: null,
  uniqueAmount: 0,
  customerName: '',
  customerWa: '',
  utrCode: '',

  async init() {
    this.loadCart();
    await this.loadCoupons();
    this.renderCart();
    this.bindEvents();
    this.initServiceWorker();
  },

  loadCart() {
    try {
      this.cart = JSON.parse(localStorage.getItem('gi28_cart') || '[]');
    } catch(e) { this.cart = []; }
  },

  saveCart() {
    localStorage.setItem('gi28_cart', JSON.stringify(this.cart));
  },

  async loadCoupons() {
    try {
      const res = await fetch('../coupon.json');
      this.coupons = await res.json();
    } catch(e) { this.coupons = []; }
  },

  /* ── Calculate Totals ── */
  calculate() {
    this.subtotal = this.cart.reduce((sum, i) => sum + i.price, 0);
    this.discount = 0;
    if (this.appliedCoupon) {
      if (this.appliedCoupon.type === 'percent') {
        this.discount = this.subtotal * this.appliedCoupon.discount / 100;
      } else {
        this.discount = this.appliedCoupon.discount;
      }
    }
    this.total = Math.max(0, this.subtotal - this.discount);
  },

  /* ── Render Cart ── */
  renderCart() {
    this.calculate();
    this.renderItems();
    this.renderTotals();
    this.renderEmpty();
  },

  renderItems() {
    const container = document.getElementById('cart-items');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.cart.map((item, idx) => `
      <div class="cp-cart-item" id="cart-item-${idx}">
        <div class="cp-cart-item__header">
          <div class="cp-cart-item__name">${item.title}</div>
          <div class="cp-cart-item__category">${item.category}</div>
        </div>
        <div class="cp-cart-item__body">
          <div class="cp-cart-item__field">
            <span class="cp-label">Target</span>
          <span class="cp-value cp-link">${this.shortenLink(item.link)}</span>
          </div>
          <div class="cp-cart-item__field">
            <span class="cp-label">Quantity</span>
            <span class="cp-value">${item.qty.toLocaleString()} ${item.unit}</span>
          </div>
          <div class="cp-cart-item__field">
            <span class="cp-label">Unit Rate</span>
            <span class="cp-value">₹${item.unitPrice} / ${item.unit}</span>
          </div>
        </div>
        <div class="cp-cart-item__footer">
          <button class="cp-btn-ghost" onclick="CartPage.removeItem(${idx})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            Remove
          </button>
          <div class="cp-cart-item__price">₹${item.price.toFixed(2)}</div>
        </div>
      </div>`).join('');
  },

  renderTotals() {
    const subEl = document.getElementById('summary-subtotal');
    const discEl = document.getElementById('summary-discount');
    const totalEl = document.getElementById('summary-total');
    const discRow = document.getElementById('summary-discount-row');

    if (subEl) subEl.textContent = `₹${this.subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `₹${this.total.toFixed(2)}`;

    if (discRow) {
      if (this.discount > 0) {
        discRow.style.display = 'flex';
        if (discEl) discEl.textContent = `−₹${this.discount.toFixed(2)}`;
      } else {
        discRow.style.display = 'none';
      }
    }
  },

  renderEmpty() {
    const emptyEl = document.getElementById('cart-empty');
    const mainEl = document.getElementById('cart-main');
    if (!emptyEl || !mainEl) return;
    if (this.cart.length === 0) {
      emptyEl.style.display = 'flex';
      mainEl.style.display = 'none';
    } else {
      emptyEl.style.display = 'none';
      mainEl.style.display = 'grid';
    }
  },

  removeItem(idx) {
    this.cart.splice(idx, 1);
    this.saveCart();
    this.renderCart();
    this.showToast('Item removed', 'info');
  },

  /* ── Coupon ── */
  applyCoupon() {
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-msg');
    if (!input || !msg) return;

    const code = input.value.trim().toUpperCase();
    const coupon = this.coupons.find(c => c.code === code);

    if (!coupon) {
      msg.textContent = 'Invalid coupon code';
      msg.className = 'cp-coupon-msg cp-coupon-msg--error';
      this.appliedCoupon = null;
    } else if (this.subtotal < coupon.min_order) {
      msg.textContent = `Minimum order ₹${coupon.min_order} required`;
      msg.className = 'cp-coupon-msg cp-coupon-msg--error';
      this.appliedCoupon = null;
    } else {
      this.appliedCoupon = coupon;
      msg.textContent = `✓ ${coupon.description}`;
      msg.className = 'cp-coupon-msg cp-coupon-msg--success';
    }

    this.renderCart();
  },

  removeCoupon() {
    this.appliedCoupon = null;
    const input = document.getElementById('coupon-input');
    const msg = document.getElementById('coupon-msg');
    if (input) input.value = '';
    if (msg) { msg.textContent = ''; msg.className = 'cp-coupon-msg'; }
    this.renderCart();
  },

  /* ── Order Generation ── */
  generateOrderId() {
    const now = new Date();
    const day  = String(now.getDate()).padStart(2, '0');
    const hr   = String(now.getHours()).padStart(2, '0');
    const min  = String(now.getMinutes()).padStart(2, '0');
    const sec  = String(now.getSeconds()).padStart(2, '0');
    return `AM${day}${hr}${min}${sec}`;
  },

  generateUniqueAmount() {
    const paise = Math.floor(Math.random() * 98) + 1;
    return parseFloat((this.total + paise / 100).toFixed(2));
  },

  getRandomUPI() {
    const upiIds = ['abrar2809@ptyes', 'const.abrar@oksbi', 'a.khan.130@superyes'];
    return upiIds[Math.floor(Math.random() * upiIds.length)];
  },

  /* ── Checkout Flow ── */
  proceedCheckout() {
    // Validate customer info
    const nameEl = document.getElementById('customer-name');
    const waEl   = document.getElementById('customer-wa');
    const nameErr = document.getElementById('name-error');
    const waErr   = document.getElementById('wa-error');

    this.customerName = nameEl?.value.trim() || '';
    this.customerWa   = waEl?.value.trim() || '';

    let valid = true;
    if (!this.customerName) {
      if (nameErr) { nameErr.textContent = 'Name is required'; nameErr.classList.add('show'); }
      valid = false;
    } else {
      nameErr?.classList.remove('show');
    }
    if (!this.customerWa || !/^\d{10,15}$/.test(this.customerWa.replace(/[\s+\-]/g,''))) {
      if (waErr) { waErr.textContent = 'Enter a valid WhatsApp number'; waErr.classList.add('show'); }
      valid = false;
    } else {
      waErr?.classList.remove('show');
    }

    if (!valid || this.cart.length === 0) return;
    if (this.cart.length === 0) { this.showToast('Cart is empty', 'error'); return; }

    this.orderId = this.generateOrderId();
    this.upiId   = this.getRandomUPI();
    this.uniqueAmount = this.generateUniqueAmount();

    this.showOrderSummaryModal();
  },

  showOrderSummaryModal() {
    const modal = document.getElementById('order-modal');
    if (!modal) return;

    document.getElementById('order-id-display').textContent = this.orderId;
    document.getElementById('order-amount-display').textContent = `₹${this.uniqueAmount.toFixed(2)}`;
    document.getElementById('order-items-list').innerHTML = this.cart.map(item => `
      <div class="order-item-row">
        <span>${item.title} × ${item.qty.toLocaleString()}</span>
        <span>₹${item.price.toFixed(2)}</span>
      </div>`).join('');

    // Payment section
    this.renderPaymentSection();

    document.getElementById('order-modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  renderPaymentSection() {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const paySection = document.getElementById('payment-section');
    if (!paySection) return;

    const amount = this.uniqueAmount.toFixed(2);
    const upiLink = `upi://pay?pa=${this.upiId}&pn=GI28&am=${amount}&cu=INR&tn=Order-${this.orderId}`;
    const qrData  = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}&color=1A2517&bgcolor=f0ede6`;

    if (isMobile) {
      paySection.innerHTML = `
        <div class="pay-mobile">
          <div class="pay-label">Pay Exact Amount</div>
          <div class="pay-amount">₹${amount}</div>
          <div class="pay-upi-id">UPI: ${this.upiId}</div>
          <a href="${upiLink}" class="btn btn--primary btn--full pay-upi-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Open UPI App
          </a>
          <div class="pay-note">Opens GPay, PhonePe, Paytm etc.</div>
        </div>`;
    } else {
      paySection.innerHTML = `
        <div class="pay-desktop">
          <div class="pay-qr-wrap">
            <img src="${qrData}" alt="UPI QR Code" class="pay-qr" width="180" height="180"/>
          </div>
          <div class="pay-info">
            <div class="pay-label">Scan QR to Pay</div>
            <div class="pay-amount">₹${amount}</div>
            <div class="pay-upi-id">
              <span>UPI ID:</span>
              <code>${this.upiId}</code>
              <button onclick="CartPage.copyUPI()" class="cp-btn-ghost cp-btn-ghost--sm">Copy</button>
            </div>
            <div class="pay-note">Use any UPI app: GPay, PhonePe, Paytm</div>
            <div class="pay-warning">⚠ Pay the exact amount shown</div>
          </div>
        </div>`;
    }
  },

  copyUPI() {
    navigator.clipboard?.writeText(this.upiId).then(() => this.showToast('UPI ID copied', 'success'));
  },

  closeOrderModal() {
    document.getElementById('order-modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
  },

  /* ── UTR Submission ── */
  submitOrder() {
    const utrEl  = document.getElementById('utr-input');
    const utrErr = document.getElementById('utr-error');
    this.utrCode = utrEl?.value.trim() || '';

    if (!this.utrCode || this.utrCode.length < 8) {
      if (utrErr) { utrErr.textContent = 'Enter a valid UTR/Transaction ID'; utrErr.classList.add('show'); }
      return;
    }
    utrErr?.classList.remove('show');

    // Submit via Web3Forms
    this.submitToWeb3Forms();
  },

  async submitToWeb3Forms() {
    const submitBtn = document.getElementById('submit-order-btn');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    const payload = {
      access_key: 'YOUR_WEB3FORMS_KEY', // Replace with actual key
      subject: `New Order ${this.orderId} — GI28`,
      name: this.customerName,
      whatsapp: this.customerWa,
      source: window.location.hostname,
      order_id: this.orderId,
      items: JSON.stringify(this.cart.map(i => ({ name: i.title, qty: i.qty, link: i.link, price: i.price }))),
      amount: this.uniqueAmount.toFixed(2),
      utr: this.utrCode,
      timestamp: new Date().toISOString(),
      coupon: this.appliedCoupon?.code || 'none'
    };

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.showReceiptPage();
      } else {
        throw new Error('Submission failed');
      }
    } catch(e) {
      // Still show receipt even if form fails
      this.showReceiptPage();
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Order'; }
    }
  },

  /* ── Receipt Page ── */
  showReceiptPage() {
    document.getElementById('order-modal-overlay').classList.remove('open');
    document.getElementById('receipt-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('receipt-order-id').textContent = this.orderId;
    document.getElementById('receipt-date').textContent = `${dateStr}, ${timeStr}`;
    document.getElementById('receipt-name').textContent = this.customerName;
    document.getElementById('receipt-wa').textContent = this.customerWa;
    document.getElementById('receipt-utr').textContent = this.utrCode;
    document.getElementById('receipt-total').textContent = `₹${this.uniqueAmount.toFixed(2)}`;

    document.getElementById('receipt-items').innerHTML = this.cart.map(item => `
      <tr>
        <td>${item.title}</td>
        <td>${item.category}</td>
        <td>${item.qty.toLocaleString()}</td>
        <td>${item.link}</td>
        <td>₹${item.price.toFixed(2)}</td>
      </tr>`).join('');

    // Clear cart
    localStorage.removeItem('gi28_cart');
    this.cart = [];
  },
shortenLink(link) {
  if (!link) return '';
  const clean = link.replace(/^https?:\/\//, '');
  return clean.substring(0,3) + '...';
},
beforeinstallprompt
  /* ── Download Receipt ── */
  async downloadReceipt() {
    const receiptEl = document.getElementById('receipt-printable');
    if (!receiptEl) return;

    // Generate receipt HTML as data URI and open
    const html = receiptEl.outerHTML;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const fullHTML = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>GI28 Receipt — ${this.orderId}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'DM Sans',sans-serif;font-size:12px;color:#1A2517;background:#f8f5ef;padding:24px}
        .receipt-doc{max-width:680px;margin:0 auto;background:#fff;border:1px solid #e0d8d0;padding:32px}
        .receipt-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1A2517;padding-bottom:16px;margin-bottom:16px}
        .receipt-logo{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#1A2517;letter-spacing:0.1em}
        .receipt-logo small{display:block;font-family:'DM Sans',sans-serif;font-size:9px;font-weight:300;letter-spacing:0.2em;color:#888;margin-top:2px}
        .receipt-meta{text-align:right;font-size:11px;color:#666}
        .receipt-meta strong{display:block;font-size:13px;color:#1A2517;margin-bottom:4px}
        .receipt-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
        .info-block label{font-size:9px;text-transform:uppercase;letter-spacing:0.15em;color:#999;display:block;margin-bottom:2px}
        .info-block span{font-size:12px;color:#1A2517;font-weight:400}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.1em;color:#999;border-bottom:1px solid #e0d8d0;padding:8px 4px;text-align:left}
        td{font-size:11px;padding:8px 4px;border-bottom:1px solid #f0ede6;color:#1A2517}
        .total-row{border-top:2px solid #1A2517;padding-top:8px;display:flex;justify-content:space-between;margin-top:8px}
        .total-label{font-size:13px;font-weight:500;color:#1A2517}
        .total-amount{font-family:'Playfair Display',serif;font-size:18px;font-weight:600;color:#5C0120}
        .receipt-footer{margin-top:24px;border-top:1px solid #e0d8d0;padding-top:12px;font-size:10px;color:#999;text-align:center}
      </style>
    </head><body>${receiptEl.outerHTML}</body></html>`;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GI28-Receipt-${this.orderId}.html`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Receipt downloaded', 'success');
  },

  /* ── Events ── */
  bindEvents() {
    document.getElementById('apply-coupon')?.addEventListener('click', () => this.applyCoupon());
    document.getElementById('remove-coupon')?.addEventListener('click', () => this.removeCoupon());
    document.getElementById('coupon-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.applyCoupon();
    });

    document.getElementById('checkout-btn')?.addEventListener('click', () => this.proceedCheckout());
    document.getElementById('order-modal-close')?.addEventListener('click', () => this.closeOrderModal());
    document.getElementById('order-modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'order-modal-overlay') this.closeOrderModal();
    });
    document.getElementById('submit-order-btn')?.addEventListener('click', () => this.submitOrder());
    document.getElementById('download-receipt')?.addEventListener('click', () => this.downloadReceipt());
    document.getElementById('receipt-close')?.addEventListener('click', () => {
      document.getElementById('receipt-overlay').classList.remove('open');
      document.body.style.overflow = '';
      window.location.href = '../';
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        this.closeOrderModal();
        document.getElementById('receipt-overlay')?.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  },

  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('../service-worker.js').catch(console.error);
    }
  },

  showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => CartPage.init());

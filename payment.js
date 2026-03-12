/* ============================================================
   GI28 — payment.js
   Payment utilities: UPI link generation, QR, deep links
   ============================================================ */

'use strict';

const Payment = {
  UPI_IDS: ['abrar2809@ptyes', 'const.abrar@oksbi', 'a.khan.130@superyes'],
  MERCHANT_NAME: 'GI28',

  /* Get a random UPI ID for each transaction */
  getUPI() {
    return this.UPI_IDS[Math.floor(Math.random() * this.UPI_IDS.length)];
  },

  /* Add unique paise to amount */
  makeUnique(amount) {
    const paise = Math.floor(Math.random() * 98) + 1;
    return parseFloat((amount + paise / 100).toFixed(2));
  },

  /* Build UPI deep link */
  buildLink({ upiId, amount, orderId, name = this.MERCHANT_NAME }) {
    const params = new URLSearchParams({
      pa: upiId,
      pn: name,
      am: amount.toFixed(2),
      cu: 'INR',
      tn: `Order-${orderId}`
    });
    return `upi://pay?${params.toString()}`;
  },

  /* Generate QR image URL (free public API) */
  buildQRUrl({ upiId, amount, orderId, size = 200 }) {
    const link = this.buildLink({ upiId, amount, orderId });
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(link)}&color=1A2517&bgcolor=f0ede6&margin=10`;
  },

  /* Detect mobile */
  isMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  },

  /* Render payment widget into a container element */
  render(container, { amount, orderId }) {
    if (!container) return;
    const upiId = this.getUPI();
    const uniqueAmt = this.makeUnique(amount);
    const link = this.buildLink({ upiId, amount: uniqueAmt, orderId });
    const qrUrl = this.buildQRUrl({ upiId, amount: uniqueAmt, orderId });

    if (this.isMobile()) {
      container.innerHTML = `
        <div class="payment-widget payment-widget--mobile">
          <div class="pw-header">
            <div class="pw-label">Pay Exact Amount</div>
            <div class="pw-amount">₹${uniqueAmt.toFixed(2)}</div>
          </div>
          <div class="pw-upi">${upiId}</div>
          <a href="${link}" class="btn btn--primary btn--full pw-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
            Open UPI App
          </a>
          <div class="pw-apps">Works with GPay · PhonePe · Paytm · BHIM</div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="payment-widget payment-widget--desktop">
          <div class="pw-qr-col">
            <img src="${qrUrl}" alt="UPI QR" class="pw-qr" loading="lazy"/>
            <div class="pw-qr-label">Scan to pay</div>
          </div>
          <div class="pw-info-col">
            <div class="pw-label">Amount to Pay</div>
            <div class="pw-amount">₹${uniqueAmt.toFixed(2)}</div>
            <div class="pw-divider"></div>
            <div class="pw-upi-row">
              <div class="pw-upi-label">UPI ID</div>
              <div class="pw-upi-val">${upiId}</div>
              <button class="pw-copy-btn" onclick="Payment.copyText('${upiId}','UPI ID copied')">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy
              </button>
            </div>
            <div class="pw-apps">Use GPay, PhonePe, Paytm or any UPI app</div>
            <div class="pw-warning">⚠ Pay exactly ₹${uniqueAmt.toFixed(2)} — unique paise ensures tracking</div>
          </div>
        </div>`;
    }

    return { upiId, amount: uniqueAmt };
  },

  copyText(text, msg = 'Copied!') {
    navigator.clipboard?.writeText(text).then(() => {
      // Find toast container
      const tc = document.getElementById('toast-container');
      if (tc) {
        const t = document.createElement('div');
        t.className = 'toast toast--success';
        t.textContent = msg;
        tc.appendChild(t);
        setTimeout(() => t.remove(), 3000);
      }
    });
  }
};

(function () {
  // DOM
  const d = document;
  const amountInput = d.getElementById('amount');
  const chips = Array.from(d.querySelectorAll('[data-amount]'));
  const amountError = d.getElementById('amountError');
  const coverFees = d.getElementById('coverFees');
  const feePreview = d.getElementById('feePreview');
  const fundSelect = d.getElementById('fund');
  const fundDesc = d.getElementById('fundDesc');
  const nameInput = d.getElementById('name');
  const emailInput = d.getElementById('email');
  const giveBtn = d.getElementById('giveBtn');
  const summary = d.getElementById('summary');

  const sheet = d.getElementById('paySheet');
  const backdrop = d.getElementById('sheetBackdrop');
  const closeSheetBtn = d.getElementById('closeSheet');
  const confirmPayBtn = d.getElementById('confirmPayBtn');
  const confirmTotalEl = d.getElementById('confirmTotal');
  const payStatus = d.getElementById('payStatus');

  const appleBtnWrap = d.getElementById('apple-pay-btn');
  const googleBtnWrap = d.getElementById('google-pay-btn');
  const cashBtnWrap = d.getElementById('cash-app-pay-btn');
  const walletDivider = d.getElementById('wallet-divider');

  // Helpers
  const FUND_DESCRIPTIONS = {
    'tithe': 'Supports the ongoing ministry and operations.',
    'offering': 'Helps fund weekly services and community care.',
    'missions': 'Advances outreach and missionary support.',
    'building-fund': 'Invests in facilities, equipment, and upgrades.'
  };
  const parseAmount = v => {
    if (!v) return NaN;
    const cleaned = String(v).replace(/[^0-9.]/g, '');
    return parseFloat(cleaned);
  };
  const cur = n => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const feeFor = amt => Math.max(0, (amt * 0.029) + 0.30); // estimate

  function amountValid() {
    const amt = parseAmount(amountInput.value);
    const ok = !isNaN(amt) && amt >= 1;
    amountError.classList.toggle('hidden', ok);
    return ok ? amt : NaN;
  }
  function updateFeePreview() {
    const amt = amountValid();
    if (isNaN(amt) || !coverFees.checked) { feePreview.textContent = '(adds ~$0.00)'; return; }
    feePreview.textContent = `(adds ~${cur(feeFor(amt))})`;
  }
  function updateFundDesc() { fundDesc.textContent = FUND_DESCRIPTIONS[fundSelect.value] || ''; }
  function updateSummary() {
    const amt = amountValid();
    const fundText = fundSelect.options[fundSelect.selectedIndex]?.text || 'Fund';
    if (isNaN(amt)) { summary.textContent = ''; return; }
    const fee = coverFees.checked ? feeFor(amt) : 0;
    summary.textContent = `Giving ${cur(amt)} to ${fundText}${fee ? ` • Fees ~ ${cur(fee)}` : ''} • Total ${cur(amt + fee)}`;
  }
  function updateGiveState() { giveBtn.disabled = isNaN(amountValid()); }

  // Chips
  function clearChipStates() { chips.forEach(b => b.classList.remove('chip--on')); }
  chips.forEach(btn => {
    btn.addEventListener('click', () => {
      amountInput.value = btn.dataset.amount;
      clearChipStates(); btn.classList.add('chip--on');
      updateGiveState(); updateFeePreview(); updateSummary();
      amountInput.focus({ preventScroll: true });
    });
  });

  // Inputs
  amountInput.addEventListener('input', () => { clearChipStates(); updateGiveState(); updateFeePreview(); updateSummary(); });
  coverFees.addEventListener('change', () => { updateFeePreview(); updateSummary(); });
  fundSelect.addEventListener('change', () => { updateFundDesc(); updateSummary(); });

  // Init UI
  updateFundDesc(); updateGiveState(); updateFeePreview(); updateSummary();

  // Payment sheet helpers
  const lockScroll = on => {
    d.documentElement.classList.toggle('overflow-hidden', on);
    d.body.classList.toggle('overflow-hidden', on);
  };
  const openSheet = () => { sheet.classList.remove('hidden'); lockScroll(true); };
  const closeSheet = () => { sheet.classList.add('hidden'); lockScroll(false); };

  // Square
  let payments, card, walletsReady = false;

  async function ensureSquareReady(totalCents) {
    const cfg = window.SQUARE_CONFIG || {};
    if (!cfg.appId || !cfg.locationId) throw new Error('Missing Square appId/locationId.');
    if (!window.Square) throw new Error('Square SDK not loaded');

    if (!payments) payments = window.Square.payments(cfg.appId, cfg.locationId);

    // Card
    if (!card) {
      card = await payments.card();
      await card.attach('#card-container');
    }

    // Wallets (if eligible)
    if (!walletsReady) {
      try {
        if (payments.applePay) {
          const ap = await payments.applePay({ countryCode: 'US', currencyCode: 'USD', total: { amount: (totalCents/100).toFixed(2), label: 'Total' } });
          const ok = await ap.canMakePayment();
          if (ok) { appleBtnWrap.classList.remove('hidden'); await ap.attach('#apple-pay-btn'); }
        }
      } catch {}
      try {
        if (payments.googlePay) {
          const gp = await payments.googlePay({ countryCode: 'US', currencyCode: 'USD', total: { amount: (totalCents/100).toFixed(2), label: 'Total' } });
          const gok = await gp.canMakePayment();
          if (gok) { googleBtnWrap.classList.remove('hidden'); await gp.attach('#google-pay-btn'); }
        }
      } catch {}
      try {
        if (payments.cashAppPay) {
          const cap = await payments.cashAppPay();
          const cok = await cap?.isAuthorized();
          if (cok) { cashBtnWrap.classList.remove('hidden'); await cap.attach('#cash-app-pay-btn'); }
        }
      } catch {}
      if (![appleBtnWrap, googleBtnWrap, cashBtnWrap].every(el => el.classList.contains('hidden'))) {
        walletDivider.classList.remove('hidden');
      }
      walletsReady = true;
    }
  }

  // Open the sheet
  const confirmBtnState = (on) => { confirmPayBtn.disabled = !on; };
  giveBtn.addEventListener('click', async () => {
    const amt = amountValid(); if (isNaN(amt)) return;
    const fee = coverFees.checked ? feeFor(amt) : 0;
    const total = amt + fee;

    confirmTotalEl.textContent = cur(total);
    openSheet();
    payStatus.textContent = 'Loading secure fields...';
    confirmBtnState(false);

    try {
      await ensureSquareReady(Math.round(total * 100));
      payStatus.textContent = '';
      confirmBtnState(true);
    } catch (e) {
      payStatus.textContent = e.message || 'Failed to initialize payment.';
      console.error(e);
    }
  });

  // Close sheet
  backdrop.addEventListener('click', closeSheet);
  closeSheetBtn.addEventListener('click', closeSheet);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // Confirm payment (Card)
  const idKey = () => {
    const a = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(a, b => ('0' + b.toString(16)).slice(-2)).join('');
  };
  confirmPayBtn.addEventListener('click', async () => {
    if (!card) return;
    confirmBtnState(false);
    payStatus.textContent = 'Tokenizing...';

    const tok = await card.tokenize();
    if (tok.status !== 'OK') {
      payStatus.textContent = 'Card details error. Please check and try again.';
      confirmBtnState(true);
      return;
    }

    const amt = amountValid(); if (isNaN(amt)) return;
    const fee = coverFees.checked ? feeFor(amt) : 0;
    const cents = Math.round((amt + fee) * 100);

    payStatus.textContent = 'Processing...';
    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tok.token,
          amount: cents,
          fund: fundSelect.value,
          name: nameInput.value || null,
          email: emailInput.value || null,
          idempotencyKey: idKey()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Payment failed');

      payStatus.textContent = 'Thank you! Payment approved.';
      setTimeout(() => { closeSheet(); payStatus.textContent = ''; }, 1000);
    } catch (err) {
      payStatus.textContent = err.message || 'Payment failed. Please try again.';
      console.error(err);
    } finally {
      confirmBtnState(true);
    }
  });
})();

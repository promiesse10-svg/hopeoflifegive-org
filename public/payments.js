(function () {
  const d = document;

  // --- DOM ---
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

  const appleBtnWrap = d.getElementById('apple-pay-btn');   // container YOU click
  const googleBtnWrap = d.getElementById('google-pay-btn'); // container Square renders into
  const cashBtnWrap = d.getElementById('cash-app-pay-btn');
  const afterpayWrap = d.getElementById('afterpay-btn');
  const achBtn = d.getElementById('ach-btn');
  const walletDivider = d.getElementById('wallet-divider');

  // --- helpers ---
  const FUND_DESCRIPTIONS = {
    'tithe': 'Supports the ongoing ministry and operations.',
    'offering': 'Helps fund weekly services and community care.',
    'missions': 'Advances outreach and missionary support.',
    'building-fund': 'Invests in facilities, equipment, and upgrades.'
  };
  const parseAmountRaw = v => (v ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
  const parseAmount = () => parseAmountRaw(amountInput.value);
  const cur = n => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const feeFor = amt => Math.max(0, amt * 0.029 + 0.30); // estimate

  function amountValid() { const a = parseAmount(); const ok = Number.isFinite(a) && a >= 1; amountError.classList.toggle('hidden', ok); return ok ? a : NaN; }
  function buyerTotal() { const b = amountValid(); if (isNaN(b)) return NaN; return coverFees.checked ? b + feeFor(b) : b; }
  function updateFeePreview() { const a = amountValid(); if (isNaN(a) || !coverFees.checked) { feePreview.textContent='(adds ~$0.00)'; return; } feePreview.textContent = `(adds ~${cur(feeFor(a))})`; }
  function updateFundDesc() { fundDesc.textContent = FUND_DESCRIPTIONS[fundSelect.value] || ''; }
  function updateSummary() { const a = amountValid(); const ftxt = fundSelect.options[fundSelect.selectedIndex]?.text || 'Fund'; if (isNaN(a)) { summary.textContent = ''; return; } const fee = coverFees.checked ? feeFor(a) : 0; summary.textContent = `Giving ${cur(a)} to ${ftxt}${fee ? ` • Fees ~ ${cur(fee)}` : ''} • Total ${cur(a+fee)}`; }
  function updateGiveState(){ giveBtn.disabled = isNaN(amountValid()); }

  // chips
  function clearChips(){ chips.forEach(b=>b.classList.remove('chip--on')); }
  chips.forEach(btn => btn.addEventListener('click', () => { amountInput.value = btn.dataset.amount; clearChips(); btn.classList.add('chip--on'); updateGiveState(); updateFeePreview(); updateSummary(); amountInput.focus({preventScroll:true}); }));

  amountInput.addEventListener('input', () => { clearChips(); updateGiveState(); updateFeePreview(); updateSummary(); });
  coverFees.addEventListener('change', () => { updateFeePreview(); updateSummary(); });
  fundSelect.addEventListener('change', () => { updateFundDesc(); updateSummary(); });

  updateFundDesc(); updateGiveState(); updateFeePreview(); updateSummary();

  // sheet helpers
  const lockScroll = on => { d.documentElement.classList.toggle('overflow-hidden', on); d.body.classList.toggle('overflow-hidden', on); };
  const openSheet = () => { sheet.classList.remove('hidden'); lockScroll(true); };
  const closeSheet = () => { sheet.classList.add('hidden'); lockScroll(false); };

  // Square
  let payments, card, paymentRequest, walletsReady = false;
  const cfg = window.SQUARE_CONFIG || {};
  const apiBase = cfg.apiBaseUrl || '';

  function idKey(){ const a = crypto.getRandomValues(new Uint8Array(16)); return Array.from(a,b=>('0'+b.toString(16)).slice(-2)).join(''); }

  async function postPaymentToken(token) {
    const cents = Math.round(buyerTotal() * 100);
    const res = await fetch(`${apiBase}/api/pay`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token, amount: cents, fund: fundSelect.value, name: nameInput.value || null, email: emailInput.value || null, idempotencyKey: idKey() })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Payment failed');
    return data;
  }

  function showDividerIfAnyWalletVisible(){
    const shown = [appleBtnWrap, googleBtnWrap, cashBtnWrap, afterpayWrap, achBtn].some(el => el && !el.classList.contains('hidden'));
    if (shown) walletDivider.classList.remove('hidden');
  }

  async function ensureSquareReady(totalCents){
    if (!cfg.appId || !cfg.locationId) throw new Error('Missing Square appId/locationId.');
    if (!window.Square) throw new Error('Square SDK not loaded');
    if (!payments) payments = window.Square.payments(cfg.appId, cfg.locationId);

    // Card
    if (!card) { card = await payments.card(); await card.attach('#card-container'); }

    // Shared PaymentRequest for wallets
    paymentRequest = await payments.paymentRequest({
      countryCode:'US', currencyCode:'USD',
      total:{ amount:(totalCents/100).toFixed(2), label:'Donation' },
      requestShippingContact:false
    });

    if (!walletsReady) {
      // APPLE PAY (no attach; you click your own element, then tokenize)
      try {
        const applePay = await payments.applePay(paymentRequest);
        // Show btn only on Apple devices with Wallet set up
        if (window.ApplePaySession && window.ApplePaySession.canMakePayments()) {
          appleBtnWrap.classList.remove('hidden');
          appleBtnWrap.onclick = async (e) => {
            e.preventDefault();
            try {
              payStatus.textContent = 'Authorizing Apple Pay...';
              const r = await applePay.tokenize();                // ← open Apple sheet
              if (r.status === 'OK') { await postPaymentToken(r.token); payStatus.textContent = 'Thank you! Payment approved (Apple Pay).'; setTimeout(closeSheet, 900); }
              else { payStatus.textContent = 'Apple Pay canceled or unavailable.'; }
            } catch (err) { payStatus.textContent = err.message || 'Apple Pay failed.'; }
          };
        }
      } catch { /* not eligible / domain not verified */ }

      // GOOGLE PAY (attach renders the button; you call tokenize on click)
      try {
        const googlePay = await payments.googlePay(paymentRequest);
        await googlePay.attach('#google-pay-btn');
        googleBtnWrap.classList.remove('hidden');
        googleBtnWrap.onclick = async (e) => {
          e.preventDefault();
          try {
            payStatus.textContent = 'Authorizing Google Pay...';
            const r = await googlePay.tokenize();                // ← open GPay sheet
            if (r.status === 'OK') { await postPaymentToken(r.token); payStatus.textContent = 'Thank you! Payment approved (Google Pay).'; setTimeout(closeSheet, 900); }
            else { payStatus.textContent = 'Google Pay canceled or unavailable.'; }
          } catch (err) { payStatus.textContent = err.message || 'Google Pay failed.'; }
        };
      } catch { /* not eligible on this device */ }

      // CASH APP PAY
      try {
        const cashAppPay = await payments.cashAppPay(paymentRequest, { redirectURL: window.location.origin, referenceId: 'donation-' + Date.now() });
        await cashAppPay.attach('#cash-app-pay-btn');
        cashBtnWrap.classList.remove('hidden');
        cashAppPay.addEventListener('ontokenization', async (evt) => {
          const { tokenResult, error } = evt.detail || {};
          if (error) { payStatus.textContent = error.message || 'Cash App Pay failed.'; return; }
          if (tokenResult?.status === 'OK') {
            try { await postPaymentToken(tokenResult.token); payStatus.textContent = 'Thank you! Payment approved (Cash App Pay).'; setTimeout(closeSheet, 900); }
            catch (err) { payStatus.textContent = err.message || 'Payment failed.'; }
          }
        });
      } catch {}

      // AFTERPAY/CLEARPAY
      try {
        const apcp = await payments.afterpayClearpay(paymentRequest);
        await apcp.attach('#afterpay-btn');
        afterpayWrap.classList.remove('hidden');
        afterpayWrap.onclick = async (e) => {
          e.preventDefault();
          try {
            payStatus.textContent = 'Authorizing Afterpay...';
            const r = await apcp.tokenize();
            if (r.status === 'OK') { await postPaymentToken(r.token); payStatus.textContent = 'Thank you! Payment approved (Afterpay).'; setTimeout(closeSheet, 900); }
            else { payStatus.textContent = 'Afterpay canceled or unavailable.'; }
          } catch (err) { payStatus.textContent = err.message || 'Afterpay failed.'; }
        };
      } catch {}

      // ACH
      try {
        const params = new URLSearchParams(location.search);
        const transactionId = params.get('transactionId') || undefined;
        const ach = await payments.ach({ redirectURI: window.location.origin, transactionId });
        achBtn.classList.remove('hidden');
        achBtn.onclick = async (e) => {
          e.preventDefault();
          const base = amountValid(); if (isNaN(base)) { payStatus.textContent = 'Enter a valid amount first.'; return; }
          try {
            payStatus.textContent = 'Opening bank selection...';
            const r = await ach.tokenize({ accountHolderName: (nameInput.value || 'Donor').trim(), intent: 'CHARGE', amount: buyerTotal().toFixed(2), currency:'USD' });
            if (r.status === 'OK') { await postPaymentToken(r.token); payStatus.textContent = 'Thank you! Payment approved (ACH).'; setTimeout(closeSheet, 900); }
            else { payStatus.textContent = 'ACH canceled or unavailable.'; }
          } catch (err) { payStatus.textContent = err.message || 'ACH failed.'; }
        };
      } catch {}

      showDividerIfAnyWalletVisible();
      walletsReady = true;
    }
  }

  // open sheet
  const confirmBtnState = on => { confirmPayBtn.disabled = !on; };
  giveBtn.addEventListener('click', async () => {
    const a = amountValid(); if (isNaN(a)) return;
    const total = buyerTotal();
    confirmTotalEl.textContent = cur(total);
    openSheet();
    payStatus.textContent = 'Loading secure fields...';
    confirmBtnState(false);
    try { await ensureSquareReady(Math.round(total*100)); payStatus.textContent=''; confirmBtnState(true); }
    catch(e){ payStatus.textContent = e.message || 'Failed to initialize payment.'; console.error(e); }
  });

  // close sheet
  backdrop.addEventListener('click', closeSheet);
  closeSheetBtn.addEventListener('click', closeSheet);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // card confirm
  confirmPayBtn.addEventListener('click', async () => {
    if (!confirmPayBtn || !window.Square) return;
    confirmBtnState(false);
    payStatus.textContent = 'Tokenizing card...';
    try {
      const tok = await (await window.Square.payments(cfg.appId, cfg.locationId).card()).tokenize();
      if (tok.status !== 'OK') throw new Error('Card details error. Please check and try again.');
      await postPaymentToken(tok.token);
      payStatus.textContent = 'Thank you! Payment approved.';
      setTimeout(()=>{ closeSheet(); payStatus.textContent=''; }, 900);
    } catch (err) { payStatus.textContent = err.message || 'Payment failed. Please try again.'; console.error(err); }
    finally { confirmBtnState(true); }
  });

  // keep totals in sync if user edits after opening
  ['input','change'].forEach(ev=>{
    amountInput.addEventListener(ev, ()=>{
      const t = buyerTotal();
      if (paymentRequest && Number.isFinite(t)) {
        paymentRequest.update({ total:{ amount:t.toFixed(2), label:'Donation' } });
        confirmTotalEl.textContent = cur(t);
      }
    });
    coverFees.addEventListener(ev, ()=>{
      const t = buyerTotal();
      if (paymentRequest && Number.isFinite(t)) {
        paymentRequest.update({ total:{ amount:t.toFixed(2), label:'Donation' } });
        confirmTotalEl.textContent = cur(t);
      }
    });
  });
})();

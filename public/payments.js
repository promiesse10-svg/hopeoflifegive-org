// public/payments.js (Stripe)
(function () {
  const d = document;

  // --- DOM refs ---
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
  const impactLine = d.getElementById('impactLine');

  // Dedication (optional fields; safe if they don’t exist)
  const dedicateToggle = d.getElementById('dedicateToggle');
  const dedicateWrap = d.getElementById('dedicateWrap');
  const dedicateName = d.getElementById('dedicateName');
  const dedicateNote = d.getElementById('dedicateNote');

  // Payment sheet
  const sheet = d.getElementById('paySheet');
  const backdrop = d.getElementById('sheetBackdrop');
  const closeSheetBtn = d.getElementById('closeSheet');
  const confirmPayBtn = d.getElementById('confirmPayBtn');
  const confirmTotalEl = d.getElementById('confirmTotal');
  const payStatus = d.getElementById('payStatus');
  const shareBtn = d.getElementById('shareBtn');

  // Stripe mounts
  const prButtonWrap = d.getElementById('payment-request-button'); // Payment Request Button (Apple/Google Pay)
  const walletDivider = d.getElementById('wallet-divider');
  const paymentElementMount = d.getElementById('payment-element');

  // --- Helpers ---
  const FUND_DESCRIPTIONS = {
    'tithe': 'Supports the ongoing ministry and operations.',
    'offering': 'Helps fund weekly services and community care.',
    'missions': 'Advances outreach and missionary support.',
    'building-fund': 'Invests in facilities, equipment, and upgrades.'
  };

  const IMPACT = {
    offering: { label: 'meals', unitCost: 5 },
    tithe:    { label: 'care packages', unitCost: 20 },
    missions: { label: 'outreach kits', unitCost: 15 },
    'building-fund': { label: 'brick units', unitCost: 50 }
  };

  const parseAmountRaw = (v) => (v ? parseFloat(String(v).replace(/[^0-9.]/g, '')) : NaN);
  const parseAmount = () => parseAmountRaw(amountInput?.value);
  const cur = (n) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const feeFor = (amt) => Math.max(0, amt * 0.029 + 0.30); // visual estimate

  function amountValid() {
    const a = parseAmount();
    const ok = Number.isFinite(a) && a >= 1;
    if (amountError) amountError.classList.toggle('hidden', ok);
    return ok ? a : NaN;
  }
  function buyerTotal() {
    const base = amountValid();
    if (isNaN(base)) return NaN;
    return coverFees?.checked ? base + feeFor(base) : base;
  }
  function updateFeePreview() {
    const a = amountValid();
    if (!feePreview) return;
    if (isNaN(a) || !coverFees?.checked) { feePreview.textContent = '(adds ~$0.00)'; return; }
    feePreview.textContent = `(adds ~${cur(feeFor(a))})`;
  }
  function updateFundDesc() { if (fundDesc) fundDesc.textContent = FUND_DESCRIPTIONS[fundSelect?.value] || ''; }
  function updateSummary() {
    if (!summary) return;
    const a = amountValid();
    const ftxt = fundSelect?.options[fundSelect.selectedIndex]?.text || 'Fund';
    if (isNaN(a)) { summary.textContent = ''; return; }
    const fee = coverFees?.checked ? feeFor(a) : 0;
    summary.textContent = `Giving ${cur(a)} to ${ftxt}${fee ? ` • Fees ~ ${cur(fee)}` : ''} • Total ${cur(a+fee)}`;
  }
  function updateImpact() {
    if (!impactLine) return;
    const amt = parseAmountRaw(amountInput?.value);
    const cfg = IMPACT[fundSelect?.value] || IMPACT.offering;
    if (!Number.isFinite(amt) || amt <= 0) { impactLine.textContent = ''; return; }
    const count = Math.max(1, Math.floor(amt / cfg.unitCost));
    impactLine.textContent = `Your gift can help fund ~${count} ${cfg.label}.`;
  }
  function updateGiveState(){ if (giveBtn) giveBtn.disabled = isNaN(amountValid()); }

  // Dedication toggle
  if (dedicateToggle && dedicateWrap) {
    dedicateToggle.addEventListener('change', ()=> {
      dedicateWrap.classList.toggle('hidden', !dedicateToggle.checked);
    });
  }

  // Chips
  function clearChips(){ chips.forEach(b=>b.classList.remove('chip--on')); }
  chips.forEach(btn => btn.addEventListener('click', () => {
    if (amountInput) amountInput.value = btn.dataset.amount;
    clearChips(); btn.classList.add('chip--on');
    updateGiveState(); updateFeePreview(); updateSummary(); updateImpact();
    amountInput?.focus({preventScroll:true});
  }));

  amountInput?.addEventListener('input', () => { clearChips(); updateGiveState(); updateFeePreview(); updateSummary(); updateImpact(); });
  coverFees?.addEventListener('change', () => { updateFeePreview(); updateSummary(); updateImpact(); });
  fundSelect?.addEventListener('change', () => { updateFundDesc(); updateSummary(); updateImpact(); });

  // Init UI
  updateFundDesc(); updateGiveState(); updateFeePreview(); updateSummary(); updateImpact();

  // Sheet helpers
  const lockScroll = on => { d.documentElement.classList.toggle('overflow-hidden', on); d.body.classList.toggle('overflow-hidden', on); };
  const openSheet = () => { sheet?.classList.remove('hidden'); lockScroll(true); };
  const closeSheet = () => { sheet?.classList.add('hidden'); lockScroll(false); };

  // Share
  function showShare() {
    if (!shareBtn) return;
    shareBtn.classList.remove('hidden');
    shareBtn.onclick = async () => {
      try {
        if (navigator.share) await navigator.share({
          title: 'Hope of Life — Give',
          text: 'Join me in supporting Hope of Life International Church.',
          url: location.origin
        });
      } catch {}
    };
  }

  // Confetti
  function celebrate() {
    const root = document.body;
    const N = 80;
    for (let i = 0; i < N; i++) {
      const s = document.createElement('i');
      s.style.position = 'fixed';
      s.style.left = Math.random() * 100 + 'vw';
      s.style.top = '-2vh';
      s.style.width = s.style.height = (6 + Math.random()*6) + 'px';
      s.style.background = ['#cc0000','#111','#666','#e5e7eb'][i % 4];
      s.style.opacity = '0.9';
      s.style.transform = `rotate(${Math.random()*360}deg)`;
      s.style.borderRadius = Math.random() < 0.5 ? '2px' : '50%';
      s.style.pointerEvents = 'none';
      s.style.zIndex = 9999;
      s.animate(
        [
          { transform: s.style.transform + ' translateY(0) rotate(0deg)', opacity: 0.9 },
          { transform: `translate(${(Math.random()*2-1)*40}vw, 100vh) rotate(${360+Math.random()*360}deg)`, opacity: 0.9 }
        ],
        { duration: 1800 + Math.random()*1000, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
      ).finished.then(() => s.remove());
      root.appendChild(s);
    }
  }

  // -------- Stripe integration --------
  const cfg = window.STRIPE_CONFIG || {};
  let stripe, elements, clientSecret, paymentRequest;
  let lastCents = null;
  let initializing = false;

  function confirmBtnState(on){ if (confirmPayBtn) confirmPayBtn.disabled = !on; }

  async function createOrUpdatePaymentIntent(cents) {
    // Create a fresh PaymentIntent for the current total
    const dedication =
      (dedicateToggle && dedicateToggle.checked)
        ? {
            name: (dedicateName?.value || '').trim(),
            note: (dedicateNote?.value || '').trim()
          }
        : null;

    const r = await fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: cents,
        fund: fundSelect?.value,
        name: nameInput?.value || null,
        email: emailInput?.value || null,
        dedication
      })
    });
    const data = await r.json();
    if (!r.ok || !data?.clientSecret) throw new Error(data?.error || 'Failed to create payment');
    return data.clientSecret;
  }

  async function initStripeFlow(cents) {
    if (!cfg.publishableKey) throw new Error('Missing STRIPE publishable key');
    if (!window.Stripe) throw new Error('Stripe.js not loaded');

    if (!stripe) stripe = window.Stripe(cfg.publishableKey);

    // If amount changed since last init, rebuild
    if (elements) {
      try { elements.destroy(); } catch {}
      elements = null;
    }
    paymentRequest = null;
    clientSecret = await createOrUpdatePaymentIntent(cents);
    lastCents = cents;

    const dark = document.documentElement.classList.contains('dark');
    elements = stripe.elements({
      clientSecret,
      appearance: {
        theme: dark ? 'night' : 'stripe',
        variables: {
          colorPrimary: '#cc0000',
          colorText: dark ? '#e5e7eb' : '#0a0a0a',
        }
      }
    });

    // Payment Element (cards, Link, bank, etc.)
    const paymentElement = elements.create('payment', { layout: 'accordion' });
    paymentElement.mount('#payment-element');

    // Payment Request Button (Apple Pay / Google Pay)
    paymentRequest = stripe.paymentRequest({
      country: 'US',
      currency: 'usd',
      total: { label: 'Donation', amount: cents },
      requestPayerName: true,
      requestPayerEmail: true
    });

    const can = await paymentRequest.canMakePayment();
    if (can) {
      const prButton = elements.create('paymentRequestButton', {
        paymentRequest,
        style: {
          paymentRequestButton: {
            theme: dark ? 'dark' : 'light',
            height: '44px'
          }
        }
      });
      prButton.mount('#payment-request-button');
      prButtonWrap?.classList.remove('hidden');
      walletDivider?.classList.remove('hidden');

      // Handle wallet flow
      paymentRequest.on('paymentmethod', async (ev) => {
        // Try confirming without redirect first
        const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: ev.paymentMethod.id
        }, { handleActions: false });

        if (confirmError) {
          ev.complete('fail');
          payStatus.textContent = confirmError.message || 'Payment failed.';
          return;
        }
        ev.complete('success');

        // If actions needed (3DS)
        const { error: actionError } = await stripe.confirmCardPayment(clientSecret);
        if (actionError) {
          payStatus.textContent = actionError.message || 'Payment authorization failed.';
        } else {
          celebrate(); showShare();
          payStatus.textContent = 'Thank you! Payment approved.';
          setTimeout(()=>{ closeSheet(); payStatus.textContent=''; }, 900);
        }
      });
    } else {
      prButtonWrap?.classList.add('hidden');
    }
  }

  // Open sheet → init Stripe
  giveBtn?.addEventListener('click', async () => {
    const a = amountValid(); if (isNaN(a)) return;
    const total = buyerTotal();
    const cents = Math.round(total * 100);

    if (confirmTotalEl) confirmTotalEl.textContent = cur(total);
    openSheet();
    if (payStatus) payStatus.textContent = 'Loading secure fields...';
    confirmBtnState(false);

    try {
      initializing = true;
      await initStripeFlow(cents);
      if (payStatus) payStatus.textContent = '';
      confirmBtnState(true);
    } catch (e) {
      if (payStatus) payStatus.textContent = e.message || 'Failed to initialize payment.';
      console.error(e);
    } finally {
      initializing = false;
    }
  });

  // Close sheet
  backdrop?.addEventListener('click', closeSheet);
  closeSheetBtn?.addEventListener('click', closeSheet);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  // Confirm via Payment Element
  confirmPayBtn?.addEventListener('click', async () => {
    if (!stripe || !elements || !clientSecret) return;
    confirmBtnState(false);
    if (payStatus) payStatus.textContent = 'Processing...';
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        clientSecret,
        redirect: 'if_required'
      });
      if (error) throw error;
      celebrate(); showShare();
      if (payStatus) payStatus.textContent = 'Thank you! Payment approved.';
      setTimeout(()=>{ closeSheet(); if (payStatus) payStatus.textContent=''; }, 900);
    } catch (err) {
      if (payStatus) payStatus.textContent = err.message || 'Payment failed. Please try again.';
      console.error(err);
    } finally {
      confirmBtnState(true);
    }
  });

  // If user edits amount after open, re-create PI so totals match
  function maybeReinit() {
    if (!sheet || sheet.classList.contains('hidden')) return; // only if sheet is open
    const total = buyerTotal();
    if (!Number.isFinite(total)) return;
    const cents = Math.round(total * 100);
    if (cents !== lastCents && !initializing) {
      if (confirmTotalEl) confirmTotalEl.textContent = cur(total);
      // Update PR total quickly if it exists
      if (paymentRequest) {
        try { paymentRequest.update({ total: { label: 'Donation', amount: cents } }); } catch {}
      }
      // Re-init Elements with a fresh PaymentIntent
      initializing = true;
      payStatus && (payStatus.textContent = 'Updating total...');
      initStripeFlow(cents)
        .then(()=> payStatus && (payStatus.textContent = ''))
        .catch(e => { payStatus && (payStatus.textContent = e.message || 'Failed to update payment.'); console.error(e); })
        .finally(()=> initializing = false);
    }
  }

  ['input','change'].forEach(ev=>{
    amountInput?.addEventListener(ev, maybeReinit);
    coverFees?.addEventListener(ev, maybeReinit);
  });
})();

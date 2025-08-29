const stripe = Stripe(stripeConfig.publishableKey);
let elements, paymentRequest, paymentRequestButton;

const form = document.getElementById('donationForm');
const amountInput = document.getElementById('amount');
const chips = document.querySelectorAll('.chip');
const coverFeesCheckbox = document.getElementById('coverFees');
const feePreview = document.getElementById('feePreview');
const giveBtn = document.getElementById('giveBtn');
const paySheet = document.getElementById('paySheet');
const closeSheet = document.getElementById('closeSheet');
const confirmPayBtn = document.getElementById('confirmPayBtn');
const confirmTotal = document.getElementById('confirmTotal');
const payStatus = document.getElementById('payStatus');
const shareBtn = document.getElementById('shareBtn');
const walletDivider = document.getElementById('wallet-divider');
const paymentRequestButtonElement = document.getElementById('payment-request-button');
const fundSelect = document.getElementById('fund');
const fundDesc = document.getElementById('fundDesc');
const summary = document.getElementById('summary');
const amountError = document.getElementById('amountError');

let selectedAmount = 0;
let clientSecret = null;

// Fund descriptions
const fundDescriptions = {
  tithe: 'Your tithe supports the general operations of the church.',
  offering: 'Offerings go towards special projects and community outreach.',
  missions: 'Support global missions and outreach programs.',
  'building-fund': 'Contribute to the church’s building and maintenance fund.'
};

// Calculate processing fees (Stripe: 2.9% + $0.30)
function calculateFees(amount) {
  const fee = (amount * 0.029) + 0.30;
  return Math.ceil(fee * 100) / 100;
}

function updateSummary() {
  const amount = parseFloat(amountInput.value) || selectedAmount;
  if (amount < 1) {
    giveBtn.disabled = true;
    amountError.classList.remove('hidden');
    return;
  }
  amountError.classList.add('hidden');
  giveBtn.disabled = false;

  const coverFees = coverFeesCheckbox.checked;
  const fees = coverFees ? calculateFees(amount) : 0;
  const total = amount + fees;

  feePreview.textContent = coverFees ? `(adds ~$${fees.toFixed(2)})` : '(adds ~$0.00)';
  summary.textContent = `You are giving $${amount.toFixed(2)} to the ${fundSelect.options[fundSelect.selectedIndex].text}${coverFees ? ` plus $${fees.toFixed(2)} to cover fees` : ''}.`;
  confirmTotal.textContent = `$${total.toFixed(2)}`;
}

// Initialize Stripe Elements
async function initializePaymentElements(amount) {
  const response = await fetch(stripeConfig.clientSecretEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: Math.round((parseFloat(amountInput.value) || selectedAmount) * 100),
      coverFees: coverFeesCheckbox.checked
    })
  });
  const { clientSecret: secret } = await response.json();
  clientSecret = secret;

  const appearance = { theme: 'stripe' };
  elements = stripe.elements({ clientSecret, appearance });

  const paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');

  paymentRequest = stripe.paymentRequest({
    country: 'US',
    currency: 'usd',
    total: {
      label: 'Donation',
      amount: Math.round((parseFloat(amountInput.value) || selectedAmount) * 100)
    },
    requestPayerName: true,
    requestPayerEmail: true
  });

  paymentRequestButton = elements.create('paymentRequestButton', {
    paymentRequest
  });

  const canMakePayment = await paymentRequest.canMakePayment();
  if (canMakePayment) {
    paymentRequestButton.mount('#payment-request-button');
    paymentRequestButtonElement.classList.remove('hidden');
    walletDivider.classList.remove('hidden');
  }
}

// Event Listeners
chips.forEach(chip => {
  chip.addEventListener('click', () => {
    chips.forEach(c => c.classList.remove('chip--on'));
    chip.classList.add('chip--on');
    selectedAmount = parseInt(chip.dataset.amount);
    amountInput.value = selectedAmount.toFixed(2);
    updateSummary();
  });
});

amountInput.addEventListener('input', () => {
  chips.forEach(c => c.classList.remove('chip--on'));
  selectedAmount = 0;
  updateSummary();
});

coverFeesCheckbox.addEventListener('change', updateSummary);

fundSelect.addEventListener('change', () => {
  fundDesc.textContent = fundDescriptions[fundSelect.value] || '';
  updateSummary();
});

giveBtn.addEventListener('click', async () => {
  const amount = parseFloat(amountInput.value) || selectedAmount;
  if (amount < 1) {
    amountError.classList.remove('hidden');
    return;
  }
  paySheet.classList.remove('hidden');
  await initializePaymentElements(amount);
});

closeSheet.addEventListener('click', () => {
  paySheet.classList.add('hidden');
  elements.getElement('payment').unmount();
  if (paymentRequestButton) {
    paymentRequestButton.unmount();
  }
});

confirmPayBtn.addEventListener('click', async () => {
  confirmPayBtn.disabled = true;
  payStatus.textContent = 'Processing...';
  const { error } = await stripe.confirmPayment({
    elements,
    confirmParams: {
      return_url: window.location.href,
      payment_method_data: {
        billing_details: {
          name: document.getElementById('name').value || undefined,
          email: document.getElementById('email').value || undefined
        }
      }
    }
  });

  if (error) {
    payStatus.textContent = error.message;
    confirmPayBtn.disabled = false;
  } else {
    payStatus.textContent = 'Payment successful!';
    shareBtn.classList.remove('hidden');
  }
});

shareBtn.addEventListener('click', () => {
  if (navigator.share) {
    navigator.share({
      title: 'Hope of Life International Church',
      text: 'Support our mission by donating!',
      url: window.location.href
    });
  }
});

// Initialize fund description
fundDesc.textContent = fundDescriptions[fundSelect.value] || '';
updateSummary();
// public/script.js

const form = document.getElementById('payment-form');
const submitBtn = document.getElementById('submit-btn');
const statusMessage = document.getElementById('status-message');

// How often to poll for payment status (milliseconds)
const POLL_INTERVAL = 4000;
// Max number of polling attempts before giving up
const MAX_POLLS = 15;

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? 'Processing…' : 'Pay Now';
}

async function pollPaymentStatus(transactionId, attempts = 0) {
  if (attempts >= MAX_POLLS) {
    showStatus(
      'Payment is taking longer than expected. Please check back later or contact support.',
      'error'
    );
    setLoading(false);
    return;
  }

  try {
    const response = await fetch(`/api/check-status?transactionId=${transactionId}`);
    const data = await response.json();

    switch (data.status) {
      case 'successful':
      case 'SUCCESSFUL':
        showStatus('✅ Payment successful! Thank you.', 'success');
        setLoading(false);
        break;

      case 'failed':
      case 'FAILED':
        showStatus('❌ Payment failed. Please try again.', 'error');
        setLoading(false);
        break;

      case 'pending':
      case 'PENDING':
      default:
        showStatus(
          `⏳ Waiting for payment confirmation… (check ${attempts + 1}/${MAX_POLLS})`,
          'pending'
        );
        setTimeout(() => pollPaymentStatus(transactionId, attempts + 1), POLL_INTERVAL);
        break;
    }
  } catch (error) {
    console.error('Polling error:', error);
    showStatus('Network error while checking status. Retrying…', 'pending');
    setTimeout(() => pollPaymentStatus(transactionId, attempts + 1), POLL_INTERVAL);
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const phone_number = document.getElementById('phone_number').value.trim();
  const amount = document.getElementById('amount').value.trim();

  if (!phone_number || !amount) {
    showStatus('Please fill in all fields.', 'error');
    return;
  }

  setLoading(true);
  showStatus('Initiating payment, please wait…', 'info');

  try {
    const response = await fetch('/api/initiate-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number, amount })
    });

    const data = await response.json();

    if (data.success && data.transactionId) {
      showStatus(
        '📱 Payment request sent! Please approve the prompt on your phone.',
        'info'
      );
      pollPaymentStatus(data.transactionId);
    } else {
      showStatus(data.message || 'Payment initiation failed. Please try again.', 'error');
      setLoading(false);
    }
  } catch (error) {
    console.error('Submission error:', error);
    showStatus('Could not reach the server. Please check your connection and try again.', 'error');
    setLoading(false);
  }
});

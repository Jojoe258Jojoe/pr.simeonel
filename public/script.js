// public/script.js
const form = document.getElementById('payment-form');
const payButton = document.getElementById('pay-btn');
const messageDiv = document.getElementById('message');

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    payButton.disabled = true;
    payButton.innerText = 'Processing...';
    messageDiv.innerHTML = '<p>Sending payment request...</p>';
    
    const paymentDetails = {
        amount: document.getElementById('amount').value,
        phone_number: document.getElementById('phone').value,
        network: document.getElementById('network').value
    };
    
    try {
        const response = await fetch('/.netlify/functions/initiate-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentDetails),
        });
        
        const result = await response.json();
        
        if (result.success) {
            messageDiv.innerHTML = '<p>✅ Payment prompt sent! Please check your phone and enter your PIN.</p>';
            checkPaymentStatus(result.transactionId);
        } else {
            messageDiv.innerHTML = `<p>❌ Error: ${result.message}</p>`;
            payButton.disabled = false;
            payButton.innerText = 'Pay Now';
        }
    } catch (error) {
        console.error('Error:', error);
        messageDiv.innerHTML = '<p>❌ An unexpected error occurred. Please try again.</p>';
        payButton.disabled = false;
        payButton.innerText = 'Pay Now';
    }
});

async function checkPaymentStatus(transactionId) {
    const interval = setInterval(async () => {
        const statusResponse = await fetch(`/.netlify/functions/check-status?transactionId=${transactionId}`);
        const statusResult = await statusResponse.json();
        
        if (statusResult.status === 'successful') {
            clearInterval(interval);
            messageDiv.innerHTML = '<p>🎉 Payment successful! Thank you for your purchase.</p>';
            payButton.disabled = false;
            payButton.innerText = 'Pay Now';
            // window.location.href = '/thank-you';
        } else if (statusResult.status === 'failed') {
            clearInterval(interval);
            messageDiv.innerHTML = '<p>❌ Payment failed. Please try again.</p>';
            payButton.disabled = false;
            payButton.innerText = 'Pay Now';
        }
    }, 3000);
}
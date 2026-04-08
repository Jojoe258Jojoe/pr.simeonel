// netlify/edge-functions/check-status.js

export default async (request) => {
  // Only allow GET requests
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, message: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get the transactionId from the URL's query parameters
    const url = new URL(request.url);
    const transactionId = url.searchParams.get('transactionId');

    if (!transactionId) {
      return new Response(JSON.stringify({ success: false, message: 'Missing transaction ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Access your secret environment variable
    const authId = Netlify.env.get('MONEY_UNIFY_AUTH_ID');

    const requestBody = new URLSearchParams({
      transaction_id: transactionId,
      auth_id: authId
    });

    const verifyResponse = await fetch('https://api.moneyunify.one/payments/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: requestBody
    });

    const verificationData = await verifyResponse.json();

    if (verificationData && !verificationData.isError) {
      return new Response(JSON.stringify({
        status: verificationData.data.status,
        message: verificationData.message
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({
        status: 'error',
        message: verificationData.message || 'Could not verify payment'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return new Response(JSON.stringify({
      status: 'error',
      message: 'An error occurred while verifying payment.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Define the path where this function will be invoked
export const config = { path: "/api/check-status" };

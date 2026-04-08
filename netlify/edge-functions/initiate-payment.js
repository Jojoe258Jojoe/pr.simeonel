// netlify/edge-functions/initiate-payment.js

export default async (request) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse the incoming request body
    const { amount, phone_number, network } = await request.json();

    // Validate required fields
    if (!amount || !phone_number) {
      return new Response(JSON.stringify({ success: false, message: 'Missing amount or phone number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Access your secret environment variable
    const authId = Netlify.env.get('MONEY_UNIFY_AUTH_ID');

    // Prepare the request to MoneyUnify
    // Note: Add 'provider' if the API requires the network (MTN/Airtel)
    const requestBody = new URLSearchParams({
      from_payer: phone_number,
      amount: amount,
      auth_id: authId,
      // Uncomment if the API needs the network parameter:
      // provider: network || 'mtn'
    });

    const moneyUnifyResponse = await fetch('https://api.moneyunify.one/payments/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: requestBody
    });

    // --- START: Detailed error handling ---
    // If the response is not OK (e.g., 400, 500), capture the error details
    if (!moneyUnifyResponse.ok) {
      let errorDetails;
      const responseText = await moneyUnifyResponse.text();
      try {
        // Try to parse as JSON
        errorDetails = JSON.parse(responseText);
      } catch (e) {
        // If not JSON, use the raw text
        errorDetails = responseText;
      }

      console.error('MoneyUnify API Error:', {
        status: moneyUnifyResponse.status,
        statusText: moneyUnifyResponse.statusText,
        details: errorDetails
      });

      // Return a detailed error to the frontend
      return new Response(JSON.stringify({
        success: false,
        message: `MoneyUnify error: ${moneyUnifyResponse.status} - ${moneyUnifyResponse.statusText}`,
        details: errorDetails
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // --- END: Detailed error handling ---

    // If response is OK, parse JSON as usual
    const data = await moneyUnifyResponse.json();

    if (data && !data.isError) {
      return new Response(JSON.stringify({
        success: true,
        transactionId: data.data.transaction_id,
        message: data.message
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // API returned an isError flag
      return new Response(JSON.stringify({
        success: false,
        message: data.message || 'Payment initiation failed',
        details: data
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Payment initiation error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'An error occurred on our server. Please try again later.',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Define the path where this function will be invoked
export const config = { path: "/api/initiate-payment" };

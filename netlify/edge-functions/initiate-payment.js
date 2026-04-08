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

    // --- Phone Number Formatting ---
    // Remove any non-digit characters (spaces, +, dashes, etc.)
    let cleanedNumber = phone_number.replace(/\D/g, '');

    // Check if it's a 12-digit international number starting with 260 (Zambia)
    if (cleanedNumber.length === 12 && cleanedNumber.startsWith('260')) {
      // Convert '26097xxxxxxx' to '097xxxxxxx'
      cleanedNumber = `0${cleanedNumber.slice(3)}`;
    }
    // Check if it's a 9-digit number (missing leading zero)
    else if (cleanedNumber.length === 9) {
      cleanedNumber = `0${cleanedNumber}`;
    }
    
    // Final validation: must be 10 digits starting with 0
    if (!cleanedNumber.match(/^0\d{9}$/)) {
      console.error(`Invalid phone number format: ${phone_number} -> ${cleanedNumber}`);
      return new Response(JSON.stringify({
        success: false,
        message: `Invalid phone number format. Please use a 10-digit number starting with 0 (e.g., 097xxxxxxx).`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Access your secret environment variable
    const authId = Netlify.env.get('MONEY_UNIFY_AUTH_ID');
    if (!authId) {
      console.error('MONEY_UNIFY_AUTH_ID environment variable is not set');
      return new Response(JSON.stringify({
        success: false,
        message: 'Payment service configuration error. Please contact support.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Prepare the request to MoneyUnify
    const requestBody = new URLSearchParams({
      from_payer: cleanedNumber,
      amount: amount.toString(),
      auth_id: authId,
      provider: network || 'mtn' // Default to MTN if not provided
    });

    // Log the request (auth_id is partially masked for security)
    const maskedAuthId = authId.slice(0, 8) + '...' + authId.slice(-4);
    console.log(`MoneyUnify Request: from_payer=${cleanedNumber}, amount=${amount}, provider=${network || 'mtn'}, auth_id=${maskedAuthId}`);

    const moneyUnifyResponse = await fetch('https://api.moneyunify.one/payments/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: requestBody
    });

    // Handle non-OK responses (400, 500, etc.)
    if (!moneyUnifyResponse.ok) {
      let errorDetails;
      const responseText = await moneyUnifyResponse.text();
      try {
        errorDetails = JSON.parse(responseText);
      } catch (e) {
        errorDetails = responseText;
      }

      console.error('MoneyUnify API Error:', {
        status: moneyUnifyResponse.status,
        statusText: moneyUnifyResponse.statusText,
        details: errorDetails
      });

      return new Response(JSON.stringify({
        success: false,
        message: errorDetails?.message || `MoneyUnify error: ${moneyUnifyResponse.status}`,
        details: errorDetails
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse successful response
    const data = await moneyUnifyResponse.json();

    if (data && !data.isError) {
      console.log(`Payment initiated successfully. Transaction ID: ${data.data?.transaction_id}`);
      return new Response(JSON.stringify({
        success: true,
        transactionId: data.data?.transaction_id,
        message: data.message || 'Payment prompt sent to your phone.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // API returned an isError flag
      console.error('MoneyUnify returned error:', data);
      return new Response(JSON.stringify({
        success: false,
        message: data?.message || 'Payment initiation failed',
        details: data
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Payment initiation exception:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Define the path where this function will be invoked
export const config = { path: "/api/initiate-payment" };

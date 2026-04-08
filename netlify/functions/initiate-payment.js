// netlify/edge-functions/initiate-payment.js

export default async (request, context) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { amount, phone_number } = await request.json();
    
    if (!amount || !phone_number) {
      return new Response(JSON.stringify({ success: false, message: 'Missing amount or phone number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const authId = Netlify.env.get('MONEY_UNIFY_AUTH_ID');

    const requestBody = new URLSearchParams({
      from_payer: phone_number,
      amount: amount,
      auth_id: authId
    });

    const moneyUnifyResponse = await fetch('https://api.moneyunify.one/payments/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: requestBody
    });

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
      return new Response(JSON.stringify({ 
        success: false, 
        message: data.message || 'Payment initiation failed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Payment initiation error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'An error occurred on our server. Please try again later.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

//  Changed path to match what your frontend calls
export const config = { path: "/.netlify/functions/initiate-payment" };

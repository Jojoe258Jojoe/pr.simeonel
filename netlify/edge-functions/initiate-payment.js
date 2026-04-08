// netlify/edge-functions/initiate-payment.js

export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { amount, phone_number, network } = await request.json();

    if (!amount || !phone_number) {
      return new Response(JSON.stringify({ success: false, message: 'Missing amount or phone number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- 1. Phone Number Formatting (Force International) ---
    let cleanedNumber = phone_number.replace(/\D/g, '');
    let internationalNumber = cleanedNumber;
    if (cleanedNumber.length === 10 && cleanedNumber.startsWith('0')) {
      internationalNumber = `260${cleanedNumber.slice(1)}`;
    } else if (cleanedNumber.length === 12 && cleanedNumber.startsWith('260')) {
      internationalNumber = cleanedNumber;
    }
    console.log(`Phone formatting: original=${phone_number}, final=${internationalNumber}`);

    // --- 2. Amount Formatting (Force Decimal String) ---
    // Convert integer "5800" to decimal string "58.00"
    let formattedAmount = amount.toString();
    if (!formattedAmount.includes('.')) {
      formattedAmount = (parseFloat(formattedAmount) / 100).toFixed(2);
    }
    console.log(`Amount formatting: original=${amount}, final=${formattedAmount}`);

    const authId = Netlify.env.get('MONEY_UNIFY_AUTH_ID');
    if (!authId) {
      console.error('MONEY_UNIFY_AUTH_ID environment variable is not set');
      return new Response(JSON.stringify({
        success: false,
        message: 'Payment service configuration error.'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // --- 3. Prepare Request Body (Try without 'provider') ---
    // The API might auto-detect the network from the phone number.
    const requestBody = new URLSearchParams({
      from_payer: internationalNumber,
      amount: formattedAmount,
      auth_id: authId,
      // provider: network || 'mtn'  // <-- COMMENTED OUT for testing
    });

    // Log the exact request (masking the auth_id)
    const maskedAuthId = authId.slice(0, 8) + '...' + authId.slice(-4);
    console.log(`MoneyUnify Request Body: ${requestBody.toString().replace(authId, maskedAuthId)}`);

    // --- 4. Make the Request with Enhanced Logging ---
    const moneyUnifyResponse = await fetch('https://api.moneyunify.one/payments/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: requestBody
    });

    // Log the full response status and text
    console.log(`MoneyUnify Response Status: ${moneyUnifyResponse.status}`);
    const responseText = await moneyUnifyResponse.text();
    console.log(`MoneyUnify Raw Response: ${responseText}`);

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      data = { message: responseText };
    }

    if (moneyUnifyResponse.ok && data && !data.isError) {
      return new Response(JSON.stringify({
        success: true,
        transactionId: data.data?.transaction_id,
        message: data.message || 'Payment prompt sent.'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      console.error('MoneyUnify API Error:', data);
      return new Response(JSON.stringify({
        success: false,
        message: data?.message || 'Payment initiation failed',
        details: data
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Exception:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Server error. Please try again.'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: "/api/initiate-payment" };

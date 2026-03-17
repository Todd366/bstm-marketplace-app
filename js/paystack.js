// BSTM Marketplace - Paystack Payment Integration

const PAYSTACK_PUBLIC_KEY = 'pk_test_YOUR_KEY_HERE'; // Replace with your key

// Initialize Paystack Payment
function initiatePayment(amount, email, metadata = {}) {
  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: email,
    amount: amount * 100, // Convert to kobo
    currency: 'BWP', // Botswana Pula
    ref: generateReference(),
    metadata: {
      custom_fields: [
        {
          display_name: "Product",
          variable_name: "product",
          value: metadata.product || 'BSTM Product'
        },
        {
          display_name: "Room",
          variable_name: "room",
          value: metadata.room || 'Room 18'
        }
      ]
    },
    callback: function(response) {
      handlePaymentSuccess(response);
    },
    onClose: function() {
      handlePaymentCancelled();
    }
  });
  
  handler.openIframe();
}

// Generate unique reference
function generateReference() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `BSTM-${timestamp}-${random}`;
}

// Handle successful payment
async function handlePaymentSuccess(response) {
  console.log('✅ Payment successful:', response);
  
  // Show success message
  showToast('Payment successful! Order confirmed.', 'success');
  
  // Clear cart
  AppState.cart = [];
  saveCart();
  
  // TODO: Save order to Supabase
  // await createOrder({
  //   payment_reference: response.reference,
  //   amount: response.amount / 100,
  //   status: 'paid'
  // });
  
  // Redirect to success page
  setTimeout(() => {
    window.location.href = '/order-success.html?ref=' + response.reference;
  }, 2000);
}

// Handle payment cancellation
function handlePaymentCancelled() {
  console.log('❌ Payment cancelled');
  showToast('Payment cancelled', 'error');
}

// Checkout Cart
function checkoutCart() {
  if (AppState.cart.length === 0) {
    showToast('Cart is empty!', 'error');
    return;
  }
  
  // Calculate total
  const total = AppState.cart.reduce((sum, item) => sum + item.price, 0);
  
  // Get user email (TODO: from auth)
  const email = prompt('Enter your email:');
  if (!email) return;
  
  // Initiate payment
  initiatePayment(total, email, {
    product: `${AppState.cart.length} items`,
    room: 'Room 18'
  });
}

// Verify Payment (Backend should do this)
async function verifyPayment(reference) {
  try {
    // TODO: Call backend to verify with Paystack secret key
    console.log('Verifying payment:', reference);
    return { success: true };
  } catch (error) {
    console.error('Verification error:', error);
    return { success: false };
  }
}

// Export
window.PaystackPayment = {
  initiatePayment,
  checkoutCart,
  verifyPayment
};

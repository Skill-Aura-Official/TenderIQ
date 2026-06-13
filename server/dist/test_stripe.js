import app from './app.js';
async function testWebhooks() {
    await app.ready();
    console.log('[TestStripe] App ready. Injecting mock checkout event...');
    const mockCheckoutBody = {
        type: 'checkout.session.completed',
        data: {
            object: {
                client_reference_id: 'mock_clerk_user_id',
                customer_details: { email: 'test_pro@example.com' },
                customer: 'cust_mock_123',
                subscription: 'sub_mock_123'
            }
        }
    };
    const checkoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/stripe',
        payload: mockCheckoutBody
    });
    console.log('[TestStripe] Checkout Response status:', checkoutRes.statusCode);
    console.log('[TestStripe] Checkout Response body:', checkoutRes.body);
    console.log('[TestStripe] Injecting mock subscription deleted event...');
    const mockDeleteBody = {
        type: 'customer.subscription.deleted',
        data: {
            object: {
                customer: 'cust_mock_123'
            }
        }
    };
    const deleteRes = await app.inject({
        method: 'POST',
        url: '/api/v1/webhooks/stripe',
        payload: mockDeleteBody
    });
    console.log('[TestStripe] Delete Response status:', deleteRes.statusCode);
    console.log('[TestStripe] Delete Response body:', deleteRes.body);
    await app.close();
    process.exit(0);
}
testWebhooks().catch(err => {
    console.error('[TestStripe ERROR]', err);
    process.exit(1);
});

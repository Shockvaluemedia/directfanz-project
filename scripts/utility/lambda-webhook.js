exports.handler = async (event) => {
    console.log('Webhook received:', JSON.stringify(event, null, 2));
    
    // Process Stripe webhook
    const body = JSON.parse(event.body);
    const eventType = body.type;
    
    switch (eventType) {
        case 'payment_intent.succeeded':
            // Handle successful payment
            console.log('Payment succeeded:', body.data.object.id);
            break;
        case 'customer.subscription.created':
            // Handle new subscription
            console.log('Subscription created:', body.data.object.id);
            break;
        default:
            console.log('Unhandled event type:', eventType);
    }
    
    return {
        statusCode: 200,
        body: JSON.stringify({ received: true })
    };
};
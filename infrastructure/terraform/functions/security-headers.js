function handler(event) {
    var response = event.response;
    var headers = response.headers;

    // Add security headers
    headers['strict-transport-security'] = { value: 'max-age=63072000; includeSubdomains; preload' };
    headers['content-type-options'] = { value: 'nosniff' };
    headers['x-frame-options'] = { value: 'DENY' };
    headers['x-xss-protection'] = { value: '1; mode=block' };
    headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };
    headers['permissions-policy'] = { 
        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' 
    };

    // Add Content Security Policy for DirectFanz
    headers['content-security-policy'] = {
        value: "default-src 'self'; " +
               "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com; " +
               "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
               "font-src 'self' https://fonts.gstatic.com; " +
               "img-src 'self' data: https: blob:; " +
               "media-src 'self' https: blob:; " +
               "connect-src 'self' https: wss: ws:; " +
               "frame-src 'self' https://js.stripe.com https://checkout.stripe.com; " +
               "object-src 'none'; " +
               "base-uri 'self'; " +
               "form-action 'self';"
    };

    // Add CORS headers for API endpoints
    if (event.request.uri.startsWith('/api/')) {
        headers['access-control-allow-origin'] = { value: '*' };
        headers['access-control-allow-methods'] = { value: 'GET, POST, PUT, DELETE, OPTIONS' };
        headers['access-control-allow-headers'] = { 
            value: 'Content-Type, Authorization, X-Requested-With' 
        };
        headers['access-control-max-age'] = { value: '86400' };
    }

    // Add cache control headers based on content type
    var uri = event.request.uri;
    
    if (uri.match(/\.(css|js|woff|woff2|ttf|eot)$/)) {
        // Static assets - long cache
        headers['cache-control'] = { value: 'public, max-age=31536000, immutable' };
    } else if (uri.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
        // Images - medium cache
        headers['cache-control'] = { value: 'public, max-age=604800' };
    } else if (uri.match(/\.(mp4|webm|ogg|mp3|wav)$/)) {
        // Media files - short cache for premium content
        headers['cache-control'] = { value: 'private, max-age=3600' };
    } else if (uri.startsWith('/api/')) {
        // API responses - no cache
        headers['cache-control'] = { value: 'no-cache, no-store, must-revalidate' };
        headers['pragma'] = { value: 'no-cache' };
        headers['expires'] = { value: '0' };
    }

    return response;
}
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

import { NextResponse } from 'next/server';

// Define routes that do NOT require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const hostname = request.headers.get('host') || '';
  const primaryDomains = ['localhost:3000', 'app.tenderiq.in', 'tenderiq.in'];
  const isCustomDomain = !primaryDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain));

  if (isCustomDomain) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-partner-domain', hostname);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

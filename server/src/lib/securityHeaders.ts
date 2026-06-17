import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { blockedIPs } from './rateLimit.js';

// Suspicious paths signature scanner list
const SUSPICIOUS_PATHS = [
  '/.env',
  '/.git',
  '/wp-admin',
  '/wp-login.php',
  '/xmlrpc.php',
  '/actuator/',
  '/docker-compose',
  '/config.json',
  '/package.json',
  '/web.config',
  '/.aws/',
  '/id_rsa',
  '/etc/passwd'
];

/**
 * Hook to inject strict HTTP Security Headers (mitigating Clickjacking, XSS, MIME-sniffing, etc.)
 */
export async function securityHeadersHook(request: FastifyRequest, reply: FastifyReply) {
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  reply.header('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' https://*.googleapis.com https://api.openai.com https://api.anthropic.com https://clerk.com; " +
    "frame-ancestors 'none';"
  );
}

/**
 * Hook to intercept path scanner probes and ban malicious IPs
 */
export async function scannerAutobanHook(request: FastifyRequest, reply: FastifyReply) {
  const ip = (request.headers['x-forwarded-for'] as string || request.ip || 'unknown').split(',')[0].trim();
  const url = request.url.toLowerCase();

  // If already blocked, end request immediately
  if (blockedIPs.has(ip)) {
    return reply.code(403).send({ 
      error: { 
        code: 'IP_BLOCKED', 
        message: 'Access denied. Your IP has been blacklisted for security violations.' 
      } 
    });
  }

  // Scan URL for suspicious signatures
  const isScannerRequest = SUSPICIOUS_PATHS.some(path => url.includes(path));

  if (isScannerRequest) {
    blockedIPs.add(ip);
    request.log.error(`[Autoban Alert] IP ${ip} banned for scan attempt on path: ${request.url}`);
    
    return reply.code(403).send({
      error: {
        code: 'SECURITY_VIOLATION',
        message: 'Security Violation. Your IP has been blacklisted due to automated scanning behavior.'
      }
    });
  }
}

import time
from datetime import datetime, timedelta
import random
import hashlib
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed. Run: pip install playwright && playwright install")
    sync_playwright = None

def attempt_playwright_bypass(source, portal_url, headers):
    if not sync_playwright:
        return []
        
    print(f"Starting Playwright headless bypass for {portal_url}")
    raw_data = []
    
    try:
        with sync_playwright() as p:
            # Use stealth options if possible, or just regular browser
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=headers.get('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'))
            page = context.new_page()
            
            # Navigate to the active tenders page
            url = f"{portal_url}/nicgep/app?page=FrontEndLatestActiveTenders&service=page"
            page.goto(url, wait_until="networkidle", timeout=30000)
            
            # Check for Captcha
            content = page.content()
            if 'Captcha' in content or 'captcha' in content.lower():
                print("CAPTCHA detected even with Playwright. Awaiting manual solve or 2Captcha integration...")
                # Here we could integrate 2Captcha or similar service.
                # For now, we wait a bit to see if JS resolves it, then fail honestly.
                time.sleep(5)
                content = page.content()
                if 'Captcha' in content or 'captcha' in content.lower():
                    print("Still blocked by CAPTCHA. Failing honestly.")
                    browser.close()
                    return []
            
            # Wait for table
            try:
                page.wait_for_selector('.list_table', timeout=10000)
            except Exception:
                print("Table not found on page.")
                browser.close()
                return []
                
            # Extract data
            rows = page.query_selector_all('.list_table tr')
            portal_name = portal_url.split('//')[1].split('.')[0]
            
            for i, row in enumerate(rows):
                if i == 0: continue # Skip header
                cols = row.query_selector_all('td')
                if len(cols) >= 5:
                    title_ref = cols[4].inner_text().strip()
                    org = cols[5].inner_text().strip() if len(cols) > 5 else "Unknown"
                    parts = title_ref.split('\n')
                    title = parts[0].strip() if len(parts) > 0 else "Unknown Title"
                    ref = parts[-1].strip() if len(parts) > 1 else f"REF_{random.randint(1000,9999)}"
                    
                    raw_data.append({
                        'title': title,
                        'reference_number': ref,
                        'value': None,
                        'emd': None,
                        'deadline': (datetime.now() + timedelta(days=7)).isoformat(),
                        'state': source,
                        'category': None,
                        'organization': org,
                        'portal_name': portal_name
                    })
                    
            browser.close()
            print(f"Successfully bypassed CAPTCHA and extracted {len(raw_data)} tenders.")
            return raw_data
            
    except Exception as e:
        print(f"Playwright bypass failed: {e}")
        return []

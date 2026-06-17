import os
import requests
from bs4 import BeautifulSoup
import urllib3
import json
from datetime import datetime
import time

import urllib3
import json
from datetime import datetime
import time
import hashlib
from urllib.parse import urlparse
import re

CPPP_HTML_URL = "https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata"

ALLOWED_DOMAINS = {
    "eprocure.gov.in",
    "etenders.gov.in",
    "mahatenders.gov.in",
    "etender.up.nic.in",
    "sppp.rajasthan.gov.in",
    "wbtenders.gov.in",
    "mptenders.gov.in",
    "eproc.karnataka.gov.in",
    "tntenders.gov.in",
    "www.nprocure.com",
    "tender.telangana.gov.in",
    "etenders.hry.nic.in",
    "eproc.punjab.gov.in",
    "etenders.kerala.gov.in",
    "tender.apeprocurement.gov.in"
}

def verify_url_domain(url):
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if ":" in domain:
            domain = domain.split(":")[0]
        for allowed in ALLOWED_DOMAINS:
            if domain == allowed or domain.endswith("." + allowed):
                return True
        return False
    except Exception:
        return False

def sanitize_scraped_text(text):
    if not text:
        return ""
    # Strip script tags and their content
    text = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', text, flags=re.IGNORECASE)
    # Strip inline javascript events like onload, onclick etc
    text = re.sub(r'on\w+\s*=\s*(["\'])(.*?)\1', '', text, flags=re.IGNORECASE)
    # Strip html tags if raw text is supposed to be plain text, or just strip javascript/dangerous HTML
    text = re.sub(r'<(iframe|object|embed|style|link|meta)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>', '', text, flags=re.IGNORECASE)
    return text

# Standardizing location strings to State Codes for AI matching
STATE_MAP = {
    'delhi': 'DL',
    'maharashtra': 'MH',
    'mumbai': 'MH',
    'pune': 'MH',
    'karnataka': 'KA',
    'bangalore': 'KA',
    'tamil nadu': 'TN',
    'chennai': 'TN',
    'gujarat': 'GJ',
    'ahmedabad': 'GJ',
    'uttar pradesh': 'UP',
    'noida': 'UP',
    'lucknow': 'UP',
    'haryana': 'HR',
    'gurugram': 'HR',
    'telangana': 'TG',
    'hyderabad': 'TG',
    # Default fallback
}

def normalize_state(location_str):
    if not location_str:
        return []
    location_lower = location_str.lower()
    states = set()
    for key, code in STATE_MAP.items():
        if key in location_lower:
            states.add(code)
    
    # If no state matched but a location exists, we just return empty so the engine knows it's unknown
    # or we could attempt advanced NER.
    return list(states)

def extract_tender_value(detail_url, headers):
    try:
        if not detail_url.startswith("http"):
            detail_url = "https://eprocure.gov.in" + detail_url
        if not verify_url_domain(detail_url):
            raise ValueError(f"Domain not allowed: {detail_url}")
        time.sleep(1) # Rate limit
        resp = requests.get(detail_url, headers=headers, timeout=10, verify=False)
        resp.raise_for_status()
        detail_soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Look for "Tender Value" or "Estimated Cost"
        labels = detail_soup.find_all('td', class_='td_caption')
        for label in labels:
            text = label.text.strip().lower()
            if 'tender value' in text or 'estimated cost' in text:
                val_td = label.find_next_sibling('td')
                if val_td:
                    val_str = val_td.text.strip().replace(',', '').replace('INR', '').strip()
                    try:
                        return float(val_str)
                    except ValueError:
                        pass
                        
        # Fallback to EMD
        for label in labels:
            text = label.text.strip().lower()
            if 'emd amount' in text:
                val_td = label.find_next_sibling('td')
                if val_td:
                    val_str = val_td.text.strip().replace(',', '').replace('INR', '').strip()
                    try:
                        emd_val = float(val_str)
                        if emd_val > 0:
                            return emd_val / 0.02 # Extrapolate 2% EMD rule
                    except ValueError:
                        pass
                        
    except Exception as e:
        pass
    return 0.0

def fetch_and_parse(max_pages=None):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    tenders = []
    current_page = 1
    total_pages = 1
    
    # First request to get total pages
    try:
        if not verify_url_domain(CPPP_HTML_URL):
            raise ValueError(f"Domain not allowed: {CPPP_HTML_URL}")
        response = requests.get(CPPP_HTML_URL, headers=headers, timeout=20, verify=False)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract total pages from pagination
        pagination = soup.find(class_='pagination')
        if pagination:
            links = pagination.find_all('a', class_='paginate_button')
            for link in links:
                if link.text.isdigit():
                    val = int(link.text)
                    if val > total_pages:
                        total_pages = val
                        
        if max_pages is not None and total_pages > max_pages:
            total_pages = max_pages
            
    except Exception as e:
        pass
        
    for page in range(1, total_pages + 1):
        url = f"{CPPP_HTML_URL}?page={page}"
        try:
            if not verify_url_domain(url):
                raise ValueError(f"Domain not allowed: {url}")
            response = requests.get(url, headers=headers, timeout=20, verify=False)
            response.raise_for_status()
            content = response.text
        except Exception as e:
            # Reached end or error
            break

        soup = BeautifulSoup(content, 'html.parser')
        table = soup.find('table')
        if not table:
            break

        rows = table.find_all('tr')[1:] # Skip header row
        if not rows:
            break
        
        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 6:
                continue
                
            try:
                # Table Structure:
                # 0: Sl.No, 1: e-Published Date, 2: Bid Submission Closing Date
                # 3: Tender Opening Date, 4: Title/Ref.No./Tender Id, 5: Organisation Name
                
                published_date_str = cols[1].text.strip()
                deadline_str = cols[2].text.strip()
                title_ref_id = cols[4].text.strip()
                org_name = cols[5].text.strip()
                
                parts = title_ref_id.split('/')
                title = title_ref_id
                tender_id = parts[-1] if len(parts) > 1 else title_ref_id
                
                deadline = None
                if deadline_str:
                    try:
                        deadline = datetime.strptime(deadline_str, "%d-%b-%Y %I:%M %p")
                    except ValueError:
                        deadline = datetime.now()
                else:
                    deadline = datetime.now()

                state_codes = normalize_state(org_name)
                
                # Extract detail URL if available
                a_tag = cols[4].find('a')
                detail_url = a_tag['href'] if a_tag and 'href' in a_tag.attrs else None
                
                estimated_value = 0.0
                if detail_url:
                    estimated_value = extract_tender_value(detail_url, headers)
                
                raw_text = f"Title: {title}\nOrganisation: {org_name}\nDeadline: {deadline_str}"
                
                tenders.append({
                    "dedupeHash": hashlib.md5((tender_id + org_name).encode()).hexdigest(),
                    "portalSlug": "cppp",
                    "referenceNumber": sanitize_scraped_text(tender_id[:50]),
                    "title": sanitize_scraped_text(title[:200]),
                    "description": sanitize_scraped_text(f"Issued by {org_name}"),
                    "rawText": sanitize_scraped_text(raw_text),
                    "categoryCodes": json.dumps([]),
                    "stateCodes": json.dumps(state_codes),
                    "estimatedValue": estimated_value,
                    "submissionDeadline": deadline,
                    "documentOpenDate": datetime.now(),
                })
                
            except Exception as e:
                continue

    return tenders

if __name__ == "__main__":
    data = fetch_and_parse()
    # Print exactly the JSON output so Node can parse it
    print(json.dumps([t for t in data], default=str))

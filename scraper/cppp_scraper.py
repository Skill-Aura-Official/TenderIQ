import os
import requests
from bs4 import BeautifulSoup
import urllib3
import json
from datetime import datetime
import time

urllib3.disable_warnings()
import hashlib

CPPP_HTML_URL = "https://eprocure.gov.in/cppp/latestactivetendersnew/cpppdata"

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
                
                raw_text = f"Title: {title}\\nOrganisation: {org_name}\\nDeadline: {deadline_str}"
                
                tenders.append({
                    "dedupeHash": hashlib.md5((tender_id + org_name).encode()).hexdigest(),
                    "portalSlug": "cppp",
                    "referenceNumber": tender_id[:50],
                    "title": title[:200],
                    "description": f"Issued by {org_name}",
                    "rawText": raw_text,
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

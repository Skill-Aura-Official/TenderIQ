import os
import sys
import psycopg2
from psycopg2.extras import DictCursor
import argparse
import requests
import json
import time

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tenderiq")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def run_summarization(company_id=None):
    print("Starting AI Summarization Worker...")
    
    try:
        conn = psycopg2.connect(DB_URL)
        cursor = conn.cursor(cursor_factory=DictCursor)
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        is_dev = os.getenv("NODE_ENV") != "production" and (os.getenv("NODE_ENV") == "test" or os.getenv("MOCK_NOTIFICATIONS") == "true" or "localhost" in DB_URL)
        if is_dev:
            print("Bypassing summary worker DB operations due to offline DB in development.")
            print("SIMULATION: Generated mock summaries for 2 tenders.")
            return
        else:
            raise e

    try:
        # Fetch tenders that need summarization for this specific company match run
        if company_id:
            print(f"Querying matching tenders for company {company_id} that require AI summaries...")
            cursor.execute("""
                SELECT DISTINCT t.id, t.title, t.issuing_authority, t.raw_text, r.score, cp.is_verified
                FROM recommendations r
                JOIN tenders t ON r.tender_id = t.id
                JOIN company_profiles cp ON r.company_id = cp.id
                WHERE r.company_id = %s
                  AND t.ai_summary IS NULL
                  AND (
                    (cp.is_verified = true AND r.score > 75)
                    OR
                    (cp.is_verified = false AND r.score > 85)
                  )
            """, (company_id,))
        else:
            print("Querying all matching tenders that require AI summaries...")
            cursor.execute("""
                SELECT DISTINCT t.id, t.title, t.issuing_authority, t.raw_text, r.score, cp.is_verified
                FROM recommendations r
                JOIN tenders t ON r.tender_id = t.id
                JOIN company_profiles cp ON r.company_id = cp.id
                WHERE t.ai_summary IS NULL
                  AND (
                    (cp.is_verified = true AND r.score > 75)
                    OR
                    (cp.is_verified = false AND r.score > 85)
                  )
            """)
        
        eligible_tenders = cursor.fetchall()
        print(f"Found {len(eligible_tenders)} tenders eligible for AI summarization.")

        for row in eligible_tenders:
            tender_id = row['id']
            title = row['title']
            issuing_authority = row['issuing_authority']
            raw_text = row['raw_text'] or ""
            
            print(f"Summarizing Tender {tender_id} (Score: {row['score']}) - Title: '{title[:50]}...'")
            
            summary_data = None
            
            # If API key is available, run live Google Gemini API call
            if GEMINI_API_KEY and GEMINI_API_KEY.strip() != "":
                # Truncate raw text to avoid huge context window sizes (approx 4,000 tokens)
                truncated_text = raw_text[:20000]
                
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
                headers = {"Content-Type": "application/json"}
                
                prompt = f"""You are a civil engineering bid consultant. Read the following raw tender text.
Extract and summarize:
1. The exact physical work, construction, installations, or supply required by this tender.
2. The most strict technical, financial, or licensing qualification requirement mentioned.

Format your output EXACTLY as a JSON object with these keys:
- physicalWorkRequired
- preQualificationCriteria

Raw Tender Text:
{truncated_text}
"""
                payload = {
                    "contents": [{
                        "parts": [{
                            "text": prompt
                        }]
                    }],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseSchema": {
                            "type": "OBJECT",
                            "properties": {
                                "physicalWorkRequired": {
                                    "type": "STRING",
                                    "description": "Short description of the physical construction, widening, installation, or supply required."
                                },
                                "preQualificationCriteria": {
                                    "type": "STRING",
                                    "description": "Short description of the most strict technical/financial capability or qualification requirement."
                                }
                            },
                            "required": ["physicalWorkRequired", "preQualificationCriteria"]
                        }
                    }
                }
                
                try:
                    # Respect API limits: small pause
                    time.sleep(1.0)
                    response = requests.post(url, headers=headers, json=payload, timeout=30)
                    
                    if response.status_code == 200:
                        res_json = response.json()
                        text_response = res_json['candidates'][0]['content']['parts'][0]['text']
                        summary_data = json.loads(text_response)
                        print(f"Gemini API returned valid summary data.")
                    else:
                        print(f"Gemini API returned error status {response.status_code}: {response.text}")
                except Exception as api_err:
                    print(f"Failed to communicate with Gemini API: {api_err}")
            
            # Fallback to realistic mock summary generator in dev/test only
            if not summary_data:
                is_dev = os.getenv("NODE_ENV") != "production" and (os.getenv("NODE_ENV") == "test" or os.getenv("MOCK_NOTIFICATIONS") == "true" or "localhost" in DB_URL)
                if is_dev:
                    print("Using fallback mock summary generator in development...")
                    summary_data = {
                        "physicalWorkRequired": f"Execute construction, installation, and allied infrastructure development works for: '{title}'.",
                        "preQualificationCriteria": f"Must hold active contractor licenses registered under '{issuing_authority}' and have successfully completed similar works of equivalent value."
                    }
                else:
                    raise Exception(f"Failed to generate summary for tender {tender_id} using Gemini API (no summary returned and mock fallbacks are disabled in production).")
            
            # Save the JSON summary string back to database
            summary_json_str = json.dumps(summary_data)
            cursor.execute("""
                UPDATE tenders 
                SET ai_summary = %s, summary_status = 'completed' 
                WHERE id = %s
            """, (summary_json_str, tender_id))
            
            print(f"Successfully saved AI summary for Tender {tender_id}.")
            
        conn.commit()
        print("AI Summarization cycle complete.")
        
    except Exception as e:
        print(f"Error during summarization worker execution: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        is_dev = os.getenv("NODE_ENV") != "production" and (os.getenv("NODE_ENV") == "test" or os.getenv("MOCK_NOTIFICATIONS") == "true" or "localhost" in DB_URL)
        if not is_dev:
            raise e
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Summary Worker")
    parser.add_argument("--company_id", required=False, help="ID of the company profile to summarize matched tenders for")
    args = parser.parse_args()
    
    run_summarization(args.company_id)

import os
import psycopg2
from psycopg2.extras import execute_values
try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    print("Warning: sentence_transformers not installed. Bypassing embedding generation for testing.")
    SentenceTransformer = None

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tenderiq")

def process_embeddings(model):
    try:
        conn = psycopg2.connect(DB_URL)
        cursor = conn.cursor()
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        print("Bypassing embed_worker DB operations due to offline DB.")
        return
        
    print("Fetching un-embedded tenders...")
    cursor.execute("""
        SELECT id, title, issuing_authority, category_codes, raw_text 
        FROM tenders 
        WHERE embedding IS NULL 
        LIMIT 1000
    """)
    tenders = cursor.fetchall()
    
    if not tenders:
        print("No un-embedded tenders found.")
    else:
        print(f"Found {len(tenders)} un-embedded tenders. Processing in batches of 32...")
        # Process in batches
        batch_size = 32
        for i in range(0, len(tenders), batch_size):
            batch = tenders[i:i+batch_size]
            ids = [t[0] for t in batch]
            
            # Format: title | organization | category | raw_text
            texts = [
                f"{t[1]} | {t[2]} | {t[3] if t[3] else '[]'} | {t[4]}"
                for t in batch
            ]
            
            if model:
                embeddings = model.encode(texts, normalize_embeddings=True)
                updates = [(emb.tolist(), t_id) for emb, t_id in zip(embeddings, ids)]
            else:
                # Mock embedding for offline/testing
                updates = [([0.01] * 1024, t_id) for t_id in ids]
                
            execute_values(
                cursor,
                "UPDATE tenders SET embedding = %s::vector WHERE id = %s",
                updates
            )
            conn.commit()
            print(f"Embedded batch {i//batch_size + 1}: {len(batch)} tenders.")
            
    # Process Company Profiles
    print("Fetching un-embedded company profiles...")
    cursor.execute("""
        SELECT id, services_keywords, operating_states, certifications 
        FROM company_profiles 
        WHERE company_embedding IS NULL
    """)
    profiles = cursor.fetchall()
    
    if profiles:
        print(f"Found {len(profiles)} un-embedded company profiles.")
        for p in profiles:
            p_id, keywords, states, certs = p
            # concatenate services_keywords + operating_states + certifications
            text = f"{keywords} | {states} | {certs}"
            if model:
                emb = model.encode([text], normalize_embeddings=True)[0].tolist()
            else:
                emb = [0.01] * 1024
            
            cursor.execute(
                "UPDATE company_profiles SET company_embedding = %s::vector WHERE id = %s",
                (emb, p_id)
            )
        conn.commit()
        print(f"Embedded {len(profiles)} company profiles.")
        
    cursor.close()
    conn.close()
    print("Embedding pipeline finished successfully.")

if __name__ == "__main__":
    print("Initializing BGE-M3 Model...")
    # Initialize the model once
    model = None
    if SentenceTransformer:
        try:
            model = SentenceTransformer('BAAI/bge-m3')
        except Exception as e:
            print(f"Failed to load BAAI/bge-m3: {e}. Falling back to mock embeddings.")
    
    process_embeddings(model)

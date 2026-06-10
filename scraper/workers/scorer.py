import math

def cosine_similarity(vec1, vec2):
    """Fallback cosine similarity if not doing it in DB directly."""
    if not vec1 or not vec2:
        return 0.0
    dot = sum(a*b for a,b in zip(vec1, vec2))
    norm_a = math.sqrt(sum(a*a for a in vec1))
    norm_b = math.sqrt(sum(b*b for b in vec2))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

def calculate_tender_score(profile, tender, semantic_similarity=None):
    """
    Calculates the score of a tender against a company profile.
    Formula:
    Geography (20%): 20pts if tender state is in profile operating_states
    Financial & Capability (40%):
       Similar Work (15pts): tender value <= profile max_tender_capacity
       EMD Capacity (15pts): tender emd <= profile max_emd_capacity
       PQ/MSME (10pts): tender requires MSME and profile msme_registered == true, OR no PQ
    Semantic Match (30%):
       cosine similarity threshold: >0.75 = 30pts, 0.5-0.75 = scaled, <0.5 = 0
    Certification Match (10%):
       10pts if profile certs overlap with tender required certs
    """
    score = 0
    
    # Geography (20%)
    tender_state = tender.get('state')
    operating_states = profile.get('operating_states', [])
    if tender_state in operating_states:
        score += 20
        
    # Financial & Capability (40%)
    tender_val = tender.get('estimated_value') or 0
    max_cap = profile.get('max_tender_capacity') or 0
    if tender_val <= max_cap:
        score += 15
        
    tender_emd = tender.get('emd_amount') or 0
    max_emd = profile.get('max_emd_capacity') or 0
    if tender_emd <= max_emd:
        score += 15
        
    # PQ/MSME
    requires_msme = tender.get('requires_msme', False)
    is_msme = profile.get('msme_registered', False)
    if (requires_msme and is_msme) or not requires_msme:
        score += 10
        
    # Semantic Match (30%)
    if semantic_similarity is None:
        semantic_similarity = cosine_similarity(profile.get('company_embedding'), tender.get('embedding'))
        
    if semantic_similarity > 0.75:
        score += 30
    elif semantic_similarity >= 0.5:
        # Scale proportionally between 0.5 and 0.75 for 0-30 points
        scaled = ((semantic_similarity - 0.5) / 0.25) * 30
        score += round(scaled)
        
    # Certification Match (10%)
    profile_certs = set(profile.get('certifications', []))
    tender_certs = set(tender.get('required_certifications', []))
    if not tender_certs or profile_certs.intersection(tender_certs):
        score += 10
        
    return score

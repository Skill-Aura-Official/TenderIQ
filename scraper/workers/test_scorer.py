import pytest
from scorer import calculate_tender_score

@pytest.fixture
def base_profile():
    return {
        'operating_states': ['MH', 'GJ'],
        'max_tender_capacity': 50000000, # 5Cr
        'max_emd_capacity': 1000000, # 10L
        'msme_registered': True,
        'certifications': ['ISO9001']
    }

def test_strong_match(base_profile):
    """Should score > 75 (strong match)"""
    tender = {
        'state': 'MH', # +20
        'estimated_value': 20000000, # +15 (<= 5Cr)
        'emd_amount': 400000, # +15 (<= 10L)
        'requires_msme': True, # +10 (profile has MSME)
        'required_certifications': ['ISO9001'] # +10 (overlap)
    }
    # Semantic Match manually injected as 0.82 (+30)
    score = calculate_tender_score(base_profile, tender, semantic_similarity=0.82)
    assert score > 75
    assert score == 100

def test_partial_match(base_profile):
    """Should score 40-60 (partial match, geo miss)"""
    tender = {
        'state': 'KA', # +0 (geo miss)
        'estimated_value': 40000000, # +15
        'emd_amount': 800000, # +15
        'requires_msme': False, # +10
        'required_certifications': ['ISO14001'] # +0 (no overlap)
    }
    # Semantic Match injected as 0.60 (+12 points)
    score = calculate_tender_score(base_profile, tender, semantic_similarity=0.60)
    # Total: 0 + 15 + 15 + 10 + 12 + 0 = 52
    assert 40 <= score <= 60
    assert score == 52

def test_poor_match(base_profile):
    """Should score < 20 (completely wrong category and state, high value)"""
    tender = {
        'state': 'DL', # +0
        'estimated_value': 100000000, # +0 (> 5Cr)
        'emd_amount': 2000000, # +0 (> 10L)
        'requires_msme': True, # +10
        'required_certifications': ['ISO14001'] # +0
    }
    # Semantic Match injected as 0.20 (+0)
    score = calculate_tender_score(base_profile, tender, semantic_similarity=0.20)
    # Total: 0 + 0 + 0 + 10 + 0 + 0 = 10
    assert score < 20
    assert score == 10

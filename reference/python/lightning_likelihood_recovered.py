"""Recovered public-only lightning likelihood scoring (reference only)."""

def reflectivity_score(c):
    return 30 if c>=14 else 26 if c>=12 else 22 if c>=11 else 17 if c>=10 else 12 if c>=9 else 7 if c>=7 else 0

def persistence_score(n):
    return 10 if n>=6 else 8 if n>=4 else 6 if n>=3 else 4 if n>=2 else 1

def category(score):
    return "VERY HIGH" if score>=65 else "HIGH" if score>=45 else "MODERATE" if score>=25 else "LOW"

def doppler_score(values):
    valid=[v for v in values if v!=-32768]
    if not valid: return 0
    max_abs=max(abs(v) for v in valid)
    score=8 if max_abs>=80 else 6 if max_abs>=60 else 4 if max_abs>=40 else 2 if max_abs>=20 else 0
    neg=[v for v in valid if v<0]; pos=[v for v in valid if v>0]
    if neg and pos:
        span=max(pos)-min(neg)
        score += 7 if span>=120 else 5 if span>=80 else 3 if span>=50 else 0
    return min(score,15)

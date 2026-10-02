"""Recovered StormTracker tracking constants/formulas (reference only)."""
from math import pi, sqrt

CROSS_RADAR_TIME_TOLERANCE_SECONDS = 180.0
MAXIMUM_TRACK_SPEED_KMH = 140.0
MAXIMUM_GAP_MINUTES = 12.0


def equivalent_radius_km(area_km2):
    return sqrt(area_km2/pi) if area_km2 > 0 else 0.0


def dedup_radius_km(a_area, b_area):
    radius_sum = equivalent_radius_km(a_area)+equivalent_radius_km(b_area)
    return min(20.0, max(6.0, 1.25*radius_sum+4.0))


def association_score(distance_km, previous_area, current_area, category_difference, radar_overlap):
    adaptive_distance_km=min(45.0,max(10.0,equivalent_radius_km(previous_area)+equivalent_radius_km(current_area)+12.0))
    if distance_km > adaptive_distance_km: return None
    area_ratio=min(previous_area,current_area)/max(previous_area,current_area,0.01)
    return (
        0.65*(distance_km/adaptive_distance_km)
        +0.20*(1.0-area_ratio)
        +0.15*min(category_difference/6.0,1.0)
        +(-0.10 if radar_overlap else 0.0)
    )


def confidence(observation_count, any_multi_radar):
    if observation_count >= 4: return "high" if any_multi_radar else "medium"
    if observation_count >= 2: return "medium"
    return "low"

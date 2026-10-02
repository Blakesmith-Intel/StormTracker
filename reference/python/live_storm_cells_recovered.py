"""Recovered StormTracker live segmentation specification (reference only)."""
from collections import deque

REFLECTIVITY_CLASSES = {
    1:(12.0,23.0),2:(23.0,28.0),3:(28.0,31.0),4:(31.0,34.0),5:(34.0,37.0),
    6:(37.0,40.0),7:(40.0,43.0),8:(43.0,46.0),9:(46.0,49.0),10:(49.0,52.0),
    11:(52.0,55.0),12:(55.0,58.0),13:(58.0,61.0),14:(61.0,64.0),15:(64.0,None),
}

DEFAULT_THRESHOLD_CATEGORY = 7
DEFAULT_MIN_PIXELS = 8
DEFAULT_CONNECTIVITY = 8


def connected_components(mask, connectivity=8):
    rows, cols = len(mask), len(mask[0])
    labels = [[0]*cols for _ in range(rows)]
    offsets=[(-1,0),(1,0),(0,-1),(0,1)]
    if connectivity == 8: offsets += [(-1,-1),(-1,1),(1,-1),(1,1)]
    components=[]; next_label=1
    for row in range(rows):
        for col in range(cols):
            if not mask[row][col] or labels[row][col]: continue
            q=deque([(row,col)]); labels[row][col]=next_label; pixels=[]
            while q:
                rr,cc=q.popleft(); pixels.append((rr,cc))
                for dr,dc in offsets:
                    nr,nc=rr+dr,cc+dc
                    if 0<=nr<rows and 0<=nc<cols and mask[nr][nc] and labels[nr][nc]==0:
                        labels[nr][nc]=next_label; q.append((nr,nc))
            components.append(pixels); next_label += 1
    return labels, components


def threshold_counts(categories):
    return {
        "definite_ge_50_pixel_count": sum(c>=11 for c in categories),
        "possible_ge_50_pixel_count": sum(c>=10 for c in categories),
        "definite_ge_55_pixel_count": sum(c>=12 for c in categories),
        "possible_ge_55_pixel_count": sum(c>=11 for c in categories),
        "definite_ge_60_pixel_count": sum(c>=14 for c in categories),
        "possible_ge_60_pixel_count": sum(c>=13 for c in categories),
    }

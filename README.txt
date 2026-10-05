StormTracker Christmas Night 2023 severe-storm tracking validation

Purpose
-------
Deterministic simulation to exercise the real StormTracker tracking and
footprint-restricted Doppler assessment code using the observed corridor,
timing and severity anchors from the 25 December 2023 South East Queensland
severe thunderstorm / QLCS event.

This is NOT represented as an archived radar replay.

Observed anchors used
---------------------
- 19:49 AEST: Gold Coast explicitly in Detailed Severe Thunderstorm Warning.
- 19:56 AEST: Scenic Rim / Gold Coast escalated to Very Dangerous Thunderstorm.
- 20:40 AEST: warning escalated to destructive wind gusts.
- 21:12 AEST: Gold Coast Seaway recorded 106 km/h maximum gust.
- Bureau reporting: damaging to locally destructive wind corridor about
  3–4 km wide and 30–50 km long across the Gold Coast and Scenic Rim.
- Independent post-event meteorological analysis describes a QLCS/bow-echo
  progression from the Amberley/Ripley area through Jimboomba/Tamborine to
  the northern Gold Coast, including 3-D radar analysis around 20:20–20:45.

Simulated inputs
----------------
Six 5-minute frames from 20:20 to 20:45 AEST:
- two radar observations per frame (50 Marburg and 66 Mt Stapylton)
- one cross-radar-deduplicated storm object
- centroid progression along the documented corridor
- increasing/decreasing >=40 dBZ footprint area
- severe reflectivity categories
- strict footprint Doppler radial-velocity classes

The production tracking algorithm must:
- keep one identity: ST0001
- maintain centroid motion below the 140 km/h hard association limit
- preserve a southeast heading
- achieve multi-radar confirmation
- produce HIGH / VERY HIGH convective-lightning assessment during peak frames
- reach the full 15/15 Doppler component at the 20:40 destructive-warning frame

Install
-------
Copy the whole folder into /workspaces/StormTracker and run:

  cd /workspaces/StormTracker
  python StormTracker_Christmas_2023_Tracking_Test/install.py

The installer only ADDS the simulation/test files. It does not modify the
live Core V8.3 application or the shared camera controller.

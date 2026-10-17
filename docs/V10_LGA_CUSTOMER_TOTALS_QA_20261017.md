# StormTracker V10 QA — LGA-level impacted customer totals (17 October 2026)

The expanded **Power outages by LGA** modal now shows two separate values next to every council: the number of distinct unplanned outage events, and the electricity providers' reported **customers affected** across those distinct event IDs.

- Each incident is counted only once per council even if the source lists multiple suburbs within that council. Counts and customer values come from the same live outage snapshot as the map and sidebar buttons; no additional source fetch or estimated allocations.
- In outages spanning more than one LGA, the same full event customer count can appear in more than one LGA. Such council rows show **Shared***, with an explanation when expanded. These figures are not an exact geographic apportionment and must not be added across council areas to obtain a statewide total.
- Search-filtered results show sums for the visible incident matches only; the shared-event flag is always computed from the complete council group snapshot.
- Works for the **LGA not verified** group as well, showing provider event counts without inventing a council assignment.
- Responsive chips wrap beneath long LGA names on smaller phones. Existing council expand/collapse, suburb navigation, polygons, refresh polling, and outage source attribution remain untouched.
- CI regression covers unique event IDs, multiple suburbs in the same council, cross-council shared events, filtered counts, and customer-count markup.

This is a **development preview** change. Production **V9.20.2** remains sealed until operator acceptance.

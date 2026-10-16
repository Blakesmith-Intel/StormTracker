# V9.19 experimental incremental 3-D: flicker and memory regression fix

## Observation (16 October 2026)
User recording shows the 3-D weather cloud repeatedly appearing and disappearing during playback, and browser memory increased after the first incremental/memory preview. The original 990.7 MB tab / 2,158 MB shared GPU process are comparison values, not measurements of this corrected preview.

## Root causes corrected
1. The application alternated between *track-specific* inferred volume geometry on observed frames and *frame-wide* inferred geometry on temporally interpolated display frames. The delta renderer covered only the latter; full-cloud visibility still toggled at scan boundaries.
2. The first delta engine allocated replacement Cesium billboards and temporarily overlapped outgoing/incoming glyphs while fading their alpha, causing extra GPU memory and noticeable blinking where source categories changed.
3. The secondary radar 3-D renderer could reset its geographic sampling stride as echo extent changed, and performed a full opacity write on every scan.
4. Secondary sites that were deselected had their Cesium geometry hidden but not removed.
5. Track-specific 3-D point arrays and footprint arrays remained in memory for every historical frame even though the preview no longer renders those separate clouds.

## Current fix (isolated preview ONLY)
- Render **one** persistent frame-wide, empirically inferred 3-D cloud across both original BoM radar observations and display-only interpolated frames.
- Update matched Cesium point/billboard primitives **in place**, without any zero-alpha cloud fade, double-cloud overlap, or additional timed animation. Add/delete only genuine new/disappearing column levels.
- Keep all original 2-D BoM observations, Doppler, track IDs, storm motion and threat-cone calculation paths untouched.
- Secondary radar 3-D uses the same stable glyph update, locked spatial sampling lattice, no frame-wide opacity repaint; unloads deselected site glyphs.
- Retain track high-support top/trend/count summary values, but release the redundant 3-D point arrays and source footprint arrays from each track's cached historical record in this preview.
- Other preview memory caps remain in effect; sealed V9.19.0 production root remains immutable.

## Required browser acceptance
Play a 60-minute rain-only loop with at least one genuine interpolated frame; verify continuous cloud presence, no alternating cloud representations, and no freezing. Verify correct source UTC and no synthetic timestamps fed to tracks. Then repeat with 3 additional radars, switch radars, zoom rapidly, and test Doppler-only playback. Record Task Manager tab memory, GPU process (not tab exclusive), and Memory QA snapshots at initial load, five loops, 20 loops, and site changes. No production promotion until these measurements improve without introducing satellite dropout or WebGL texture errors.

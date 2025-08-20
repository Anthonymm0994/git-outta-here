#!/usr/bin/env python3
"""
Pulse Analysis System - Bob Angle Window Width Recommender

This script analyzes pulse data to recommend optimal angle window widths for a system
that "franks" pulses. It processes SQLite data with bob_deg and frank_flag columns,
sweeping through candidate window widths to find the best balance of coverage,
inside lift, and outside suppression.

Inputs: SQLite database with pulse data
Outputs: Professional report with window width recommendations
Constraints: Uses only Python standard library, no third-party packages
"""

import sqlite3
import math
from typing import List, Dict, Tuple, Optional

# =============================================================================
# CONFIGURATION SECTION
# =============================================================================
DB_PATH = "telemetry.sqlite"
SUBSETS = [
    {"name": "All pulses", "sql": "SELECT bob_deg, frank_flag FROM pulses"},
    # {"name": "Channel A", "sql": "SELECT aoa AS bob_deg, blank AS frank_flag FROM pulses WHERE rx_channel='A'"},
    # {"name": "Last 24h", "sql": "SELECT bob_deg, frank_flag, ts FROM pulses WHERE ts >= datetime('now','-1 day')"},
]

# Tunable parameters
TARGET_COVERAGE = 0.95
MIN_LIFT_INSIDE = 2.0
MAX_REL_OUTSIDE = 0.75
GUARD_DEG = 2.0
EDGE_FRACTION = 0.10
BIN_DEG = 15
MIN_WIDTH_DEG = 10.0
MAX_WIDTH_DEG = 120.0
STEP_WIDTH_DEG = 2.0
KNEE_MIN_COVER = 0.90
KNEE_MARGINAL_EPS = 0.002
WIDTH_TOLERANCE_DEG = 6.0

# =============================================================================
# CORE FUNCTIONS
# =============================================================================

def fetch_rows(con: sqlite3.Connection, sql: str) -> List[Dict]:
    """Fetch and validate rows from SQLite query."""
    cursor = con.execute(sql)
    columns = [description[0] for description in cursor.description]
    
    # Validate required columns
    required = {'bob_deg', 'frank_flag'}
    if not required.issubset(set(columns)):
        missing = required - set(columns)
        raise ValueError(f"Missing required columns: {missing}")
    
    rows = []
    for row in cursor.fetchall():
        row_dict = dict(zip(columns, row))
        # Validate data types
        try:
            float(row_dict['bob_deg'])
            int(row_dict['frank_flag'])
        except (ValueError, TypeError):
            continue  # Skip invalid rows
        rows.append(row_dict)
    
    return rows

def basic_stats(rows: List[Dict]) -> Tuple[int, int, float]:
    """Compute basic statistics: total pulses, franked pulses, global frank rate."""
    n_all = len(rows)
    n_frank = sum(1 for row in rows if row['frank_flag'] == 1)
    r_global = n_frank / n_all if n_all > 0 else 0.0
    return n_all, n_frank, r_global

def ang_dev_from_zero(bob_deg: float) -> float:
    """Compute absolute short-way deviation from 0°."""
    # Normalize to 0-360 range
    bob_deg = bob_deg % 360
    # Find shortest distance to 0°
    if bob_deg <= 180:
        return bob_deg
    else:
        return 360 - bob_deg

def eval_width(rows: List[Dict], full_width_deg: float, guard_deg: float, edge_fraction: float) -> Dict:
    """Evaluate a specific window width."""
    half_width = full_width_deg / 2
    edge_start = half_width * (1 - edge_fraction)
    
    inside_pulses = []
    outside_pulses = []
    edge_pulses = []
    
    for row in rows:
        dev = ang_dev_from_zero(row['bob_deg'])
        if dev < half_width:
            inside_pulses.append(row)
            if dev >= edge_start:
                edge_pulses.append(row)
        elif dev >= half_width + guard_deg:
            outside_pulses.append(row)
    
    return {
        'width': full_width_deg,
        'inside_pulses': inside_pulses,
        'outside_pulses': outside_pulses,
        'edge_pulses': edge_pulses,
        'inside_count': len(inside_pulses),
        'outside_count': len(outside_pulses),
        'edge_count': len(edge_pulses)
    }

def sweep_widths(rows: List[Dict]) -> List[Dict]:
    """Sweep through candidate window widths."""
    results = []
    width = MIN_WIDTH_DEG
    
    while width <= MAX_WIDTH_DEG:
        result = eval_width(rows, width, GUARD_DEG, EDGE_FRACTION)
        results.append(result)
        width += STEP_WIDTH_DEG
    
    return results

def rates_for_result(n_all: int, n_frank: int, r_global: float, res: Dict) -> Tuple[float, float, float, float, float, float]:
    """Compute rates and metrics for a width result."""
    inside_franked = sum(1 for p in res['inside_pulses'] if p['frank_flag'] == 1)
    outside_franked = sum(1 for p in res['outside_pulses'] if p['frank_flag'] == 1)
    edge_franked = sum(1 for p in res['edge_pulses'] if p['frank_flag'] == 1)
    
    r_inside = inside_franked / res['inside_count'] if res['inside_count'] > 0 else 0.0
    r_outside = outside_franked / res['outside_count'] if res['outside_count'] > 0 else 0.0
    covered = inside_franked / n_frank if n_frank > 0 else 0.0
    lift_in = r_inside / r_global if r_global > 0 else 0.0
    rel_out = r_outside / r_global if r_global > 0 else 0.0
    edge_idx = edge_franked / inside_franked if inside_franked > 0 else 0.0
    
    return r_inside, r_outside, covered, lift_in, rel_out, edge_idx

def choose_width(results: List[Dict], n_all: int, n_frank: int, r_global: float) -> Tuple[Optional[Dict], Optional[float]]:
    """Choose the optimal window width based on targets."""
    # Add computed metrics to each result
    for res in results:
        r_inside, r_outside, covered, lift_in, rel_out, edge_idx = rates_for_result(n_all, n_frank, r_global, res)
        res.update({
            'r_inside': r_inside,
            'r_outside': r_outside,
            'covered': covered,
            'lift_in': lift_in,
            'rel_out': rel_out,
            'edge_idx': edge_idx
        })
    
    # Find results that meet all targets
    meeting_targets = [
        res for res in results
        if (res['covered'] >= TARGET_COVERAGE and
            res['lift_in'] >= MIN_LIFT_INSIDE and
            res['rel_out'] <= MAX_REL_OUTSIDE)
    ]
    
    if meeting_targets:
        # Choose smallest width that meets all targets
        chosen = min(meeting_targets, key=lambda x: x['width'])
    else:
        # Fallback: maximize coverage, then minimize outside relative, then smallest width
        chosen = max(results, key=lambda x: (x['covered'], -x['rel_out'], -x['width']))
    
    # Find knee point
    knee_width = None
    if chosen['covered'] >= KNEE_MIN_COVER:
        # Look for marginal coverage gain below threshold
        for i, res in enumerate(results):
            if res['width'] >= chosen['width']:
                continue
            if res['covered'] >= KNEE_MIN_COVER:
                # Check marginal gain
                if i + 1 < len(results):
                    next_res = results[i + 1]
                    marginal_gain = (next_res['covered'] - res['covered']) / (next_res['width'] - res['width'])
                    if marginal_gain < KNEE_MARGINAL_EPS:
                        knee_width = res['width']
                        break
    
    return chosen, knee_width

def by_angle_bins(rows: List[Dict], bin_deg: float) -> List[Dict]:
    """Create coarse angle bin summary."""
    bins = {}
    
    for row in rows:
        bob_deg = row['bob_deg'] % 360
        bin_start = int(bob_deg // bin_deg) * bin_deg
        bin_key = f"{bin_start:03.0f}-{bin_start + bin_deg:03.0f}°"
        
        if bin_key not in bins:
            bins[bin_key] = {'pulses': 0, 'franks': 0}
        
        bins[bin_key]['pulses'] += 1
        if row['frank_flag'] == 1:
            bins[bin_key]['franks'] += 1
    
    # Convert to list and sort by frank rate
    bin_list = []
    for bin_key, data in bins.items():
        frank_rate = data['franks'] / data['pulses'] if data['pulses'] > 0 else 0.0
        bin_list.append({
            'bin': bin_key,
            'pulses': data['pulses'],
            'franks': data['franks'],
            'frank_rate': frank_rate
        })
    
    bin_list.sort(key=lambda x: x['frank_rate'], reverse=True)
    return bin_list

def outside_scatter(rows: List[Dict], full_width_deg: float, guard_deg: float, bin_deg: float = 30) -> List[Dict]:
    """Analyze outside scatter beyond window + guard."""
    half_width = full_width_deg / 2
    outside_rows = [row for row in rows if ang_dev_from_zero(row['bob_deg']) >= half_width + guard_deg]
    
    return by_angle_bins(outside_rows, bin_deg)

def stability_split_by_time(rows: List[Dict], full_width_deg: float) -> Optional[Tuple[float, float]]:
    """Check stability by splitting data in time if timestamp available."""
    if 'ts' not in rows[0]:
        return None
    
    # Sort by timestamp
    sorted_rows = sorted(rows, key=lambda x: x['ts'])
    mid_point = len(sorted_rows) // 2
    
    first_half = sorted_rows[:mid_point]
    second_half = sorted_rows[mid_point:]
    
    # Compute 95th percentile half-width for each half
    def get_95th_percentile_width(half_rows):
        franked = [row for row in half_rows if row['frank_flag'] == 1]
        if not franked:
            return None
        
        deviations = [ang_dev_from_zero(row['bob_deg']) for row in franked]
        deviations.sort()
        percentile_idx = int(0.95 * len(deviations))
        return deviations[percentile_idx] * 2  # Full width
    
    first_width = get_95th_percentile_width(first_half)
    second_width = get_95th_percentile_width(second_half)
    
    if first_width is not None and second_width is not None:
        return first_width, second_width
    
    return None

def print_subset_report(name: str, rows: List[Dict], have_cols: set) -> Optional[float]:
    """Print complete report for a subset and return recommended width."""
    print("=" * 96)
    print(f"[Subset] {name}")
    print("=" * 96)
    
    if not rows:
        print("No pulses")
        return None
    
    n_all, n_frank, r_global = basic_stats(rows)
    
    if n_frank == 0:
        print("No franked pulses - cannot provide recommendation")
        return None
    
    print(f"Total pulses: {n_all:,} | Franked: {n_frank:,} | Overall frank rate: {r_global:.5f}")
    
    # Where franking concentrates
    print(f"\nWhere franking concentrates by Bob angle ({BIN_DEG}° bins):")
    bins = by_angle_bins(rows, BIN_DEG)
    for bin_data in bins[:6]:  # Top 6 bins
        print(f"  Bob {bin_data['bin']} | pulses {bin_data['pulses']:6d}  franks {bin_data['franks']:4d}  frank rate {bin_data['frank_rate']:.4f}")
    
    # Width sweep
    print(f"\nWidth sweep (center fixed at 0°). Key points near the recommendation:")
    results = sweep_widths(rows)
    chosen, knee_width = choose_width(results, n_all, n_frank, r_global)
    
    # Show results around the chosen width
    chosen_idx = next(i for i, res in enumerate(results) if res['width'] == chosen['width'])
    start_idx = max(0, chosen_idx - 2)
    end_idx = min(len(results), chosen_idx + 3)
    
    for i in range(start_idx, end_idx):
        res = results[i]
        r_inside, r_outside, covered, lift_in, rel_out, edge_idx = rates_for_result(n_all, n_frank, r_global, res)
        marker = "  <-- pick" if res['width'] == chosen['width'] else ""
        print(f"  W={res['width']:5.1f}° | inside rate {r_inside:.5f} (~{lift_in:.1f}× overall) | outside(+{GUARD_DEG:.0f}°) {r_outside:.5f} (~{rel_out:.2f}×) | covered ~{covered*100:.1f}% | edge idx {edge_idx:.3f}{marker}")
    
    # Outside scatter
    print(f"\nOutside (beyond window + guard), by 30° bins:")
    outside_bins = outside_scatter(rows, chosen['width'], GUARD_DEG, 30)
    for bin_data in outside_bins[:4]:  # Top 4 outside bins
        print(f"  Bob {bin_data['bin']} | pulses {bin_data['pulses']:6d} | franks {bin_data['franks']:4d} | frank rate {bin_data['frank_rate']:.5f}")
    
    # Stability check
    stability_result = stability_split_by_time(rows, chosen['width'])
    if stability_result:
        first_width, second_width = stability_result
        print(f"\nStability check (first vs second half by time):")
        print(f"  First half 95th percentile width: {first_width:.1f}°")
        print(f"  Second half 95th percentile width: {second_width:.1f}°")
    
    # Recommendation
    print(f"\nRecommendation")
    print("-" * 15)
    half_width = chosen['width'] / 2
    edge_start = half_width * (1 - EDGE_FRACTION)
    
    print(f"• Set the Bob window to [-{half_width:.1f}°, +{half_width:.1f}°] (full width ~{chosen['width']:.1f}°, edges [{edge_start:.1f}°, {half_width:.1f}°]).")
    
    # Determine if targets are met
    targets_met = (chosen['covered'] >= TARGET_COVERAGE and
                   chosen['lift_in'] >= MIN_LIFT_INSIDE and
                   chosen['rel_out'] <= MAX_REL_OUTSIDE)
    
    if targets_met:
        print(f"• Why this choice: meets all targets.")
    else:
        print(f"• Why this choice: best available trade-off.")
    
    print(f"  - Inside frank rate ≈ {chosen['r_inside']:.5f} (~{chosen['lift_in']:.1f}× overall {r_global:.5f})")
    print(f"  - Outside(+{GUARD_DEG:.0f}°) frank rate ≈ {chosen['r_outside']:.5f} (~{chosen['rel_out']:.2f}× overall)")
    print(f"  - Covers ≈ {chosen['covered']*100:.1f}% of franked pulses")
    print(f"  - Edge hits are {'modest' if chosen['edge_idx'] < 0.1 else 'moderate'} (edge index {chosen['edge_idx']:.3f}); use ±1° hysteresis.")
    
    print(f"• Policy notes:")
    print(f"  - Center is fixed at 0°.")
    print(f"  - Guard band {GUARD_DEG}° beyond the window is considered firmly \"outside\".")
    
    if knee_width and knee_width != chosen['width']:
        print(f"• Knee point: {knee_width:.1f}° (marginal coverage gain becomes small)")
    
    return chosen['width']

def main():
    """Main execution function."""
    try:
        con = sqlite3.connect(DB_PATH)
        print("Pulse Analysis System - Bob Angle Window Width Recommender")
        print("=" * 96)
        
        recommended_widths = []
        
        for subset in SUBSETS:
            try:
                rows = fetch_rows(con, subset['sql'])
                have_cols = set(rows[0].keys()) if rows else set()
                width = print_subset_report(subset['name'], rows, have_cols)
                if width:
                    recommended_widths.append((subset['name'], width))
                print()  # Empty line between subsets
                
            except Exception as e:
                print(f"Error processing subset '{subset['name']}': {e}")
                continue
        
        # Wrap-up across subsets
        if recommended_widths:
            print("=" * 96)
            print("WRAP-UP ACROSS SUBSETS")
            print("=" * 96)
            
            print("Recommended widths by subset:")
            for name, width in recommended_widths:
                print(f"  {name}: {width:.1f}°")
            
            # Check if we can suggest a global width
            if len(recommended_widths) > 1:
                widths = [w for _, w in recommended_widths]
                width_range = max(widths) - min(widths)
                
                if width_range <= WIDTH_TOLERANCE_DEG:
                    # Use median for global recommendation
                    widths.sort()
                    median_width = widths[len(widths)//2]
                    print(f"\nGlobal recommendation: Use {median_width:.1f}° for all subsets")
                    print(f"(Width variation {width_range:.1f}° ≤ tolerance {WIDTH_TOLERANCE_DEG:.1f}°)")
                else:
                    print(f"\nPer-subset widths recommended (variation {width_range:.1f}° > tolerance {WIDTH_TOLERANCE_DEG:.1f}°)")
            else:
                print(f"\nSingle subset analyzed - no global recommendation needed")
        
        # Limitations
        print(f"\nLIMITATIONS")
        print("No ground truth (we don't know which pulses should be franked).")
        print("This aligns the window to where franking already happens, keeps most of those inside,")
        print("and keeps franking low elsewhere.")
        
        con.close()
        
    except Exception as e:
        print(f"Fatal error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())

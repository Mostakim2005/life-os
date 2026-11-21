#!/usr/bin/env python3
"""
Life OS v3.0 - Offline Analytics & Monthly Report Generator
Parses standard inline Markdown fields ([sleep:: ...], [water_liters:: ...], [status:: ...])
from DD-MM-YYYY.md daily notes and exports monthly CSV summaries and matplotlib trend charts.
"""

import argparse
import csv
import datetime
import os
import re
import sys
from pathlib import Path


def parse_arguments():
    parser = argparse.ArgumentParser(description="Life OS Monthly Analytics Generator")
    parser.add_argument(
        "--vault-folder",
        type=str,
        default="Life OS",
        help="Path or subfolder holding DD-MM-YYYY.md daily notes (default: 'Life OS')",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to analyze (default: 30)",
    )
    return parser.parse_args()


def extract_daily_record(file_path: Path):
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        print(f"Warning: could not read {file_path}: {e}", file=sys.stderr)
        return None

    # Parse date from filename: DD-MM-YYYY
    stem = file_path.stem
    try:
        date_obj = datetime.datetime.strptime(stem, "%d-%m-%Y").date()
    except ValueError:
        return None

    # Regex field extraction
    sleep_match = re.search(r"\[sleep::\s*([0-9.]+)\]", content)
    water_liters_match = re.search(r"\[water_liters::\s*([0-9.]+)\]", content)
    water_glasses_match = re.search(r"\[water::\s*([0-9]+)\]", content)

    sleep = float(sleep_match.group(1)) if sleep_match else None
    water_liters = float(water_liters_match.group(1)) if water_liters_match else None
    if water_liters is None and water_glasses_match:
        water_liters = round(int(water_glasses_match.group(1)) * 0.25, 2)

    # Prayer statuses
    prayers = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]
    prayer_status = {}
    prayed_count = 0
    jamaah_count = 0

    for p in prayers:
        pattern = rf"-\s*\[([ xX])\]\s*{p}\b[^\[\n]*(?:\[status::\s*([a-zA-Z]+)\])?"
        m = re.search(pattern, content)
        if m:
            is_checked = m.group(1).lower() == "x"
            status = (m.group(2) or "").lower()
            if is_checked or status in ("prayed", "jamaah", "late"):
                prayed_count += 1
                if status == "jamaah":
                    jamaah_count += 1
            prayer_status[p] = status if status else ("prayed" if is_checked else "missed")
        else:
            prayer_status[p] = "none"

    return {
        "date": date_obj,
        "date_str": date_obj.strftime("%d-%m-%Y"),
        "iso_date": date_obj.isoformat(),
        "sleep": sleep,
        "water_liters": water_liters,
        "prayers_done": prayed_count,
        "prayers_jamaah": jamaah_count,
        "fajr": prayer_status.get("Fajr", "none"),
        "dhuhr": prayer_status.get("Dhuhr", "none"),
        "asr": prayer_status.get("Asr", "none"),
        "maghrib": prayer_status.get("Maghrib", "none"),
        "isha": prayer_status.get("Isha", "none"),
    }


def main():
    args = parse_arguments()
    vault_path = Path(args.vault_folder)
    if not vault_path.exists():
        print(f"Directory not found: {vault_path}. Searching current directory...", file=sys.stderr)
        vault_path = Path(".")

    # Gather matching DD-MM-YYYY.md files
    md_files = list(vault_path.glob("*.md")) + list(vault_path.glob("**/*.md"))
    records = []
    for f in md_files:
        rec = extract_daily_record(f)
        if rec:
            records.append(rec)

    # Sort chronologically
    records.sort(key=lambda r: r["date"])

    # Slice to requested days window
    if args.days > 0 and len(records) > args.days:
        records = records[-args.days:]

    if not records:
        print(f"No valid DD-MM-YYYY daily note records found in {vault_path}.")
        return

    # Ensure export directory exists
    export_dir = vault_path / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    csv_file = export_dir / "monthly-summary.csv"
    png_file = export_dir / "monthly-trends.png"

    # Compute 7-day rolling averages
    for i, r in enumerate(records):
        window = records[max(0, i - 6) : i + 1]
        valid_sleep = [w["sleep"] for w in window if w["sleep"] is not None]
        valid_water = [w["water_liters"] for w in window if w["water_liters"] is not None]
        r["sleep_rolling_7d"] = round(sum(valid_sleep) / len(valid_sleep), 2) if valid_sleep else None
        r["water_rolling_7d"] = round(sum(valid_water) / len(valid_water), 2) if valid_water else None

    # Write monthly-summary.csv
    fieldnames = [
        "date_str",
        "iso_date",
        "sleep",
        "sleep_rolling_7d",
        "water_liters",
        "water_rolling_7d",
        "prayers_done",
        "prayers_jamaah",
        "fajr",
        "dhuhr",
        "asr",
        "maghrib",
        "isha",
    ]
    with open(csv_file, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in records:
            writer.writerow(r)

    print(f"[OK] Summary CSV exported to: {csv_file}")

    # Generate matplotlib trends if available
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.dates as mdates

        fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(10, 8), sharex=True)
        fig.patch.set_facecolor("#1e1e2e")
        for ax in (ax1, ax2, ax3):
            ax.set_facecolor("#181825")
            ax.tick_params(colors="#cdd6f4")
            ax.xaxis.label.set_color("#cdd6f4")
            ax.yaxis.label.set_color("#cdd6f4")
            ax.title.set_color("#cdd6f4")
            for spine in ax.spines.values():
                spine.set_color("#45475a")

        dates = [r["date"] for r in records]
        sleep_vals = [r["sleep"] or 0 for r in records]
        sleep_7d = [r["sleep_rolling_7d"] or 0 for r in records]
        water_vals = [r["water_liters"] or 0 for r in records]
        water_7d = [r["water_rolling_7d"] or 0 for r in records]
        prayers_done = [r["prayers_done"] for r in records]
        prayers_jamaah = [r["prayers_jamaah"] for r in records]

        # Panel 1: Sleep
        ax1.bar(dates, sleep_vals, color="#89b4fa", alpha=0.6, label="Sleep (h)")
        ax1.plot(dates, sleep_7d, color="#fab387", linewidth=2, label="7d Rolling Avg")
        ax1.axhline(7.5, color="#f38ba8", linestyle="--", linewidth=1.2, label="Goal (7.5h)")
        ax1.set_ylabel("Hours")
        ax1.set_title("Sleep Consistency Trend")
        ax1.legend(loc="upper left", facecolor="#1e1e2e", edgecolor="#45475a", labelcolor="#cdd6f4")

        # Panel 2: Hydration
        ax2.bar(dates, water_vals, color="#94e2d5", alpha=0.6, label="Hydration (L)")
        ax2.plot(dates, water_7d, color="#a6e3a1", linewidth=2, label="7d Rolling Avg")
        ax2.axhline(2.5, color="#f38ba8", linestyle="--", linewidth=1.2, label="Goal (2.5L)")
        ax2.set_ylabel("Liters")
        ax2.set_title("Daily Hydration Trend")
        ax2.legend(loc="upper left", facecolor="#1e1e2e", edgecolor="#45475a", labelcolor="#cdd6f4")

        # Panel 3: Prayers
        ax3.bar(dates, prayers_done, color="#a6e3a1", alpha=0.7, label="Completed (/5)")
        ax3.bar(dates, prayers_jamaah, color="#cba6f7", alpha=0.8, label="Jamaah")
        ax3.set_ylim(0, 5.5)
        ax3.set_ylabel("Prayers")
        ax3.set_title("Daily Prayer Completion & Jamaah")
        ax3.legend(loc="upper left", facecolor="#1e1e2e", edgecolor="#45475a", labelcolor="#cdd6f4")

        ax3.xaxis.set_major_formatter(mdates.DateFormatter("%d %b"))
        fig.autofmt_xdate()
        plt.tight_layout()
        plt.savefig(png_file, dpi=180, facecolor=fig.get_facecolor())
        plt.close()
        print(f"[OK] Trend charts exported to: {png_file}")
    except ImportError:
        print("[NOTE] matplotlib is not installed in the active Python environment. CSV was generated successfully; install matplotlib to also generate PNG charts.")


if __name__ == "__main__":
    main()

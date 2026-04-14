#!/usr/bin/env python3
"""
ENAZIZI — NIH Chest X-ray Ingest Orchestrator
===============================================
Downloads the NIH dataset via kagglehub, filters pathologies relevant
to Brazilian medical residency exams, and calls the ingest-nih-xrays
edge function in controlled batches.

Usage:
  pip install kagglehub pandas requests
  python nih_xray_orchestrator.py --max-per-pathology 10 --batch-size 3

Environment:
  SUPABASE_URL          – e.g. https://xxx.supabase.co
  SUPABASE_ANON_KEY     – publishable anon key
"""

import os
import sys
import json
import time
import argparse
import hashlib
from pathlib import Path
from typing import List, Dict

import pandas as pd
import requests

# ── Config ──────────────────────────────────────────────────────────
EDGE_FN_PATH = "/functions/v1/ingest-nih-xrays"

PRIORITY_PATHOLOGIES = [
    "Pneumonia", "Pneumothorax", "Cardiomegaly", "Effusion",
    "Consolidation", "Edema", "Atelectasis", "Mass", "Nodule",
    "Emphysema", "Fibrosis", "Pleural_Thickening", "Hernia",
    "Infiltration",
]


def get_dataset_path() -> str:
    """Download NIH Chest X-ray dataset via kagglehub."""
    try:
        import kagglehub
        path = kagglehub.dataset_download("nih-chest-xrays/data")
        print(f"✓ Dataset at: {path}")
        return path
    except Exception as e:
        print(f"✗ kagglehub download failed: {e}")
        print("  Ensure KAGGLE_USERNAME and KAGGLE_KEY env vars are set.")
        sys.exit(1)


def load_and_filter(dataset_path: str, max_per_pathology: int) -> pd.DataFrame:
    """Load the NIH CSV labels and select best candidates per pathology."""
    csv_candidates = [
        os.path.join(dataset_path, "Data_Entry_2017_v2020.csv"),
        os.path.join(dataset_path, "Data_Entry_2017.csv"),
    ]
    csv_path = None
    for c in csv_candidates:
        if os.path.exists(c):
            csv_path = c
            break
    if not csv_path:
        # search recursively
        for root, _, files in os.walk(dataset_path):
            for f in files:
                if "Data_Entry" in f and f.endswith(".csv"):
                    csv_path = os.path.join(root, f)
                    break
            if csv_path:
                break
    if not csv_path:
        print("✗ Could not find NIH labels CSV in dataset.")
        sys.exit(1)

    print(f"  Loading labels: {csv_path}")
    df = pd.read_csv(csv_path)
    print(f"  Total images: {len(df)}")

    # Explode multi-label rows (e.g. "Pneumonia|Effusion")
    df["labels"] = df["Finding Labels"].str.split("|")
    exploded = df.explode("labels")

    # Keep only single-label for cleaner pedagogy
    single_label = df[df["Finding Labels"].apply(lambda x: "|" not in str(x))].copy()
    single_label["pathology"] = single_label["Finding Labels"]

    selected = []
    for pathology in PRIORITY_PATHOLOGIES:
        subset = single_label[single_label["pathology"] == pathology]
        if len(subset) == 0:
            print(f"  ⚠ No single-label entries for {pathology}")
            continue
        # Prefer PA view, varied patients
        pa = subset[subset["View Position"] == "PA"]
        pool = pa if len(pa) >= max_per_pathology else subset
        sample = pool.sample(n=min(max_per_pathology, len(pool)), random_state=42)
        sample = sample.copy()
        sample["pathology"] = pathology
        selected.append(sample)
        print(f"  ✓ {pathology}: {len(sample)} images selected")

    if not selected:
        print("✗ No images selected.")
        sys.exit(1)

    result = pd.concat(selected, ignore_index=True)
    print(f"\n  Total selected: {len(result)} images across {len(selected)} pathologies\n")
    return result


def find_image_file(dataset_path: str, filename: str) -> str | None:
    """Locate the actual image file in the dataset directory tree."""
    # NIH dataset has images in subdirectories like images_001/, images_002/, ...
    for root, _, files in os.walk(dataset_path):
        if filename in files:
            return os.path.join(root, filename)
    return None


def upload_to_storage(supabase_url: str, anon_key: str, filepath: str, dest_path: str) -> str | None:
    """Upload image to Supabase Storage and return public URL."""
    with open(filepath, "rb") as f:
        data = f.read()

    url = f"{supabase_url}/storage/v1/object/question-images/{dest_path}"
    resp = requests.post(url, headers={
        "Authorization": f"Bearer {anon_key}",
        "apikey": anon_key,
        "Content-Type": "image/png",
        "x-upsert": "true",
    }, data=data)

    if resp.status_code in (200, 201):
        return f"{supabase_url}/storage/v1/object/public/question-images/{dest_path}"
    else:
        print(f"    ✗ Upload failed ({resp.status_code}): {resp.text[:200]}")
        return None


def call_edge_function(supabase_url: str, anon_key: str, batch: List[Dict]) -> Dict:
    """Call the ingest-nih-xrays edge function with a batch."""
    url = f"{supabase_url}{EDGE_FN_PATH}"
    resp = requests.post(url, headers={
        "Authorization": f"Bearer {anon_key}",
        "apikey": anon_key,
        "Content-Type": "application/json",
    }, json={"batch": batch}, timeout=120)

    if resp.status_code == 200:
        return resp.json()
    else:
        return {"error": f"HTTP {resp.status_code}: {resp.text[:300]}"}


def main():
    parser = argparse.ArgumentParser(description="ENAZIZI NIH X-ray Ingest Orchestrator")
    parser.add_argument("--max-per-pathology", type=int, default=5, help="Max images per pathology (default: 5)")
    parser.add_argument("--batch-size", type=int, default=3, help="Batch size for edge function calls (default: 3)")
    parser.add_argument("--dry-run", action="store_true", help="Only filter and print, don't ingest")
    parser.add_argument("--dataset-path", type=str, default=None, help="Skip download, use existing path")
    parser.add_argument("--upload-first", action="store_true", default=True, help="Upload images to Storage before calling edge fn")
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")

    if not supabase_url or not anon_key:
        print("✗ Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.")
        sys.exit(1)

    print("=" * 60)
    print("ENAZIZI — NIH Chest X-ray Ingest Pipeline")
    print("=" * 60)

    # Step 1: Get dataset
    dataset_path = args.dataset_path or get_dataset_path()

    # Step 2: Filter
    selected = load_and_filter(dataset_path, args.max_per_pathology)

    if args.dry_run:
        print("\n[DRY RUN] Would ingest these images:")
        for _, row in selected.iterrows():
            print(f"  {row['Image Index']} → {row['pathology']}")
        print(f"\nTotal: {len(selected)} images")
        return

    # Step 3: Process in batches
    print("Starting ingestion...\n")
    total_ingested = 0
    total_questions = 0
    total_failed = 0
    log_entries = []

    rows = selected.to_dict("records")
    for i in range(0, len(rows), args.batch_size):
        batch_rows = rows[i:i + args.batch_size]
        batch_items = []

        for row in batch_rows:
            filename = row["Image Index"]
            pathology = row["pathology"]
            patient_id = str(row.get("Patient ID", ""))

            # Find and upload image
            img_path = find_image_file(dataset_path, filename)
            if not img_path:
                print(f"  ✗ Image not found: {filename}")
                total_failed += 1
                continue

            safe_name = filename.replace("/", "_").replace(" ", "_")
            dest = f"xray/nih_{pathology}_{safe_name}"
            print(f"  ↑ Uploading {filename} ({pathology})...")
            public_url = upload_to_storage(supabase_url, anon_key, img_path, dest)
            if not public_url:
                total_failed += 1
                continue

            batch_items.append({
                "image_url": public_url,
                "filename": filename,
                "pathology": pathology,
                "patient_id": patient_id,
            })

        if not batch_items:
            continue

        print(f"  → Calling edge function with {len(batch_items)} items...")
        result = call_edge_function(supabase_url, anon_key, batch_items)

        if "error" in result:
            print(f"  ✗ Edge function error: {result['error']}")
            total_failed += len(batch_items)
        else:
            summary = result.get("summary", {})
            total_ingested += summary.get("ingested", 0)
            total_questions += summary.get("questions_total", 0)
            total_failed += summary.get("failed", 0)
            print(f"  ✓ Ingested: {summary.get('ingested', 0)} | Questions: {summary.get('questions_total', 0)}")

            for r in result.get("results", []):
                log_entries.append(r)

        # Rate limit between batches
        time.sleep(3)

    # Summary
    print("\n" + "=" * 60)
    print("PIPELINE SUMMARY")
    print("=" * 60)
    print(f"  Total processed:  {len(rows)}")
    print(f"  Ingested:         {total_ingested}")
    print(f"  Questions:        {total_questions}")
    print(f"  Failed:           {total_failed}")
    print("=" * 60)

    # Save log
    log_path = Path("nih_ingest_log.json")
    log_path.write_text(json.dumps(log_entries, indent=2, ensure_ascii=False))
    print(f"\nLog saved: {log_path}")


if __name__ == "__main__":
    main()

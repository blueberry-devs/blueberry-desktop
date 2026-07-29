#!/usr/bin/env python3
"""
build-vectors.py — Process AcousticBrainz low-level features into 128-dim embeddings.

Usage:
    python scripts/build-vectors.py --input <path_to_csv> --output <path_to_vectors.json>

The script reads AcousticBrainz low-level feature CSVs and produces:
  - resources/vectors.json    — { mbid: [f32; 128] } embeddings
  - resources/mbid-map.json   — { "artist::title": mbid } lookup

Vector layout (128 floats):
  [0]   bpm (normalized 60-200 → 0-1)
  [1]   danceability (0-1)
  [2]   sin(key * 2π/12)
  [3]   cos(key * 2π/12)
  [4]   scale (major=1, minor=0)
  [5]   average_loudness (normalized)
  [6]   dynamic_complexity (normalized)
  [7]   onset_rate (normalized 0-5 → 0-1)
  [8]   tuning_frequency (normalized 430-450 → 0-1)
  [9]   energy estimate (derived from loudness + onset)
  [10]  valence estimate (derived from key + mode)
  [11-42]  artist feature hash (32 dims)
  [43-74]  genre feature hash (32 dims)
  [75-127] title feature hash (53 dims)
"""

import argparse
import csv
import hashlib
import json
import math
import os
import sys
from collections import defaultdict
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

KEY_MAP = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
}

VECTOR_SIZE = 128

# Genre keywords for multi-hot encoding (same categories as the frontend)
GENRE_KEYWORDS = {
    'pop': ['pop', 'britney', 'taylor', 'swift', 'bieber', 'gaga', 'katy', 'perry',
            'rihanna', 'bruno', 'mars', 'ariana', 'grande', 'billie', 'eilish', 'dua', 'lipa'],
    'rock': ['rock', 'nirvana', 'pearl jam', 'foo fighters', 'guns n roses', 'ac/dc',
             'led zeppelin', 'pink floyd', 'queen', 'rolling stones', 'green day',
             'linkin park', 'imagine dragons', 'radiohead'],
    'metal': ['metal', 'metallica', 'slipknot', 'iron maiden', 'megadeth', 'pantera',
              'system of a down', 'rammstein', 'disturbed', 'korn', 'avenged sevenfold',
              'judas priest', 'black sabbath', 'motorhead'],
    'hiphop': ['hip hop', 'hip-hop', 'eminem', 'kanye', 'kendrick', 'lamar', 'drake',
               'j. cole', 'travis scott', 'lil', 'cardi b', 'nicki minaj', 'future', '21 savage'],
    'edm': ['edm', 'electronic', 'dance', 'david guetta', 'avicii', 'martin garrix',
            'kygo', 'calvin harris', 'swedish house', 'tiesto', 'skrillex', 'deadmau5'],
    'chill': ['chill', 'lo-fi', 'lofi', 'ambient', 'relax', 'chillstep', 'sleep', 'meditation'],
    'jazz': ['jazz', 'soul', 'rnb', 'r&b', 'blues', 'funk', 'miles davis',
             'louis armstrong', 'ella fitzgerald', 'john coltrane'],
    'classical': ['classical', 'beethoven', 'bach', 'mozart', 'chopin', 'vivaldi',
                  'tchaikovsky', 'debussy', 'rachmaninoff', 'orchestra', 'symphony', 'piano'],
    'indie': ['indie', 'arcade fire', 'arctic monkeys', 'tame impala', 'mac demarco',
              'vampire weekend', 'the strokes', 'modest mouse', 'pixies', 'bon iver', 'alt-j'],
    'folk': ['folk', 'acoustic', 'country', 'king of leon', 'mumford', 'sons',
             'lumineers', 'hozier', 'ed sheeran', 'vance joy'],
    'workout': ['workout', 'exercise', 'rocky', 'survivor', 'eminem lose yourself',
                'dmx', 'rage', 'hard rock', 'heavy'],
    'mix': ['mix', 'random', 'popular', 'modern', 'alternative'],
}

# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

def normalize(value, min_val, max_val):
    """Normalize value to 0-1 range."""
    if max_val <= min_val:
        return 0.0
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))


def key_to_sin_cos(key_str):
    """Convert key string to sin/cos pair."""
    key_num = KEY_MAP.get(key_str, 0)
    angle = key_num * 2 * math.pi / 12
    return math.sin(angle), math.cos(angle)


def feature_hash(text, size):
    """Feature hashing: map text to fixed-size vector using MD5."""
    vec = [0.0] * size
    if not text:
        return vec
    text = text.lower().strip()
    for i in range(size):
        h = hashlib.md5(f"{text}_{i}".encode()).hexdigest()
        # Convert first 8 hex chars to float in [-1, 1]
        val = (int(h[:8], 16) / 0xFFFFFFFF) * 2 - 1
        vec[i] = val
    return vec


def detect_genre(artist, title):
    """Detect genre from artist and title text."""
    text = f"{artist} {title}".lower()
    scores = {}
    for genre, keywords in GENRE_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[genre] = score
    if not scores:
        return None
    return max(scores, key=scores.get)


def build_vector(row):
    """Build 128-dim vector from AcousticBrainz row."""
    vec = [0.0] * VECTOR_SIZE

    # [0] BPM (normalized 60-200)
    bpm = float(row.get('rhythm.bpm', 0) or 0)
    vec[0] = normalize(bpm, 60, 200)

    # [1] Danceability
    vec[1] = float(row.get('rhythm.danceability', 0) or 0)

    # [2-3] Key as sin/cos
    key_str = row.get('tonal.key_key', 'C') or 'C'
    sin_key, cos_key = key_to_sin_cos(key_str)
    vec[2] = sin_key
    vec[3] = cos_key

    # [4] Scale (major=1, minor=0)
    scale = row.get('tonal.key_scale', 'minor') or 'minor'
    vec[4] = 1.0 if scale.lower() == 'major' else 0.0

    # [5] Average loudness
    vec[5] = float(row.get('lowlevel.average_loudness', 0) or 0)

    # [6] Dynamic complexity
    vec[6] = float(row.get('lowlevel.dynamic_complexity', 0) or 0)

    # [7] Onset rate (normalized 0-5)
    onset = float(row.get('rhythm.onset_rate', 0) or 0)
    vec[7] = normalize(onset, 0, 5)

    # [8] Tuning frequency (normalized 430-450)
    tuning = float(row.get('tonal.tuning_frequency', 440) or 440)
    vec[8] = normalize(tuning, 430, 450)

    # [9] Energy estimate (derived from loudness + onset)
    vec[9] = (vec[5] * 0.6 + vec[7] * 0.4)

    # [10] Valence estimate (major = happier, higher BPM = more energetic)
    vec[10] = (vec[4] * 0.5 + vec[0] * 0.3 + vec[1] * 0.2)

    # [11-42] Artist feature hash (32 dims)
    artist = row.get('metadata.tags.artist', '') or ''
    vec[11:43] = feature_hash(artist, 32)

    # [43-74] Genre feature hash (32 dims)
    genre = detect_genre(artist, row.get('metadata.tags.title', '') or '')
    vec[43:75] = feature_hash(genre or 'unknown', 32)

    # [75-127] Title feature hash (53 dims)
    title = row.get('metadata.tags.title', '') or ''
    vec[75:128] = feature_hash(title, 53)

    # L2 normalize
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]

    return vec


# ---------------------------------------------------------------------------
# CSV processing
# ---------------------------------------------------------------------------

def process_csv(csv_path, output_dir, max_entries=100000):
    """Process AcousticBrainz CSV and build vectors."""
    vectors = {}
    mbid_map = {}

    print(f"Processing {csv_path}...")
    count = 0

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if count >= max_entries:
                print(f"  Reached {max_entries} entries, stopping.")
                break

            mbid = row.get('mbid', '').strip()
            if not mbid:
                continue

            try:
                vec = build_vector(row)
                vectors[mbid] = vec

                # Build artist::title → mbid lookup
                artist = (row.get('metadata.tags.artist', '') or '').lower().strip()
                title = (row.get('metadata.tags.title', '') or '').lower().strip()
                if artist and title:
                    key = f"{artist}::{title}"
                    mbid_map[key] = mbid

                count += 1
                if count % 10000 == 0:
                    print(f"  Processed {count} entries...")
            except Exception as e:
                print(f"  Warning: skipping {mbid}: {e}")
                continue

    print(f"Total: {count} vectors built.")

    # Save vectors.json
    vectors_path = os.path.join(output_dir, 'vectors.json')
    with open(vectors_path, 'w', encoding='utf-8') as f:
        json.dump(vectors, f)
    print(f"Saved vectors to {vectors_path}")

    # Save mbid-map.json
    map_path = os.path.join(output_dir, 'mbid-map.json')
    with open(map_path, 'w', encoding='utf-8') as f:
        json.dump(mbid_map, f)
    print(f"Saved mbid map to {map_path}")

    return vectors, mbid_map


# ---------------------------------------------------------------------------
# Mood vectors (for server-side filtering)
# ---------------------------------------------------------------------------

def build_mood_vectors():
    """Build representative vectors for each mood category.
    
    These are used server-side to filter candidates by mood.
    Each mood is represented as the average vector of its genre's tracks.
    """
    mood_vectors = {}
    for genre in GENRE_KEYWORDS:
        # Create a representative vector for this genre
        # using feature hashing of genre keywords
        vec = [0.0] * VECTOR_SIZE
        keywords = GENRE_KEYWORDS[genre]
        for kw in keywords:
            h = feature_hash(kw, VECTOR_SIZE)
            vec = [a + b for a, b in zip(vec, h)]
        # L2 normalize
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        mood_vectors[genre] = vec
    return mood_vectors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Build track vectors from AcousticBrainz data')
    parser.add_argument('--input', '-i', help='Path to AcousticBrainz low-level features CSV')
    parser.add_argument('--output', '-o', default='resources', help='Output directory (default: resources)')
    parser.add_argument('--max-entries', '-n', type=int, default=100000, help='Max entries to process (default: 100k)')
    parser.add_argument('--mood-only', action='store_true', help='Only generate mood vectors (no CSV needed)')
    args = parser.parse_args()

    output_dir = os.path.join(os.path.dirname(__file__), '..', args.output)
    os.makedirs(output_dir, exist_ok=True)

    if args.mood_only:
        mood_vectors = build_mood_vectors()
        mood_path = os.path.join(output_dir, 'mood-vectors.json')
        with open(mood_path, 'w', encoding='utf-8') as f:
            json.dump(mood_vectors, f)
        print(f"Saved mood vectors to {mood_path}")
        return

    if not args.input:
        print("Error: --input is required (path to AcousticBrainz CSV)")
        print("Download from: https://acousticbrainz.org/download")
        print("Example: python scripts/build-vectors.py -i lowlevel_rhythm.csv -n 100000")
        sys.exit(1)

    if not os.path.exists(args.input):
        print(f"Error: file not found: {args.input}")
        sys.exit(1)

    process_csv(args.input, output_dir, args.max_entries)

    # Also build mood vectors
    mood_vectors = build_mood_vectors()
    mood_path = os.path.join(output_dir, 'mood-vectors.json')
    with open(mood_path, 'w', encoding='utf-8') as f:
        json.dump(mood_vectors, f)
    print(f"Saved mood vectors to {mood_path}")


if __name__ == '__main__':
    main()

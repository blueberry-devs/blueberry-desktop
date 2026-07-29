#!/usr/bin/env python3
"""Generate sample vectors.json + mbid-map.json + mood-vectors.json for testing."""

import json
import math
import random
import string

VECTOR_SIZE = 128
NUM_TRACKS = 10000

GENRES = ['pop', 'rock', 'metal', 'hiphop', 'edm', 'chill', 'jazz', 'classical', 'indie', 'folk']

ARTISTS_BY_GENRE = {
    'pop': ['Taylor Swift', 'Dua Lipa', 'The Weeknd', 'Billie Eilish', 'Ariana Grande',
            'Ed Sheeran', 'Bruno Mars', 'Doja Cat', 'Harry Styles', 'Lizzo'],
    'rock': ['Linkin Park', 'Foo Fighters', 'Green Day', 'Nirvana', 'Queen',
             'Led Zeppelin', 'Pink Floyd', 'AC/DC', 'Radiohead', 'Arctic Monkeys'],
    'metal': ['Metallica', 'Iron Maiden', 'Slipknot', 'System of a Down', 'Rammstein',
              'Disturbed', 'Megadeth', 'Black Sabbath', 'Pantera', 'Avenged Sevenfold'],
    'hiphop': ['Eminem', 'Kendrick Lamar', 'Drake', 'Travis Scott', 'Kanye West',
               'J. Cole', 'Lil Baby', 'Future', '21 Savage', 'Pusha T'],
    'edm': ['Avicii', 'Calvin Harris', 'Martin Garrix', 'David Guetta', 'Skrillex',
            'Deadmau5', 'Tiësto', 'Kygo', 'Marshmello', 'Zedd'],
    'chill': ['Khruangbin', 'Tycho', 'Bonobo', 'Emancipator', 'Nujabes',
              'Trevor Hall', 'Stick Figure', 'Collie Buddz', 'Rebelution', 'Slightly Stoopid'],
    'jazz': ['Miles Davis', 'John Coltrane', 'Bill Evans', 'Dave Brubeck', 'Thelonious Monk',
             'Herbie Hancock', 'Oscar Peterson', 'Chet Baker', 'Wes Montgomery', 'Charlie Parker'],
    'classical': ['Beethoven', 'Bach', 'Mozart', 'Chopin', 'Tchaikovsky',
                  'Debussy', 'Vivaldi', 'Rachmaninoff', 'Dvorak', 'Handel'],
    'indie': ['Tame Impala', 'Arctic Monkeys', 'Mac DeMarco', 'Bon Iver', 'The Strokes',
              'Glass Animals', 'Beach House', 'Phoebe Bridgers', 'Japanese Breakfast', 'Clairo'],
    'folk': ['Mumford & Sons', 'The Lumineers', 'Hozier', 'Ed Sheeran', 'Vance Joy',
             'Passenger', 'Of Monsters and Men', 'Fleet Foxes', 'Iron & Wine', 'James Taylor'],
}

TRACK_NAMES = [
    'Midnight Drive', 'Electric Dreams', 'Summer Nights', 'Lost in Tokyo',
    'Crystal Waves', 'Neon Lights', 'Fading Echoes', 'Wild Heart',
    'Broken Sky', 'Dancing Shadows', 'Ocean Breeze', 'City Lights',
    'Running Free', 'Silent Storm', 'Burning Bright', 'Endless Road',
    'Purple Rain', 'Golden Hour', 'Silver Lining', 'Frozen Lake',
    'Desert Sun', 'Mountain High', 'River Deep', 'Forest Green',
    'Winter Moon', 'Spring Rain', 'Autumn Leaves', 'Summer Sun',
    'Starlight', 'Moonlight', 'Sunrise', 'Sunset',
    'Thunder', 'Lightning', 'Hurricane', 'Tornado',
    'Fire', 'Ice', 'Wind', 'Rain',
    'Love', 'Hate', 'Dream', 'Reality',
    'Hope', 'Fear', 'Joy', 'Sorrow',
    'Peace', 'War', 'Life', 'Death',
    'Rhythm', 'Melody', 'Harmony', 'Silence',
    'Colors', 'Shadows', 'Reflections', 'Visions',
    'Journey', 'Destination', 'Path', 'Crossroads',
    'Time', 'Space', 'Gravity', 'Magnet',
]


def random_name():
    return random.choice(TRACK_NAMES) + ' ' + random.choice(['', 'Pt. II', 'Remix', 'Acoustic', 'Live', 'Edit', 'Deluxe'])


def feature_hash(text, size):
    import hashlib
    vec = [0.0] * size
    if not text:
        return vec
    for i in range(size):
        h = hashlib.md5(f"{text}_{i}".encode()).hexdigest()
        val = (int(h[:8], 16) / 0xFFFFFFFF) * 2 - 1
        vec[i] = val
    return vec


def generate_track_vector(genre):
    vec = [0.0] * VECTOR_SIZE

    # Genre-specific acoustic properties
    genre_props = {
        'pop':       {'bpm': 120, 'dance': 0.7, 'energy': 0.6, 'valence': 0.7},
        'rock':      {'bpm': 130, 'dance': 0.5, 'energy': 0.7, 'valence': 0.5},
        'metal':     {'bpm': 140, 'dance': 0.3, 'energy': 0.95, 'valence': 0.4},
        'hiphop':    {'bpm': 95,  'dance': 0.8, 'energy': 0.7, 'valence': 0.6},
        'edm':       {'bpm': 128, 'dance': 0.9, 'energy': 0.8, 'valence': 0.6},
        'chill':     {'bpm': 85,  'dance': 0.3, 'energy': 0.2, 'valence': 0.5},
        'jazz':      {'bpm': 110, 'dance': 0.4, 'energy': 0.35, 'valence': 0.5},
        'classical': {'bpm': 72,  'dance': 0.1, 'energy': 0.3, 'valence': 0.5},
        'indie':     {'bpm': 115, 'dance': 0.5, 'energy': 0.5, 'valence': 0.5},
        'folk':      {'bpm': 95,  'dance': 0.3, 'energy': 0.3, 'valence': 0.5},
    }

    props = genre_props[genre]

    # Add some randomness
    vec[0] = max(0, min(1, (props['bpm'] + random.gauss(0, 15)) / 200))
    vec[1] = max(0, min(1, props['dance'] + random.gauss(0, 0.1)))
    key = random.randint(0, 11)
    vec[2] = math.sin(key * 2 * math.pi / 12)
    vec[3] = math.cos(key * 2 * math.pi / 12)
    vec[4] = random.choice([0, 1])
    vec[5] = max(0, min(1, props['energy'] + random.gauss(0, 0.1)))
    vec[6] = max(0, min(1, random.random()))
    vec[7] = max(0, min(1, (props['energy'] * 0.7 + random.gauss(0, 0.1))))
    vec[8] = max(0, min(1, 0.5 + random.gauss(0, 0.05)))
    vec[9] = (vec[5] * 0.6 + vec[7] * 0.4)
    vec[10] = (vec[4] * 0.5 + vec[0] * 0.3 + vec[1] * 0.2)

    return vec


def l2_normalize(vec):
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def main():
    random.seed(42)

    print(f"Generating {NUM_TRACKS} sample track vectors...")
    vectors = {}
    mbid_map = {}

    for i in range(NUM_TRACKS):
        mbid = ''.join(random.choices(string.hexdigits[:16], k=32))
        genre = random.choice(GENRES)
        artist = random.choice(ARTISTS_BY_GENRE[genre])
        title = random_name()

        vec = generate_track_vector(genre)
        vec = l2_normalize(vec)
        vectors[mbid] = vec

        key = f"{artist.lower()}::{title.lower()}"
        mbid_map[key] = mbid

    # Save vectors.json
    vectors_path = 'resources/vectors.json'
    with open(vectors_path, 'w') as f:
        json.dump(vectors, f)
    print(f"Saved {len(vectors)} vectors to {vectors_path}")

    # Save mbid-map.json
    map_path = 'resources/mbid-map.json'
    with open(map_path, 'w') as f:
        json.dump(mbid_map, f)
    print(f"Saved {len(mbid_map)} mappings to {map_path}")

    # Generate mood vectors (average per genre)
    mood_vectors = {}
    genre_vecs = {}
    for mbid, vec in vectors.items():
        # Find genre from mbid map
        for key, mid in mbid_map.items():
            if mid == mbid:
                genre = key.split('::')[0]
                for g in GENRES:
                    if any(a.lower() == genre for a in ARTISTS_BY_GENRE[g]):
                        genre_vecs.setdefault(g, []).append(vec)
                        break
                break

    for genre, vecs in genre_vecs.items():
        avg = [0.0] * VECTOR_SIZE
        for v in vecs:
            for j in range(VECTOR_SIZE):
                avg[j] += v[j]
        n = len(vecs)
        avg = [x / n for x in avg]
        avg = l2_normalize(avg)
        mood_vectors[genre] = avg

    mood_path = 'resources/mood-vectors.json'
    with open(mood_path, 'w') as f:
        json.dump(mood_vectors, f)
    print(f"Saved {len(mood_vectors)} mood vectors to {mood_path}")

    print("\nSample data generated! You can now test the recommendation engine.")
    print("The vectors are random — for real recommendations, run build-vectors.py with AcousticBrainz data.")


if __name__ == '__main__':
    main()

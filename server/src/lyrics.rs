use crate::types::LrcLibEntry;

pub async fn search(http: &reqwest::Client, params: &[(&str, &str)]) -> Vec<LrcLibEntry> {
    let resp = http
        .get("https://lrclib.net/api/search")
        .header("User-Agent", "blueberry-desktop (https://github.com/blueberry-devs/blueberry-desktop)")
        .query(params)
        .send()
        .await;

    match resp {
        Ok(r) => r.json::<Vec<LrcLibEntry>>().await.unwrap_or_default(),
        _ => vec![],
    }
}

fn synced_line_count(entry: &LrcLibEntry) -> usize {
    entry
        .synced_lyrics
        .as_deref()
        .map(|s| s.lines().filter(|l| l.trim().starts_with('[')).count())
        .unwrap_or(0)
}

fn synced_first_ts(entry: &LrcLibEntry) -> f64 {
    if let Some(ref synced) = entry.synced_lyrics {
        for line in synced.lines() {
            let line = line.trim();
            if line.starts_with('[') {
                if let Some(end) = line.find(']') {
                    let stamp = &line[1..end];
                    if let Some((mm, ss)) = stamp.split_once(':') {
                        if let (Ok(m), Ok(s)) = (mm.parse::<f64>(), ss.parse::<f64>()) {
                            return m * 60.0 + s;
                        }
                    }
                }
            }
        }
    }
    10_000.0
}

pub fn pick_best(results: Vec<LrcLibEntry>, duration: Option<f64>) -> Option<LrcLibEntry> {
    if results.is_empty() {
        return None;
    }
    let synced: Vec<&LrcLibEntry> = results.iter().filter(|d| d.synced_lyrics.is_some()).collect();
    if !synced.is_empty() {
        let mut sorted = synced.clone();
        sorted.sort_by_key(|d| {
            let dur_gap = duration
                .map(|dur| (d.duration.unwrap_or(0.0) - dur).abs() as i64)
                .unwrap_or(0);
            (
                -(synced_line_count(d) as i64),
                (synced_first_ts(d) * 100.0) as i64,
                dur_gap,
            )
        });
        return sorted.into_iter().next().cloned();
    }
    let pool: Vec<&LrcLibEntry> = if results.iter().any(|d| d.plain_lyrics.is_some()) {
        results.iter().filter(|d| d.plain_lyrics.is_some()).collect()
    } else {
        results.iter().collect()
    };
    if pool.is_empty() {
        return None;
    }
    let mut pool = pool;
    if let Some(dur) = duration {
        pool.sort_by_key(|d| ((d.duration.unwrap_or(0.0) - dur).abs() * 100.0) as i64);
    }
    pool.into_iter().next().cloned()
}

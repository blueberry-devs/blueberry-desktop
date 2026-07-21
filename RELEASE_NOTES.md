### Discord RPC
- App now always visible in Discord activities — even when nothing is playing (Idle state)
- Activity type set to **Listening to** (instead of Playing)
- Paused: album art + pause icon, no timer, ⏸ Paused label
- Playing: album art + play icon, elapsed timer shown
- Three duplicate PlayerContext functions merged into one

### Logging
- All `console.*` calls replaced with **electron-log**
- Empty `catch` blocks now log errors instead of swallowing them
- Logs written to `%APPDATA%/Yandex-Music/logs/`

### CI/CD
- **New Release workflow** — manual trigger with version bump (patch/minor/major/skip) and release notes
- Builds for Windows, macOS, Linux with optional code signing
- Release notes read from `RELEASE_NOTES.md` + auto-generated commit log
- `tsconfig.*.tsbuildinfo` removed from git tracking

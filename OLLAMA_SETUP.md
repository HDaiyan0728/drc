# Optional Ollama column matching

## Architecture

Vercel hosts the static reconciliation application. Ollama does **not** run inside this Vercel project. Each user runs Ollama locally, and the browser calls `http://127.0.0.1:11434`.

The normal deterministic matcher remains the fallback. `ollama-column-matcher.js` adds:

- semantic ranking with `embeddinggemma`
- structured review with `qwen3:8b`
- filename, sheet name, detected type, and sample values in each review
- semantic-risk checks
- no full workbook upload to the model

## Install locally

```bash
ollama pull embeddinggemma
ollama pull qwen3:8b
```

Allow your deployed Vercel origin in Ollama, then restart Ollama. Replace the example domain:

### Windows PowerShell

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "https://your-project.vercel.app", "User")
```

Quit Ollama from the system tray and reopen it.

### macOS

```bash
launchctl setenv OLLAMA_ORIGINS "https://your-project.vercel.app"
```

Quit and reopen the Ollama app.

### Linux systemd

```bash
sudo systemctl edit ollama
```

Add:

```ini
[Service]
Environment="OLLAMA_ORIGINS=https://your-project.vercel.app"
```

Then run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

## Test from the browser console

```javascript
await OllamaColumnMatcher.health()
```

Expected:

```javascript
{ ok: true, version: "..." }
```

## Important

The helper is loaded by `index.html`, but it is intentionally not allowed to silently overwrite mappings. Connect `improveMappings(...)` after the existing deterministic mapping stage and show the AI result as a suggestion requiring confirmation.

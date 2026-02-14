# S3 CORS for PDF uploads

If you get **"Failed to fetch"** when uploading a PDF, the browser is almost certainly blocking the **PUT** request to S3 because the bucket has no CORS config.

## Fix

1. Open **AWS Console** → **S3** → your bucket (e.g. `iba-hackathon-abbas`).
2. Go to **Permissions** → **Cross-origin resource sharing (CORS)** → **Edit**.
3. Paste the config below (adjust `AllowedOrigins` if you use a different URL for the app).

### CORS configuration

Use the **exact** origin your browser uses for the app (see the address bar).

- App at `http://localhost:3000`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "http://127.0.0.1:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

- If you open the app via network URL (e.g. `http://192.168.100.74:3000`), add that origin:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://192.168.100.74:3000"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

4. Save. Try the upload again.

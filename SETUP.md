# Setup Instructions for Toyota API Integration

## Netlify Environment Variables

Add these environment variables in your Netlify dashboard (Site settings → Environment variables):

### Required Variables:

1. **`TOYOTA_USERNAME`**
   - Your Toyota Connected Services email/username
   - Example: `your.email@example.com`

2. **`TOYOTA_PASSWORD`**
   - Your Toyota Connected Services password
   - Make sure to mark this as "Sensitive" in Netlify

3. **`GOOGLE_SERVICE_ACCOUNT`** (already exists)
   - Your Google Service Account JSON credentials for Google Sheets access

## Google Sheet Structure Update

Your Google Sheet needs a new column for tracking the data source:

1. Open your Google Sheet: `1QvIQpN0Yr4dee1aNf3_ubwyWpWCIULfRWOOAqWAmywM`
2. Add a new column **E** with header: `source`
3. The column will contain either:
   - `manual` - for manually entered records
   - `API` - for records fetched from Toyota API

**Current columns:**
- A: id
- B: date
- C: totalKm
- D: createdAt
- E: source (NEW)

## Testing

1. The app will work with manual entry even if API fails
2. When API fetch fails, you'll see an error message but can still enter data manually
3. API-fetched entries will show a green "API" badge in the history

## Troubleshooting

- If API fetch fails, check Netlify function logs
- Ensure environment variables are set correctly
- Verify Toyota credentials are correct
- Check that the Google Sheet has the `source` column added


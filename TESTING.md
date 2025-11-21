# Testing Guide

## Quick Start - Local Testing

### Option 1: Test with Netlify Dev (Recommended)

This will run both the React app AND the Netlify functions locally with real API calls:

```bash
cd /Users/vituhy/Documents/JavaScript_HTML/toyota-evidence-kilometru

# Install Netlify CLI if you haven't already
npm install -g netlify-cli

# Start Netlify Dev (runs React app + functions)
netlify dev
```

This will:
- Start React app on `http://localhost:8888`
- Run Netlify functions locally
- Use credentials from `../pytoyoda/sandbox/credentials.json` automatically
- Make REAL API calls to Toyota

### Option 2: Test Function Only (Node.js script)

Test just the API function with credentials.json:

```bash
cd /Users/vituhy/Documents/JavaScript_HTML/toyota-evidence-kilometru
node test-api-local.js
```

This will:
- Load credentials from `../pytoyoda/sandbox/credentials.json`
- Test the fetch-mileage function
- Show the result in console

### Option 3: React App Only (Mock Data)

```bash
cd /Users/vituhy/Documents/JavaScript_HTML/toyota-evidence-kilometru
npm start
```

This will:
- Start React app on `http://localhost:3000`
- Use mock data (8007 km) for API calls
- Test UI/UX without real API calls

## Step-by-Step Testing

### 1. Test API Function Directly

```bash
# Make sure credentials.json exists
ls ../pytoyoda/sandbox/credentials.json

# Run test script
node test-api-local.js
```

Expected output:
```
✓ Loaded credentials from: ...
🧪 Testing Toyota API mileage fetch...
📊 Response Status: 200
✅ SUCCESS!
   Mileage: 8,007 km
   Vehicle: 2023 Toyota Corolla HB/TS - MC '23
```

### 2. Test Full App with Netlify Dev

```bash
# Start Netlify Dev
netlify dev
```

Then in browser (`http://localhost:8888`):

1. **Test Manual Entry:**
   - Click "+" button
   - Enter date and mileage
   - Click "Přidat záznam"
   - ✅ Verify entry appears (no API badge)

2. **Test API Fetch:**
   - Close form if open
   - Click "Načíst z Toyota API" button
   - ✅ Button shows "Načítání z API..."
   - ✅ Success message appears
   - ✅ Form opens with REAL mileage
   - ✅ Click "Přidat záznam"
   - ✅ Entry shows API badge in history

### 3. Test Error Handling

To test errors, you can:
- Temporarily rename credentials.json
- Use wrong credentials
- Check that error messages appear
- Verify manual entry still works

## Testing Checklist

### API Function
- [ ] `node test-api-local.js` returns success
- [ ] Real mileage is fetched
- [ ] Vehicle info is correct
- [ ] Errors are handled gracefully

### UI - Manual Entry
- [ ] Can add new record manually
- [ ] Date defaults to today
- [ ] Entry appears in history
- [ ] Entry has NO API badge

### UI - API Fetch
- [ ] Button appears when form is closed
- [ ] Loading state shows during fetch
- [ ] Success message appears
- [ ] Form auto-opens with fetched data
- [ ] Can save API-fetched entry
- [ ] API entry shows badge in history

### Error Handling
- [ ] Error messages display clearly
- [ ] Manual entry still works after error
- [ ] Error messages are user-friendly

## Debugging

### Check Function Logs (Netlify Dev)
- Terminal where `netlify dev` is running
- Look for function logs

### Check Browser Console
- Open DevTools (F12)
- Console tab for errors
- Network tab for API calls

### Common Issues

**Credentials not found:**
```bash
# Check if file exists
ls ../pytoyoda/sandbox/credentials.json

# Should contain:
# {
#   "username": "your@email.com",
#   "password": "yourpassword"
# }
```

**Function not found:**
- Make sure you're using `netlify dev` not `npm start`
- Check that `netlify/functions/fetch-mileage.js` exists

**API fails:**
- Verify credentials are correct
- Check Toyota account has vehicles
- Look at function logs for detailed errors

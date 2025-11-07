# CORS Testing - Quick Reference

## Quick Start

### Run Automated Test
```bash
# Start API server
npm run dev

# Run CORS test (in another terminal)
./scripts/test-widget-cors.sh
```

### Run Interactive Test
```bash
# Start API server
npm run dev

# Open test page
open widget/examples/test-sites/test-cors.html
```

## Test Files

| File | Purpose |
|------|---------|
| `scripts/test-widget-cors.sh` | Automated CLI test script |
| `widget/examples/test-sites/test-cors.html` | Interactive browser test |
| `.kiro/specs/integration-fixes/CORS_TESTING_GUIDE.md` | Full testing guide |
| `.kiro/specs/integration-fixes/CORS_TEST_RESULTS.md` | Implementation summary |

## What Gets Tested

- ✅ Preflight OPTIONS requests
- ✅ Session creation from external domain
- ✅ Chat messages from external domain
- ✅ Session history from external domain
- ✅ Document search from external domain
- ✅ CORS headers validation

## Expected Output (Success)

```
✓ All tests passed!
The widget should work correctly on external merchant domains.
```

## Troubleshooting

### Tests Fail?
1. Check API is running: `curl http://localhost:3000/health`
2. Review CORS config in `src/api/app.ts`
3. Check browser console for errors
4. See full guide: `.kiro/specs/integration-fixes/CORS_TESTING_GUIDE.md`

### CORS Errors in Browser?
- Verify `Access-Control-Allow-Origin` header is present
- Check `exposedHeaders` includes required headers
- Ensure OPTIONS requests return 200/204

## CORS Configuration Location

File: `src/api/app.ts` (lines ~90-130)

Current config allows all origins for widget endpoints ✅

## Documentation

- **Full Guide:** `.kiro/specs/integration-fixes/CORS_TESTING_GUIDE.md`
- **Implementation Details:** `.kiro/specs/integration-fixes/CORS_TEST_RESULTS.md`
- **Task Spec:** `.kiro/specs/integration-fixes/tasks.md` (Task 1.7)

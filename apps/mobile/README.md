# @raket/mobile

Expo + Expo Router app for the Raket cross-border payment platform.

## Development

```bash
npm run dev -w @raket/mobile
```

Opens the Expo dev server. Press `i` for iOS Simulator, scan the QR code for Expo Go on a physical device.

## Required environment variables

Create a `.env` file at the repo root (or export these in your shell):

| Variable                             | Description                                                |
| ------------------------------------ | ---------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`                | Base URL for the NestJS API (e.g. `http://localhost:3001`) |
| `EXPO_PUBLIC_SUPABASE_URL`           | Your Supabase project URL                                  |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`      | Your Supabase anon/public key                              |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_…` for dev)               |

`EXPO_PUBLIC_*` variables are inlined by the Metro bundler at build time and are safe to expose to the client.

## Assets

Place the following image assets in `src/assets/` before running a production build:

- `icon.png` — 1024×1024, app icon
- `splash.png` — 1284×2778, splash screen
- `adaptive-icon.png` — 1024×1024, Android adaptive icon foreground

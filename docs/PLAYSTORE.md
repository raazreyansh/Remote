# SmartTable OS Play Store Packaging

SmartTable OS is currently implemented as an installable PWA in the web frontend. The fastest Android distribution path is:

1. Deploy the frontend on a stable HTTPS domain.
2. Keep the manifest at [frontend/public/manifest.webmanifest](/Users/akbai/OneDrive/Documents/Playground/frontend/public/manifest.webmanifest).
3. Package the web app as an Android shell using one of these:
   - Trusted Web Activity for a thin Play Store wrapper around the production web app
   - Capacitor if you want native plugins like camera, Bluetooth/NFC handling, or printer integrations

## Recommended path

- Use TWA first for fastest launch.
- Move to Capacitor if you need:
  - native push notifications
  - deeper NFC control
  - Bluetooth printers
  - offline-first table staff tooling

## Android app split

- Guest app:
  - Usually not needed as a store app because QR scans should open the web menu instantly.
- Restaurant operator app:
  - Good Play Store candidate for onboarding, menu management, order monitoring, and KDS-lite flows.

## Production checklist before Play Store

- Final production domain and Digital Asset Links
- Android package name
- App icons and splash assets
- Real OAuth providers
- Real payment credentials
- Push notification provider
- Privacy policy and support URL

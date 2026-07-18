# iOSApp — Ramachandra Traders

The mobile app is built with **Expo**, which is cross-platform: the single
project in **`../AndroidApp`** runs on **iOS as well** (and web). There is no
separate iOS codebase to maintain.

## Run on iOS

```bash
cd ../AndroidApp
npm install
npm run ios        # opens the iOS simulator (requires a Mac + Xcode)
```

Or install **Expo Go** on an iPhone, run `npm start`, and scan the QR code
(works from Windows/Linux too — no Mac needed for development).

## App Store build

Building for TestFlight / the App Store requires a Mac and an Apple Developer
account:

```bash
cd ../AndroidApp
eas build -p ios
```

The bundle identifier is already set in `AndroidApp/app.json`
(`com.ramachandratraders.app`).

See `../AndroidApp/README.md` for the full details, API URL setup, and the
roadmap to website parity.

# Overpopped for iOS

A [Capacitor](https://capacitorjs.com) wrapper around the web game. The game is `../src`,
built unchanged; nothing here is imported by it, and the website's deploy ignores this folder.

Differences from the website, all set here and not in the game's code:

- No log uploads: the web build for the app is made with `VITE_TRACE_URL` empty.
- Landscape only, status bar hidden, full screen (`ios/App/App/Info.plist`).
- App id `com.jonsploder.overpopped` (`capacitor.config.json`; change it before the first upload if you want another).

## After changing the game

```bash
cd mobile
npm install        # first time only
npm run sync       # build the web game into www/ and copy it into the iOS project
npm run open       # open the project in Xcode
```

In Xcode, pick a simulator or your phone and press Run.

## Upload to TestFlight

```bash
cd mobile
npm run testflight            # build the game, raise the build number, archive and upload
npm run testflight -- --dry   # build and archive only, upload nothing
```

That does steps 3-5 below. Steps 1 and 2 are one-off, and the manual route still works.

Needs a paid Apple Developer Program membership.

1. Once: at appstoreconnect.apple.com, Apps > + > New App. Platform iOS, name Overpopped,
   bundle ID `com.jonsploder.overpopped` (register it under Certificates, Identifiers & Profiles
   first if it isn't offered), any SKU.
2. Once: in Xcode, select the App target > Signing & Capabilities, tick "Automatically manage
   signing" and choose your team.
3. Each upload: raise Build (App target > General > Identity) by one. `npm run sync` first if the game changed.
4. Choose the destination "Any iOS Device (arm64)", then Product > Archive.
5. In the Organizer window that opens: Distribute App > TestFlight & App Store > Distribute.
6. After 5-15 minutes of processing the build shows under TestFlight in App Store Connect. Add
   yourself as an internal tester, then install it from the TestFlight app on your phone.

Online play needs the same game version as the other players (`VERSION` in `../src/main.ts`),
so upload a new build whenever the website's version changes.

#!/bin/bash
# Build the game into the iOS app and upload it to TestFlight.
#
#   npm run testflight            build, archive, upload (raises the build number by one)
#   npm run testflight -- --dry   build and archive only: checks it compiles and signs, uploads nothing
#
# Uses the Apple account signed in to Xcode (Settings > Accounts) and the team set on the App target.
set -euo pipefail
cd "$(dirname "$0")"
PROJ=ios/App/App.xcodeproj/project.pbxproj
OUT=ios/App/output          # ignored by git
DRY=${1:-}

npm run web
npx cap sync ios

if [ "$DRY" != "--dry" ]; then
  old=$(sed -n 's/.*CURRENT_PROJECT_VERSION = \([0-9]*\);.*/\1/p' "$PROJ" | head -1)
  new=$((old + 1))
  sed -i '' "s/CURRENT_PROJECT_VERSION = $old;/CURRENT_PROJECT_VERSION = $new;/" "$PROJ"
  echo "Build number $old -> $new"
fi

rm -rf "$OUT"
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$OUT/App.xcarchive" \
  -allowProvisioningUpdates -quiet archive 2>&1 | grep -E "(^|: )error:" || true
[ -d "$OUT/App.xcarchive" ] || { echo "Archive failed. Open Xcode (npm run open) and try Product > Archive to see why."; exit 1; }

if [ "$DRY" = "--dry" ]; then echo "Dry run: archived fine, nothing uploaded."; exit 0; fi

cat > "$OUT/ExportOptions.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath "$OUT/App.xcarchive" -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT" -allowProvisioningUpdates 2>&1 | tee "$OUT/upload.log" | grep -E "(^|: )error:|Upload succeeded|EXPORT" || true
if grep -q "EXPORT SUCCEEDED\|Upload succeeded" "$OUT/upload.log"; then
  echo "Uploaded build $new. It appears in TestFlight after 5-15 minutes of processing."
else
  echo "Upload failed (see $OUT/upload.log). Build number stays at $new; the next run uses $((new + 1))."; exit 1
fi

docker run --rm \
  -e EXPO_TOKEN=<TOKEN> \
  -v $(pwd):/app \
  -v ~/.gradle:/root/.gradle \
  -v ~/.eas-build-local:/root/.eas-build-local \
  expo-android-builder \
  bash -c "
    yarn install &&
    eas build --platform android --profile development --local --non-interactive --output=app-dev.apk
  "

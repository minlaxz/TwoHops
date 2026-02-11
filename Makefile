init:
	npm ci || yarn install

# Start the metro bundler.
start:
	npx react-native start;

# Start the metro bundler with reset.
start-reset:
	npx react-native start --reset-cache;

# Reinstall the app on the emulator.
run-android:
	cd ./android/gradlew clean && \
	npx react-native run-android;

run-ios:
	npx react-native run-ios;

eas-android-build-dev:
	eas build --platform android --profile development

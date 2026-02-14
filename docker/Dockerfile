FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=20
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools
ENV NODE_OPTIONS="--openssl-legacy-provider"

# ---- System deps ----
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    git \
    openjdk-17-jdk \
    jq \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ---- Node.js ----
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs

# ---- Yarn ----
RUN corepack enable && corepack prepare yarn@stable --activate

# ---- Android SDK ----
RUN mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools \
    && curl -o /tmp/sdk.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
    && unzip /tmp/sdk.zip -d ${ANDROID_SDK_ROOT}/cmdline-tools \
    && mv ${ANDROID_SDK_ROOT}/cmdline-tools/cmdline-tools ${ANDROID_SDK_ROOT}/cmdline-tools/latest \
    && rm /tmp/sdk.zip

RUN yes | sdkmanager --licenses && \
    sdkmanager \
      "platform-tools" \
      "platforms;android-34" \
      "build-tools;34.0.0"

# ---- EAS CLI ----
RUN yarn global add eas-cli@latest

WORKDIR /app

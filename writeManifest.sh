#!/bin/bash

DATE="$(date +'%Y%m%d.%H%M')"
GIT_SHA="$(git rev-parse --short HEAD)"
REPO_URL=https://github.com/$TRAVIS_REPO_SLUG
LAST_COMMIT="$(git log -1 --oneline)"

sed -i 's~MANIFEST_REPOSITORY~'"$REPO_URL"'~' MANIFEST
sed -i 's~MANIFEST_BRANCH~'"$TRAVIS_BRANCH"'~' MANIFEST
sed -i 's~MANIFEST_LAST_COMMIT~'"$LAST_COMMIT"'~' MANIFEST
sed -i 's~MANIFEST_COMMIT~'"$TRAVIS_COMMIT"'~' MANIFEST
sed -i 's~MANIFEST_TRAVIS_JOB_URL~'"$TRAVIS_JOB_WEB_URL"'~' MANIFEST
sed -i 's~MANIFEST_DATE~'"$DATE"'~' MANIFEST

#!/bin/bash

IMAGE=keptn/github-service
REGISTRY_USER=dirkwallerstorfer
VERSION="$(cat version)"
DATE="$(date +'%Y%m%d.%H%M')"
GIT_SHA="$(git rev-parse --short HEAD)"
REPO_URL="$(git remote get-url --all origin)"
LAST_COMMIT="$(git log -1 --oneline)"

sed -i 's~MANIFEST_REPOSTIORY~'"$REPO_URL"'~' MANIFEST
#- sed -i 's~PERSONAL_ACCESS_TOKEN_PLACEHOLDER~'"$GITAT"'~'
#- echo "##########\nrepository: $REPO_URL\nbranch: $TRAVIS_BRANCH\ncommit: $LAST_COMMIT\n" >> MANIFEST
#- echo "commitlink: $REPO_URL/commit/$TRAVIS_COMMIT\nrepolink: $REPO_URL/tree/$TRAVIS_COMMIT\n" >> MANIFEST
#- echo "travisbuild: $TRAVIS_JOB_WEB_URL\ntimestamp: $DATE" >> MANIFEST
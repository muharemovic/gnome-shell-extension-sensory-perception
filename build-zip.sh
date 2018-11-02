#!/bin/sh

# Build the zip file with the current version read from metadata.json
# using underscore

command -v underscore >/dev/null 2>&1 || {
  echo >&2 "Please install underscore with \"npm install\".  Aborting."
  exit 1
}

VERSION="$(underscore extract --in metadata.json --outfmt text 'version')"
UUID="$(underscore extract --in metadata.json --outfmt text 'uuid')"
FILENAME="$UUID-v$VERSION.zip"

printf "Zipping into $FILENAME...\n"
zip -r $FILENAME icons po schemas *.js metadata.json LICENSE README.md
printf "done!\n"

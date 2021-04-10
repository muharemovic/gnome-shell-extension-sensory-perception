#!/bin/sh

# Build the zip file with the current version read from metadata.json
# using grep

VERSION="$(grep -oP '(?<="version": ")\d+' metadata.json)"
UUID="$(grep -oP '(?<="uuid": ")[^"]+' metadata.json)"
FILENAME="$UUID-v$VERSION.zip"

printf "Zipping into $FILENAME...\n"
zip -r $FILENAME icons po schemas *.js metadata.json LICENSE README.md stylesheet.css
printf "done!\n"

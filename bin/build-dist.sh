#!/bin/sh

set -e

printf "Linting...\n"

npm test

printf "Packing...\n"

gnome-extensions pack --extra-source=icons --extra-source=logger.js --extra-source=prefs.js --extra-source=utilities.js --extra-source=sensory-perception.png --podir=po --out-dir=dist --schema=schemas/org.gnome.shell.extensions.sensors.gschema.xml --force .

printf "✅ Done.\n\n"
# Sensory Perception
### A GNOME Shell Extension

Forked from https://github.com/xtranophilist/gnome-shell-extension-sensors

## Requirements

This GNOME shell extension uses [`lm-sensors`](https://github.com/lm-sensors/lm-sensors) which must be installed.

```sh
# ArchLinux
sudo pacman -S lm_sensors

# Fedora
sudo dnf install lm_sensors

# Ubuntu
sudo apt install lm-sensors
```


## Compatibility

As of [v14](/releases/tag/v14) GNOME Shell 40 is tested as working.
As of [v12](/releases/tag/v12) GNOME Shell 3.36 is tested as working.
As of [v11](/releases/tag/v11) GNOME Shell 3.34 is tested as working.
As of [v8](/releases/tag/v8) GNOME Shell 3.32 is tested as working.

GNOME Shell < 3.32 require [v7](/releases/tag/v7).

## Installation

### GNOME Extensions Website

1. Visit https://extensions.gnome.org/extension/1145/sensory-perception/
2. Click the switch to install and enable the extension
3. Accept the prompt to install if not already installed

### Manual

This is useful for developing and/or debugging.

```sh
# Clone the repository
git clone https://github.com/HarlemSquirrel/gnome-shell-extension-sensory-perception.git
# Or download and unzip a release from https://github.com/HarlemSquirrel/gnome-shell-extension-sensory-perception/tags

# OPTIONAL: check out a specific tag or branch
git checkout v7

# Create a symlink to the local user's extensions directory
ln -s ~/gnome-shell-extension-sensory-perception ~/.local/share/gnome-shell/extensions/sensory-perception@HarlemSquirrel.github.io

# Enable the extension
gnome-shell-extension-tool --enable sensory-perception@HarlemSquirrel.github.io
```

## Customizing labels

You may want to set the labels of your sensors to something like 'CPU' instead of 'temp1'. Every motherboard is different so you will need to set these labels manually. I created [lm-sensors-chip-labels](https://github.com/HarlemSquirrel/lm-sensors-chip-labels) where I am adding the files I need for my machines. Feel free to open a PR and contribute!

The [sensors.conf manual](https://linux.die.net/man/5/sensors.conf) describes the full array of customizations.

## Troubleshooting

### Reloading

```sh
# This does not always work
gnome-shell-extension-tool -r sensory-perception@HarlemSquirrel.github.io
```

One of the best ways to troubleshoot is to watch the logs with `journalctl` and restart the extension. You can reload this extension with the handy [Gnome Shell Extension Reloader](https://extensions.gnome.org/extension/1137/gnome-shell-extension-reloader/) extension.

    journalctl --since="`date '+%Y-%m-%d %H:%M'`" -f | grep sensory-perception


### Launch preferences from a terminal

GNOME 40

    gnome-extensions prefs sensory-perception@HarlemSquirrel.github.io

Earlier versions

    gnome-shell-extension-prefs sensory-perception@HarlemSquirrel.github.io


## Build a zip file for distribution

    # Check for lints first
    npm run test
    # Then build a zip file
    npm run build

## Compile schemas

    glib-compile-schemas --strict schemas/

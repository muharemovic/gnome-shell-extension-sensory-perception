/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */

const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = imports.misc.extensionUtils.getCurrentExtension();

/**
 * initIcons:
 *
 * Initialize Gtk to load icons from extensionsdir/icons.
 */
function initIcons() {
  const Theme = Gtk.IconTheme.get_default();
  const IconDir = Me.dir.get_child('icons');
  if(IconDir.query_exists(null))
    Theme.append_search_path(IconDir.get_path());
}

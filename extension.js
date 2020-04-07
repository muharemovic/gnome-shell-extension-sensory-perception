/* eslint indent: "off", camelcase: "off" */
const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const SHELL_VERSION = imports.misc.config.PACKAGE_VERSION;
const St = imports.gi.St;
const Util = imports.misc.util;

const Me = ExtensionUtils.getCurrentExtension();
const Utilities = Me.imports.utilities;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const Logger = Me.imports.logger.Logger;
const Metadata = Me.metadata;

const ELLIPSIS = '\u2026';

let settings;

const SensorsItem = class SensoryPerception_SensorsItem {
    constructor(type, label, value) {
        this._menuItem = new PopupMenu.PopupBaseMenuItem();

        this._menuItem.connect('activate', function () {
            settings.set_string('main-sensor', label);
        });
        this._menuItem._label = label;
        this._menuItem._value = value;

        this._menuItem.add(new St.Icon({
            style_class: 'sensory-perception-sensor-icon',
            gicon: Utilities.giconFor('sensors-' + type + '-symbolic')
        }));
        this._menuItem.add(new St.Label({ text: label }));
        this._menuItem.add(new St.Label({ text: value }), { align: St.Align.END });
    }

    getPanelString() {
        if(settings.get_boolean('display-label'))
        return '%s: %s'.format(this._menuItem._label, this._menuItem._value);
        else
        return this._menuItem._value;
    }

    setMainSensor() {
        this._menuItem.setOrnament(PopupMenu.Ornament.DOT);
    }

    get label() {
        return this._menuItem._label;
    }

    get menuItem() {
        return this._menuItem;
    }
};

var SensorsMenuButton = GObject.registerClass(
class SensoryPerception_SensorsMenuButton extends PanelMenu.Button {
    _init() {
        super._init(null, 'sensorMenu');

        this._sensorsOutput = '';
        this._hddtempOutput = '';

        const box = new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box' });

        this.extensionIcon = new St.Icon({
            gicon: Utilities.giconFor('sensory-perception'),
            style_class: 'system-status-icon'
        });

        this.statusLabel = new St.Label({
            text: ELLIPSIS,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        box.add_child(this.extensionIcon);
        box.add_child(this.statusLabel);
        this.add_child(box);

        this.sensorsArgv = Utilities.detectSensors();

        if (settings.get_boolean('display-hdd-temp')) {
            this.hddtempArgv = Utilities.detectHDDTemp();
        }

        this.udisksProxies = [];
        Utilities.UDisks.getDriveAtaProxies((proxies) => {
            this.udisksProxies = proxies;
            this._updateDisplay(this._sensorsOutput, this._hddtempOutput);
        });

        this._querySensors();
        this._settingsChanged = settings.connect('changed', this._querySensors.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));

        this._eventLoop = Mainloop.timeout_add_seconds(settings.get_int('update-time'), () => {
            this._querySensors();
            // readd to update queue
            return true;
        });
    }

    _onDestroy() {
        Mainloop.source_remove(this._eventLoop);
        settings.disconnect(this._settingsChanged);
        this.menu.removeAll();
    }

    _querySensors() {
        if (typeof this.sensorsArgv !== 'undefined') {
            this._sensorsFuture = new Utilities.Future(this.sensorsArgv, (stdout) => {
                this._sensorsOutput = stdout;
                this._updateDisplay(this._sensorsOutput, this._hddtempOutput);
                this._sensorsFuture = undefined;
            });
        } else {
            Logger.error('SensorsMenuButton _querySensors: sensors program not found!');
        }

        if (typeof this.hddtempArgv !== 'undefined') {
            this._hddtempFuture = new Utilities.Future(this.hddtempArgv, (stdout) => {
                this._hddtempOutput = stdout;
                this._updateDisplay(this._sensorsOutput, this._hddtempOutput);
                this._hddtempFuture = undefined;
            });
        }
    }

    _updateDisplay(sensorsOutput, hddtempOutput) {
        const DisplayFanRPM = settings.get_boolean('display-fan-rpm');
        const DisplayVoltage = settings.get_boolean('display-voltage');

        let tempInfo = Array();
        let fanInfo = Array();
        let voltageInfo = Array();

        tempInfo = Utilities.parseSensorsOutput(sensorsOutput,Utilities.parseSensorsTemperatureLine);
        tempInfo = tempInfo.filter(Utilities.filterTemperature);
        if (DisplayFanRPM){
            fanInfo = Utilities.parseSensorsOutput(sensorsOutput,Utilities.parseFanRPMLine);
            fanInfo = fanInfo.filter(Utilities.filterFan);
        }
        if (DisplayVoltage){
            voltageInfo = Utilities.parseSensorsOutput(sensorsOutput,Utilities.parseVoltageLine);
        }

        if (this.hddtempArgv) {
            tempInfo = tempInfo.concat(
                Utilities.parseHddTempOutput(
                    hddtempOutput,
                    !(/nc$/.exec(this.hddtempArgv[0])) ? ': ' : '|'
                )
            );
        }

        tempInfo = tempInfo.concat(Utilities.UDisks.createListFromProxies(this.udisksProxies));

        tempInfo.sort(function(a,b) { return a.label.localeCompare(b.label); });
        fanInfo.sort(function(a,b) { return a.label.localeCompare(b.label); });
        voltageInfo.sort(function(a,b) { return a.label.localeCompare(b.label); });

        this.menu.removeAll();

        const Section = new PopupMenu.PopupMenuSection("Temperature");

        if (this.sensorsArgv && tempInfo.length > 0){
            const sensorsList = new Array();
            let sum = 0; //sum
            let max = 0; //max temp
            let allCoreTemps = '';
            for (const temp of tempInfo){
                sum += temp.temp;
                if (temp.temp > max)
                    max = temp.temp;

                sensorsList.push(new SensorsItem('temperature', temp.label, this._formatTemp(temp.temp)));

                const IncludesCore = SHELL_VERSION < '3.26' ? temp.label.contains('Core') : temp.label.includes('Core');
                if (IncludesCore) {
                    if (temp.high <= temp.temp) {
                        allCoreTemps += ("!");
                    }
                    allCoreTemps += _("%s ").format(this._formatTemp(temp.temp));
                }
            }

            if (tempInfo.length > 0){
                sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());

                // Add average and maximum entries
                sensorsList.push(new SensorsItem('temperature', _("Average"), this._formatTemp(sum/tempInfo.length)));
                sensorsList.push(new SensorsItem('temperature', _("Maximum"), this._formatTemp(max)));
                sensorsList.push(new SensorsItem('temperature', _("All Cores"), allCoreTemps));

                if(fanInfo.length > 0 || voltageInfo.length > 0)
                    sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());
            }

            for (const fan of fanInfo){
                sensorsList.push(new SensorsItem('fan', fan.label, _("%drpm").format(fan['rpm'])));
            }
            if (fanInfo.length > 0 && voltageInfo.length > 0){
                sensorsList.push(new PopupMenu.PopupSeparatorMenuItem());
            }
            for (const voltage of voltageInfo){
                sensorsList.push(new SensorsItem('voltage', voltage.label, _("%s%.3fV").format(((voltage['volt'] >= 0) ? '+' : '-'), voltage['volt'])));
            }

            this.statusLabel.set_text(_("N/A")); // Just in case

            for (const item of sensorsList) {
                if (item.label && settings.get_string('main-sensor') == item.label) {
                    // Configure as main sensor and set panel string
                    item.setMainSensor();
                    this.statusLabel.set_text(item.getPanelString());
                }

                if (item.menuItem) {
                    // Add the menu item from SensorsItem objects.
                    Section.addMenuItem(item.menuItem);
                } else {
                    Section.addMenuItem(item);
                }
            }

            // separator
            Section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            const item = new PopupMenu.PopupBaseMenuItem();
            // HACK: span and expand parameters don't work as expected on Label, so add an invisible
            // Label to switch columns and not totally break the layout.
            item.add(new St.Label({ text: '' }));
            item.add(new St.Label({ text: _("⚙ Settings") }));
            item.connect('activate', () => {
                const AppSys = Shell.AppSystem.get_default();
                const App = AppSys.lookup_app('gnome-shell-extension-prefs.desktop');
                const AppInfo = App.get_app_info();
                const Timestamp = global.display.get_current_time_roundtrip();
                AppInfo.launch_uris(
                    ['extension:///' + Metadata.uuid],
                    global.create_app_launch_context(Timestamp, -1)
                );
            });
            Section.addMenuItem(item);
        } else {
            this.statusLabel.set_text(_("Error"));

            const Item = new PopupMenu.PopupMenuItem(
                (this.sensorsArgv
                    ? _("Please run sensors-detect as root.")
                    : _("Please install lm_sensors.")) + "\n" + _("If this doesn\'t help, click here to report with your sensors output!")
            );
            Item.connect('activate',function() {
                Util.spawn(["xdg-open", Metadata.url + '/issues']);
            });
            Section.addMenuItem(Item);
        }

        this.menu.addMenuItem(Section);
    } // _updateDisplay

    _toFahrenheit(c) {
        return ((9/5)*c+32);
    }

    _formatTemp(value) {
        if (settings.get_string('unit')=='Fahrenheit'){
            value = this._toFahrenheit(value);
        }
        let format = '%.1f';
        if (!settings.get_boolean('display-decimal-value')){
            format = '%d';
        }
        if (settings.get_boolean('display-degree-sign')) {
            format += '%s';
        }
        return format.format(value, (settings.get_string('unit')=='Fahrenheit') ? "\u00b0F" : "\u00b0C");
    }
});

let sensorsMenu;

function init(extensionMeta) {
    ExtensionUtils.initTranslations();
    settings = ExtensionUtils.getSettings();
}

function enable() {
    sensorsMenu = new SensorsMenuButton();
    Main.panel.addToStatusArea('sensorsMenu', sensorsMenu, 1, 'right');
}

function disable() {
    sensorsMenu.destroy();
    sensorsMenu = null;
}

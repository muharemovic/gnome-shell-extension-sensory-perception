/* eslint indent: "off", camelcase: "off", 'prefer-const': "off" */
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;
const Logger = Me.imports.logger.Logger;
const Utilities = Me.imports.utilities;

const BOOL_SETTINGS = {
    displayDegreeSign: {
        name: "display-degree-sign",
        label: _("Display temperature unit"),
        help: _("Show temperature unit in panel and menu.")
    },
    displayDecimalValue: {
        name: "display-decimal-value",
        label: _("Display decimal value"),
        help: _("Show one digit after decimal.")
    },
    showHddTemp: {
        name: "display-hdd-temp",
        label: _("Display drive temperature"),
    },
    showFanRpm: {
        name: "display-fan-rpm",
        label: _("Display fan speed"),
    },
    showVoltage: {
        name: "display-voltage",
        label: _("Display power supply voltage"),
    },
};

const MODEL_COLUMN = {
    label: 0,
    separator: 1
};

function init() {
    ExtensionUtils.initTranslations();
}

const SensorsPrefsWidget = GObject.registerClass(
class SensorsPrefsWidget extends Gtk.Grid {
    _init(params) {
        /************************************************************
        * Gtk.Grid
        * https://developer.gnome.org/gtk4/4.0/GtkGrid.html
        *
        * Gtk.Grid.attach(child, left, top, width, height)
        */
        super._init(params);

        this.column_homogeneous = false;
        this.row_homogeneous = false;
        this.margin = 20;
        this.row_spacing = 20;
        this.column_spacing = 20;

        this._settings = ExtensionUtils.getSettings();

        /***********************************************************
         * Gtk.Label
         * https://developer.gnome.org/gtk3/stable/GtkLabel.html
         */
        this.attach(new Gtk.Label({ label: _("Poll sensors every (in seconds)") , xalign: 1 }), 0, 0, 2, 1);

        /***********************************************************
         * GtkScale
         * https://developer.gnome.org/gtk4/4.0/GtkScale.html
         */
        const updateTime = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 1, 64, 1);
        updateTime.set_value(this._settings.get_int('update-time'));
        updateTime.set_digits(0);
        updateTime.set_draw_value(true);
        updateTime.set_hexpand(true);
        updateTime.connect('value-changed', this._onUpdateTimeChanged.bind(this));
        this.attach(updateTime, 2, 0, 4, 1);

        this.attach(new Gtk.Label({ label: _("Temperature unit"), xalign: 1 }), 0, 2, 2, 1);

        const centigradeRadio = new Gtk.CheckButton({
            group: null,
            label: _("Centigrade"),
            valign: Gtk.Align.START
        });

        const fahrenheitRadio = new Gtk.CheckButton({
            group: centigradeRadio,
            label: _("Fahrenheit"),
            valign: Gtk.Align.START
        });

        centigradeRadio.connect('toggled', this._onUnitChanged.bind(this, centigradeRadio, 'Centigrade'));
        fahrenheitRadio.connect('toggled', this._onUnitChanged.bind(this, fahrenheitRadio, 'Fahrenheit'));

        if (this._settings.get_string('unit')=='Centigrade') {
            centigradeRadio.active = true;
        } else {
            fahrenheitRadio.active = true;
        }

        this.attach(centigradeRadio, 2, 2, 2, 1);
        this.attach(fahrenheitRadio, 4, 2, 2, 1);

        const settings = this._settings;

        let counter = 3;

        for (const boolSetting in BOOL_SETTINGS){
            const setting = BOOL_SETTINGS[boolSetting];
            const settingLabel = new Gtk.Label({ label: setting.label, xalign: 1 });
            const settingSwitch = new Gtk.Switch({ active: this._settings.get_boolean(setting.name) });
            const settingSwitchBox = new Gtk.Box();
            // const settings = this._settings;

            settingSwitch.connect('notify::active', function(button) {
                settings.set_boolean(setting.name, button.active);
            });

            if (setting.help) {
                settingLabel.set_tooltip_text(setting.help);
                settingSwitch.set_tooltip_text(setting.help);
            }

            // Placing the switch inside a box avoids stretching it's width.
            settingSwitchBox.append(settingSwitch);

            this.attach(settingLabel, 0, counter, 2, 1);
            this.attach(settingSwitchBox, 2, counter++, 1, 1);
        }

        // List of items of the ComboBox
        this._model =  new Gtk.ListStore();
        this._model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]);
        this._appendItem(_("Average"));
        this._appendItem(_("Maximum"));
        this._appendItem(_("All Cores"));
        this._appendSeparator();

        // Get current options
        this._display_fan_rpm = this._settings.get_boolean('display-fan-rpm');
        this._display_voltage = this._settings.get_boolean('display-voltage');
        this._display_hdd_temp = this._settings.get_boolean('display-hdd-temp');

        // Fill the list
        this._getSensorsLabels();
        this._getUdisksLabels();

        if(this._display_hdd_temp) {
            this._appendSeparator();
            this._getHddTempLabels();
        }

        // ComboBox to select which sensor to show in panel
        this._sensorSelector = new Gtk.ComboBox({ model: this._model });
        this._sensorSelector.set_active_iter(this._getActiveSensorIter());
        this._sensorSelector.set_row_separator_func(this._comboBoxSeparator.bind(this));

        const renderer = new Gtk.CellRendererText();
        this._sensorSelector.pack_start(renderer, true);
        this._sensorSelector.add_attribute(renderer, 'text', MODEL_COLUMN.label);
        this._sensorSelector.connect('changed', this._onSelectorChanged.bind(this));

        this.attach(new Gtk.Label({ label: _("Sensor in panel"), xalign: 1 }), 0, ++counter, 2, 1);
        this.attach(this._sensorSelector, 2, counter , 2, 1);

        // const settings = this._settings;
        const checkButton = new Gtk.CheckButton({ label: _("Display sensor label") });
        checkButton.set_active(settings.get_boolean('display-label'));
        checkButton.connect('toggled', function () {
            settings.set_boolean('display-label', checkButton.get_active());
        });
        this.attach(checkButton, 4, counter, 2, 1);
    }

    _comboBoxSeparator(model, iter, data) {
        return model.get_value(iter, MODEL_COLUMN.separator);
    }

    _appendItem(label) {
        this._model.set(this._model.append(), [MODEL_COLUMN.label], [label]);
    }

    _appendMultipleItems(sensorInfo) {
        for (const sensor of sensorInfo) {
            this._model.set(this._model.append(), [MODEL_COLUMN.label], [sensor['label']]);
        }
    }

    _appendSeparator() {
        this._model.set (this._model.append(), [MODEL_COLUMN.separator], [true]);
    }

    _getSensorsLabels() {
        const sensorsCmd = Utilities.detectSensors();
        if(sensorsCmd) {
            const sensorsOutput = GLib.spawn_command_line_sync(sensorsCmd.join(' '));
            if(sensorsOutput[0]) {
                const output = Utilities.stringify(sensorsOutput[1]);
                let tempInfo = Utilities.parseSensorsOutput(output,Utilities.parseSensorsTemperatureLine);
                tempInfo = tempInfo.filter(Utilities.filterTemperature);
                this._appendMultipleItems(tempInfo);

                if (this._display_fan_rpm){
                    let fanInfo = Utilities.parseSensorsOutput(output,Utilities.parseFanRPMLine);
                    fanInfo = fanInfo.filter(Utilities.filterFan);
                    this._appendMultipleItems(fanInfo);
                }
                if (this._display_voltage){
                    const voltageInfo = Utilities.parseSensorsOutput(output,Utilities.parseVoltageLine);
                    this._appendMultipleItems(voltageInfo);
                }
            }
        }
    }

    _getHddTempLabels() {
        const hddtempCmd = Utilities.detectHDDTemp();
        if(hddtempCmd){
            const hddtempOutput = GLib.spawn_command_line_sync(hddtempCmd.join(' '));
            if(hddtempOutput[0]){
                const hddTempInfo = Utilities.parseHddTempOutput(
                    Utilities.stringify(hddtempOutput[1]),
                    !(/nc$/.exec(hddtempCmd[0])) ? ': ' : '|'
                );
                this._appendMultipleItems(hddTempInfo);
            }
        }
    }

    _getUdisksLabels() {
        Utilities.UDisks.getDriveAtaProxies((function(proxies) {
            const list = Utilities.UDisks.createListFromProxies(proxies);

            this._appendMultipleItems(list);
        }).bind(this));
    }

    _getActiveSensorIter() {
        /* Get the first iter in the list */
        let success, iter;
        [success, iter] = this._model.get_iter_first();
        // let sensorLabel = this._model.get_value(iter, 0);

        while (success) {
            /* Walk through the list, reading each row */
            const sensorLabel = this._model.get_value(iter, 0);
            if(sensorLabel == this._settings.get_string('main-sensor'))
            break;

            success = this._model.iter_next(iter);
        }

        return iter;
    }

    _onUpdateTimeChanged(updateTime) {
        this._settings.set_int('update-time', updateTime.get_value());
    }

    _onUnitChanged(button, unit) {
        if (button.get_active()) {
            this._settings.set_string('unit', unit);
        }
    }

    _onSelectorChanged(comboBox) {
        const [success, iter] = comboBox.get_active_iter();
        if (!success)
        return;

        const label = this._model.get_value(iter, MODEL_COLUMN.label);
        this._settings.set_string('main-sensor', label);
    }
});

function buildPrefsWidget() {
    const widget = new SensorsPrefsWidget();

    return widget;
}

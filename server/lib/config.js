"use strict";

var CONFIG_FILE = '/../config/config.json';

var fs = require('fs');

/**
 * Reads JSON from a local file, parses it, and calls callback with the result.
 *     The local file is defined as a constant at the top of this file.
 * @param {String} filename the name of the file
 * @param {function} callback the callback to call with the data
 */
function readFile(filename, callback) {
    var data = fs.readFileSync(__dirname + filename, 'utf-8');
    callback(JSON.parse(data));
}

/**
 * Loads configurations from the settings file.
 */
function loadSettings() {
    readFile(CONFIG_FILE, function(contents) {
        // Expose the entire contents of the config file (as exports)
        for(var property in contents) {
            if(contents.hasOwnProperty(property)) {
                exports[property] = contents[property];
            }
        }
    });
}

// On initialization:
loadSettings();

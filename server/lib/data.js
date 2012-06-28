"use strict";

var CONFIG_FILE = '/../config/config.json';
//TODO: load this from config:
var DATA_REMOTE = {
    host: 'localhost',
    port: 3435,
    path: '/data' };

var fs = require('fs'),
    http = require('http');

var config;

/**
 * Reads JSON from a local file, parses it, and calls callback with the result.
 *     The local file is defined as a constant at the top of this file.
 * @param {String} filename the name of the file
 * @param {function} callback the callback to call with the data
 */
function readFile(filename, callback) {
    fs.readFile(__dirname + filename, 'utf-8', function(err, data) {
        if(err) throw err;
        callback(JSON.parse(data));
    });
}

/**
 * Reads data from a remote file and calls callback with it.
 *     The location of the remote file is defined as a constant at the top of this file.
 * @param {function} callback the callback to call with the data
 */
function fetchData(callback) {
    http.get(DATA_REMOTE, function(res) {
        res.setEncoding('utf8');
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            callback(JSON.parse(body));
        });
    }).on('error', function(e) {
        throw(e);
    });
}

/**
 * Retrieves data and returns the portion that falls between start and end.
 * @param {Integer} start timestamp (in seconds) of earliest acceptable data point
 *     or null if any start time is acceptable
 * @param {Integer} end timestamp (in seconds) of latest acceptable data point
 *     or null if any end time is acceptable
 * @param {function} callback function that will be callled with the data
 */
exports.getData = function(start, end, callback) {
    fetchData(function(data) {
        // If necessary, filter data by start and end times.
        if(start !== null) {
            data = data.filter(function(datum) {
                return exports.getTimestamp(datum) >= start;
            });
        }

        if(end !== null) {
            data = data.filter(function(datum) {
                return exports.getTimestamp(datum) <= end;
            });
        }

        callback(data);
    });
};

/**
 * Given a data point, returns its timestamp (in seconds)
 * @param {Object} datum data point to extract information from
 * @return {Integer} seconds since epoch
 */
exports.getTimestamp = function(datum) {
    return Math.floor(datum.timestamp / 1000);
        // XXX: kpiggybank has timestamps in milliseconds, so we convert them to seconds.
        // If we fix that, this will need to change. See https://github.com/mozilla/browserid/issues/1732
};

/**
 * Given a data point, returns number of sites logged in
 * @param {Object} datum data point to extract information from
 * @return {Integer} number of sites logged in, or 0 if this field is missing
 */
exports.getNumberSitesLoggedIn = function(datum) {
    return datum.number_sites_logged_in || 0;
};

/**
 * Returns the various segmentations of the data, loaded from the config file.
 * @return {Object} of the form
 *     { <segmentation>: [<segment>, <segment>, ...], ...}
 *     e.g., { "Browser": [ "Firefox", "Chrome", "MSIE", "Safari" ] }
 * TODO: eventually, we'll probably want to generate these based on the data
 *     (e.g., find and return the top 5 for each category)
 */
exports.getSegmentations = function() {
    if(config.segmentations) {
        return config.segmentations;
    } else {
        throw new Error('segmentations not yet loaded');
    }
};

/**
 * Given a data point, returns the value of the given metric.
 *     Acceptable metrics are those for which we have segmentations.
 * @param {String} metric the name of the metric
 * @param {Object} datum data point to extract information from
 * @return the desired value or null if it doesn't exist
 */
exports.getSegmentation = function(metric, datum) {
    var value = null;

    switch(metric) {
        case "OS":
            if('user_agent' in datum) value = datum.user_agent.os;
            break;
        case "Browser":
            if('user_agent' in datum) value = datum.user_agent.browser;
            break;
        case "Locale":
            value = datum.lang;
            break;
    }

    if(value !== null && value in config.aliases) {
        value = config.aliases[value];
    }

    return value;
};

/**
 * Loads configurations from the settings file.
 */
function loadSettings() {
    readFile(CONFIG_FILE, function(contents) {
        config = contents;
    });
}

// On initialization:
loadSettings();

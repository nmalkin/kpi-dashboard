"use strict";

var config = require('./config'),
    http = require('http');

/**
 * Reads data from a remote file and calls callback with it.
 *     The location of the remote file is defined as a constant at the top of this file.
 * @param {function} callback the callback to call with the data
 */
function fetchData(callback) {
    http.get(config.data_server, function(res) {
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
    return Math.floor(datum.value.timestamp / 1000);
        // XXX: kpiggybank has timestamps in milliseconds, so we convert them to seconds.
        // If we fix that, this will need to change. See https://github.com/mozilla/browserid/issues/1732
};

/**
 * Converts Unix time to a string with the respective date (but not time).
 *     The output is a string representing the date that this time falls on.
 *     This is used for bucket-izing, so the exact format is not important.
 * @param {Integer} seconds since epoch
 * @return {String} the date on which this time falls, in the format YYYY-MM-DD
 */
function getDateStringFromUnixTime(seconds) {
    var date = new Date(seconds * 1000); // Date constructor takes milliseconds
    return date.toISOString().substr(0, 10);
}

/**
 * Returns the date of the given data point, in the format YYYY-MM-DD
 */
exports.getDate = function(datum) {
    return getDateStringFromUnixTime(exports.getTimestamp(datum));
};

/**
 * Given a data point, returns number of sites logged in
 * @param {Object} datum data point to extract information from
 * @return {Integer} number of sites logged in, or 0 if this field is missing
 */
exports.getNumberSitesLoggedIn = function(datum) {
    return datum.value.number_sites_logged_in || 0;
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
            if('user_agent' in datum.value) value = datum.value.user_agent.os;
            break;
        case "Browser":
            if('user_agent' in datum.value) value = datum.value.user_agent.browser;
            break;
        case "Locale":
            value = datum.value.lang;
            break;
    }

    if(value !== null && value in config.aliases) {
        value = config.aliases[value];
    }

    return value;
};

/**
 * Given a data point, returns a list of [only the] names of all events it contains.
 */
function eventList(datum) {
    return datum.value.event_stream.map(function(eventPair) {
        return eventPair[0];
    });
}

/**
 * Returns the names of all steps in the new user flow that were completed
 *     in the given data point.
 */
exports.newUserSteps = function(datum) {
    var steps = [];
    var events = eventList(datum);

    if(events.indexOf('screen.set_password') === -1) { // not a new user
        return steps;
    }

    config.flows.new_user.forEach(function(step) {
        if(events.indexOf(step[1]) !== -1) {
            steps.push(step[0]);
        }
    });

    return steps;
};



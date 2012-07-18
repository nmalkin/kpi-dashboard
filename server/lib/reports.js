"use strict";

var config = require('./config'),
    data = require('./data'),
    db = require('./db'),
    util = require('./util');

/**
 * Reports mean number of sites logged in
 * @param {String} segmentation segmentation type or null for none
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 */
exports.sites = function(segmentation, start, end, callback) {
    var dbOptions = {
        group: true
    };

    if(segmentation) {
        if(start) {
            dbOptions.startkey = [ util.getDateStringFromUnixTime(start) ];
            // Note that the key is in an array, and we are omitting the second key (segment).
        }
        if(end) {
            dbOptions.endkey = [ util.getDateStringFromUnixTime(end) ];
        }

        db.view('sites_' + segmentation, dbOptions, function(response) {
            var result = {};
            response.forEach(function(row) {
                var date = row.key[0],
                    segment = row.key[1],
                    mean = row.value.sum / row.value.count;

                if(! (segment in result)) {
                    result[segment] = [];
                }

                result[segment].push({
                    category: date,
                    value: mean
                });
            });

            callback(result);
        });
    } else {
        if(start) {
            dbOptions.startkey = util.getDateStringFromUnixTime(start);
        }
        if(end) {
            dbOptions.endkey = util.getDateStringFromUnixTime(end);
        }

        db.view('sites', dbOptions, function(response) {
            var dates = [];
            response.forEach(function(row) {
                var stats = row.value;
                dates.push({
                    category: row.key, // date
                    value: stats.sum / stats.count // mean
                });
            });

           callback({ Total: dates });
        });
    }
};


/**
 * Reports total number of assertions generated
 * @param {String} segmentation segmentation type or null for none
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 */
exports.assertions = function(segmentation, start, end, callback) {
    var dbOptions = {
        group: true
    };

    // Convert timestamps to dates
    if(start) {
        dbOptions.startkey = util.getDateStringFromUnixTime(start);
    }
    if(end) {
        dbOptions.endkey = util.getDateStringFromUnixTime(end);
    }

    if(segmentation) {
        db.view('assertions_' + segmentation, dbOptions, function(response) {
            var result = {};
            response.forEach(function(row) {
                var date = row.key;
                var segments = Object.keys(row.value);
                segments.forEach(function(segment) {
                    if(! (segment in result)) {
                        result[segment] = [];
                    }

                    result[segment].push({
                        category: date,
                        value: row.value[segment]
                    });
                });
            });

            callback(result);
        });
    } else {
        db.view('assertions', dbOptions, function(response) {
            var result = { Total:
                response.map(function(row) {
                    return { category: row.key, value: row.value };
                })
            };

            callback(result);
        });
    }};

/**
 * Reports the number of users at each step in the sign-in flow for new users
 * @param {String} segmentation segmentation type or null for none
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 */
exports.new_user = function(segmentation, start, end, callback) {
    var dbOptions = {
        group: false
    };

    // Convert timestamps to dates
    if(start) {
        dbOptions.startkey = util.getDateStringFromUnixTime(start);
    }
    if(end) {
        dbOptions.endkey = util.getDateStringFromUnixTime(end);
    }

    if(segmentation) {
        db.view('new_user_' + segmentation, dbOptions, function(response) {
            if(response.length !== 1) {
                console.log('Error: unexpected result from database', response);
                return;
            }

            var rawData = response[0];

            var result = {};
            var segments = Object.keys(rawData.value);
            segments.forEach(function(segment) {
                var steps = Object.keys(rawData.value[segment]);
                result[segment] = steps.map(function(step) {
                    return { category: step, value: rawData.value[segment][step] };
                });
            });

            callback(result);
        });
    } else {
        db.view('new_user', dbOptions, function(response) {
            if(response.length !== 1) {
                console.log('Error: unexpected result from database', response);
                return;
            }

            var rawData = response[0];

            var steps = Object.keys(rawData.value);
            var result = { Total:
                steps.map(function(step) {
                    return { category: step, value: rawData.value[step] };
                })
            };

            callback(result);
        });
    }
};

/**
 * Reports fraction of users at each step in the new user flow, over time
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 */
exports.new_user_time = function(start, end, callback) {
    var dbOptions = {
        group: true
    };

    // Convert timestamps to dates
    if(start) {
        dbOptions.startkey = util.getDateStringFromUnixTime(start);
    }
    if(end) {
        dbOptions.endkey = util.getDateStringFromUnixTime(end);
    }

    db.view('new_user_time', dbOptions, function(dataByDate) {
        // Pivot data
        // (so that it's organized by step, then date; rather than date, step

        // Set up container object
        var dataByStep = {};
        var steps = data.newUserStepNames();
        steps.forEach(function(step) {
            dataByStep[step] = {};
        });

        dataByDate.forEach(function(datum) {
            var date = datum.key;

            steps.forEach(function(step) {
                var value;
                if(! (step in datum.value.steps)) { // No data about this step
                    // That means no one completed it.
                    value = 0;
                } else {
                    value = datum.value.steps[step];
                }

                dataByStep[step][date] = value;
            });
        });

        callback(dataByStep);
    });
};

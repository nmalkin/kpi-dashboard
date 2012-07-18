"use strict";

var aggregate = require('./aggregate'),
    config = require('./config'),
    data = require('./data'),
    db = require('./db'),
    util = require('./util');

/*
 * Given an array of data points, aggregates it by date
 * @param {Array} dataArray array of data objects
 * @return {Object} the data, aggregated by the date of the timestamp
 * @see aggregate.aggregateData
 */
function dateAggregator(dataArray) {
    return aggregate.aggregateData(dataArray, function(datum) {
        return [ data.getDate(datum) ];
    });
}

/**
 * Put data into buckets based on the desired segmentation
 */
function segmentData(rawData, segmentation) {
    var segmentedData;

    if(segmentation === null) { // If no segmentation is specified,
        // everything goes into one bucket.
        segmentedData = { Total: rawData };
    } else { // Otherwise, aggregate by known segments.
        var segments = data.getSegmentations()[segmentation];
        segmentedData = aggregate.aggregateData(rawData, function(datum) {
                var segment = data.getSegmentation(segmentation, datum);
                return segments.indexOf(segment) === -1 ?
                    [ 'Other' ] : [ segment ];
                    // If the segment is unknown, categorize it as "other."
            }
        );
    }

    return segmentedData;
}

/**
 * Processes request for summarized data, aggregated by date.
 *     Handles requesting and segmenting data, all you need to provide
 *     is a way to summarize the data.
 * NOTE: none of the parameters are validated (since this is an internal interface);
 *       this should happen elsewhere
 * @param {String} segmentation segmentation type or null for none
 * @param {Integer} start Unix timestamp of start time or null for none
 * @param {Integer} end Unix timestamp of end time or null for none
 * @param {function: Array -> Object } aggregator function mapping array of data
 *     to object where each field is a bucket of dta objects
 * @param {function: Array -> Number} summarizer function saying how to reduce
 *     an array of data to a single number
 */
function summaryReport(segmentation, start, end, aggregator, summarizer, callback) {
    // Get the requested data
    data.getData(start, end, function(rawData) {
        var segmentedData = segmentData(rawData, segmentation);

        for(var segment in segmentedData) { // for each segment:
            if(segmentedData.hasOwnProperty(segment)) {
                // Put data into buckets according to the aggregator
                var aggregatedData = aggregator(segmentedData[segment]);

                // Summarize the data:
                var summarizedData = aggregate.summarizeData(aggregatedData, summarizer);

                // Replace segmented data with summarized data
                segmentedData[segment] = summarizedData;
            }
        }

        callback(segmentedData);
    });
}

/**
 * Reports median number of sites logged in
 * @see summaryReport for parameter documentation
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
 * @see summaryReport for parameter documentation
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
        var dataByStep = {};

        dataByDate.forEach(function(datum) {
            var date = datum.key,
                steps = datum.value.steps;

            for(var step in steps) {
                if(steps.hasOwnProperty(step)) {
                    if(! (step in dataByStep)) {
                        dataByStep[step] = {};
                    }

                    dataByStep[step][date] = steps[step];
                }
            }
        });

        callback(dataByStep);
    });
};

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
    summaryReport(segmentation, start, end, dateAggregator,
    function(dayData) { // to summarize each day's data,
        // find the median number of sites users are logged in to
        return aggregate.median(dayData.map(data.getNumberSitesLoggedIn));
    }, callback);
};


/**
 * Reports total number of assertions generated
 * @see summaryReport for parameter documentation
 */
exports.assertions = function(segmentation, start, end, callback) {
    summaryReport(segmentation, start, end, dateAggregator,
    function(dayData) { // to summarize each day's data,
        // use the number of data points ~= number of assertions generated ~= login attempts
        return dayData.length;
    }, callback);
};

/**
 * Reports the number of users at each step in the sign-in flow for new users
 */
exports.new_user = function(segmentation, start, end, callback) {
if(segmentation) { // TODO: no support for segmentation yet; use legacy code
    summaryReport(segmentation, start, end,
    function(rawData) {
        // Place data into buckets by step in the flow
        var aggregatedData = aggregate.aggregateData(rawData, data.newUserSteps);

        // We want to make sure there's a bucket for each step in the flow,
        // even if it is empty. (That way, the report looks consistent,
        // and we're providing the user with a list of all steps.)
        config.flows.new_user.forEach(function(step) {
            if(! (step[0] in aggregatedData)) {
                aggregatedData[step[0]] = [];
            }
        });

        return aggregatedData;
    },
    function(stepData) { // to summarize each step's data,
        // use the number of data points = number of users at each step
        return stepData.length;
    }, callback);
} else {
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

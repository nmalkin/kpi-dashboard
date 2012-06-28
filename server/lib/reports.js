"use strict";

var aggregate = require('./aggregate'),
    data = require('./data');

/**
 * Converts Unix time to a string with the respective date (but not time).
 *     The output is a string representing the date that this time falls on.
 *     This is used for bucket-izing, so the exact format is not important.
 * @param {Integer} seconds since epoch
 * @return {String} the date on which this time falls
 */
function getDateStringFromUnixTime(seconds) {
    var date = new Date(seconds * 1000); // Date constructor takes milliseconds
    return date.toLocaleDateString();
}

/*
 * Given an array of data points, aggregates it by date
 * @param {Array} dataArray array of data objects
 * @return {Object} the data, aggregated by the date of the timestamp
 * @see aggregate.aggregateData
 */
function dateAggregator(dataArray) {
    return aggregate.aggregateData(dataArray, function(datum) {
        return getDateStringFromUnixTime(data.getTimestamp(datum));
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
                    'Other' : segment;
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
    summaryReport(segmentation, start, end,
    function(rawData) { // place data into buckets by step in the flow
        return aggregate.aggregateMultiple(rawData, data.newUserSteps);
    },
    function(stepData) { // to summarize each step's data,
        // use the number of data points = number of users at each step
        return stepData.length;
    }, callback);
};

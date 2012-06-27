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
 * Given a data point, returns its date
 * @param {Object} datum data object
 * @return {String} the date of the timestamp
 */
function dateAggregator(datum) {
    return getDateStringFromUnixTime(data.getTimestamp(datum));
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
 * @param {function: Object -> String } aggregator function mapping data object
 *     to the bucket it should be in
 * @param {function: Array -> Number} summarizer function saying how to reduce
 *     an array of data to a single number
 */
function summaryReport(segmentation, start, end, aggregator, summarizer, callback) {
    var segmentations = data.getSegmentations();

    // Get the requested data
    data.getData(start, end, function(rawData) {
        // Put data into buckets based on the desired segmentation
        var segmentedData;
        if(segmentation === null) { // If no segmentation is specified,
            // everything goes into one bucket.
            segmentedData = {Total: rawData};
        } else { // Otherwise, aggregate by known segments.
            segmentedData = aggregate.aggregateBySegment(rawData,
                segmentations[segmentation], function(datum) {
                    return data.getSegmentation(segmentation, datum);
                }
            );
        }

        for(var segment in segmentedData) { // for each segment:
            if(segmentedData.hasOwnProperty(segment)) {
                // Put data into buckets according to the aggregator
                var aggregatedData = aggregate.aggregateData(segmentedData[segment], aggregator);

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


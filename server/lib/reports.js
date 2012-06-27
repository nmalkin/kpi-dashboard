"use strict";

var aggregate = require('./aggregate'),
    data = require('./data');

/**
 * Processes request for summarized data. Handles requesting and segmenting data,
 *     all you need to provide is the way to summarize the data.
 * NOTE: none of the parameters are validated (since this is an internal interface);
 *       this should happen elsewhere
 * @param {String} segmentation segmentation type
 * @param {Integer} start Unix timestamp of start time
 * @param {Integer} end Unix timestamp of end time
 * @param {function: Array -> Number} summarizer function saying how to reduce
 *     an array of data to a single number
 */
function summaryReport(segmentation, start, end, summarizer, callback) {
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
                // Put data into buckets based on the date of the data point
                var aggregatedData = aggregate.aggregateByDate(segmentedData[segment],
                    data.getTimestamp);

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
 */
exports.sites = function(segmentation, start, end, callback) {
    summaryReport(segmentation, start, end, function(dayData) { // to summarize each day's data,
        // find the median number of sites users are logged in to
        return aggregate.median(dayData.map(data.getNumberSitesLoggedIn));
    }, callback);
};


/**
 * Reports total number of assertions generated
 */
exports.assertions = function(segmentation, start, end, callback) {
    summaryReport(segmentation, start, end, function(dayData) { // to summarize each day's data,
        // use the number of data points ~= number of assertions generated ~= login attempts
        return dayData.length;
    }, callback);
};

"use strict";

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

/**
 * Places the data into buckets according to the category returned by the
 *     aggregator function.
 * @param {Array} data the array of data points
 * @param {function: Object -> String} aggregator given a data point, this
 *     function returns the bucket it should be in
 * @return {Object} of the form: { "<bucket>": [{data point}, {data point}, ...] }
 */
exports.aggregateData = function(data, aggregator) {
    var aggregatedData = {};
    data.forEach(function(current) {
        var category = aggregator(current);
        if(! (category in aggregatedData)) {
            aggregatedData[category] = [];
        }
        aggregatedData[category].push(current);
    });
    return aggregatedData;
};

/**
 * Aggregates given data by date.
 * @param {Array} data the array of data points
 * @param {function: ? -> Integer} timeAccessor extracts Unix time from data point
 * @return {Object} bucketized data, where the buckets are dates
 * @see aggregateData
 */
exports.aggregateByDate = function(data, timeAccessor) {
    return exports.aggregateData(data, function(datum) {
        return getDateStringFromUnixTime(timeAccessor(datum));
    });
};

/**
 * Aggregates data by given segments.
 * @param {Array} data the array of data points
 * @param {Array} segments the buckets to use for aggregation
 * @param {function: ? -> String} segmentAccessor extracts the segment in question from data
 * @return {Object} bucketized data, where the buckets are given segments
 *     NOTE: if a segment is not in the segments array, it is put in the bucket "Other"
 * @see aggregateData
 */
exports.aggregateBySegment = function(data, segments, segmentAccessor) {
    return exports.aggregateData(data, function(datum) {
        var segment = segmentAccessor(datum);
        return segments.indexOf(segment) === -1 ?
            'Other' : segment;
            // If the segment is unknown, categorize it as "other."
    });
};

/**
 * Returns the median value of the given array.
 * @param {Array} array an array of numeric values
 * @return {Number} the median value of the array (middle value, or mean of
 *     middle values)
 */
exports.median = function(array) {
    array.sort();
    var center = Math.floor(array.length / 2);
    if(array.length % 2 === 1) {
        return array[center];
    } else {
        return (array[center-1] + array[center]) / 2;
    }
};

/**
 * Summarizes data by reducing all data in a category to a single value.
 * @param {Object} aggregatedData "bucketized" data
 * @param {function: Array -> ?} summarizer a function that reduces an array of
 *     data points to a single value
 * @return {Array} an array of summarized data points: objects containing a
 *     category and a value: [{category: '<category>', value: <value>}, ...]
 */
exports.summarizeData = function(aggregatedData, summarizer) {
    var categories = Object.keys(aggregatedData);
    return categories.map(function(category) {
        var categoryData = aggregatedData[category];
        return { category: category, value: summarizer(categoryData) };
    });
};

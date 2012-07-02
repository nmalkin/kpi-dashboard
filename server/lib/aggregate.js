"use strict";

/**
 * Places the data into buckets according to the categories returned by the
 *     aggregator function.
 * @param {Array} data the array of data points
 * @param {function: Object -> Array[String]} aggregator given a data point, this
 *     function returns the buckets it should be in
 * @return {Object} of the form: { "<bucket>": [{data point}, {data point}, ...] }
 */
exports.aggregateData = function(data, aggregator) {
    var aggregatedData = {};

    data.forEach(function(current) {
        var categories = aggregator(current);
        categories.forEach(function(category) {
            if(! (category in aggregatedData)) {
                aggregatedData[category] = [];
            }
            aggregatedData[category].push(current);
        });
    });

    return aggregatedData;
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
 *     The result is an array of objects, each having a "category" and a "value".
 *     The array is sorted by category name.
 * @param {Object} aggregatedData "bucketized" data
 * @param {function: Array -> ?} summarizer a function that reduces an array of
 *     data points to a single value
 * @return {Array} an array of summarized data points: objects containing a
 *     category and a value: [{category: '<category>', value: <value>}, ...]
 */
exports.summarizeData = function(aggregatedData, summarizer) {
    var categories = Object.keys(aggregatedData).sort();
    return categories.map(function(category) {
        var categoryData = aggregatedData[category];
        return { category: category, value: summarizer(categoryData) };
    });
};

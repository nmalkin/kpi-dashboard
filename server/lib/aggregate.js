"use strict";

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
 * Works like aggregateData, but data can be placed in multiple buckets.
 * @param {Array} data
 * @param {function: Object -> Array[String]} aggregator
 * @return {Object}
 * @see aggregateData
 */
exports.aggregateMultiple = function(data, aggregator) {
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

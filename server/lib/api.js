"use strict";

var aggregate = require('./aggregate'),
    data = require('./data'),
    url = require('url');

/**
 * Writes result to response as a JSON string.
 * @param result any Javascript object to be written to the response
 * @param response a node.js response object
 */
function resultToResponse(result, response) {
    result = (result === null) ? '' : result;
    response.writeHead(200, {'Content-Type': 'application/json'});
    response.write(JSON.stringify(result));
    response.end('\n');
}

/**
 * Processes request for segmentations
 */
exports.segmentations = function(req, res) {
    var segmentations = data.getSegmentations();
    resultToResponse(segmentations, res);
};

/**
 * Parses URL string to get the string value of the named parameter.
 * @param {String} urlStr the string with the URL
 * @param {String} param the name of the parameter whose value should be extracted
 * @return integer value of given parameter, or null if the parameter doesn't exist
 */
function getStrParamFromURL(urlStr, param) {
    var params = url.parse(urlStr, true).query;

    var value = null;

    if(param in params) {
        value = params[param];   
    }

    return value;
}

/**
 * Parses URL string to get the integer value of the named parameter.
 * @param {String} urlStr the string with the URL
 * @param {String} param the name of the parameter whose value should be extracted
 * @return integer value of given parameter,
 *      or null if the parameter doesn't exist or is not an integer
 */
function getIntParamFromURL(urlStr, param) {
    var params = url.parse(urlStr, true).query;

    var value = null;

    if(param in params) {
        value = parseInt(params[param], 10);   

        if(isNaN(value)) {
            value = null;
        }
    }

    return value;
}

/**
 * Processes request for summarized data. Handles requesting and segmenting data,
 *     all you need to provide is the way to summarize the data.
 * @param req request object
 * @param res response object
 * @param {function: Array -> Number} summarizer function saying how to reduce
 *     an array of data to a single number
 */
function handleSummaryRequest(req, res, summarizer) {
    // Parse parameters to get segmentation preference and start and end times for data
    var segmentation = getStrParamFromURL(req.url, 'segmentation'),
        start = getIntParamFromURL(req.url, 'start'),
        end = getIntParamFromURL(req.url, 'end');

    // Validate segmentation preference
    var segmentations = data.getSegmentations();
    if((segmentation !== null) && (! (segmentation in segmentations))) {
        res.send('Invalid segmentation', 400);
        return;
    }

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

        resultToResponse(segmentedData, res);
    });
}

/**
 * Processes request for median number of sites logged in
 */
exports.sites = function(req, res) {
    handleSummaryRequest(req, res, function(dayData) { // to summarize each day's data,
        // find the median number of sites users are logged in to
        return aggregate.median(dayData.map(data.getNumberSitesLoggedIn));
    });
};

/**
 * Processes request for total number of assertions generated
 */
exports.assertions = function(req, res) {
    handleSummaryRequest(req, res, function(dayData) { // to summarize each day's data,
        // use the number of data points ~= number of assertions generated ~= login attempts
        return dayData.length;
    });
};


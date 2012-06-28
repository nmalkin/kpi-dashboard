"use strict";

var data = require('./data'),
    reports = require('./reports'),
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
 * Validates segmentation preference
 * @param {String} segmentation segmentation preference
 * @return {Boolean} true if segmentation is valid, false otherwise
 */
function validateSegmentation(segmentation) {
    var segmentations = data.getSegmentations();
    return (segmentation === null) || (segmentation in segmentations);
}

/**
 * Parses request for parameters, retrieves report, and sends back response
 * @param {function(segmentation, start, end, callback}} report function that
 *     calls callback with results
 * @param {Object} req Express request object
 * @param {Object} res Express response object
 */
function getReport(report, req, res) {
    // Parse parameters to get segmentation preference and start and end times for data
    var segmentation = getStrParamFromURL(req.url, 'segmentation'),
        start = getIntParamFromURL(req.url, 'start'),
        end = getIntParamFromURL(req.url, 'end');

    // Validate segmentation
    if(! validateSegmentation(segmentation)) {
        res.send('Invalid segmentation', 400);
        return;
    }

    // Retrieve report
    report(segmentation, start, end, function(result) {
        // Send it back to client
        resultToResponse(result, res);
    });
}

/**
 * Processes request for median number of sites logged in
 */
exports.sites = function(req, res) {
    getReport(reports.sites, req, res);
};

/**
 * Processes request for total number of assertions generated
 */
exports.assertions = function(req, res) {
    getReport(reports.assertions, req, res);
};

/**
 * Processes request for steps in new user flow
 */
exports.new_user = function(req, res) {
    getReport(reports.new_user, req, res);
};


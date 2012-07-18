"use strict";

/**
 * Converts Unix time to a string with the respective date (but not time).
 *     The output is a string representing the date that this time falls on.
 *     This is used for bucket-izing, so the exact format is not important.
 * @param {Integer} seconds since epoch
 * @return {String} the date on which this time falls, in the format YYYY-MM-DD
 */
exports.getDateStringFromUnixTime = function(seconds) {
    var date = new Date(seconds * 1000); // Date constructor takes milliseconds
    return date.toISOString().substr(0, 10);
};

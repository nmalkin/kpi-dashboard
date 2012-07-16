"use strict";

var config = require('./config'),
    data = require('./data');
var cradle = require('cradle');
var db = new (cradle.Connection)(config.database_server.host, config.database_server.port)
    .database(config.database_server.database);

/*** DATABASE STRUCTURE AND SETUP ***/

/** Name of the design document */
var NAME = 'data';

/** Views used to access data */
var VIEWS = {
    new_user_time: {
        map: function(doc) {
            if(doc.newUserSteps.length > 0) { // Only count new users
                emit(doc.date, doc.newUserSteps);
            }
        },

        reduce: function(keys, values, rereduce) {
            if(rereduce) { // Merge the objects that are the results of the reductions
                var initial = {
                    steps: {},
                    total: 0
                };

                return values.reduce(function(accumulated, current) {
                    var steps = Object.keys(current.steps);
                    steps.forEach(function(step) {
                        if(! (step in accumulated.steps)) {
                            accumulated.steps[step] = 0;
                        }

                        // The fraction of users who completed this step is the
                        // weighted average of the results being merged.
                        var total = accumulated.total + current.total;
                        accumulated.steps[step] = current.steps[step] * current.total / total +
                            accumulated.steps[step] * accumulated.total / total;

                        accumulated.total = total;
                    });

                    return accumulated;
                }, initial);
            } else {
                var steps = {};

                // Count the number of times each step has been completed
                values.forEach(function(userSteps) {
                    userSteps.forEach(function(step) {
                        if(! (step in steps)) {
                            steps[step] = 0;
                        }

                        steps[step]++;
                    });
                });

                // Compute fraction of users completing steps
                var total = values.length;
                for(var step in steps) {
                    if(steps.hasOwnProperty(step)) {
                        steps[step] /= total;
                    }
                }

                return {
                    steps: steps,
                    total: total
                };
            }
        }
    },

    new_user: {
        map: function(doc) {
            if(doc.newUserSteps.length > 0) { // Only count new users
                doc.newUserSteps.forEach(function(step) {
                    emit(doc.date, step);
                });
            }
        },

        reduce: function(keys, values, rereduce) {
            if(rereduce) {
                return values.reduce(function(accumulated, current) {
                    var steps = Object.keys(current);
                    steps.forEach(function(step) {
                        if(! (step in accumulated)) {
                            accumulated[step] = 0;
                        }

                        accumulated[step] = accumulated[step] + current[step];
                    });

                    return accumulated;
                }, {});
            } else {
                var steps = {};
                values.forEach(function(step) {
                    if(! (step in steps)) {
                        steps[step] = 0;
                    }

                    steps[step]++;
                });

                return steps;
            }
        }
    },
};

/**
 * Returns a function, to be used in CouchDB to map data by the given segmentation
 *     The map-by-segmentation functions are identical, except for the
 *     segmentation being mapped. Because CouchDB doesn't support closures,
 *     we take the somewhat hacky approach of converting the function to a
 *     string (which was going to happen anyway) and replacing the name of the
 *     segmentation with the one we want.
 */
var getMapBySegment = function(segmentation) {
    return function(doc) {
        if(doc.newUserSteps.length > 0) {
            doc.newUserSteps.forEach(function(step) {
                emit(doc.date, {
                    step: step,
                    segment: doc["---SEGMENTATION---"]
                });
            });
        }
    }.toString().replace('---SEGMENTATION---', segmentation);
};

/**
 * Reduce function to be used in CouchDB to aggregate segmented data
 */
var reduceBySegment = function(keys, values, rereduce) {
    if(rereduce) {
        return values.reduce(function(accumulated, current) {
            var segments = Object.keys(current);
            segments.forEach(function(segment) {
                if(! (segment in accumulated)) {
                    accumulated[segment] = {};
                }

                var steps = Object.keys(current[segment]);
                steps.forEach(function(step) {
                    if(! (step in accumulated[segment])) {
                        accumulated[segment][step] = 0;
                    }

                    accumulated[segment][step] = accumulated[segment][step] + current[segment][step];
                });
            });

            return accumulated;
        }, {});
    } else {
        var segments = {};
        values.forEach(function(value) {
            if(! (value.segment in segments)) {
                segments[value.segment] = {};
            }

            if(! (value.step in segments[value.segment])) {
                segments[value.segment][value.step] = 0;
            }

            segments[value.segment][value.step]++;
        });

        return segments;
    }
};

// Add per-segmentation views
// ... for new user report
(function() {
    var segmentations = Object.keys(data.getSegmentations());
    segmentations.forEach(function(segmentation) {
        VIEWS['new_user_' + segmentation] = {
            map: getMapBySegment(segmentation),
            reduce: reduceBySegment
        };
    });
})();

/** Design document */
var DOCUMENT = {
    views: VIEWS
};

/**
 * Ensures the database exists and contains the proper views
 */
function initDatabase(callback) {
    db.exists(function(err, exists) {
        if(err) throw(err);

        if(exists) {
            // Update the views stored in the database to the current version.
            // Does this regardless of the current state of the design document
            // (i.e., even if it is up-to-date).
            db.get('_design/' + NAME, function(err, doc) {
                if(err) throw(err);

                db.save('_design/' + NAME, doc._rev, DOCUMENT, function(err, res) {
                    if(err) throw err;

                    callback();
                });
            });
        } else {
            // Create database and initialize views
            db.create(function(err) {
                db.save('_design/' + NAME, DOCUMENT, function(err) {
                    if(err) throw err;

                    callback();
                });
            });
        }
    });
}


// On load:
(function() {
    initDatabase(function() {
        exports.db = db;
    });
})();


/*** DATABASE API ***/

/**
 * Populates the database with data
 */
exports.populateDatabase = function() {
    data.getData(null, null, function(rawData) {
        rawData.forEach(function(datum) {
            // Pre-compute certain values for the report (not already in the datum)
            datum.value.newUserSteps = data.newUserSteps(datum);
            datum.value.date = data.getDate(datum);
            // including segmentations
            var segmentations = Object.keys(data.getSegmentations());
            segmentations.forEach(function(segmentation) {
                datum.value[segmentation] = data.getKnownSegmentation(segmentation, datum);
            });

            // Insert it into the database
            // Conveniently, it already has a UUID, from the last time it was in CouchDB.
            db.save(datum.id, datum.value);
        });
    });
};

/**
 * Returns the results of a given view
 */
exports.view = function(view, params, callback) {
    db.view(NAME + '/' + view, params, function(err, res) {
        if(err) console.log(err);
        callback(JSON.parse(res));
    });
};

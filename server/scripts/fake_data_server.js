#!/usr/bin/env node

/*
 * A simple server generating random KPI data points
 */

"use strict";

var OS = [ "Windows NT 6.1", "Windows NT 5.1", "Macintosh", "Linux", "Android", "iOS" ],
    BROWSER = [ "Firefox", "Chrome", "MSIE", "Safari", "Opera" ],
    LOCALE = [ "en-us", "en-gb" ],
    RESOLUTION = [
        { width: 1024, height: 768 },
        { width: 1280, height: 1024 },
        { width: 1680, height: 1050 },
        { width: 1920, height: 1200 }
    ],
    RANGE = 91, // for timestamp
    TERMINATION_CHANCE = 0.2,
    EVENT_SEQUENCES = [
        [ // Returning user (not authenticated) signing in
            [
              "screen.rp_info",
              356
            ],
            [
              "screen.authenticate",
              388
            ],
            [
              "generate_assertion",
              20546
            ],
            [
              "screen.generate_assertion",
              20571
            ],
            [
              "generate_assertion",
              20610
            ],
            [
              "screen.generate_assertion",
              20624
            ],
            [
              "assertion_generated",
              20696
            ],
            [
              "assertion_generated",
              20753
            ],
            [
              "window.unload",
              22467
            ]
        ],
        [ // Returning user (already authenticated) signing in
            [
              "screen.rp_info",
              342
            ],
            [
              "user.email_count:1",
              359
            ],
            [
              "screen.pick_email",
              379
            ],
            [
              "generate_assertion",
              3683
            ],
            [
              "screen.generate_assertion",
              3689
            ],
            [
              "assertion_generated",
              3756
            ],
            [
              "window.unload",
              5523
            ]
        ],
        [ // New user signing up and signing in
            [
              "screen.rp_info",
              166
            ],
            [
              "screen.authenticate",
              200
            ],
            [
              "screen.set_password",
              46965
            ],
            [
              "user.user_staged",
              53585
            ],
            [
              "screen.check_registration",
              53599
            ],
            [
              "user.user_confirmed",
              71666
            ],
            [
              "generate_assertion",
              71671
            ],
            [
              "screen.generate_assertion",
              71698
            ],
            [
              "assertion_generated",
              71781
            ],
            [
              "window.unload",
              73545
            ]

        ]
    ]
;

/**
 * Returns a random integer from [0, ceil-1]
 */
function randInt(ceil) {
    return Math.floor(Math.random() * ceil);
}

/**"
 * Returns a random value from the given array
 */
function selectRandom(array) {
    return array[randInt(array.length)];
}

/**
 * Returns a random time from the past RANGE days.
 */
function randomTimestamp() {
    var timestamp = Date.now() - Math.random() * RANGE * 24 * 60 * 60 * 1000;
    timestamp = timestamp - (timestamp % (10 * 60 * 1000)); // round to nearest 10 minutes, like in actual data
    return timestamp;
}

/*
 * Returns a randomly generated (but not non-sensical) sequence of events.
 * There are three aspects to the randomness:
 *  1) One of the known EVENT_SEQUENCES is randomly chosen as the base.
 *  2) The interaction has a chance of terminating at any of the steps.
 *  3) The timestamps on the events are "jiggled" randomly.
 */
function randomEvents() {
    var sequence = EVENT_SEQUENCES[randInt(EVENT_SEQUENCES.length)];

    var events = [ sequence[0] ];
    for(var i = 1; i < sequence.length - 1; i++) {
        if(Math.random() < TERMINATION_CHANCE) { // sequence terminates!
            break;
        }

        var event = sequence[i];

        // Jiggle event timestamp
        do {
            event[1] += randInt(3333);
        } while(event[1] <= events[i-1][1]); // make sure timestamps are non-decreasing

        events.push(event);
    }

    // Last event is always window.unload
    var last = sequence[sequence.length - 1];
    // It should happen after all the others, too.
    do {
        last[1] += randInt(3333);
    } while(last[1] <= events[i-1][1]);
    events.push(last);

    return events;
}

/**
 * Returns one randomly-generated data point.
 */
function generateOne() {

    var events = randomEvents(),
        timestamp = randomTimestamp(),
        locale = selectRandom(LOCALE),
        screen = selectRandom(RESOLUTION),
        os = selectRandom(OS),
        browser = selectRandom(BROWSER);

    var d = 
    {
      //"_id": "e3e09710186f21c0d862b8032a294351",
      //"_rev": "1-d03ac3646fd5f62e86923c97ba19cc2b",
      //"event_stream": [
      event_stream: events,
      //"sample_rate": 1,
      "timestamp": timestamp,
      "lang": locale,
      "screen_size": screen,
      "user_agent": {
        "os": os,
        "browser": browser,
        "version": 9001 //TODO: also simulate browser versions
      },
      //"url": "/wsapi/interaction_data/?id=e3e09710186f21c0d862b8032a294351",
      //"duration": Math.random() * 30,
      //"readableDate": "2012 09:30:00-Jun-12"
      "number_sites_logged_in": randInt(13)
    };

    return d;
}

function generate(number) {
    var data = [];
    for(var i = 0; i < number; i++)
        data.push(generateOne());
    return data;
}

var express = require('express');
var app = express.createServer();

app.use(express.logger());

app.get('/data', function(req,res) {
    res.contentType('application/json');
    var WANT_COUNT = 10000;
    var data = generate(WANT_COUNT);
    res.send(data);
});

app.listen(3435);

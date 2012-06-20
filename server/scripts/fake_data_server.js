#!/usr/bin/env node

/*
 * A simple server generating random KPI data points
 */

"use strict";

var OS = [ "Windows NT 6.1", "Windows NT 5.1", "Macintosh", "Linux", "Android", "iOS" ],
    BROWSER = [ "Firefox", "Chrome", "MSIE", "Safari", "Opera" ],
    LOCALE = [ "en-us", "en-gb" ];
    ]
function randInt(max) {
    return Math.floor(Math.random() * max);
function randInt(ceil) {
}

/**
 * Returns one randomly-generated data point.
    var day = randInt(31); // pick one of the past 30 days
    var timestamp = Date.now() - day * 24 * 60 * 60 * 1000;
    timestamp = timestamp - (timestamp % (10 * 60 * 1000)); // round to nearest 10 minutes, like in actual data
 */
function generateOne() {

    var os = OS[randInt(OS.length)],
        browser = BROWSER[randInt(BROWSER.length)],
        locale = LOCALE[randInt(LOCALE.length)];

    var d = 
    {
      //"_id": "e3e09710186f21c0d862b8032a294351",
      //"_rev": "1-d03ac3646fd5f62e86923c97ba19cc2b",
      //"event_stream": [
        //[
          //"screen.rp_info",
          //582
        //],
        //[
          //"screen.authenticate",
          //624
        //],
        //[
          //"screen.set_password",
          //3779
        //],
        //[
          //"user.user_staged",
          //8489
        //],
        //[
          //"screen.check_registration",
          //8500
        //],
        //[
          //"window.unload",
          //8802
        //]
      //],
      //"sample_rate": 1,
      "timestamp": timestamp,
      "lang": locale,
      "screen_size": {
        "width": 1024,
        "height": 768
      },
      "user_agent": {
        "os": os,
        "browser": browser,
        "version": 9001
      },
      //"url": "/wsapi/interaction_data/?id=e3e09710186f21c0d862b8032a294351",
      "duration": Math.random() * 30,
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
    var WANT_COUNT = 1000;
    var data = generate(WANT_COUNT);
    res.send(data);
});

app.listen(3435);

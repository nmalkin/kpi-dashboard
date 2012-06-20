/*global data:true */

/*
 * A utility script. Based on a data dump (in the data variable), counts the
 * number of occurrences of each OS, browser, and locale.
 * Useful seeing which values are in the dataset and which are the most popular
 * ones.
 */

"use strict";
var os = {},
    browser = {},
    locale = {};

var myos, mybrowser, mylocale;

data.forEach(function(d,i) {
    console.log('t');
    //console.log(d);
    console.log(i, data.length);

    if(! ('user_agent' in d.value)) return;

    myos = d.value.user_agent.os;
    mybrowser = d.value.user_agent.browser;
    mylocale = d.value.lang;

    if(! (myos in os)) os[myos] = 0;
    if(! (mybrowser in browser)) browser[mybrowser] = 0;
    if(! (mylocale in locale)) locale[mylocale] = 0;

    os[myos]++;
    browser[mybrowser]++;
    locale[mylocale]++;
});

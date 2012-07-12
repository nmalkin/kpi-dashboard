KPI Dashboard
=============

Motivation
----------
[Mozilla Persona](https://www.mozilla.org/en-US/persona/) is "an identity system
for the web." More specifically, it is a distributed, privacy-preserving single
sign-on system for web sites and applications. Rather than having to manage
multiple usernames and passwords, it allows you to sign in to a website using
the email address of your choice.

As part of our goal to make Persona the best sign-in solution, we are 
continually working to streamline and improve the user experience. To better
understand how our users are using the system, we collect certain statistics
(suitably anonymized) about users' interaction with the interface.

The goal of the KPI dashboard is to present this information in a meaningful
and informative manner.

What is it?
-----------
The dashboard provides a number of different reports, visualizing the Key
Performance Indicators (KPIs) of users interacting with the Persona dialog.

Sample KPIs include:

- Median number of sites a user logs into with Persona
- The drop-off rate of new users following the sign-in flow
- Percentage of successful password resets
- Percentage of users successfully activating additional email addresses
- Number of new users

As the dashboard is developed, other KPIs may be added (or may replace) these.

Where is the data?
------------------
The interaction data collected in the Persona dialog is sent over and stored in
the [KPI Backend](https://wiki.mozilla.org/Privacy/Reviews/KPI_Backend).

[KPIggybank](https://github.com/jedp/kpiggybank) is an implementation of the
backend that provides an interface for storing and retrieving this data. The
KPI Dashboard will use KPIggybank's interface for accessing the data.

The location of the data server is defined in the configuration file found in
`server/config/config.json`.

An implementation of a server serving randomized interaction data (in the
expected format) is provided in `server/scripts/fake_data_server.js`. You can
run it using the command `npm run-script data`.

Prerequisites
-------------
The KPI dashboard run on [NodeJS](http://www.nodejs.org/).

Once you have Node and [npm](http://npmjs.org/), you can install additional
dependencies by running the command `npm install`.

Running
-------
Start the server with `npm start`. The server runs, by default, on port 3434.


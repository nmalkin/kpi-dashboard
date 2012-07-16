"use strict";

// Directives for JSHint:
/*global $:false, Rickshaw:false, d3:false */

/**
 * Converts the given timestamp to a string date
 * @param {Integer} timestamp seconds since epoch
 * @return {String} date in the format YYYY-MM-DD
 */
function timestampToDate(timestamp) {
    return (new Date(timestamp * 1000)).toISOString().substr(0,10);
}

var DATA_URL = '/data/',
    SEGMENTATIONS_URL = '/data/segmentations',
    EARLIEST_DATE = '2012-05-01', // The earliest date to use as input.
        // TODO: ^ get from server
    LATEST_DATE = timestampToDate(Date.now() / 1000), // today
    DEFAULT_SERIES = [ {
        name: 'Data',
        color: '#c05020',
        data: [{x:0, y:0}]
    } ];

var GRAPH_CONTAINER = '.chart';

var _reports = {
    // Report: new user flow over time
    new_user_time:
        {
            kpi: 'new_user_time',
            id: '#new_user_time',
            tab: $('#new_user_time'),
            dataToSeries: function(d) { return d; },
            update: null,
            start: dateToTimestamp(EARLIEST_DATE),
            end: dateToTimestamp(LATEST_DATE),
            dimensions: {
                width: 700,
                height: 600,
                padding: { vertical: 100, horizontal: 0 }
            }
        },
    // Report: new user flow
    new_user:
        {
            kpi: 'new_user',
            tab: $('#new_user'),
            dataToSeries: null, // will be filled in during initialization
            graphDecorator: initStepGraph,
            update: updateGraph,
            steps: [], // will hold the names of the steps
            total: 0, // will hold the total number of people report covers
            graph: null,
            series: null,
            start: dateToTimestamp(EARLIEST_DATE),
            end: dateToTimestamp(LATEST_DATE),
            segmentation: null
        },
    // Report: median of number_sites_logged_in
    sites:
        {
            kpi: 'sites',
            tab: $('#sites'),
            dataToSeries: dataToTimeSeries,
            graphDecorator: initTimeGraph,
            update: updateGraph,
            graph: null,
            series: null,
            start: dateToTimestamp(EARLIEST_DATE),
            end: dateToTimestamp(LATEST_DATE),
            segmentation: null
        }, 
    // Report: total number of data points
    assertions:
        {
            kpi: 'assertions',
            tab: $('#assertions'),
            dataToSeries: dataToTimeSeries,
            graphDecorator: initTimeGraph,
            update: updateGraph,
            graph: null,
            series: null,
            start: dateToTimestamp(EARLIEST_DATE),
            end: dateToTimestamp(LATEST_DATE),
            segmentation: null
        }
};

var _milestones = [];

/*** TAB SWITCHING ***/

/**
 * Switches tabs when tab button is clicked and records event in history
 */
$('[data-toggle="tab"]').click(function(e) {
    e.preventDefault();

    var target = $(e.target);

    // Is this tab already active?
    var parent = target.parent('li');
    if(parent.hasClass('active')) {
        return;
    }

    // Inactivate current tab
    parent.siblings('.active').removeClass('active');

    // Inactivate current tab contents
    var container = parent.parents('.tabbable');
    container.find('.active').removeClass('active');

    // Which report do we want activated?
    var report = target.attr('href');
        // Of the form '#report', so it already includes the ID selector

    // Activate new tab
    parent.addClass('active');

    // Activate new tab contents
    $(report).addClass('active');

    // Record event in browser history
    history.pushState({ report: report }, '', report);
});

/**
 * Activates tab when page state changes
 */
window.onpopstate = function(event) {
    var activateTab = function(report) {
        // Inactivate currently selected tab and contents
        $('.tabbable .active').removeClass('active');

        // Activate new tab
        $('[data-toggle="tab"][href="' + report + '"]').parent('li').addClass('active');

        // Activate new tab contents
        $(report).addClass('active');
    };

    var report;
    if('state' in event && event.state !== null) { // Try opening tab based on state
        report = event.state.report;
        activateTab(report);
    } else if(window.location.hash !== '') {
        // There's no state, but maybe we can get the report from the hash?
        report = window.location.hash;
        // Does a tab with the requested ID exist?
        if($('[data-toggle="tab"][href="' + report + '"]').length > 0) { // Yes!
            activateTab(report);   
        }
    } else { // No state, no hash
        // Just show the first report in this case.
        report = $($('[data-toggle="tab"]')[0]).attr('href');
        activateTab(report);
    }
};

window.onload = window.onpopstate;


/*** DATA RETRIEVAL ***/

/**
 * Retrieves data from server, calls callback with the data as the argument
 * @param {Object} options an object with parameters that will be sent to the server
 *     @see jQuery.getJSON
 */
function getData(kpi, options, callback) {
    var url = DATA_URL + kpi;
    $.getJSON(url, options, function(data) {
        callback(data);
    });
}


/*** DATA PROCESSING ***/

/**
 * Converts a human-readable date string into Unix time (seconds since epoch)
 * @return {Integer} number of seconds elapsed from epoch on this date
 */
function dateToTimestamp(date) {
    return Math.floor(Date.parse(date) / 1000);
}

/**
 * Converts a data object (server representation) to an array of series objects
 *     (Rickshaw representation).
 * @param {Object} data object of the form { <segment>: [ { category: '<date>', value: <value> }, ...], ... }
 * @return {Array} [ { name: '<name>', data: [ {x:<x>, y:<y>}, ...], color: '<color>' }, ...]
 */
function dataToTimeSeries(data) {
    // Choose colors from built-in color scheme
    var palette = new Rickshaw.Color.Palette( { scheme: 'spectrum14' } );

    var series = [];
    for(var segment in data) {
        if(data.hasOwnProperty(segment)) {
            series.push({
                name: segment,
                color: palette.color(),
                data: data[segment].map(function(d) {
                    return {
                        // convert date to timestamp to take advantage of
                        // Rickshaw's built-in date handling 
                        x: dateToTimestamp(d.category),
                        y: d.value
                    };
                }).sort(function(a,b) { return a.x - b.x; }) // sort by ascending date
            });
        }
    }

    Rickshaw.Series.zeroFill(series);
    
    return series;
}

/**
 * Loads data for the report's selected segmentation from the server,
 *     converts it to series form (storing it with the report), and
 *     calls callback with no arguments when done.
 *     Uses cumulative data if segmentation is null.
 * @param {Object} report object with report's variables
 * @param {function: Object -> Array} dataToSeries function mapping a data object
 *     of the form
 *         { <segment>: [ { category: '<date>', value: <value> }, ...], ... }
 *     to an array of series objects:
 *         [ { name: '<name>', data: [ {x:<x>, y:<y>}, ...], color: '<color>' }, ...]
 * @param {function} callback to be called when done
 */
function loadData(report, callback) {
    var options = {};

    ['start', 'end', 'segmentation'].forEach(function(property) {
        if(report[property] !== null) {
            options[property] = report[property];
        }
    });

    getData(report.kpi, options, function(data) {
        report.series = report.dataToSeries(data);

        callback();
    });
}


/*** DATA DISPLAY ***/

/**
 * Recreates the graph using the data in series.
 * @param {Array} series the array of data in Rickshaw format
 */
function drawGraph(report, series) {
    var container = report.tab.find(GRAPH_CONTAINER);

    // Clear out graph container
    container.html('');

    // Set up a new Rickshaw graph
    report.graph  = new Rickshaw.Graph( {
        element: container[0],
        width: 650,
        height: 500,
        padding: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
        renderer: 'area',
        series: series
    });
    report.graph.render();
}

/**
 * Sets up a Rickshaw time series graph in the given report
 *     The graph object itself must already be initialized.
 *     @see drawGraph
 */
function initTimeGraph(report) {
    var hoverDetail = new Rickshaw.Graph.HoverDetail( {
        graph: report.graph,
        xFormatter: function(x) {
            // Convert timestamp to date for use as the hover detail
            return (new Date(x * 1000)).toLocaleDateString();
        }
    } );

    var xAxis = new Rickshaw.Graph.Axis.Time({
        graph: report.graph
    });
    xAxis.render();

    var yAxis = new Rickshaw.Graph.Axis.Y({
        graph: report.graph
    });
    yAxis.render();

    var annotator = new Rickshaw.Graph.Annotate({
        graph: report.graph,
        element: report.tab.find('.timeline')[0]
    });

    _milestones.forEach(function(milestone) {
        annotator.add(dateToTimestamp(milestone.date), milestone.milestone);
    });
}

/**
 * Sets up a Rickshaw step-graph in the given report
 *     The graph object itself must already be initialized.
 *     @see drawGraph
 */
function initStepGraph(report) {
    // hover details
    var hoverDetail = new Rickshaw.Graph.HoverDetail( {
        graph: report.graph,
        xFormatter: function(x) { // Display step name (remove step number)
            return report.steps[x].substr(4);
        },
        yFormatter: function(y) { // Display percentage of total users
            return (report.total === 0) ? '0' : Math.round(y / report.total * 100) + '%';
        }
    } );

    // y axis
    var yAxis = new Rickshaw.Graph.Axis.Y({
        graph: report.graph
    });

    yAxis.render();
}

/**
 * Updates the graph with the given series.
 *     Note: the graph needs to be initialized for that to work.
 * @param {Array} an array of series objects (in Rickshaw format)
 */
function updateGraph(report) {
    // If any series are empty, filter them out.
    var newSeries = report.series.filter(function(series) {
        return series.data.length > 0;
    });

    // Rickshaw extends the prototype of the series array. Copy over the extension(s).
    newSeries.active = report.graph.series.active;

    // Update the graph with the new series
    report.graph.series = newSeries;
    try {
        report.graph.update();
    } catch(e) { // Something bad happened while trying to update the graph.
        // Draw a new graph
        drawGraph(report, newSeries);
        report.graphDecorator(report);
    }
}

/**
 * Loads data for current segmentation and updates graph.
 */
function reloadGraph(report) {
    loadData(report, function() {
        updateDisplayedSegments(report);
    });
}


/*** REPORT CONFIGURATION ***/

/**
 * Validates currently selected dates, then updates report based on them
 *     Updating the report entails loading new data and updating the graph.
 *     This only happens if the dates pass validation.
 * @return {Boolean} false if dates were invalid, true otherwise
 */
function dateChanged(report) {
    ['start', 'end'].forEach(function(type) {
        var input = report.tab.find('input[type=date].' + type).val();
        var milliseconds = (new Date(input)).getTime(); // milliseconds since epoch
        
        if(isNaN(milliseconds)) { // Not a valid date
            alert('Invalid date entered');
            return false;
        }

        report[type] = Math.floor(milliseconds / 1000); // in seconds
    });

    // Check for valid date range
    if(report.start && report.end && report.start > report.end) {
        alert("Your start date is after your end date. You won't get any data that way.");
        return false;
    }

    loadData(report, function() {
        report.update(report);
    });

    return true;
}

/**
 * Updates the visibility of segment checkboxes based on currently selected
 *     segmentation value.
 */
function segmentationChanged(report) {
    // Un-select current value
    if(report.segmentation) {
        report.tab.find('.segment-' + report.segmentation).hide();
    }

    // Show controls for selected value
    report.segmentation = report.tab.find('.segment-select').val();
    report.tab.find('.segment-' + report.segmentation).show();

    // Get new data and update graph.
    loadData(report, function() {
        updateDisplayedSegments(report);
    });
}

/**
 * Updates report's segmentation and the visiblity of segmentation-selection controls
 *     based on the value of the control radio button
 */
function cumulativeToggled(report) {
    var cumulative = (report.tab.find('input.segment-enabled:radio:checked').val() === 'no');

    // Toggle display of segmentation options
    report.tab.find('.segment-options').toggle(! cumulative);

    // if user wants cumulative display, segmentation is null
    report.segmentation = cumulative ? null : report.segmentation;

    if(cumulative) { // Load data and update graph
        loadData(report, function() {
            updateGraph(report);
        });
    } else {
        segmentationChanged(report);        
    }
}

/**
 * Returns an array of the selected segments for the current segmentation.
 */
function getSelectedSegments(report) {
    var segments = [];
    if(report.segmentation) {
        report.tab.find('.segment-' + report.segmentation + ' .segment-toggle:checked').each(function() {
            segments.push($(this).val());
        });
    }
    return segments;
}

/**
 * Updates which segments are displayed on the graph.
 * 
 * Since we already have data for all segments, no new data is needed;
 * we just create a series using only those segments we want and display that.
 *
 * The new series is injected into the graph, and the graph is updated.
 * (This preserves the status of the slider.)
 *
 * @return {Boolean} true if the graph was updated, false if it wasn't
 *     NOTE: The one case where the graph wouldn't be updated is if the new series is
 *     empty, i.e., the user is trying to hide all segments. However, due to a
 *     limitation of Rickshaw, at least one series must be displayed at all times.
 *     So, in this situation, we just don't update the graph.
 */
function updateDisplayedSegments(report) {
    // Create a new series with just the selected segments
    var segments = getSelectedSegments(report);
    var newSeries = report.series.filter(function(segment) {
        return segments.indexOf(segment.name) !== -1;
    });

    // Rickshaw breaks on empty series, so give it a blank one instead.
    if(newSeries.length === 0) {
        return false;
    }

    // Temporarily overwrite full series with filtered series,
    // so that updateGraph can get at them.
    var allSeries = report.series;
    report.series = newSeries;

    updateGraph(report);

    // Restore full series
    report.series = allSeries;

    return true;
}

/**
 * Creates controls on the page for all segmentations and their segments
 */
function setupSegmentControls() {
    // Load segmentations from the server
    $.getJSON(SEGMENTATIONS_URL, function(segmentations) {
        // Set up controls for the segmentations
        for(var category in segmentations) { // for each segmentation:
            if(segmentations.hasOwnProperty(category)) {
                // Create an option to turn it on
                $('.segment-select').append('<option>' + category + '</option>');

                // Create a div for checkboxes
                $('.segment-boxes').append('<ul class="segment-' + category + ' segment-box controls"></ul>');

                // Add an "other" option
                segmentations[category].push('Other');
                
                // Create a checkbox for each segment
                segmentations[category].forEach(function(segment) {
                    $('.segment-' + category).append(
                        '<li><label class="checkbox"><input class="segment-toggle" type="checkbox" checked="checked" value="' +
                        segment + '">' + segment + '</label></li>');
                });
            }
        }

        // React to toggling segments
        $('input.segment-toggle').click(function(e) {
            var report = targetReport(e.target);
            var success = updateDisplayedSegments(report);
            
            // If the update failed, leave the checkbox in its original state.
            // @see updateDisplayedSegments for why this might happen
            if(! success) {
                e.preventDefault();
            }
        });
    });
}

/**
 * Updates the graph to use the given kind of visualization.
 * @param {String} type the name of the renderer to use (e.g., 'area', 'line')
 *     accepted values are any renderers supported by Rickshaw
 */
function toggleVisualization(report, type) {
    report.graph.configure({ renderer: type });
    report.graph.update();
}

/**
 * Returns the report associated with the given target element
 * @param {Element} element DOM element, the target of an event
 * @return {Object} the report object for the pane that this element is in
 */
function targetReport(element) {
    var report = $(element).parents('.tab-pane').attr('id');
    return _reports[report];
}


/*** ON LOAD ***/

// Setup segmentation controls for all reports
setupSegmentControls();

// Load milestones
getData('milestones', {}, function(data) {
    _milestones = data;
});

// Set up report for new user flow over time

(function(report) {
    loadData(report, function() {
        // Set up the svg element
        var chart = d3.select(report.id + ' .chart')
            .append('svg')
            .attr('width', report.dimensions.width + report.dimensions.padding.horizontal)
            .attr('height', report.dimensions.height + report.dimensions.padding.vertical)
            .append('svg:g')
            .attr('transform', 'translate(30,20)');

        // Set up containers for paths, ticks, and labels
        chart.append('svg:g').attr('class', 'paths');
        chart.append('g').attr('class', 'y-ticks');
        chart.append('g').attr('class', 'x-ticks');

        var y = d3.scale.linear().range([report.dimensions.height, 0]);
        var color = d3.scale.category10();

        // Draw y axis ticks and labels
        var y_ticks = chart.select('.y-ticks')
            .selectAll('.tick')
            .data(y.ticks(10))
        ;

        y_ticks
            .enter()
            .append('svg:g')
            .attr('transform', function(d) { return 'translate(0, ' + y(d) + ')'; } )
            .attr('class', 'tick')
        ;

        y_ticks
            .exit()
            .remove()
        ;

        y_ticks.append('svg:line')
            .attr('x1', 0)
            .attr('y1', 0)
            .attr('x2', report.dimensions.width)
            .attr('y2', 0)
        ;

        y_ticks.append('svg:text')
            .text(function(d) { return Math.round(d * 100) + '%'; })
            .attr('text-anchor', 'end')
            .attr('dy', 2)
            .attr('dx', -4)
        ;

        // Legend
        var steps = Object.keys(report.series).sort();
        d3.select('body').select(report.id + ' .legend')
            .selectAll('p')
            .data(steps)
            .enter()
            .append('p')
            .style('color', function(d,i) { return color(i); } )
            .text(function(d) { return d; })
        ;

        _reports.new_user_time.update = function(report) {
            var rawData = report.series;

            var dates = Object.keys(rawData[steps[0]]).sort();
            var data = steps.map(function(step) {
                return dates.map(function(date) {
                    return rawData[step][date];
                });
            });

            // Draw paths
            var x = d3.scale.linear().domain([0, data[0].length - 1]).range([0, report.dimensions.width]);

            var lines = chart
                .select('.paths')
                .selectAll('path')
                .data(data);
            
            lines
                .enter()
                .append('svg:path')
                .attr('stroke', function(d,i) { return color(i); })
                .attr('d',
                    d3.svg.line()
                    .x(function(d,i) { return x(i); } )
                    .y(function(d,i) { return y(d); } )
                )
            ;

            lines
                .attr('d',
                    d3.svg.line()
                    .x(function(d,i) { return x(i); } )
                    .y(function(d,i) { return y(d); } )
                )

            lines
                .exit()
                .remove()
            ;


            // Draw x axis ticks and labels
            var x_ticks = chart.select('.x-ticks')
                .selectAll('.tick')
                .data(dates, function(d) { return d; } );

            var xEnter = x_ticks
                .enter()
                .append('svg:g')
                .attr('transform', function(d,i) { return 'translate(' + x(i) + ', ' + report.dimensions.height + ')'; } )
                .attr('class', 'tick x-tick')
            ;

            xEnter.append('svg:line')
                .attr('x1', 0)
                .attr('y1', 0)
                .attr('x2', 0)
                .attr('y2', -1 * report.dimensions.height)
            ;

            xEnter.append('svg:text')
                .attr('dy', 0)
                .attr('dx', 5)
                .attr('transform', 'rotate(90)')
            ;

            x_ticks
                .exit()
                .remove()
            ;

            x_ticks
                .attr('transform', function(d,i) { return 'translate(' + x(i) + ', ' + report.dimensions.height + ')'; } )
            ;

            var numTicks = Math.min(10, dates.length);
            chart.selectAll('.x-tick text')
                .text(function(d,i) {
                    return (i % Math.floor(dates.length / numTicks) == 0) ? d : '';
                })

        };

        report.update(report);
    });
})(_reports.new_user_time);


// Set up new user flow report
(function(report) {
    // How to convert data to a Rickshaw series
    report.dataToSeries = function(data) {
        // Choose colors from built-in color scheme
        var palette = new Rickshaw.Color.Palette( { scheme: 'spectrum14' } );

        // Keep track of total number of people
        report.total = 0;

        var series = [];
        for(var segment in data) {
            if(data.hasOwnProperty(segment)) {
                var segmentData = data[segment];

                if(segmentData.length > 0) {
                    // 100% of people will be present in the first step,
                    // so we add the number from the first step to the total.
                    report.total += segmentData[0].value;
                }

                series.push({
                    name: segment,
                    color: palette.color(),
                    data: segmentData.map(function(d) {
                        // The first character in the category is the step number:
                        var step = parseInt(d.category[0], 10);

                        // Save the step name
                        report.steps[step] = d.category;

                        return {
                            x: step,
                            y: d.value
                        };
                    })
                });
            }
        }

        Rickshaw.Series.zeroFill(series);

        return series;
    };

    loadData(report, function() {
        drawGraph(report, report.series);

        // Format graph with proper axes and hover details
        report.graphDecorator(report);

        // Put the controls and graph in a consistent state
        cumulativeToggled(report);
    });
})(_reports.new_user);

// Setup report for sites and assertions
[_reports.sites, _reports.assertions].forEach(function(report) {
    loadData(report, function() {
        drawGraph(report, report.series);
        report.graphDecorator(report);
        cumulativeToggled(report);
    });
});

$('.reload').click(function(e) {
    var report = targetReport(e.target);
    cumulativeToggled(report);
});

$('.segment-select').change(function(e) {
    var report = targetReport(e.target);
    segmentationChanged(report);
});

$('input.segment-enabled:radio').change(function(e) {
    var report = targetReport(e.target);
    cumulativeToggled(report);
});

$('input.vis-type:radio').change(function(e) {
    var report = targetReport(e.target);
    toggleVisualization(report, $(e.target).val());
});

// Initialize date pickers
$('input[type=date]').datepicker({ dateFormat: 'yy-mm-dd' });

// Initialize date range to default values
$('input[type=date].start').val(EARLIEST_DATE);
$('input[type=date].end').val(LATEST_DATE);

// Initialize sliders to also be used as date inputs
(function() {
    // Slider input must be numeric; convert dates to Unix time
    var startTime = dateToTimestamp(EARLIEST_DATE);
    var endTime = dateToTimestamp(LATEST_DATE);

    $('.date-slider').dragslider({
        range: true,
        rangeDrag: true,
        min: startTime,
        max: endTime,
        values: [startTime, endTime],
        slide: function(event, ui) { // Update date boxes when slider moves
            var report = targetReport(event.target);

            var startDate = timestampToDate(ui.values[0]);
            var endDate = timestampToDate(ui.values[1]);
            
            $('input[type=date].start').val(startDate);
            $('input[type=date].end').val(endDate);

            dateChanged(report);
        }
    });
})();

// Update date ranges when inputs change
$('input[type=date]').change(function(e) {
    var report = targetReport(e.target);

    if(dateChanged(report)) { // If the selected dates pass validation,
        // Update the slider to reflect the change
        var target = $(e.target);
        var slider = report.tab.find('.date-slider');
        var currentValues = slider.dragslider('option', 'values');
        var timestamp = dateToTimestamp(target.val());
        if(target.hasClass('start')) {
            slider.dragslider('option', 'values', [timestamp, currentValues[1]]);
        } else if(target.hasClass('end')) {
            slider.dragslider('option', 'values', [currentValues[0], timestamp]);
        }
    }
});

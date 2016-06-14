function renderFancySelectBox(selectElement) {
    var fancySelectContainer = $(
        '<div class="dropdown-container ' + selectElement.attr('id') + '-dropdown">'
    );

    fancySelectContainer.append(
        '    <div class="dropdown-display">' +
        '        <span class="variable">' + selectElement.find('option:selected').text() + '</span>' +
        '        <span class="ss-icon ss-navigatedown"></span>' +
        '    </div>'
    );

    fancySelectOptionHolder = $('<div class="dropdown-list">');
    fancySelectOptionInner = $('<div>');

    _.each(selectElement.find('option'), function(option) {
        var optionClasses = 'fancy-select-option';
        if (option.selected) {
            optionClasses += ' selected';
        }

        fancySelectOptionInner.append(
            '<div class="' + optionClasses + '" data-slug="' + option.value + '">' +
            '    <span class="ss-icon ss-check"></span>' +
            '    <span>' + option.text + '</span>' +
            '</div>'
        );
    });

    fancySelectOptionHolder.append(fancySelectOptionInner);
    fancySelectContainer.append(fancySelectOptionHolder);

    selectElement.after(fancySelectContainer);

    fancySelectContainer.find(".dropdown-display").on('click', function(e) {
        e.stopPropagation();
        $('.dropdown-container').not($(this).parent()).removeClass('show');

        $(this).parent().toggleClass('show');
    });

    fancySelectContainer.find(".fancy-select-option").on('click', function() {
        selectElement.val($(this).attr('data-slug')).change();

        $('.dropdown-container').removeClass('show');
    });

    selectElement.change(function() {
        fancySelectContainer.find(".variable").text(
            selectElement.find('option:selected').text()
        );
        fancySelectContainer.find(
            ".fancy-select-option"
        ).removeClass('selected');
        fancySelectContainer.find(
            ".fancy-select-option[data-slug='" + this.value + "']"
        ).addClass('selected');
    });
}


var HomicideTracker = Backbone.View.extend({
    initialize: function(opts) {
        this.el = opts.el;
        this.componentOpts = opts.components;

        this.chatterHolder = new ChatterHolderView({
            parentView: this,
            componentSlug: "ChatterHolder"
        });

        this.countHolder = new CountHolderView({
            parentView: this,
            componentSlug: "CountHolder"
        });

        this.filterHolder = new FilterHolderView({
            parentView: this,
            componentSlug: "FilterHolder"
        });

        this.resultsHolder = new ResultsHolderView({
            parentView: this,
            componentSlug: "ResultsHolder"
        });

        this.render({
            isFirstRender: true
        });
    },

    render: function(opts) {
        var renderedComponents = {
            ChatterHolderHTML: this.chatterHolder.render().$el.html(),
            CountHolderHTML: this.countHolder.render().$el.html(),
            // CountHolderHTML: "ASDF 9989",
            FilterHolderHTML: this.filterHolder.render().$el.html(),
            ResultsHolderHTML: this.resultsHolder.render().$el.html()
        };

        var currentElement = this.$el;

        currentElement.html(ich.HomicideTrackerTPL(renderedComponents));

        this.handleResize();

        if (currentElement.find(".count-holder .count-section.date-picker select").next().length === 0) {
            renderFancySelectBox(currentElement.find(".count-holder .count-section.date-picker select"));
        }

        currentElement.find(".filter-holder ol li h3 .clear-filter").unbind().click(function(e) {
            if ($(this).is(':visible')) {
                var thisFilter = $(this).closest('li');

                if (thisFilter.hasClass('active')) {
                    thisFilter.removeClass('active');

                    if (thisFilter.find("input[type='checkbox']:checked").length > 0) {
                        thisFilter.find("input[type='checkbox']:checked").prop('checked', false);
                    }
                }
            }
        });

        var tracker = this;
        setTimeout(function() {
            tracker.finishRender(opts);
        }, 200);

        currentElement.find(".filter-holder .graph-bar input[type='checkbox']").unbind().change(function(e) {
            var activeChoices = $(this).closest('.graph-bar').find("input[type='checkbox']:checked");

            if (activeChoices.length > 0) {
                $(this).closest('li').addClass('active');
            } else {
                $(this).closest('li').removeClass('active');
            }
        });

        currentElement.find("form .filter-holder .button-holder input").unbind().click(function(event) {
            event.preventDefault();

            if ($(this).hasClass('more-options-toggle')) {
                currentElement.find(".filter-holder .extra-filters").slideToggle();
                // setTimeout(function() {
                //     var hiddenSelects = currentElement.find(".filter-holder .extra-filters select");

                //     if (hiddenSelects.css('display') == 'block') {
                //         hiddenSelects.css('display', 'inline');
                //     } else {
                //         hiddenSelects.css('display', 'block');
                //     }
                // }, 300);
            }
        });


        $(window).resize(function() {
            tracker.handleResize();
        });
    },

    finishRender: function(opts) {
        var currentElement = this.$el,
            isFirstRender = false;

        if (typeof opts != "undefined") {
            isFirstRender = opts.isFirstRender || false;
        }

        _.each(
            currentElement.find(".filter-holder .graph-bar label .bar-chart"),
            function(bar) {
                $(bar).css('width', $(bar).attr('final-width'));
            }
        );

        if (isFirstRender) {
            _.each(
                this.filterHolder.filters,
                function(filterObj, filterName) {
                    if (filterObj.filterType == 'nullBooleanFilter') {
                        var filterElement = currentElement.find(
                            '.filter-holder #homicide-filter-' + filterName + ' .chart-pie'
                        );

                        filterObj.chart = drawPie({
                            element: $(filterElement),
                            data: filterObj.data,
                            animate: true,
                            animationDuration: 500,
                            textOffset: 18,
                            clickEvent: function() {
                                console.log("Clicked.");
                            }
                        });

                        $(window).resize(function() {
                            if (filterObj.chart != "undefined") {
                                filterObj.chart.initialize({
                                    animationDuration: 0
                                });
                            }
                        });
                    }
                }
            );
        }
    },

    handleResize: function() {
        _.each(
            this.$el.find('.filter-holder .chart-pie'),
            function(chartDiv) {
                var chartHolder = $(chartDiv);

                chartHolder.css('height', chartHolder.css('width'));
            }
        );
    }
});

var ChatterHolderView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.componentSlug = opts.componentSlug;
    },

    render: function(opts) {
        var configData;

        if (typeof opts != "undefined") {
            configData = opts;
        } else {
            configData = this.parentView.componentOpts[this.componentSlug];
        }

        $(this.el).html(ich.ChatterHolderTPL(configData));

        return this;
    }
});

var CountHolderView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.componentSlug = opts.componentSlug;

        this.lastFullYear = '2015';
        this.lastFullMonth = {
            month: 'Dec.',
            year: '2015'
        };
        this.currentYear = '2016';

        this.dateChoices = this.generateDateChoices();
    },

    render: function(opts) {
        var configData;

        if (typeof opts != "undefined") {
            configData = opts;
        } else {
            configData = this.parentView.componentOpts[this.componentSlug];
        }

        // TODO: Handle changing which dates are selected.
        var currentDatesChoice = {},
            selectedDatesChoice = _.where(this.dateChoices, {selected: true});

        if (selectedDatesChoice.length > 0) {
            currentDatesChoice = selectedDatesChoice[0];
        }

        // TODO: Retrieve 'homiCounts' from this.parentView.data (once filtered).
        // Generate 'countLabelText' based on whether it's the full dataset or
        // a filtered subset, being sure to properly pluralize the output.
        var homiCounts, countLabelText;

        homiCounts = 150;
        countLabelText = 'total homicides in 2015';
        // countLabelText = 'matching homicides in 2015 (out&nbsp;of&nbsp;150&nbsp;total)';

        $(this.el).html(ich.CountHolderTPL({
            homiCounts: homiCounts,
            countLabelText: countLabelText,
            dateChoices: this.dateChoices,
            currentDatesChoice: currentDatesChoice
        }));

        return this;
    },

    generateDateChoices: function(defaultSlug) {
        var selectedSlug;

        if (typeof defaultSlug != "undefined") {
            selectedSlug = defaultSlug;
        } else {
            selectedSlug = this.parentView.componentOpts[this.componentSlug].defaultDateChoice;
        }

        var dateChoices = [
            {
                displayValue: "All of " + this.lastFullYear,
                rawValue: "last-full-year",
                selected: false
            },
            {
                displayValue: this.lastFullMonth.month + " " + this.lastFullMonth.year,
                rawValue: "last-full-month",
                selected: false
            },
            {
                displayValue: this.currentYear + " to date",
                rawValue: "current-year-to-date",
                selected: false
            },
            {
                displayValue: "Custom dates",
                rawValue: "custom",
                selected: false
            }
        ];

        // Find the 'dateChoices' object whose slug matches 'selectedSlug'.
        // Set its 'selected' value to 'true'.
        var selectedChoice = _.where(dateChoices, {rawValue: selectedSlug});
        if (selectedChoice.length > 0) {
            selectedChoice[0].selected = true;
        }

        return dateChoices;
    }
});


var FilterView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.filterSlug = opts.filterSlug;
        this.filterType = opts.type;
        this.extraContext = opts.extraContext;
    },

    render: function(initialOpts) {
        var defaults = this.parentView.generateFilterDefaults(this);

        if (this.filterType == 'nullBooleanFilter') {
            if (this.filterSlug == "ArrestMade") {
                this.data = [
                    {choice: 'Yes', count: 20, color: '#666666'},
                    {choice: 'No', count: 68, color: '#BBBBBB'}
                ];
            } else {
                this.data = [
                    {choice: 'Yes', count: 45, color: '#666666'},
                    {choice: 'No', count: 105, color: '#BBBBBB'}
                ];
            }
        }

        this.parentView.filterRenderers[this.filterType](this, defaults);

        return this;
    }
});


var FilterHolderView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.componentSlug = opts.componentSlug;
        this.filterConfigs = FilterViews;

        filters = {};

        var holder = this;

        _.each(this.filterConfigs, function(filterConfig, name) {
            filters[name] = new FilterView({
                parentView: holder,
                filterSlug: name,
                type: filterConfig.type,
                extraContext: _.omit(filterConfig, 'type')
            });
        });

        this.filters = filters;
    },

    render: function(opts) {
        var configData;

        if (typeof opts != "undefined") {
            configData = opts;
        } else {
            configData = this.parentView.componentOpts[this.componentSlug];
        }

        var featuredFilterHTML = {},
            allFeaturedFilterNames = [];

        _.each(configData.featuredFilters, function(columnFilterList, columnKey) {
            featuredFilterHTML[columnKey] = [];
            _.each(columnFilterList, function(filterName) {
                allFeaturedFilterNames.push(filterName);
                featuredFilterHTML[columnKey].push({
                    filterName: filterName,
                    filterContents: this.filters[filterName].render().$el.html()
                });
            });
        });

        var remainingFilters = _.difference(
            _.keys(this.filterConfigs),
            // configData.featuredFilters
            allFeaturedFilterNames
        );

        // _.each(configData.featuredFilters, function(filterName) {
        //     featuredFilterHTML.push({
        //         filterName: filterName,
        //         filterContents: this.filters[filterName].render().$el.html()
        //     });
        // });

        var remainingFilterHTML = [];
        _.each(remainingFilters, function(filterName) {
            remainingFilterHTML.push({
                filterName: filterName,
                filterContents: this.filters[filterName].render().$el.html()
            });
        });

        var hasExtraFilters = false;
        if (remainingFilters.length > 0) {
            hasExtraFilters = true;
        }

        $(this.el).html(
            ich.FilterHolderTPL({
                featuredFilters: featuredFilterHTML,
                hasExtraFilters: hasExtraFilters,
                remainingFilters: remainingFilterHTML
            })
        );

        return this;
    },

    generateFilterDefaults: function(filterObj) {
        var defaults = {};

        if (
            _.has(
                this.parentView.componentOpts[
                    this.componentSlug
                ].defaultValues,
                filterObj.filterSlug
            )
        ) {
            defaults = this.parentView.componentOpts[
                this.componentSlug
            ].defaultValues[filterObj.filterSlug];
        }

        return defaults;
    },

    filterRenderers: {
        'choiceFilter': function(filterObj, defaults) {
            var extraContext = filterObj.extraContext,
                filterSlug = filterObj.filterSlug,
                verboseFilterName = extraContext.verboseName || filterSlug;

            _.each(defaults.choices, function(choice) {
                var match = _.where(
                    filterObj.extraContext.choices,
                    {'raw': choice}
                )[0];

                match.selected = true;
            });

            _.each(filterObj.extraContext.choices, function(choice) {
                choice.easingDuration = 0.025 * choice.percent;
            });

            $(filterObj.el).html(
                ich.ChoiceFilterTPL({
                    name: filterSlug,
                    verboseName: verboseFilterName,
                    choices: filterObj.extraContext.choices
                })
            );

            return filterObj;
        },
        'nullBooleanFilter': function(filterObj, defaults) {
            var extraContext = filterObj.extraContext,
                filterSlug = filterObj.filterSlug,
                verboseFilterName = extraContext.verboseName || filterSlug,
                isTrue = false,
                isFalse = false,
                isUnset = true;

            if (_.has(defaults, "value")) {
                isUnset = false;
                if (defaults.value === true) {
                    isTrue = true;
                } else {
                    isFalse = true;
                }
            }

            $(filterObj.el).html(
                ich.BooleanFilterTPL({
                    name: filterSlug,
                    verboseName: verboseFilterName,
                    isTrue: isTrue,
                    isFalse: isFalse,
                    isUnset: isUnset
                })
            );
        }
    }
});

var ResultsHolderView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.componentSlug = opts.componentSlug;
    },

    render: function(opts) {
        var configData;

        if (typeof opts != "undefined") {
            configData = opts;
        } else {
            configData = this.parentView.componentOpts[this.componentSlug];
        }

        $(this.el).html(ich.ResultsHolderTPL(configData));

        return this;
    }
});


var FilterViews = {
    Age: {
        type: 'choiceFilter',
        choices: [
            {raw: '0s', display: '0&ndash;9 years', selected: false, percent: 7},
            {raw: '10s', display: '10&ndash;19 years', selected: false, percent: 16},
            {raw: '20s', display: '20&ndash;29 years', selected: false, percent: 33},
            {raw: '30s', display: '30&ndash;39 years', selected: false, percent: 23},
            {raw: '40s', display: '40&ndash;49 years', selected: false, percent: 9},
            {raw: '50s', display: '50&ndash;59 years', selected: false, percent: 6},
            {raw: '60s', display: '60&ndash;69 years', selected: false, percent: 4},
            {raw: '70-plus', display: '70+ years', selected: false, percent: 2}
        ]
    },
    HomicideAction: {
        type: 'choiceFilter',
        verboseName: 'Cause of death',
        choices: [
            {raw: 'shot', display: 'Shot', selected: false, percent: 30},
            {raw: 'stabbed', display: 'Stabbed', selected: false, percent: 15},
            {raw: 'abuse', display: 'Abuse', selected: false, percent: 20},
            {raw: 'beaten', display: 'Beaten', selected: false, percent: 12},
            {raw: 'arson', display: 'Arson', selected: false, percent: 7},
            {raw: 'heart failure', display: 'Heart failure', selected: false, percent: 9},
            {raw: 'unknown', display: 'Unknown', selected: false, percent: 3},
            {raw: 'other', display: 'Other', selected: false, percent: 4}
        ]
    },
    Race: {
        type: 'choiceFilter',
        choices: [
            {raw: 'asian', display: 'Asian', selected: false, percent: 5},
            {raw: 'black', display: 'Black', selected: false, percent: 35},
            {raw: 'hispanic', display: 'Hispanic', selected: false, percent: 26},
            {raw: 'white', display: 'White', selected: false, percent: 23},
            {raw: 'other', display: 'Other', selected: false, percent: 4},
            {raw: 'unknown', display: 'Unknown', selected: false, percent: 7}
        ]
    },
    Gender: {
        type: 'choiceFilter',
        choices: [
            {raw: 'male', display: 'Male', selected: false, percent: 62},
            {raw: 'female', display: 'Female', selected: false, percent: 36},
            {raw: 'unknown', display: 'Unknown', selected: false, percent: 2}
        ]
    },
    // PrimaryFactor: {
    //     type: 'choiceFilter',
    //     choices: [
    //         {raw: 'argument-fight', display: 'Argument/fight', selected: false, percent: 12},
    //         {raw: 'child-abuse-neglect', display: 'Child abuse/neglect', selected: false, percent: 5},
    //         {raw: 'domestic-violence', display: 'Domestic violence', selected: false, percent: 10},
    //         {raw: 'robbery', display: 'Robbery', selected: false, percent: 15},
    //         {raw: 'retaliation', display: 'Retaliation', selected: false, percent: 14},
    //         {raw: 'drug-related', display: 'Drug related', selected: false, percent: 13},
    //         {raw: 'gang-related', display: 'Gang related', selected: false, percent: 11},
    //         {raw: 'drug-related-robbery', display: 'Drug-related robbery', selected: false, percent: 7},
    //         {raw: 'negligent-handling', display: 'Negligent Handling', selected: false, percent: 2},
    //         {raw: 'unknown', display: 'Unknown', selected: false, percent: 6},
    //         {raw: 'other', display: 'Other', selected: false, percent: 5}
    //     ]
    // },
    // SelfDefense: {
    //     type: 'nullBooleanFilter',
    // },
    // UCRReportable: {
    //     type: 'nullBooleanFilter',
    // },
    ArrestMade: {
        type: 'nullBooleanFilter',
        verboseName: 'Arrest(s) made?',
    },
    ChargesFiled: {
        type: 'nullBooleanFilter',
        verboseName: 'Charges filed?',
    }
};
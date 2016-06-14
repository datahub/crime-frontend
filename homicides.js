function renderFancySelectBox(selectElement) {

    var fancySelectContainer = $(
        '<div class="dropdown-container ' + selectElement.attr('id') + '-dropdown">'
    );

    fancySelectContainer.append(
        '    <div class="dropdown-display">' +
        '        <span class="variable">' + selectElement.find('option:selected').text() + '</span>' +
        '        <span class="ss-icon ss-symbolicons-block ss-navigatedown"></span>' +
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
            '    <span class="ss-icon ss-symbolicons-block ss-check"></span>' +
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

        HomicideTracker.componentOpts.CountHolder.selectedDateChoice = this.value;
        HomicideTracker.updateDates(HomicideTracker);

    });
}


var HomicideTracker = Backbone.View.extend({
    initialize: function(opts) {
        var self = this;

        this.API = opts.API;

        this.el = opts.el;
        this.componentOpts = opts.components;
        this.currentValues = opts.currentValues;

        this.$el.html(ich.HomicideTrackerTPL({}));

        self.getDateRanges(
            function(ranges) {
                self.dateRanges = ranges;

                self.lastUpdated = ranges.updated;

                self.loadHomicides(
                    function(loadedData) {
                        self.allHomicides = loadedData.homicides;

                        self.filterHomicides(function() {
                            self.finishInitialize();
                        });
                    }
                );
            }
        );
    },

    updateDates: function(self, optionalCallback) {
        self.loadHomicides(
            function(loadedData) {
                self.allHomicides = loadedData.homicides;

                self.filterHomicides(function() {
                    self.finishInitialize();
                    if (typeof optionalCallback === 'function') {
                        optionalCallback();
                    }
                });
            }
        );
    },


    filterHomicides: function(callbackFunction) {
        var allHomicides = this.allHomicides;

        if (this.componentOpts.CountHolder.ucrMode != 'all') {
            allHomicides = _.filter(
                allHomicides,
                function(obj) {
                    return obj.isUCRReportable === true;
                }
            );
        }

        if (_.keys(this.currentValues).length === 0) {
            this.filteredHomicides = allHomicides;
        } else {
            var self = this;

            this.filteredHomicides = allHomicides;

            _.each(this.currentValues, function(currentValue, filterName) {
                if (FilterViews[filterName].type == 'nullBooleanFilter') {
                    //
                } else {
                    self.filteredHomicides = _.filter(
                        self.filteredHomicides,
                        function(obj) {
                            return _.contains(
                                currentValue.choices,
                                FilterViews[filterName].generateFilterValue(obj)
                            );
                        }
                    );
                }
            });
        }

        if (typeof callbackFunction != 'undefined') {
            callbackFunction();
        }
    },

    finishInitialize: function() {

        this.chatterHolder = new ChatterHolderView({
            parentView: this,
            el: this.$el.find('.chatter-holder'),
            componentSlug: "ChatterHolder"
        });

        this.countHolder = new CountHolderView({
            parentView: this,
            el: this.$el.find('.count-holder'),
            componentSlug: "CountHolder"
        });

        this.filterHolder = new FilterHolderView({
            parentView: this,
            el: this.$el.find('.filter-holder'),
            componentSlug: "FilterHolder"
        });

        this.resultsHolder = new ResultsHolderView({
            parentView: this,
            el: this.$el.find('.results-holder'),
            componentSlug: "ResultsHolder"
        });

        this.popupHolder = new PopupHolderView({
            parentView: this,
            el: this.$el.find('.popup-holder'),
            componentSlug: "PopupHolder"
        });

        if (!Backbone.History.started) {
            new HomicideRouter;
            Backbone.history.start();
        }

        this.render({
            isFirstRender: true
        });
    },

    updateFilters: function() {
        var self = this,
            newFilterDict = {},
            rawFormData = self.$el.find("form").serializeArray();

        _.each(rawFormData, function(inputObj) {
            if (inputObj.value !== "") {
                var fieldKey = inputObj.name.split('homicide-input-')[1];

                if (_.has(self.filterHolder.filters, fieldKey)) {
                    var filterType = self.filterHolder.filters[fieldKey].filterType;

                    if (filterType == 'nullBooleanFilter') {
                    } else {
                        if (_.has(newFilterDict, fieldKey)) {
                            if (_.has(newFilterDict[fieldKey], 'choices')) {
                                newFilterDict[fieldKey].choices.push(inputObj.value);
                            } else {
                                newFilterDict[fieldKey].choices = [inputObj.value];
                            }
                        } else {
                            newFilterDict[fieldKey] = {
                                choices: [inputObj.value]
                            };
                        }
                    }
                }
            }
        });

        this.currentValues = newFilterDict;

        this.filterHomicides(function() {
            self.renderAgain();
        });
    },

    getDateRanges: function(successCallback, errorCallback) {
        var API = this.API,
            self = this;

        $.ajax({
            url: API.baseURL + 'date-ranges/?spaceless=true',
            jsonpCallback: API.dateRangeCallback,
            dataType: 'jsonp',
            crossDomain: true,
            success: function(dateRanges) {
                successCallback(dateRanges);
            }
        });
    },

    loadHomicides: function(successCallback, errorCallback) {
        var API = this.API,
            dateRanges = this.dateRanges,
            currentRangeChoice = this.componentOpts.CountHolder.selectedDateChoice,
            startDate, endDate, queryURL;

        var currentRangeConfig = dateRanges.rangeConfigs[currentRangeChoice];

        startDate = currentRangeConfig.start;
        endDate = currentRangeConfig.end;
        queryURL = API.baseURL +
            'list-homicides/' +
            startDate +
            '_' +
            endDate +
            '/';
        $.ajax({
            url: queryURL + '?spaceless=true',
            jsonpCallback: API.queryCallback,
            dataType: 'jsonp',
            crossDomain: true,
            success: function(data) {
                successCallback(data);
            }
        });
    },

    renderAgain: function(opts) {
        this.chatterHolder.renderAgain();
        this.countHolder.renderAgain();
        this.filterHolder.renderAgain();
        this.resultsHolder.renderAgain();
    },

    render: function(opts) {
        var tracker = this,
            isFirstRender = false;

        if (typeof opts != "undefined") {
            isFirstRender = opts.isFirstRender || false;
        }

        this.chatterHolder.render();
        this.countHolder.render();

        if (isFirstRender) {
            this.filterHolder.render();
        }

        this.resultsHolder.render();

        this.handleResize();

        if (this.countHolder.$el.find(".count-section.date-picker select").next().length === 0) {
            renderFancySelectBox(this.countHolder.$el.find(".count-section.date-picker select"));
        }

        this.filterHolder.$el.find("ol li h3 .clear-filter").unbind().click(function(e) {
            if ($(this).is(':visible')) {
                var thisFilter = $(this).closest('li');

                if (thisFilter.hasClass('active')) {
                    thisFilter.removeClass('active');

                    if (thisFilter.find("input[type='checkbox']:checked").length > 0) {
                        thisFilter.find("input[type='checkbox']:checked").prop('checked', false);
                    }

                    tracker.updateFilters();
                }
            }
        });

        setTimeout(function() {
            tracker.finishRender(opts);
        }, 200);

        this.filterHolder.$el.find(".graph-bar input[type='checkbox']").unbind().change(function(e) {
            var activeChoices = $(this).closest('.graph-bar').find("input[type='checkbox']:checked");

            tracker.updateFilters();

            if (activeChoices.length > 0) {
                $(this).closest('li').addClass('active');
            } else {
                $(this).closest('li').removeClass('active');
            }
        });

        this.filterHolder.$el.find(".button-holder input").unbind().click(function(event) {
            event.preventDefault();

            if ($(this).hasClass('more-options-toggle')) {
                tracker.filterHolder.$el.find('.extra-filters').slideToggle();
            }
        });

        this.resultsHolder.$el.find('.homicide').click(function(event) {
            tracker.popupHolder.openPopupForID($(this).data('homicide-id'));
        });

        $(window).resize(function() {
            tracker.handleResize();
        });
    },

    finishRender: function(opts) {
        var self = this,
            isFirstRender = false;

        if (typeof opts != "undefined") {
            isFirstRender = opts.isFirstRender || false;
        }

        _.each(
            this.filterHolder.$el.find(".graph-bar label .bar-chart"),
            function(bar) {
                $(bar).css('width', $(bar).attr('final-width'));
            }
        );

        if (isFirstRender) {
            if (_.has(this.componentOpts.PopupHolder, 'defaultPopupID')) {
                this.popupHolder.resizePopup();
            }
        }
    },

    handleResize: function() {

        this.resultsHolder.$el.find('.homicide img').height(
            this.resultsHolder.$el.find('.homicide .thumbnail').css('width')
        );

        this.popupHolder.resizePopup();
    }
});


var PopupHolderView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.componentSlug = opts.componentSlug;

        var componentOpts = this.parentView.componentOpts[this.componentSlug];

        if (_.has(componentOpts, 'defaultPopupID')) {
            this.openPopupForID(componentOpts.defaultPopupID);
        }

        vent.on('homicide:show', this.openPopupForID, this);

    },

    openPopupForID: function(homicideID) {
        var scrollPosition = this.$el.parent().parent().find('.chatter-holder').height() - 51;

        this.render({
            homicideID: homicideID
        });

        Backbone.history.navigate(this.parentView.componentOpts.CountHolder.selectedDateChoice + '/homicide/' + homicideID);

        $('html, body').animate({scrollTop: scrollPosition}, 500);
    },

    closePopup: function() {

        this.$el.removeClass('shown');

        // ie 10 fix
        //if(window.navigator.userAgent.indexOf('MSIE ') > -1) {
        setTimeout(function(){
           this.$el.css('z-index', -1);
        }.bind(this), 650);
        //}

        Backbone.history.navigate('');

    },

    render: function(opts) {

        var popupView = this;
        var detailHomicide = _.where(
            HomicideTracker.allHomicides, {
                id: opts.homicideID
            }
        )[0];


        if (typeof detailHomicide.victim.photo != 'undefined') {
            detailHomicide.victim.fullPhoto = detailHomicide.victim.photo;
        }

        if (detailHomicide.homicideAction == 'shot') {
            detailHomicide.verboseAction = 'been <strong>fatally shot</strong>';
        } else if (detailHomicide.homicideAction == 'stabbed') {
            detailHomicide.verboseAction = 'been <strong>fatally stabbed</strong>';
        } else if (detailHomicide.homicideAction == 'abuse') {
            detailHomicide.verboseAction = 'died due to <strong>abuse</strong>';
        } else if (detailHomicide.homicideAction == 'beaten') {
            detailHomicide.verboseAction = 'been <strong>beaten to death</strong>';
        } else if (detailHomicide.homicideAction == 'arson') {
            detailHomicide.verboseAction = 'died as a result of <strong>arson</strong>';
        } else if (detailHomicide.homicideAction == 'heart-failure') {
            detailHomicide.verboseAction = 'died of <strong>heart failure</strong>';
        } else if (detailHomicide.homicideAction == 'unknown') {
            detailHomicide.verboseAction = 'died due to <strong>unknown causes</strong>';
        } else if (detailHomicide.homicideAction == 'other') {
            detailHomicide.verboseAction = 'died due to <strong>other causes</strong>';
        }

        if (detailHomicide.victim.gender == 'male') {
            detailHomicide.victim.genderPronoun = 'he';
            detailHomicide.victim.genderPronounUpper = 'He';
            detailHomicide.victim.genderPossessivePronoun = 'his';
            detailHomicide.victim.genderPossessivePronounUpper = 'His';
        } else if (detailHomicide.victim.gender == 'female') {
            detailHomicide.victim.genderPronoun = 'she';
            detailHomicide.victim.genderPronounUpper = 'She';
            detailHomicide.victim.genderPossessivePronoun = 'her';
            detailHomicide.victim.genderPossessivePronounUpper = 'Her';
        } else {
            detailHomicide.victim.genderPronoun = 'they';
            detailHomicide.victim.genderPronounUpper = 'They';
            detailHomicide.victim.genderPossessivePronoun = 'their';
            detailHomicide.victim.genderPossessivePronounUpper = 'Their';
        }

        if (detailHomicide.wasArrestMade === true) {
            detailHomicide.verboseArrestMade = 'Yes';
        } else if (detailHomicide.wasArrestMade === false || detailHomicide.wasArrestMade === null) {
            detailHomicide.verboseArrestMade = 'No';
        }

        if (detailHomicide.wereChargesFiled === true) {
            detailHomicide.verboseChargesFiled = 'Yes';
        } else if (detailHomicide.wereChargesFiled === false || detailHomicide.wereChargesFiled === null) {
            detailHomicide.verboseChargesFiled = 'No';
        }

        detailHomicide.homicideLink = window.location.protocol + '//'+ window.location.hostname + window.location.pathname + '#' +
                                        this.parentView.componentOpts.CountHolder.selectedDateChoice + '/homicide/' + opts.homicideID;

        this.$el.css('height', this.$el.parent().height() + 16);

        this.$el.html(
            ich.PopupTPL(
                {
                    homicide: detailHomicide,
                    innerHeight: this.$el.parent().find('.homicide-queries').height() + 51
                }
            )
        );

        this.$el.find('.popup-switcher .type').unbind().click(
            function(event) {
                var thisTrigger = $(this);
                if (!thisTrigger.hasClass('active')) {
                    popupView.$el.find('.popup-switcher .type.active').removeClass('active');
                    thisTrigger.addClass('active');

                    popupView.$el.find('.popup-switcher .type-body.shown').removeClass('shown');
                    setTimeout(function(){
                        popupView.$el.find('.popup-switcher .type-body.shown').css('z-index', -1);
                    }, 650);


                    popupView.$el.find(
                        '.popup-switcher .type-body.' + thisTrigger.data('type-slug')
                    ).css('z-index', 333);
                    popupView.$el.find(
                        '.popup-switcher .type-body.' + thisTrigger.data('type-slug')
                    ).addClass('shown');
                }
            }
        );

        this.$el.find('.homicide-popup .remnant-space').css(
            'height',
            (
                (
                    this.$el.parent().height() + 14
                ) - (
                    this.$el.find('.homicide-popup').height() - 51
                )
            )
        );
        this.$el.find('.homicide-popup .remnant-space').unbind().click(
            function(event) {
                popupView.closePopup();
            }
        );

        this.$el.find('.close-button').unbind().click(
            function(event) {
                popupView.closePopup();
            }
        );

        popupView.$el.css('z-index', 333);
        popupView.$el.addClass('shown');
    },

    resizePopup: function() {
        this.$el.css('height', this.$el.parent().height() + 16);

        this.$el.find('.homicide-popup .remnant-space').css(
            'height',
            (
                (
                    this.$el.parent().height() + 14
                ) - (
                    this.$el.find('.homicide-popup').height() - 51
                )
            )
        );

        var innerHeight = this.$el.parent().find('.homicide-queries').height() + 51;
        this.$el.find().css(
            'min-height',
            innerHeight + 'px'
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
        var chatterView = this;

        if (typeof opts != "undefined") {
            configData = opts;
        } else {
            configData = this.parentView.componentOpts[this.componentSlug];
        }

        configData['lastUpdated'] = this.parentView.lastUpdated;

        $(this.el).html(ich.ChatterHolderTPL(configData));

        this.$el.find('.submissions-link').unbind().click(function() {
            chatterView.$el.find('.submissions-collapsed').fadeIn();

            chatterView.$el.find('.submissions-collapsed .close-trigger').unbind().click(
                function() {
                    chatterView.$el.find('.submissions-collapsed').fadeOut();
                }
            );
        });

        this.$el.find('.resources-link').unbind().click(function() {
            chatterView.$el.find('.resources-collapsed').fadeIn();

            chatterView.$el.find('.resources-collapsed .close-trigger').unbind().click(
                function() {
                    chatterView.$el.find('.resources-collapsed').fadeOut();
                }
            );
        });

        return this;
    },

    renderAgain: function(opts) {
        this.render();
    }
});

var CountHolderView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.componentSlug = opts.componentSlug;

        this.dateChoices = this.generateDateChoices();
    },

    formatHomicideCounts: function() {
        var totalHomicides, overallNumber, countLabelText, ucrMeetPluralized;

        var currentRangeChoice = this.parentView.componentOpts.CountHolder.selectedDateChoice;
        var dateDesc = this.parentView.dateRanges.rangeConfigs[currentRangeChoice].shortDescription;

        totalHomicides = this.parentView.allHomicides.length;

        if (_.keys(this.parentView.currentValues).length === 0) {
            if (this.parentView.componentOpts.CountHolder.ucrMode == 'all') {
                overallNumber = totalHomicides;
                if (overallNumber == 1) {
                    countLabelText = 'total homicides in ' + dateDesc;
                } else {
                    countLabelText = 'total homicides in ' + dateDesc;
                }
            } else {
                overallNumber = this.parentView.filteredHomicides.length;
                if (overallNumber == 1) {
                    countLabelText = 'matching homicide in ' + dateDesc + ' (out&nbsp;of&nbsp;' + totalHomicides + '&nbsp;total)';
                } else {
                    countLabelText = 'matching homicides in ' + dateDesc + ' (out&nbsp;of&nbsp;' + totalHomicides + '&nbsp;total)';
                }
            }
        } else {
            overallNumber = this.parentView.filteredHomicides.length;
            if (overallNumber == 1) {
                countLabelText = 'matching homicide in ' + dateDesc + ' (out&nbsp;of&nbsp;' + totalHomicides + '&nbsp;total)';
            } else {
                countLabelText = 'matching homicides in ' + dateDesc + ' (out&nbsp;of&nbsp;' + totalHomicides + '&nbsp;total)';
            }
        }

        var ucrNumber = _.filter(
            this.parentView.filteredHomicides,
            function(obj) {
                return obj.isUCRReportable === true;
            }
        ).length;

        if (ucrNumber == 1) {
            ucrMeetPluralized = 'meets';
        } else {
            ucrMeetPluralized = 'meet';
        }

        return {
            'totalHomicides': totalHomicides,
            'overallNumber': overallNumber,
            'countLabelText': countLabelText,
            'ucrNumber': ucrNumber,
            'ucrMeetPluralized': ucrMeetPluralized
        };
    },

    generateUCRButtonText: function() {
        if (this.parentView.componentOpts.CountHolder.ucrMode == 'all') {
            return 'Show only UCR&nbsp;homicides';
        }

        return 'Show all homicides';
    },

    bindUCRButton: function() {
        var countView = this;

        if (this.parentView.componentOpts.CountHolder.ucrMode == 'all') {
            this.$el.find('.ucr-button-holder .ucr-button').unbind().click(function() {
                countView.parentView.componentOpts.CountHolder.ucrMode = 'ucr';
                countView.parentView.updateFilters();
            });
        } else {
            this.$el.find('.ucr-button-holder .ucr-button').unbind().click(function() {
                countView.parentView.componentOpts.CountHolder.ucrMode = 'all';
                countView.parentView.updateFilters();
            });
        }
    },

    render: function(opts) {

        var currentDatesChoice = {},
            selectedDatesChoice = _.where(this.dateChoices, {selected: true}),
            countView = this;

        if (selectedDatesChoice.length > 0) {
            currentDatesChoice = selectedDatesChoice[0];
        }

        var countFormatted = this.formatHomicideCounts();

        var ucrOnly = false;
        if (this.parentView.componentOpts.CountHolder.ucrMode != 'all') {
            ucrOnly = true;
        }

        $(this.el).html(ich.CountHolderTPL({
            overallNumber: countFormatted.overallNumber,
            countLabelText: countFormatted.countLabelText,
            ucrNumber: countFormatted.ucrNumber,
            ucrMeetPluralized: countFormatted.ucrMeetPluralized,
            dateChoices: this.dateChoices,
            currentDatesChoice: currentDatesChoice,
            ucrOnly: ucrOnly,
            ucrButtonText: countView.generateUCRButtonText()
        }));

        this.bindUCRButton();

        this.$el.find('.ucr-button-holder .ucr-explainer').unbind().click(function() {
            countView.$el.find('.explainer-collapsed').fadeIn();

            countView.$el.find('.explainer-collapsed .close-trigger').unbind().click(
                function() {
                    countView.$el.find('.explainer-collapsed').fadeOut();
                }
            );
        });

        return this;
    },

    renderAgain: function(opts) {
        var countFormatted = this.formatHomicideCounts(),
            ucrOnly = false;

        if (this.parentView.componentOpts.CountHolder.ucrMode != 'all') {
            ucrOnly = true;
        }

        this.$el.find('.count-section.totals-count .count').html(
            countFormatted.overallNumber
        );
        this.$el.find('.count-section.totals-count .count-label').html(
            countFormatted.countLabelText
        );

        this.$el.find('.count-section.ucr-explainer-toggle .ucr-count').html(
            countFormatted.ucrNumber
        );
        this.$el.find('.count-section.ucr-explainer-toggle .ucr-meet-pluralized').html(
            countFormatted.ucrMeetPluralized
        );

        this.$el.find('.ucr-explainer-toggle .ucr-button').html(
            this.generateUCRButtonText()
        );

        if (ucrOnly) {
            this.$el.find('.ucr-explainer-toggle').addClass('active');
        } else {
            this.$el.find('.ucr-explainer-toggle').removeClass('active');
        }

        this.bindUCRButton();

        return this;
    },

    generateDateChoices: function(defaultSlug) {
        var rangeConfigs = this.parentView.dateRanges.rangeConfigs,
            selectedSlug;

        if (typeof defaultSlug != "undefined") {
            selectedSlug = defaultSlug;
        } else {
            selectedSlug = this.parentView.componentOpts[this.componentSlug].selectedDateChoice;
        }

        var dateChoices = [];

        _.each(rangeConfigs, function(rangeConfig, rangeSlug) {
            dateChoices.push({
                displayValue: rangeConfig.description,
                order: rangeConfig.order,
                rawValue: rangeSlug,
                selected: false
            });
        });

        dateChoices = _.sortBy(dateChoices, 'order');

        var selectedChoice = _.where(dateChoices, {rawValue: selectedSlug});
        if (selectedChoice.length > 0) {
            selectedChoice[0].selected = true;
        }

        return dateChoices;
    }
});


var FilterHolderView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.componentSlug = opts.componentSlug;
        this.filterConfigs = FilterViews;

        var self = this,
            filters = {},
            componentOpts = self.parentView.componentOpts[self.componentSlug],
            allFeaturedFilterNames = _.reduce(
                componentOpts.featuredFilters,
                function(existingArray, newArray) {
                    return _.union(existingArray, newArray);
                },
                []
            ),
            featuredFilterList = _.mapObject(
                componentOpts.featuredFilters,
                function(filterZoneList) {
                    return _.map(
                        filterZoneList,
                        function(filterName) {
                            return {
                                filterName: filterName
                            };
                        }
                    );
                }
            ),
            remainingFilters = _.difference(
                _.keys(this.filterConfigs),
                allFeaturedFilterNames
            ),
            remainingFilterList = _.map(
                remainingFilters,
                function(filterNameValue) {
                    return {
                        filterName: filterNameValue
                    };
                }
            );

        var hasExtraFilters = false;
        if (remainingFilters.length > 0) {
            hasExtraFilters = true;
        }

        this.$el.html(
            ich.FilterHolderTPL({
                featuredFilters: featuredFilterList,
                hasExtraFilters: hasExtraFilters,
                remainingFilters: remainingFilterList
            })
        );


        _.each(this.filterConfigs, function(filterConfig, name) {
            filters[name] = new FilterView({
                parentView: self,
                el: self.$el.find('.all-filters ol li.' + name),
                filterSlug: name,
                type: filterConfig.type,
                generateFilterValue: filterConfig.generateFilterValue,
                extraContext: _.omit(
                    filterConfig,
                    ['generateFilterValue', 'type']
                )
            });
        });

        this.filters = filters;
    },

    render: function(opts) {
        var configData,
            self = this;

        _.each(this.filters, function(filterObj) {
            filterObj.render();
        });
        return this;
    },

    renderAgain: function(opts) {
        _.each(this.filters, function(filter) {
            filter.renderAgain();
        });
    },

    generateFilterDefaults: function(filterObj) {
        var defaults = {};

        if (
            _.has(
                this.parentView.currentValues,
                filterObj.filterSlug
            )
        ) {
            defaults = this.parentView.currentValues[filterObj.filterSlug];
        }

        return defaults;
    },

    filterRenderers: {
        'choiceFilter': function(filterObj, defaults) {
            var extraContext = filterObj.extraContext,
                filterSlug = filterObj.filterSlug,
                verboseFilterName = extraContext.verboseName || filterSlug,
                existingData = filterObj.generateData();

            if (_.size(defaults) !== 0) {
                filterObj.$el.addClass('active');
            }

            var choicesFormatted = _.map(
                _.map(
                    filterObj.extraContext.choices,
                    _.clone
                ),
                function(choice) {
                    if (_.has(existingData, choice.raw)) {
                        _.extend(choice, existingData[choice.raw]);
                    }

                    if (_.keys(defaults).length !== 0) {
                        if (_.contains(defaults.choices, choice.raw)) {
                            choice.selected = true;
                        }
                    }

                    if (_.has(choice, 'percent')) {
                        choice.easingDuration = 0.025 * choice.percent;
                        choice.percentRounded = Math.round(choice.percent);

                        if (choice.percent < 30) {
                            choice.valueBasedClass = 'outside';
                        }
                    } else {
                        choice.easingDuration = 0;
                        choice.percentRounded = 0;
                        choice.valueBasedClass = 'outside';
                    }

                    return _.defaults(choice, {selected: false, percent: 0});
                }
            );

            filterObj.$el.html(
                ich.ChoiceFilterTPL({
                    name: filterSlug,
                    verboseName: verboseFilterName,
                    choices: choicesFormatted
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

            filterObj.$el.html(
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


var FilterView = Backbone.View.extend({
    initialize: function(opts) {
        this.parentView = opts.parentView;
        this.filterSlug = opts.filterSlug;
        this.filterType = opts.type;
        this.extraContext = opts.extraContext;
        this.generateFilterValue = opts.generateFilterValue;
    },

    generateData: function() {
        var self = this,
            groupCounts = _.countBy(
                this.parentView.parentView.filteredHomicides,
                function(obj) {
                    return self.generateFilterValue(obj);
                }
            ),
            totalCount = this.parentView.parentView.filteredHomicides.length,
            finalizedCounts = _.mapObject(groupCounts, function(rawValue, choiceSlug) {
                return {
                    count: rawValue,
                    percent: +((rawValue / totalCount) * 100).toFixed(2)
                };
            });

        return finalizedCounts;
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
    },

    renderAgain: function() {
        var self = this;

        if (this.filterType == "nullBooleanFilter") {
            //
        } else {
            var existingData = this.generateData(),
                defaults = this.parentView.generateFilterDefaults(this);
            var choicesFormatted = _.map(
                _.map(
                    this.extraContext.choices,
                    _.clone
                ),
                function(choice) {
                    if (_.has(existingData, choice.raw)) {
                        _.extend(choice, existingData[choice.raw]);
                    }

                    if (_.keys(defaults).length !== 0) {
                        if (_.contains(defaults.choices, choice.raw)) {
                            choice.selected = true;
                        }
                    }

                    if (_.has(choice, 'percent')) {
                        choice.easingDuration = 0.005 * choice.percent;
                    } else {
                        choice.easingDuration = 0;
                    }

                    var chartItem = $(
                        self.$el.find(
                            'label[for="homicide-input-' +
                                self.filterSlug +
                                '_' +
                                choice.raw +
                                '"] .bar-chart'
                        )
                    );

                    choice = _.defaults(choice, {selected: false, percent: 0});

                    chartItem.attr('final-width', choice.percent + '%');
                    chartItem.css('transition-duration', choice.easingDuration + 's');

                    chartItem.find('.ellens-labels').html(Math.round(choice.percent) + '%');

                    if (choice.percent < 30) {
                        chartItem.find('.ellens-labels').addClass('outside');
                    } else {
                        chartItem.find('.ellens-labels').removeClass('outside');
                    }

                    return choice;
                }
            );

            _.each(
                self.$el.find(".graph-bar label .bar-chart"),
                function(bar) {
                    $(bar).css('width', $(bar).attr('final-width'));
                }
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
        var filteredHomicides = this.parentView.filteredHomicides,
            configData;

        if (typeof opts != "undefined") {
            configData = opts;
        } else {
            configData = this.parentView.componentOpts[this.componentSlug];
        }

        var homicideConfigs = [];
        _.each(this.parentView.allHomicides, function(rawHomicide) {
            var homicideObj = {};
            _.each(
                rawHomicide,
                function(v, k) {
                    if (_.isObject(v)) {
                        homicideObj[k] = _.clone(v);
                    } else {
                        homicideObj[k] = v;
                    }
                }
            );

            var birthDate = new Date(Date.parse(homicideObj.victim.birthDate.iso)),
                homicideDate = new Date(Date.parse(homicideObj.crimeDate.iso));

            homicideObj.victim.ageAtDeath = calculateYearDifference(birthDate, homicideDate);

            if (
                _.contains(
                    _.pluck(
                        filteredHomicides,
                        'id'
                    ),
                    homicideObj.id
                )
            ) {
                homicideObj.extraClasses = 'active';
            }

            _.defaults(
                homicideObj,
                {
                    extraClasses: ''
                }
            );

            _.defaults(
                homicideObj.victim,
                {
                    photo: 'http://media.dhb.io/dev/homicides/unknown.png'
                }
            );

            homicideConfigs.push(homicideObj);
        });

        $(this.el).html(ich.ResultsHolderTPL(
            {
                homicideConfigs: homicideConfigs
            }
        ));

        return this;
    },

    renderAgain: function(opts) {
        var self = this,
            currentResults = self.$el.find(".homicide.active").map(
                function() {
                    return $(this).data('homicide-id');
                }
            ).get(),
            newResults = _.pluck(self.parentView.filteredHomicides, 'id');

        var toAdd = _.difference(newResults, currentResults),
            toRemove = _.difference(currentResults, newResults);

        _.each(toAdd, function(id) {
            self.$el.find(".homicide[data-homicide-id='" + id + "']").addClass('active');
        });

        _.each(toRemove, function(id) {
            self.$el.find(".homicide.active[data-homicide-id='" + id + "']").removeClass('active');
        });
    }
});

var vent = _.extend({}, Backbone.Events);

var HomicideRouter = Backbone.Router.extend({
    routes: {
        ':dateRange/homicide/:id' : 'showHomicide'
    },
    showHomicide: function(dateRange, homicideID) {
        
        if (HomicideTracker.componentOpts.CountHolder.selectedDateChoice === dateRange) {
            
            vent.trigger('homicide:show', parseInt(homicideID,10));
        
        } else if (HomicideTracker.dateRanges.rangeConfigs[dateRange]) {
            
            $('#homicide-date-picker').val(dateRange).change();
            HomicideTracker.componentOpts.CountHolder.selectedDateChoice = dateRange;
            HomicideTracker.updateDates(HomicideTracker, function() {
                vent.trigger('homicide:show', parseInt(homicideID,10));
            });

        } else {
            console.log('date range invalid');
        }

    }
});

var FilterViews = {
    Age: {
        type: 'choiceFilter',
        generateFilterValue: function(matchingObject) {
            var ageAtDeath = matchingObject.victim.ageAtDeath.raw;

            if (ageAtDeath < 10) {
                return '0s';
            } else if (ageAtDeath < 18) {
                return '10s';
            } else if (ageAtDeath < 29) {
                return '18s';
            } else if (ageAtDeath < 39) {
                return '30s';
            } else if (ageAtDeath < 49) {
                return '40s';
            } else {
                return '50-plus';
            }
        },
        choices: [
            {raw: '0s', display: '0&ndash;9'},
            {raw: '10s', display: '10&ndash;17'},
            {raw: '18s', display: '18&ndash;29'},
            {raw: '30s', display: '30&ndash;39'},
            {raw: '40s', display: '40&ndash;49'},
            {raw: '50-plus', display: '50+'}
        ]
    },
    HomicideAction: {
        type: 'choiceFilter',
        generateFilterValue: function(matchingObject) {
            var homicideActionRaw = matchingObject.homicideAction;

            if (homicideActionRaw == 'shot') {
                return homicideActionRaw;
            } else if (homicideActionRaw == 'stabbed') {
                return homicideActionRaw;
            } else if (homicideActionRaw == 'abuse') {
                return homicideActionRaw;
            } else if (homicideActionRaw == 'beaten') {
                return homicideActionRaw;
            } else if (homicideActionRaw == 'arson') {
                return homicideActionRaw;
            }

            return 'other';
        },
        verboseName: 'Cause of death',
        choices: [
            {raw: 'shot', display: 'Shot'},
            {raw: 'stabbed', display: 'Stabbed'},
            {raw: 'abuse', display: 'Abuse'},
            {raw: 'beaten', display: 'Beaten'},
            {raw: 'arson', display: 'Arson'},
            {raw: 'other', display: 'Other'}
        ]
    },
    Race: {
        type: 'choiceFilter',
        generateFilterValue: function(matchingObject) {
            var raceRaw = matchingObject.victim.race;

            if (raceRaw == 'black') {
                return raceRaw;
            } else if (raceRaw == 'hispanic') {
                return raceRaw;
            } else if (raceRaw == 'white') {
                return raceRaw;
            } else if (raceRaw == 'asian') {
                return raceRaw;
            } else if (raceRaw == 'unknown') {
                return raceRaw;
            }

            return 'other';
        },
        choices: [
            {raw: 'black', display: 'Black'},
            {raw: 'white', display: 'White'},
            {raw: 'hispanic', display: 'Hispanic'},
            {raw: 'asian', display: 'Asian'},
            {raw: 'unknown', display: 'Unknown'},
            {raw: 'other', display: 'Other'}
        ]
    },
    Gender: {
        type: 'choiceFilter',
        generateFilterValue: function(matchingObject) {
            var genderRaw = matchingObject.victim.gender;

            if (genderRaw == 'male') {
                return genderRaw;
            } else if (genderRaw == 'female') {
                return genderRaw;
            }

            return 'other';
        },
        choices: [
            {raw: 'male', display: 'Male'},
            {raw: 'female', display: 'Female'}
        ]
    },
    ArrestMade: {
        type: 'choiceFilter',
        generateFilterValue: function(matchingObject) {
            if (matchingObject.wasArrestMade === true) {
                return 'yes';
            } else {
                return 'no';
            }
        },
        choices: [
            {raw: 'yes', display: 'Yes'},
            {raw: 'no', display: 'No'}
        ],
        verboseName: 'Arrest(s) made?',
    }
};


function calculateYearDifference(startDate, endDate) {
    var yearDifference = endDate.getFullYear() - startDate.getFullYear();

    if (yearDifference > 0) {
        var monthDifference = endDate.getMonth() - startDate.getMonth();
        if (monthDifference < 0) {
            if (yearDifference == 1) {
                return calculateFractionalYearDifference(
                    startDate,
                    endDate
                );
            }

            return yearDifference - 1;
        } else if (monthDifference === 0) {
            var dayDifference = endDate.getDate() - startDate.getDate();

            if (dayDifference < 0) {
                if (yearDifference == 1) {
                    return calculateFractionalYearDifference(
                        startDate,
                        endDate
                    );
                }

                return yearDifference - 1;
            }
        }

        return yearDifference;
    } else {
        return calculateFractionalYearDifference(
            startDate,
            endDate
        );
    }
}

function calculateFractionalYearDifference(startDate, endDate) {
    var one_day = 1000 * 60 * 60 * 24,
        dayCount = (endDate.getTime() - startDate.getTime()) / one_day;

    if (isLeapYear(startDate.getFullYear())) {
        if ((startDate.getMonth() == 1) && startDate.getDate() < 29) {
            return dayCount / 366;
        } else if ((startDate.getMonth() === 0)) {
            return dayCount / 366;
        }
    } else if (isLeapYear(endDate.getFullYear())) {
        if (endDate.getMonth() > 1) {
            return dayCount / 366;
        } else if ((endDate.getMonth() == 1) && (endDate.getDate() == 29)) {
            return dayCount / 366;
        }
    }

    return dayCount / 365;
}

function isLeapYear(year) {
    var isLeap = new Date(year, 1, 29).getMonth() == 1;
    return isLeap;
}

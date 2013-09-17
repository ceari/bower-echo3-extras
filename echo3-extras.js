/*!
 * @licence Echo Extras, version 3.0
 * Copyright (C) 2002-2009 NextApp, Inc.
 * License: MPL, GPL
 * http://echo.nextapp.com/site/echo3/
 */
/**
 * Extras root namespace object.  Components are contained directly in this namespace.
 * @namespace
 */
Extras = { 

    /**
     * Maintains a unique id for the ExtrasApp namespace.
     * 
     * @type Number
     */
    uniqueId: 0
};

/**
 * Extras serialization namespace.
 * @namespace
 */
Extras.Serial = { 
    
    /**
     * Serialization type prefix for properties specific to Echo Extras.
     */
    PROPERTY_TYPE_PREFIX: "Extras.Serial."
};

/**
 * Extras components synchronization peer namespace.  Any objects in this namespace should not be accessed by application 
 * developers or extended outside of the Extras library.
 * @namespace
 */
Extras.Sync = { };

/**
 * Abstract base class for timed animated effects.
 * Animation developer provides initialization, step, and completion methods.
 */
Extras.Sync.Animation = Core.extend({

    /**
     * The current animation step index.  This value is incremented when init() is invoked and each time step() is invoked.
     * Thus, the first time step() is invoked, stepIndex will have a value of 1.
     */
    stepIndex: 0,
    
    /**
     * The actual start time of the animation (milliseconds since the epoch, i.e., value returned by new Date().getTime()).
     * @type Number
     */
    startTime: null,

    /**
     * The calculated end time of the animation (milliseconds since the epoch, i.e., value returned by new Date().getTime()).
     * This value is the sum of <code>startTime</code> and <code>runTime</code>.  The animation will run until the system time
     * reaches or first exceeds this value.
     * @type Number
     */
    endTime: null,
    
    /**
     * Listener management object.
     * @type Core.ListenerList
     */
    _listenerList: null,
    
    /**
     * Runnable used to render animation over time.
     * @type Core.Web.Scheduler.Runnable
     */
    _runnable: null,
    
    $virtual: {
    
        /**
         * The runtime, in milliseconds of the animation.
         * @type Number
         */
        runTime: 0,
        
        /**
         * Sleep interval, in milliseconds.  The interval with which the animation should sleep between frames.  
         * Default value is 10ms.
         * @type Number
         */
        sleepInterval: 10
    },

    $abstract: {
    
        /**
         * Initializes the animation.  This method will always be invoked internally, it should not be manually invoked.
         * This method will be invoked before the <code>step()</code> method.  This method may never be invoked if
         * the animation is immediately aborted or the allotted run time has expired.
         */
        init: function() { },
        
        /**
         * Completes the animation.  This method will always be invoked internally, it should not be manually invoked.
         * This method will always be invoked to finish the animation and/or clean up its resources, even if the animation 
         * was aborted.  Implementations of this method should render the animation in its completed state.
         * 
         * @param {Boolean} abort a flag indicating whether the animation aborted, true indicating it was aborted, false indicating
         *        it completed without abort
         */
        complete: function(abort) { },
        
        /**
         * Renders a step within the animation.  This method will always be invoked internally, it should not be manually invoked.
         * The implementation should not attempt to check if the animation is finished, as this work should be done in the
         * <code>complete()</codE> method.
         * 
         * @param {Number} progress a decimal value between 0 and 1 indicating the progress of the animation.
         */
        step: function(progress) { }
    },
    
    /**
     * Invoked by runnable to process a step of the animation.
     */
    _doStep: function() {
        var currentTime = new Date().getTime();
        if (currentTime < this.endTime) {
            if (this.stepIndex === 0) {
                this.init();
            } else {
                this.step((currentTime - this.startTime) / this.runTime);
            }
            ++this.stepIndex;
            Core.Web.Scheduler.add(this._runnable);
        } else {
            this.complete(false);
            if (this._completeMethod) {
                this._completeMethod(false);
            }
        }
    },
    
    /**
     * Aborts an in-progress animation.  The <code>complete()</code> method will be invoked.
     */
    abort: function() {
        Core.Web.Scheduler.remove(this._runnable);
        this.complete(true);
        if (this._completeMethod) {
            this._completeMethod(true);
        }
    },
    
    /**
     * Starts the animation.
     * 
     * @param {Function} completeMethod a function to execute when the animation has completed (it will be passed a boolean
     *        value of true or false to indicate whether animation was aborted (true) or not (false))
     */
    start: function(completeMethod) {
        this._runnable = new Core.Web.Scheduler.MethodRunnable(Core.method(this, this._doStep),  this.sleepInterval, false);
        this.startTime = new Date().getTime();
        this.endTime = this.startTime + this.runTime;
        this._completeMethod = completeMethod;
        Core.Web.Scheduler.add(this._runnable);
    }
});
/**
 * ItemModel PropertyTranslator singleton.  Not registered, but used by other translators.
 */
Extras.Serial.ItemModel = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {
    
        /**
         * Parses an icon contained in a menu model property element.
         * 
         * @param {Echo.Client} client the client
         * @param {Element} pElement the property "p" element
         */
        parseIcon: function(client, pElement) {
            var icon = Core.Web.DOM.getChildElementByTagName(pElement, "icon");
            if (icon) {
                return Echo.Serial.ImageReference.toProperty(client, icon);
            }
            return null;
        },
        
        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var type = pElement.getAttribute("t");
            if (type.indexOf(Extras.Serial.PROPERTY_TYPE_PREFIX) === 0) {
                type = type.substring(Extras.Serial.PROPERTY_TYPE_PREFIX.length);
            }
            var translator = Extras.Serial[type];
              if (translator) {
                  return translator.toProperty(client, pElement);
            } else {
                throw new Error("Unsupported model type: " + type);
            }
        }
    }
});

/**
 * MenuModel PropertyTranslator singleton.
 */
Extras.Serial.MenuModel = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var id = pElement.getAttribute("id");
            var text = pElement.getAttribute("text");
            var icon = Extras.Serial.ItemModel.parseIcon(client, pElement);
            var model = new Extras.MenuModel(id, text, icon);
            
            var children = Core.Web.DOM.getChildElementsByTagName(pElement, "item");
            for (var i = 0; i < children.length; i++) {
                var childElement = children[i];
                var subModel = Extras.Serial.ItemModel.toProperty(client, childElement);
                model.addItem(subModel);
           }
           return model;
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Extras.Serial.MenuModel", this);
    }
});

/**
 * OptionModel PropertyTranslator singleton.
 */
Extras.Serial.OptionModel = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var id = pElement.getAttribute("id");
            var text = pElement.getAttribute("text");
            var icon = Extras.Serial.ItemModel.parseIcon(client, pElement);
            return new Extras.OptionModel(id, text, icon);
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Extras.Serial.OptionModel", this);
    }
});

/**
 * RadioOptionModel PropertyTranslator singleton.
 */
Extras.Serial.RadioOptionModel = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var id = pElement.getAttribute("id");
            var text = pElement.getAttribute("text");
            var icon = Extras.Serial.ItemModel.parseIcon(client, pElement);
            return new Extras.RadioOptionModel(id, text, icon);
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Extras.Serial.RadioOptionModel", this);
    }
});

/**
 * ToggleOptionModel PropertyTranslator singleton.
 */
Extras.Serial.ToggleOptionModel = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var id = pElement.getAttribute("id");
            var text = pElement.getAttribute("text");
            var icon = Extras.Serial.ItemModel.parseIcon(client, pElement);
            return new Extras.ToggleOptionModel(id, text, icon);
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Extras.Serial.ToggleOptionModel", this);
    }
});

/**
 * SeparatorModel PropertyTranslator singleton.
 */
Extras.Serial.SeparatorModel = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            return new Extras.SeparatorModel();
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Extras.Serial.SeparatorModel", this);
    }
});

/**
 * MenuStateModel PropertyTranslator singleton.
 */
Extras.Serial.MenuStateModel = Core.extend(Echo.Serial.PropertyTranslator, {
    
    $static: {

        /** @see Echo.Serial.PropertyTranslator#toProperty */
        toProperty: function(client, pElement) {
            var stateModel = new Extras.MenuStateModel();
            var children = Core.Web.DOM.getChildElementsByTagName(pElement, "i");
            for (var i = 0; i < children.length; i++) {
                var childElement = children[i];
                var enabledValue = childElement.getAttribute("enabled");
                if (enabledValue != null) {
                    stateModel.setEnabled(childElement.getAttribute("id"), enabledValue == "true");
                }
                var selectedValue = childElement.getAttribute("selected");
                if (selectedValue != null) {
                    stateModel.setSelected(childElement.getAttribute("id"), selectedValue == "true");
                }
            }
            return stateModel;
        }
    },
    
    $load: function() {
        Echo.Serial.addPropertyTranslator("Extras.Serial.MenuStateModel", this);
    }
});
/**
 * AccordionPane component: contains multiple children in vertically arranged
 * tabs that slide up and down to reveal a single child at a time. May contain
 * multiple children. May contain panes as children.
 * 
 * @cp {String} activeTabId the renderId of the active tab
 * @cp {Number} activeTabIndex the index of the active tab
 * @sp {Number} animationTime the duration (in milliseconds) for which the
 *     animation transition effect should be rendered A value of zero indicates
 *     an instantaneous transition
 * @sp {#Insets} defaultContentInsets the default inset margin to display around
 *     child components
 * @sp {#Color} tabBackground the tab background color
 * @sp {#FillImage} tabBackgroundImage the tab background image
 * @sp {#Border} tabBorder the tab border
 * @sp {#Font} tabFont the tab font
 * @sp {#Color} tabForeground the tab foreground color
 * @sp {#Insets} tabInsets the tab inset margin
 * @sp {#Color} tabRolloverBackground the tab rollover background color
 * @sp {#FillImage} tabRolloverBackgroundImage the tab rollover background image
 * @sp {#Border} tabRolloverBorder the tab rollover border
 * @sp {#Font} tabRolloverFont the tab rollover font
 * @sp {Boolean} tabRolloverEnabled flag indicating whether rollover effects are
 *     enabled
 * @sp {#Color} tabRolloverForeground the tab rollover foreground color
 * @ldp {#ImageReference} icon the icon to display within a tab
 * @ldp {String} title the text to display within a tab
 */
Extras.AccordionPane = Core.extend(Echo.Component, {
    
    $static: {
    
        /**
         * The default animation time, 350ms.
         * @type Number
         */
        DEFAULT_ANIMATION_TIME: 350
    },
    
    $load: function() {
        Echo.ComponentFactory.registerType("Extras.AccordionPane", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.AccordionPane",

    /** @see Echo.Component#pane */
    pane: true,
    
    /**
     * Constructor.
     * @param properties associative mapping of initial property values (optional)
     */
    $construct: function(properties) {
        Echo.Component.call(this, properties);
        this.addListener("property", Core.method(this, this._tabChangeListener));
    },
    
    /**
     * Processes a user request to select a tab.
     * Notifies listeners of a "tabSelect" event.
     * 
     * @param {String} tabId the renderId of the child tab component
     */
    doTabSelect: function(tabId) {
        // Determine selected component.
        var tabComponent = this.application.getComponentByRenderId(tabId);
        if (!tabComponent || tabComponent.parent != this) {
            throw new Error("doTabSelect(): Invalid tab: " + tabId);
        }
        
        // Store active tab id.
        this.set("activeTabId", tabId);

        // Notify tabSelect listeners.
        this.fireEvent({ type: "tabSelect", source: this, tab: tabComponent, data: tabId });
    },
    
    /**
     * Internal property listener which synchronizes activeTabIndex and activeTabId properties when possible.
     * 
     * @param e a property event
     */
    _tabChangeListener: function(e) {
        var i;
        switch (e.propertyName) {
        case "activeTabId":
            if (this.application) {
                for (i = 0; i < this.children.length; ++i) {
                    if (this.children[i].renderId == e.newValue) {
                        if (this.get("activeTabIndex") != i) {
                            this.set("activeTabIndex", i);
                        }
                        return;
                    }
                }
            }
            break;
        case "activeTabIndex":
            i = parseInt(e.newValue, 10);
            if (this.application && this.children[i] && this.get("activeTabId") != this.children[i].renderId) {
                this.set("activeTabId", this.children[i].renderId);
            }
            break;
        }
    }
});
/**
 * BorderPane component: a container which renders a
 * <code>FillImageBorder</code> around its content. May contain only one
 * child. May contain a pane component as a child.
 * 
 * @sp {#FillImage} backgroundImage  the content background image
 * @sp {#FillImageBorder} border the border with which to surround the content
 * @sp {#Insets} insets the inset margin between border and content
 */
Extras.BorderPane = Core.extend(Echo.Component, {
    
    $static: {
    
        /**
         * Default border.
         * @type #FillImageBorder
         */
        DEFAULT_BORDER: { color: "#00007f", contentInsets: 20, borderInsets: 3 }
    },
    
    $load: function() {
        Echo.ComponentFactory.registerType("Extras.BorderPane", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.BorderPane",

    /** @see Echo.Component#pane */
    pane: true
});
/**
 * CalendarSelect component: an input component which allows selection of a single date.  Displays a representation of a calendar,
 * showing the currently selected month/year.  May not contain child components.
 *
 * @cp {Date} date the selected date
 * @sp {String} actionCommand the action command fired in action events when a date is selected
 * @sp {#Color} adjacentMonthDateBackground background color for dates in previous/next months
 * @sp {#Color} adjacentMonthDateForeground foreground color for dates in previous/next months
 * @sp {#Border} border the border wrapping the calendar
 * @sp {#FillImage} backgroundImage calendar background image
 * @sp {#Color} dateBackground default background color of date cells
 * @sp {#FillImage} dateBackgroundImage default background image of date cells (note that this image is displayed behind the 
 *     entire calendar date grid, rather than being repeated in each cell)
 * @sp {#Border} dateBorder default border of date cells
 * @sp {#Color} dateForeground default foreground color of date cells
 * @sp {Number} dayOfWeekNameAbbreviationLength number of characters to use in abbreviated day names (default 2)
 * @sp {Number} firstDayOfWeek the displayed first day of the week (0=Sunday, 1=Monday, ...)
 * @sp {#Color} headerBackground background color of the week header
 * @sp {#FillImage} headerBackgroundImage background image of the week header
 * @sp {#Color} headerForeground foreground color of the week header
 * @sp {#Color} rolloverDateBackground rollover background color of date cells
 * @sp {#Color} rolloverDateBorder rollover border of date cells
 * @sp {#FillImage} rolloverDateBackgroundImage rollover background image of date cells
 * @sp {#Color} rolloverDateForeground rollover foreground color of date cells
 * @sp {#Color} selectedDateBackground background color of selected date
 * @sp {#Border} selectedDateBorder border of selected date
 * @sp {#FillImage} selectedDateBackgroundImage background image of selected date
 * @sp {#Color} selectedDateForeground foreground color of selected date
 * @event action An event fired when the date selection changes.  The <code>actionCommand</code> property of the pressed
 *        button is provided as a property.
 */
Extras.CalendarSelect = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.CalendarSelect", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.CalendarSelect",
    
    /**
     * Programmatically performs a date selection action.
     */
    doAction: function() {
        this.fireEvent({type: "action", source: this, actionCommand: this.get("actionCommand")});
    }
 });
/**
 * ColorSelect component: an input component which displays a hue selector and
 * an integrated value/saturation selector to enable the selection of a 24-bit
 * RGB color. May not contain child components.
 * 
 * @cp {#Color} color the selected color
 * @sp {Boolean} displayValue flag indicating whether hex color value should be displayed
 * @sp {#Extent} hueWidth the width of the hue selector
 * @sp {#Extent} saturationHeight the height of the saturation selector
 * @sp {#Extent} valueWidth the width of the value selector
 */
Extras.ColorSelect = Core.extend(Echo.Component, {
    
    $static: {
        /** Default value width: 12em. */
        DEFAULT_VALUE_WIDTH: "12em",

        /** Default saturation height: 12em. */
        DEFAULT_SATURATION_HEIGHT: "12em",

        /** Default hue width: 2em. */
        DEFAULT_HUE_WIDTH: "2em"
    },
    
    $load: function() {
        Echo.ComponentFactory.registerType("Extras.ColorSelect", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.ColorSelect"
});
/**
 * DataGrid component: a model-based container which can display extremely large
 * amounts of content in a scrollable view. Content is retrieved from the model
 * only as necessary, enabling the component to contain more content than could
 * ever possibly be rendered. This component renders its content using cell
 * renderers, not child components. This component may not contain child
 * components.
 * 
 * This is an EXPERIMENTAL component, it should not be used at this point for
 * any purpose other than testing it.
 * 
 * @cp {Extras.DataGrid.Model} model the data model
 * @cp {Number} columnIndex displayed column index (indicates leftmost (leading) column in scrollable area)
 * @cp {Number} rowIndex displayed row index (indicates topmost column in scrollabel area)
 * @cp {Number} columnScroll displayed column percent, a value between 0 and 100
 * @cp {Number} rowScroll displayed row percent, a value between 0 and 100
 * @cp {Border} cellBorder default cell border
 * @sp {Number} fixedRowsTop the number of rows at the top which should not
 *     scroll
 * @sp {Number} fixedRowsBottom the number of rows at the bottom which should
 *     not scroll
 * @sp {Number} fixedColumnsRight the number of columns on the right side which
 *     should not scroll
 * @sp {Number} fixedColumnsLeft the number of columns on the left side which
 *     should not scroll
 * @sp {Array} columnWidth the widths of columns (as Extents)
 */
Extras.DataGrid = Core.extend(Echo.Component, {
    
    $load: function() {
        Echo.ComponentFactory.registerType("Extras.DataGrid", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.DataGrid",
    
    /** @see Echo.Component#pane */
    pane: true
});

/**
 * Abstract base class for <code>DataGrid</code> models.
 */
Extras.DataGrid.Model = Core.extend({

    $abstract: {
    
        /**
         * Returns the data value contained in the model at the specified column and row.
         * The value will be provided to a renderer before it is displayed.
         * The returned value may be of any type.
         * 
         * @param {Number} column the column number (0-based)
         * @param {Number} row the row number (0-based)
         * @return the model value
         */
        get: function(column, row) { },
    
        /**
         * Returns the number of columns in the model
         * 
         * @return the number of columns in the model
         * @type Number
         */
        getColumnCount: function() { },
        
        /**
         * Returns the number of rows in the model
         * 
         * @return the number of rows in the model
         * @type Number
         */
        getRowCount: function() { }
    },
    
    $virtual: {
        
        /**
         * Invoked to notify model of a region of data which should be made available for display.
         * 
         * @param {Function} callback function which should be invoked by implementation when prefetching has completed
         *        this function may be invoked asynchronously, i.e., as a result of an event that is fired some time after the
         *        prefetch method has returned
         * @param {Number} firstColumn the first column to retrieve (inclusive)
         * @param {Number} firstRow the first row to retrieve (inclusive)
         * @param {Number} lastColumn the last column to retrieve (inclusive)
         * @param {Number} lastRow the last row to retrieve (inclusive)
         */
        prefetch: null
    }
});

/**
 * Drag source component.
 * 
 * @cp {Array} dropTargetIds array of strings specifying renderIds of valid drop target components
 */
Extras.DragSource = Core.extend(Echo.Component, {
    
    $load: function() {
        Echo.ComponentFactory.registerType("Extras.DragSource", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.DragSource",

    /**
     * Programmatically performs a drop action.
     * 
     * @param {String} dropTarget the renderId of the valid drop target component on which the source component was dropped
     * @param {String} specificTarget the renderId of the most-specific component on which the source component was dropped 
     *        (must be a descendant of dropTargetComponent, may be equal to dropTarget)
     */
    doDrop: function(dropTarget, specificTarget) {
        this.fireEvent({ type: "drop", source: this, dropTarget: dropTarget, specificTarget: specificTarget, 
                data: specificTarget });
    }
});
Extras.FlowViewer = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.FlowViewer", this);
    },

    componentType: "Extras.FlowViewer",
    
    pane: true,
    
    doAction: function(index) {
        this.fireEvent({ type: "action", source: this, index: index });
    }
});
/**
 * Group component: A container which renders a border consisting of images
 * around its content. Optionally draws a title in the top border. May contain
 * one child component. May not contain a pane component as a child.
 * 
 * @sp {#FillImage} backgroundImage background image to display behind content
 * @sp {Array} borderImage an array containing the top-left, top, top-right,
 *     left, right, bottom-left, bottom, and bottom-right images that make up
 *     the border (note this an array of ImageReferences, not FillImages
 * @sp {Number} borderInsets the inset margin used to provide space for the
 *     border (if the left border were 6 pixels wide, the left portion of the
 *     inset should be also be configured to 6 pixels; a zero inset would render
 *     the content over the border)
 * @sp {#Insets} insets the inset margin around the content.
 * @sp {String} title
 * @sp {#FillImage} titleBackgroundImage background image to display behind
 *     title
 * @sp {#Font} titleFont the title font
 * @sp {#Insets} titleInsets the title inset margin
 * @sp {#Extent} titlePosition the title position, relative to the top-left
 *     corner of the component
 */
Extras.Group = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.Group", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Extras.Group"
});
/**
 * ListViewer component.
 * Displays a vertically scrolling model-based table.  The table model rows are fetched on an as-required basis, such that
 * the table may have a very large number of rows (e.g., thousands/millions/billions) without a significant performance impact.
 * 
 * @cp {Extras.Viewer.Model} model the data model
 * @cp {Extras.Sync.ListViewer.Renderer} renderer the model renderer
 * @cp {Array} selection the array of selected indices (integers)
 * @cp {Array} columnName an array of column names
 * @cp {Array} columnWidth an array of column widths; may be specified as percentage or absolute extent values
 * 
 * @sp {#FillImage} backgroundImage background image to render behind entire component  
 * @sp {#Border} border the cell border (a multi-sided border may be used, e.g., if a single pixel wide border is desired between
 *     cells, or if only horizontal or vertical borders are desired
 * @sp {#Color} headerBackground the background color of header cells
 * @sp {#Color} headerForeground the foreground color of header cells
 * @sp {#Insets} headerInsets the header cell insets
 * @sp {#Insets} insets the cell insets
 * @sp {Boolean} rolloverEnabled flag indicating whether pointing-device rollover effects are enabled
 * @sp {#Color} rolloverBackground background color for row pointing-device rollover effect
 * @sp {#Color} rolloverForeground foreground color for row pointing-device rollover effect
 * @sp {#Color} selectionBackground background color for row selection effect
 * @sp {#Color} selectionForeground foreground color for row selection effect
 */
Extras.ListViewer = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.ListViewer", this);
    },

    componentType: "Extras.ListViewer",
    
    pane: true,
    
    /**
     * Fires an action event for selection of the specified model index.
     */
    doAction: function(index) {
        this.fireEvent({ type: "action", source: this, index: index });
    }
});
/**
 * Abstract base class for menu components. Provides common functionality.
 */
Extras.MenuComponent = Core.extend(Echo.Component, {
    
    $abstract: true,
    
    /** @see Echo.Component#modalSupport */
    modalSupport: true,
    
    /** @see Echo.Component#focusable */
    focusable: true,
    
    /**
     * Processes the user selection an item.
     * 
     * @param {Extras.ItemModel} itemModel the selected item
     */
    doAction: function(itemModel) {
        var path = itemModel.getItemPositionPath().join(".");
        if (itemModel instanceof Extras.ToggleOptionModel) {
            this._toggleItem(itemModel);
        }
        this.fireEvent({type: "action", source: this, data: path, modelId: itemModel.modelId});
    },
    
    /**
     * Toggles the state of an toggle option model.
     * 
     * @param {Extras.ToggleOptionModel} itemModel the option to toggle
     */
    _toggleItem: function(itemModel) {
        var model = this.get("model");
        var stateModel = this.get("stateModel");
        if (itemModel.groupId) {
            var groupItems = model.findItemGroup(itemModel.groupId);
            for (var i = 0; i < groupItems.length; ++i) {
                stateModel.setSelected(groupItems[i].modelId, false);
            }
        }
        if (stateModel) {
            stateModel.setSelected(itemModel.modelId, !stateModel.isSelected(itemModel.modelId));
        }
    }
    
});

/**
 * ContextMenu component. May not contain child components.
 * 
 * @sp {#FillImage} backgroundImage the background image that will be displayed
 *     within menus
 * @sp {#Border} border the border that will be displayed around the menus
 * @sp {#Color} disabledBackground the background color used to render disabled
 *     menu items
 * @sp {#FillImage} disabledBackgroundImage the background image used to render
 *     disabled menu items
 * @sp {#Color} disabledForeground the foreground color used to render disabled
 *     menu items
 * @sp {#ImageReference} menuExpandIcon the icon used to expand child menus
 * @sp {#Color} selectionBackground the background color used to highlight the
 *     currently selected menu item
 * @sp {#FillImage} selectionBackgroundImage the background image used to
 *     highlight the currently selected menu item
 * @sp {#Color} selectionForeground the foreground color used to highlight the
 *     currently selected menu item
 * @sp {Number} activationMode a flag indicating how the context menu may be
 *     activated, one or more of the following values ORed together:
 *     <ul>
 *     <li><code>ACTIVATION_MODE_CLICK</code>: activate menu when contents
 *     are clicked.</li>
 *     <li><code>ACTIVATION_MODE_CONTEXT_CLICK</code>: (the default)
 *     activate menu when contents are context-clicked.</li>
 *     </ul>
 */
Extras.ContextMenu = Core.extend(Extras.MenuComponent, {

    $static: {
    
        /**
         * Value for <code>activationMode</code> property, indicating that the
         * context menu should be activated whenever the contents are
         * (normal/left) clicked.
         * 
         * @type Number
         */
        ACTIVATION_MODE_CLICK: 1,

        /**
         * Value for <code>activationMode</code> property, indicating that the
         * context menu should be activated whenever the contents are context
         * (right) clicked.
         * 
         * @type Number
         */
        ACTIVATION_MODE_CONTEXT_CLICK: 2
    },

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.ContextMenu", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Extras.ContextMenu"
});

/**
 * DropDownMenu component. If the <code>selectionEnabled</code> property is
 * set, the component will display the last chosen menu item in its closed
 * state. May not contain child components.
 * 
 * @sp {Number} animationTime the animation time (in milliseconds) (A value of
 *     zero indicates animation is disabled.)
 * @sp {#FillImage} backgroundImage the background image that will be displayed
 *     in the drop down box (This image will also be used in child menus unless
 *     a value is specified for the <code>menuBackgroundImage</code>
 *     property.)
 * @sp {#Border} border the border that will be displayed around the drop down
 *     box (This border will also be used around child menus unless a value is
 *     specified for the <code>menuBorder</code> property.)
 * @sp {#Color} disabledBackground the background color used to render disabled
 *     menu items
 * @sp {#FillImage} disabledBackgroundImage the background image used to render
 *     disabled menu items
 * @sp {#ImageReference} disabledExpandIcon the expand icon displayed in the
 *     drop down box
 * @sp {#Color} disabledForeground the foreground color used to render disabled
 *     menu items
 * @sp {#ImageReference} expandIcon the expand icon displayed in the drop down
 *     box
 * @sp {#ImageReference} expandIconWidth the width of the expand icon displayed
 *     in the drop down box
 * @sp {#Extent} height the height of the drop down box
 * @sp {#Insets} insets the insets of the drop down box
 * @sp {Boolean} lineWrap flag indicating whether long lines should be wrapped
 * @sp {#Color} menuBackground the background color that will be shown in child
 *     menus
 * @sp {#FillImage} menuBackgroundImage the background image that will be drawn
 *     in child menus
 * @sp {#Border} menuBorder the border that will be drawn around child menus
 * @sp {#ImageReference} menuExpandIcon the icon used to expand child menus
 * @sp {#Font} menuFont the font that will be shown in child menus
 * @sp {#Color} menuForeground the foreground color that will be shown in child
 *     menus
 * @sp {#Extent} menuHeight the height of the expanded menu
 * @sp {#Extent} menuWidth the width of the expanded menu
 * @sp {#Color} selectionBackground the background color used to highlight the
 *     currently selected menu item
 * @sp {#FillImage} selectionBackgroundImage the background image used to
 *     highlight the currently selected menu item
 * @sp {Boolean} selectionEnabled flag indicating whether item selection is
 *     enabled
 * @sp {#Color} selectionForeground the foreground color used to highlight the
 *     currently selected menu item
 * @sp {String} selectionText the text displayed in the drop down box when no
 *     item is selected
 * @sp {#Extent} width the width of the drop down box
 */
Extras.DropDownMenu = Core.extend(Extras.MenuComponent, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.DropDownMenu", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Extras.DropDownMenu"
});

/**
 * MenuBarPane component: a menu bar containing "pull down" menus. This
 * component is a Pane, and is generally best used as the first child of a
 * <code>SplitPane</code> component whose <code>autoPositioned</code>
 * property is set to true. May not contain child components.
 * 
 * @sp {Number} animationTime the animation time (in milliseconds) ( A value of
 *     zero indicates animation is disabled)
 * @sp {#FillImage} backgroundImage the background image that will be displayed
 *     in the menu bar (This image will also be used in child menus unless a
 *     value is specified for the <code>menuBackgroundImage</code> property.)
 * @sp {#Border} border the border that will be displayed around the menu bar
 *     (This border will also be used around child menus unless a value is
 *     specified for the <code>menuBorder</code> property.)
 * @sp {#Color} disabledBackground the background color used to render disabled
 *     menu items
 * @sp {#FillImage} disabledBackgroundImage the background image used to render
 *     disabled menu items
 * @sp {#Color} disabledForeground the foreground color used to render disabled
 *     menu items
 * @sp {#Color} menuBackground the background color that will be displayed in
 *     child menus
 * @sp {#FillImage} menuBackgroundImage the background image that will be
 *     displayed in child menus
 * @sp {#Border} menuBorder the border that will be displayed around child menus
 * @sp {#ImageReference} menuExpandIcon the icon used to expand child menus
 * @sp {#Color} menuForeground the foreground color that will be displayed in
 *     child menus
 * @sp {Number} menuOpacity the opacity setting (percent) that will be used for
 *     the background color/image displayed in pulldown menus (Valid values are
 *     between 1 and 100. Some clients may not support this setting and will
 *     always render menus with 100% opacity)
 * @sp {#Color} selectionBackground the background color used to highlight the
 *     currently selected menu item
 * @sp {#FillImage} selectionBackgroundImage the background image used to
 *     highlight the currently selected menu item
 * @sp {#Color} selectionForeground the foreground color used to highlight the
 *     currently selected menu item
 */
Extras.MenuBarPane = Core.extend(Extras.MenuComponent, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.MenuBarPane", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.MenuBarPane"
});

/**
 * Abstract base class for menu model items.
 */
Extras.ItemModel = Core.extend({

    $abstract: true,
    
    /**
     * The unique identifier of the item model.
     * @type String
     */
    modelId: null,
    
    /**
     * The parent menu model.
     * @type Extras.ItemModel
     */
    parent: null
});

/**
 * Representation of a menu that may contain submenus, options, and separators.
 */
Extras.MenuModel = Core.extend(Extras.ItemModel, {
    
    /**
     * The menu title text.
     * @type String
     */
    text: null,
    
    /**
     * The menu icon.
     * @type #ImageReference
     */
    icon: null,
    
    /**
     * The child menu items, an array of <code>ItemModel</code>s.
     * @type Array
     */
    items: null,
    
    /**
     * Creates a new menu model
     * 
     * @param {String} modelId the id of the menu model
     * @param {String} text the title  text of the menu model which will appear in its
     *        parent menu when this menu is used as a submenu
     * @param {#ImageReference} icon the icon of the menu model which will appear in its
     *        parent menu when this menu is used as a submenu
     * @param {Array} items the child menu items, an array of <code>ItemModel</code>s
     *        (optional)
     */
    $construct: function(modelId, text, icon, items) {
        this.modelId = modelId;
        this.id = Extras.uniqueId++;
        this.parent = null;
        this.text = text;
        this.icon = icon;
        if (items) {
            for (var i = 0; i < items.length; ++i) {
                items[i].parent = this;
            }
        }
        this.items = items ? items : [];
    },
    
    /**
     * Adds an item to the MenuModel.
     *
     * @param {Extras.ItemModel} item the item (must be a MenuModel, OptionModel, or SeparatorModel.
     */
    addItem: function(item) {
        this.items.push(item);
        item.parent = this;
    },
    
    /**
     * Finds an item by id in the <code>MenuModel</code>, searching descendant <code>MenuModel</code>s as necessary.
     * 
     * @param id the id of the menu item to find
     * @return the item model, or null if it cannot be found
     * @type Extras.ItemModel
     */
    findItem: function(id) {
        var i;
        for (i = 0; i < this.items.length; ++i) {
            if (this.items[i].id == id) {
                return this.items[i];
            }
        }
        for (i = 0; i < this.items.length; ++i) {
            if (this.items[i] instanceof Extras.MenuModel) {
                var itemModel = this.items[i].findItem(id);
                if (itemModel) {
                    return itemModel;
                }
            }
        }
        return null;
    },
    
    /**
     * Finds all items with the specified group id in the <code>MenuModel</code>, searching descendant <code>MenuModel</code>s 
     * as necessary.
     * 
     * @param groupId the id of the group to find
     * @return an array of items with the specified group id (an empty array if no items exists)
     * @type Array
     */
    findItemGroup: function(groupId) {
        var groupItems = [];
        for (var i = 0; i < this.items.length; ++i) {
            if (this.items[i] instanceof Extras.MenuModel) {
                var subGroupItems = this.items[i].findItemGroup(groupId);
                for (var j = 0; j < subGroupItems.length; ++j) {
                    groupItems.push(subGroupItems[j]);
                }
            } else if (this.items[i].groupId == groupId) {
                groupItems.push(this.items[i]);
            }
        }
        return groupItems;
    },
    
    /**
     * Returns the <code>ItemModel</code> at a specific path within this menu model.
     * 
     * @param {Array} itemPositions array of integers describing path, e.g., [0,1,2] would
     *        indicate the third item in the second item in the first item in this menu model.
     * @return the found item
     * @type Extras.ItemModel 
     */
    getItemModelFromPositions: function(itemPositions) {
        var menuModel = this;
        for (var i = 0; i < itemPositions.length; ++i) {
            menuModel = menuModel.items[parseInt(itemPositions[i], 10)];
        }
        return menuModel;
    },
    
    /**
     * Determines the index of the specified menu item.
     *
     * @param {Extras.ItemModel} item the item to find
     * @return the index of the item, or -1 if it cannot be found
     * @type Number
     */
    indexOfItem: function(item) {
        for (var i = 0; i < this.items.length; ++i) {
            if (this.items[i] == item) {
                return i;
            }
        }
        return -1;
    },
    
    /** @see Object#toString */
    toString: function() {
        return "MenuModel \"" + this.text + "\" Items:" + this.items.length;
    }
});

/**
 * Representation of a menu option.
 */
Extras.OptionModel = Core.extend(Extras.ItemModel, {
    
    /**
     * The menu title.
     * @type String
     */
    text: null,
    
    /**
     * The menu icon.
     * @type #ImageReference
     */
    icon: null,
    
    /**
     * Creates a new menu option.
     *
     * @param {String} modelId the id of the menu model
     * @param {String} text the menu item title
     * @param {#ImageReference} icon the menu item icon
     */ 
    $construct: function(modelId, text, icon) {
        this.modelId = modelId;
        this.id = Extras.uniqueId++;
        this.parent = null;
        this.text = text;
        this.icon = icon;
    },
    
    /**
     * Returns an array containing the path of this model to its most distant ancestor, consisting of 
     * positions.
     * 
     * @return the array of positions
     * @type Array
     */
    getItemPositionPath: function() {
        var path = [];
        var itemModel = this;
        while (itemModel.parent != null) {
            path.unshift(itemModel.parent.indexOfItem(itemModel));
            itemModel = itemModel.parent;
        }
        return path;
    },
    
    /** @see Object#toString */
    toString: function() {
        return "OptionModel \"" + this.text + "\"";
    }
});

/**
 * Representation of a toggle button (checkbox) menu option.
 */
Extras.ToggleOptionModel = Core.extend(Extras.OptionModel, {

    /**
     * Creates a new toggle option.
     *
     * @param {String} modelId the id of the menu model
     * @param {String} text the menu item title
     */ 
    $construct: function(modelId, text) {
        Extras.OptionModel.call(this, modelId, text, null);
    }
});

/**
 * Representation of a radio button menu option.
 */
Extras.RadioOptionModel = Core.extend(Extras.ToggleOptionModel, {

    /**
     * The identifier of the group to which the radio button belongs.
     * Only one radio button in a group may be selected at a given time.
     * @type String 
     */
    groupId: null,
    
    /**
     * Creates a radio option.
     *
     * @param {String} modelId the id of the menu model
     * @param {String} text the menu item title
     * @param {String} groupId the group identifier (only one radio button in a group may be selected at a given time)
     */ 
    $construct: function(modelId, text, groupId) {
        Extras.ToggleOptionModel.call(this, modelId, text);
        this.groupId = groupId;
    }
});

/**
 * A representation of a menu separator.
 */
Extras.SeparatorModel = Core.extend(Extras.ItemModel, { });

/**
 * Representation of menu model state, describing which items are selected and/or disabled.
 */ 
Extras.MenuStateModel = Core.extend({

    /**
     * Disabled menu item ids.
     * @type Array
     */
    _disabledItems: null,
    
    /**
     * Selected menu item ids.
     * @type Array
     */
    _selectedItems: null,

    /**
     * Creates a new <code>MenuStateModel</code>.
     */
    $construct: function() {
        this._disabledItems = [];
        this._selectedItems = [];
    },
    
    /**
     * Determines if the specified menu item is enabled.
     *
     * @param {String} modelId the item model id
     * @return true if the item is enabled
     * @type Boolean
     */
    isEnabled: function(modelId) {
        if (modelId) {
            for (var i = 0; i < this._disabledItems.length; i++) {
                if (this._disabledItems[i] == modelId) {
                    return false;
                }
            }
        }
        return true;
    },
    
    /**
     * Determines if the specified menu item is selected.
     *
     * @param {String} modelId the item model id
     * @return true if the item is selected
     * @type Boolean
     */
    isSelected: function(modelId) {
        if (modelId) {
            for (var i = 0; i < this._selectedItems.length; i++) {
                if (this._selectedItems[i] == modelId) {
                    return true;
                }
            }
        }
        return false;
    },
    
    /**
     * Sets the enabled state of a menu item.
     *
     * @param {String} modelId the item model id
     * @param {Boolean} enabled the enabled state
     */
    setEnabled: function(modelId, enabled) {
        if (enabled) {
            Core.Arrays.remove(this._disabledItems, modelId);
        } else {
            if (Core.Arrays.indexOf(this._disabledItems, modelId) == -1) {
                this._disabledItems.push(modelId);
            }
        }
    },
    
    /**
     * Sets the selection state of a menu item.
     *
     * @param {String} modelId the item model id
     * @param {Boolean} selected the selection state
     */
    setSelected: function(modelId, selected) {
        if (selected) {
            if (Core.Arrays.indexOf(this._selectedItems, modelId) == -1) {
                this._selectedItems.push(modelId);
            }
        } else {
            Core.Arrays.remove(this._selectedItems, modelId);
        }
    }
});
/**
 * Reorder component: a component which allows a user to rearrange its children using drag handles.
 *
 * @cp order the displayed order of the child components (if omitted, the child components will be displayed
 *     in their component order) 
 */
Extras.Reorder = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.Reorder", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.Reorder",
    
    /**
     * Returns the actual order of the children.
     * This method will always return a valid value regardless of the value of the order property.  It will always specify
     * every child exactly one time.
     * 
     * @return the order
     * @type Array
     */
    getOrder: function() {
        var i;
        var requestOrder = this.get("order") || [];
        var addedChildren = [];
        var actualOrder = [];
        
        for (i = 0; i < requestOrder.length; ++i) {
            if (requestOrder[i] >= this.children.length) {
                // Invalid child index.
                continue;
            }
            if (addedChildren[requestOrder[i]]) {
                // Child already added.
                continue;
            }
            // Mark child added.
            addedChildren[requestOrder[i]] = true;
            // Add child to actual order.
            actualOrder.push(requestOrder[i]);
        }
        
        // Render any children not specified in order.
        for (i = 0; i < this.children.length; ++i) {
            if (!addedChildren[i]) {
                // Unrendered child found: render.
                actualOrder.push(i);
            }
        }
        
        return actualOrder;
    },
    
    /**
     * Moves a child component from the specified source index to the new target index.
     * 
     * @param {Number} sourceIndex the source index
     * @param {Number} targetIndex the target index
     */
    reorder: function(sourceIndex, targetIndex) {
        var i, oldOrder = this.getOrder(), newOrder;
        newOrder = oldOrder.slice();
        newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, oldOrder[sourceIndex]);
        this.set("order", newOrder);
    }
});

/**
 * Reorder handle component: a drag handle component which may be placed inside a child of a Reorder component to allow the user
 * to rearrange the children.
 */
Extras.Reorder.Handle = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.Reorder.Handle", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Extras.Reorder.Handle"
});
/**
 * RichTextArea component: a rich text user input field which allows the user to
 * select text styles, and insert/manipulate objects such as links, images, enumerated
 * lists, or tables.  This component may not contain children.
 * 
 * Security warning: HTML input provided by this component should be considered
 * potentially malicious. Directly rendering the HTML entered by one user to
 * other users of a multi-user application without first "cleaning" it could be
 * disastrous to the other users. For example, a user could potentially embed
 * JavaScript code in URLs that would execute in the other users' browsers. Any
 * cleaning operations must be performed on the client that will render such
 * HTML (not the client sending it) or on a central trusted server.
 * 
 * @cp {String} text the content of the text area
 * @sp {#Border} border the border surrounding the text entry area
 * @sp {String} menuStyleName style name for menu bar
 * @sp {String} controlPaneStyleName style name for control panes used in
 *     dialogs
 * @sp {String} controlPaneRowStyleName style name for control pane row used in
 *     dialogs
 * @sp {String} controlPaneButtonStyleName style name for control pane buttons
 *     used in dialogs
 * @sp {String} toolbarButtonStyleName style name for main toolbar buttons
 * @sp {String} windowPaneStyleName style name for dialog
 *     <code>WindowPane</code>
 * @sp {Object} icons associative array mapping icon names to images
 * @sp {Object} features associative array describing which features should be
 *     enabled.
 * @event action An event fired when the enter/return key is pressed while the
 *        text area is focused.
 */
Extras.RichTextArea = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.RichTextArea", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.RichTextArea",

    /** @see Echo.Component#focusable */
    focusable: true,
    
    /**
     * Processes a user action (pressing enter within text entry area).
     */
    doAction: function() {
        this.fireEvent({source: this, type: "action"});
    },
    
    /**
     * Executes a rich-text editing command.
     * 
     * @param {String} commandName the command name
     * @param {String} value the (optional) value to send
     */
    execCommand: function(commandName, value) {
        this.fireEvent({type: "execCommand", source: this, commandName: commandName, value: value });
    },
    
    /**
     * Inserts HTML within the text area at the current cursor location.
     *
     * @param {String} html the HTML to be inserted 
     */
    insertHtml: function(html) {
        this.execCommand("insertHtml", html);
    }
});
/**
 * RichTextInput component.  A chrome-less cross browser rich text editing component.  Provides no toolbars/menus/features of
 * any kind.  Designed to be used within an application-rendered component, e.g., Extras.Sync.RichTextArea.
 * 
 * @cp {String} text the content of the text area
 * @sp {#Border} border the border surrounding the text entry area
 * @event action An event fired when the enter/return key is pressed while the
 *        text area is focused.
 * @event cursorStyleChange An event fired when the cursor is moved over text that may have a different style.
 * @event execCommand An event fired to provide notification of a rich-text editing command being executed.
 * @event insertHtml An event fired to provide notification of HTML insertion. 
 */
Extras.RichTextInput = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.RichTextInput", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.RichTextInput",
    
    /** @see Echo.Component#focusable */
    focusable: true,
    
    /**
     * Processes a user action (pressing enter within text entry area).
     */
    doAction: function() {
        this.fireEvent({source: this, type: "action"});
    },
    
    /**
     * Processes a cursor style change (cursor has moved over content which may have new style). 
     */
    doCursorStyleChange: function(style) {
        this.fireEvent({source: this, type: "cursorStyleChange", style: style});
    },
    
    /**
     * Executes a rich-text editing command.
     * 
     * @param {String} commandName the command name
     * @param {String} value the (optional) value to send
     */
    execCommand: function(commandName, value) {
        this.fireEvent({type: "execCommand", source: this, commandName: commandName, value: value });
    },
    
    /**
     * Inserts HTML within the text area at the current cursor location.
     *
     * @param {String} html the HTML to be inserted 
     */
    insertHtml: function(html) {
        this.execCommand("insertHtml", html);
    }
});
/**
 * TabPane component: a container which displays children as an array of tabs, displaying only the component whose tab is selected
 * at a specific time.  May contain zero or more child components.  May contain pane components as children.
 *
 * @cp {String} activeTabId the renderId of the active tab
 * @cp {Number} activeTabIndex the index of the active tab
 * @sp {#Border} border the border surrounding the content of the tab pane (note that <code>tabActiveBorder</code> will be used
 *     for this purpose if this property is not configured) 
 * @sp {Number} borderType the border border type, one of the following values:
 *     <ul>
 *      <li><code>BORDER_TYPE_NONE</code></li>
 *      <li><code>BORDER_TYPE_ADJACENT_TO_TABS</code> (the default)</li>
 *      <li><code>BORDER_TYPE_PARALLEL_TO_TABS</code></li>
 *      <li><code>BORDER_TYPE_SURROUND</code></li>
 *     </ul> 
 * @sp {#Insets} defaultContentInsets the default content inset margin
 * @sp {#FillImageBorder} imageBorder the image border to display around the entire <code>TabPane</code>
 * @sp {#Insets} insets the inset margin around the entire <code>TabPane</code>
 * @sp {#ImageReference} rolloverScrollLeftIcon the rolled-over version of <code>scrollLeftIcon</code>
 * @sp {#ImageReference} rolloverScrollRightIcon the rolled-over version of <code>scrollRightIcon</code>
 * @sp {#ImageReference} scrollLeftIcon the scroll icon to display to enable scrolling of the header to the left
 * @sp {#ImageReference} scrollRightIcon the scroll icon to display to enable scrolling of the header to the right
 * @sp {#Color} tabActiveBackground the background color used to render active tabs
 * @sp {#FillImage} tabActiveBackgroundImage the background image used to render active tabs
 * @sp {#Insets} tabActiveBackgroundInsets the inset margin displayed around the background color/image used to render active tabs
 *     (rendered only when image borders are used)
 * @sp {#Border} tabActiveBorder the border surrounding the active tab and the content of the <code>TabPane</code>
 * @sp {#Font} tabActiveFont the font used to render active tabs
 * @sp {#Color} tabActiveForeground the foreground color used to render active tabs
 * @sp {#Extent} tabActiveHeightIncrease the height increase of active tabs
 * @sp {#FillImageBorder} tabActiveImageBorder the image border to display around active tabs
 * @sp {#Insets} tabActiveInsets the inset margin used to render active tabs
 * @sp {#Alignment} tabAlignment the alignment within an individual tab
 * @sp {#FillImage} tabBackgroundImage the background image displayed behind the tabs
 * @sp {Boolean} tabCloseEnabled flag indicating whether tabs may be closed
 * @sp {#ImageReference} tabCloseIcon the tab close icon
 * @sp {Boolean} tabCloseIconRolloverEnabled flag indicating whether tab close icon rollover effects are enabled
 * @sp {#ImageReference} tabDisabledCloseIcon the tab close icon for tabs that may not be closed
 * @sp {#Color} tabFocusedBackground the background used to render rolled over tabs
 * @sp {#FillImage} tabFocusedBackgroundImage the background image used to render rolled over tabs
 * @sp {#Insets} tabFocusedBackgroundInsets the inset margin displayed around the background color/image used to render rolled
 *     over tabs (rendered only when image borders are used)
 * @sp {#Border} tabFocusedBorder the border used to render rolled over tabs
 * @sp {#Font} tabFocusedFont the font used to render rolled over tabs
 * @sp {#Color} tabFocusedForeground the foreground color used to render rolled over tabs
 * @sp {#FillImageBorder} tabFocusedImageBorder the image border used to render rolled over tabs
 * @sp {#Extent} tabHeight the minimum height of an individual (inactive) tab
 * @sp {#Color} tabInactiveBackground the background color used to render inactive tabs
 * @sp {#FillImage} tabInactiveBackgroundImage the background image used to render inactive tabs
 * @sp {#Insets} tabInactiveBackgroundInsets the inset margin displayed around the background color/image used to render inactive
 *     tabs (rendered only when image borders are used)
 * @sp {#Border} tabInactiveBorder the border surrounding inactive tabs
 * @sp {#Font} tabInactiveFont the font used to render inactive tabs
 * @sp {#Color} tabInactiveForeground the foreground color used to render inactive tabs
 * @sp {#FillImageBorder} tabInactiveImageBorder the image border to display around inactive tabs
 * @sp {#Insets} tabInactiveInsets the inset margin used to render inactive tabs
 * @sp {#Extent} tabIconTextMargin the margin size between the tab icon and the text
 * @sp {#Extent} tabInset the horizontal distance from which all tabs are inset from the edge of the <code>TabPane</code>
 * @sp {#Extent} tabMaximumWidth the maximum allowed width for a single tab (percent values may be used)
 * @sp {Number} tabPosition the position where the tabs are located relative to the pane content, one of the following values:
 * @sp {#Color} tabRolloverBackground the background used to render rolled over tabs
 * @sp {#FillImage} tabRolloverBackgroundImage the background image used to render rolled over tabs
 * @sp {#Insets} tabRolloverBackgroundInsets the inset margin displayed around the background color/image used to render rolled 
 *     over tabs (rendered only when image borders are used)
 * @sp {#Border} tabRolloverBorder the border used to render rolled over tabs
 * @sp {Boolean} tabRolloverEnabled flag indicating whether tab rollover effects are enabled
 * @sp {#Font} tabRolloverFont the font used to render rolled over tabs
 * @sp {#Color} tabRolloverForeground the foreground color used to render rolled over tabs
 * @sp {#FillImageBorder} tabRolloverImageBorder the image border used to render rolled over tabs
 * @sp {#ImageReference} tabRolloverCloseIcon the tab close rollover effect icon
 * @sp {#Extent} tabSpacing the horizontal space between individual tabs
 *     <ul>
 *      <li><code>TAB_POSITION_TOP</code></li>
 *      <li><code>TAB_POSITION_BOTTOM</code></li>
 *     </ul>
 * @sp {#Extent} tabWidth the width of an individual tab (setting tabMaximumWidth is generally preferred)
 * @ldp {#Color} activeBackground the active background color
 * @ldp {#FillImage} activeBackgroundImage the active background image
 * @ldp {#Insets} activeBackgroundInsets the inset margin displayed around the background color/image when the tab is active
 *      (rendered only when image borders are used)
 * @ldp {#Border} activeBorder the active border
 * @ldp {#Font} activeFont the active font
 * @ldp {#Color} activeForeground the active foreground color
 * @ldp {#ImageReference} activeIcon the active icon (icon property is used when inactive)
 * @ldp {#FillImageBorder} activeImageBorder the active image border
 * @ldp {#Insets} activeInsets the active insets
 * @ldp {Boolean} closeEnabled flag indicating whether close is enabled (default is true, only effective when containing
 *      <code>TabPane</code> allows closing tabs)
 * @ldp {#ImageReference} icon the icon to display within a tab
 * @ldp {#Color} inactiveBackground the inactive background color
 * @ldp {#FillImage} inactiveBackgroundImage the inactive background image
 * @ldp {#Insets} inactiveBackgroundInsets the inset margin displayed around the background color/image when the tab is inactive
 *      (rendered only when image borders are used)
 * @ldp {#Border} inactiveBorder the inactive border
 * @ldp {#Font} inactiveFont the inactive font
 * @ldp {#Color} inactiveForeground the inactive foreground color
 * @ldp {#FillImageBorder} inactiveImageBorder the inactive image border
 * @ldp {#Insets} inactiveInsets the inactive insets
 * @ldp {#Color} rolloverBackground the rollover background color
 * @ldp {#FillImage} rolloverBackgroundImage the rollover background image
 * @ldp {#Insets} rolloverBackgroundInsets the inset margin displayed around the background color/image when the tab is rolled over
 *      (rendered only when image borders are used)
 * @ldp {#Border} rolloverBorder the rollover border
 * @ldp {#Font} rolloverFont the rollover font
 * @ldp {#Color} rolloverForeground the rollover foreground color
 * @ldp {#ImageReference} rolloverIcon the rollover icon
 * @ldp {#FillImageBorder} rolloverImageBorder the rollover image border
 * @ldp {String} title the text to display within a tab
 * @ldp {String} toolTipText the tool tip text to display when a tab is rolled over
 * @event tabClose An event fired when the user requests to close a tab.
 * @event tabSelect An event fired when the user selects a tab. 
 */
Extras.TabPane = Core.extend(Echo.Component, {

    $static: {
    
        /**
         * Constant for the <code>borderType</code> property indicating that no 
         * border should be drawn around the content.
         * @type Number
         */
        BORDER_TYPE_NONE: 0,
        
        /**
         * Constant for the <code>borderType</code> property indicating that a
         * border should be drawn immediately adjacent to the tabs only.
         * If the tabs are positioned at the top of the <code>TabPane</code> the
         * border will only be drawn directly beneath the tabs with this setting.  
         * If the tabs are positioned at the bottom of the <code>TabPane</code> the
         * border will only be drawn directly above the tabs with this setting.
         * @type Number
         */
        BORDER_TYPE_ADJACENT_TO_TABS: 1,
        
        /**
         * Constant for the <code>borderType</code> property indicating that
         * borders should be drawn above and below the content, but not at its 
         * sides.
         * @type Number
         */
        BORDER_TYPE_PARALLEL_TO_TABS: 2,
        
        /**
         * Constant for the <code>borderType</code> property indicating that
         * borders should be drawn on all sides of the content.
         * @type Number
         */
        BORDER_TYPE_SURROUND: 3,
        
        /**
         * Constant for the <code>tabPosition</code> property indicating that
         * the tabs are positioned at the top of the <code>TabPane</code>.
         * @type Number
         */
        TAB_POSITION_TOP: 0,
        
        /**
         * Constant for the <code>tabPosition</code> property indicating that
         * the tabs are positioned at the bottom of the <code>TabPane</code>.
         * @type Number
         */
        TAB_POSITION_BOTTOM: 1
    },

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.TabPane", this);
    },

    /** @see Echo.Component#componentType */
    componentType: "Extras.TabPane",

    /** @see Echo.Component#pane */
    pane: true,

    /** @see Echo.Component#focusable */
    focusable: true,
    
    /**
     * Constructor.
     * @param properties associative mapping of initial property values (optional)
     */
    $construct: function(properties) {
        Echo.Component.call(this, properties);
        this.addListener("property", Core.method(this, this._tabChangeListener));
    },

    /**
     * Returns the order in which the tab children should be focused. Only
     * include the active tab in the focus order to avoid focusing hidden elements in
     * inactive tabs.
     *
     * @returns {Array}
     */
    getFocusOrder: function() {
        return this.get("activeTabIndex") != null ? [this.get("activeTabIndex")] : [0];
    },
    
    /**
     * Processes a user request to close a tab.
     * Notifies listeners of a "tabClose" event.
     * 
     * @param {String} tabId the renderId of the child tab component
     */
    doTabClose: function(tabId) {
        // Determine selected component.
        var tabComponent = this.application.getComponentByRenderId(tabId);
        if (!tabComponent || tabComponent.parent != this) {
            throw new Error("doTabClose(): Invalid tab: " + tabId);
        }

        // Notify tabClose listeners.
        this.fireEvent({ type: "tabClose", source: this, tab: tabComponent, data: tabId });
    },

    /**
     * Processes a user request to select a tab.
     * Notifies listeners of a "tabSelect" event.
     * 
     * @param {String} tabId the renderId of the child tab component
     * @param {Boolean} focus whether to focus the tab pane or not
     */
    doTabSelect: function(tabId, focus) {
        // Determine selected component.
        var tabComponent = this.application.getComponentByRenderId(tabId);
        if (!tabComponent || tabComponent.parent != this) {
            throw new Error("doTabSelect(): Invalid tab: " + tabId);
        }

        // Store active tab id.
        this.set("activeTabId", tabId);

        // Notify tabSelect listeners.
        this.fireEvent({ type: "tabSelect", source: this, tab: tabComponent, data: tabId });

        if (focus) {
            this.application.setFocusedComponent(this);
        } else {
            // Try to select a new element within the active tab
            if (this.application.getFocusedComponent() != this) {
                var nextComp = this.application.focusManager.find(tabComponent, false);
                if (nextComp != null) {
                    this.application.setFocusedComponent(nextComp);
                }
            }
        }

    },
    
    /**
     * Internal property listener which synchronizes activeTabIndex and activeTabId properties when possible.
     * 
     * @param e a property event
     */
    _tabChangeListener: function(e) {
        var i;
        switch (e.propertyName) {
        case "activeTabId":
            if (this.application) {
                for (i = 0; i < this.children.length; ++i) {
                    if (this.children[i].renderId == e.newValue) {
                        if (this.get("activeTabIndex") != i) {
                            this.set("activeTabIndex", i);
                        }
                        return;
                    }
                }
            }
            break;
        case "activeTabIndex":
            i = parseInt(e.newValue, 10);
            if (this.application && this.children[i] && this.get("activeTabId") != this.children[i].renderId) {
                this.set("activeTabId", this.children[i].renderId);
            }
            break;
        }
    }
});

/**
 * ToolTipContainer component: a container which may contain two children, the
 * first of which is always displayed and the second of which is displayed with
 * the mouse is hovered over the first. May contain zero, one, or two components
 * as children. Many not contain pane components.
 */
Extras.ToolTipContainer = Core.extend(Echo.Component, {
    
    $load: function() {
        Echo.ComponentFactory.registerType("Extras.ToolTipContainer", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.ToolTipContainer"
});
/**
 * TransitionPane component: a container pane which displays a single child pane
 * or component, rendering an animated transition effect when its content is
 * changed (when the child is removed and a new one is added). May contain zero
 * or one child components. May contain pane components as children.
 * 
 * @sp type the transition type, one of the following values:
 *     <ul>
 *     <li><code>TYPE_IMMEDIATE_REPLACE</code></li>
 *     <li><code>TYPE_CAMERA_PAN_LEFT</code></li>
 *     <li><code>TYPE_CAMERA_PAN_RIGHT</code></li>
 *     <li><code>TYPE_CAMERA_PAN_UP</code></li>
 *     <li><code>TYPE_CAMERA_PAN_DOWN</code></li>
 *     <li><code>TYPE_BLIND_BLACK_IN</code></li>
 *     <li><code>TYPE_BLIND_BLACK_OUT</code></li>
 *     <li><code>TYPE_FADE_TO_BLACK</code></li>
 *     <li><code>TYPE_FADE_TO_WHITE</code></li>
 *     <li><code>TYPE_FADE</code></li>
 *     </ul>
 * @sp {Number} duration the transition duration, in milliseconds
 */
Extras.TransitionPane = Core.extend(Echo.Component, {

    $static: {
    
        /**
         * Default duration time (350ms).
         */
        DEFAULT_DURATION: 350,
        
        /**
         * Default transition type (immediate replace).
         */
        DEFAULT_TYPE: 0,
        
        /**
         * Transition setting indicating new content should immediately 
         * final int replace old content with no visual effect.
         */
        TYPE_IMMEDIATE_REPLACE: 0,
            
        /**
         * Transition setting describing a visual effect where the
         * viewing area pans to the left to realize the new content.
         * Old content exits to the right side of the screen.
         * New content enters from the left side of the screen. 
         */
        TYPE_CAMERA_PAN_LEFT: 1,
        
        /**
         * Transition setting describing a visual effect where the
         * viewing area pans to the right to realize the new content.
         * Old content exits to the left side of the screen.
         * New content enters from the right side of the screen. 
         */
        TYPE_CAMERA_PAN_RIGHT: 2,
        
        /**
         * Transition setting describing a visual effect where the
         * viewing area pans up to realize the new content.
         * Old content exits to the bottom of the screen.
         * New content enters from the top of the screen. 
         */
        TYPE_CAMERA_PAN_UP: 3,
        
        /**
         * Transition setting describing a visual effect where the
         * viewing area pans to up to realize the new content.
         * Old content exits to the top of the screen.
         * New content enters from the bottom of the screen. 
         */
        TYPE_CAMERA_PAN_DOWN: 4,
        
        /**
         * Transition setting for a horizontal blind effect with a black background.
         * Top of blinds rotate inward.
         */
        TYPE_BLIND_BLACK_IN: 5,
        
        /**
         * Transition setting for a horizontal blind effect with a black background.
         * Top of blinds rotate outward.
         */
        TYPE_BLIND_BLACK_OUT: 6,
        
        /**
         * Transition setting to fade to black, fade in new content.
         */
        TYPE_FADE_TO_BLACK: 7,
    
        /**
         * Transition setting to fade to white, fade in new content.
         */
        TYPE_FADE_TO_WHITE: 8,

        /**
         * Fades to new content over old content.
         */
        TYPE_FADE: 9
    },

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.TransitionPane", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.TransitionPane",

    /** @see Echo.Component#pane */
    pane: true
});
/**
 * Extras viewer namespace object.
 * @namespace
 */
Extras.Viewer = { };

/**
 * Abstract base class for Viewer models.
 */
Extras.Viewer.Model = Core.extend({

    $abstract: {
    
        /**
         * Invoked to notify model of a region of data which should be made available for display.
         * This method must be invoked with paramaters <code>startIndex</code> &lt;= <code>index</code> &lt; <code>endIndex</code>
         * prior to invoking <code>get</code>(<code>index</code>). 
         * 
         * @param {Number} startIndex the first index to retrieve (inclusive)
         * @param {Number} endIndex the last index to retrieve (exclusive)
         */
        fetch: function(startIndex, endIndex) { },
        
        /**
         * Retrieves a model value.  <code>fetch()</code> will always be invoked on a range before <code>get()</code> is
         * used to retrieve individual values from that range.
         * 
         * @param {Number} index the index of the model item to retrieve
         * @return the model value
         * @type Object
         */
        get: function(index) { },
        
        /**
         * Returns the number of items contained in the model.
         * 
         * @return the number of items
         * @type Number
         */
        size: function() { }
    },
    
    /**
     * Constructor.
     * Must be invoked by derivative classes.
     */
    $construct: function() {
        this._listeners = new Core.ListenerList();
    },
    
    /**
     * Registers an <code>update</code> listener with the model.
     * Update listeners will be notified when an item within the model or the number of items within the model has changed.
     * 
     * @param {Function} l the listener to add 
     */
    addUpdateListener: function(l) {
        this._listeners.addListener("update", l);
    },
    
    /**
     * Notifies listeners that the model has fundamentally changed, possibly even including the 
     * number of items within the model.  
     */
    refresh: function() {
        this._listeners.fireEvent({ source: this, type: "update", refresh: true });
    },
    
    /**
     * Unregisters an <code>update</code> listener with the model.
     * Update listeners will be notified when an item within the model or the number of items within the model has changed.
     * 
     * @param {Function} l the listener to remove 
     */
    removeUpdateListener: function(l) {
        this._listeners.removeListener("update", l);
    },
    
    /**
     * Notifies listeners that a range of items within the model has changed, but that the size of the
     * model is unchanged.
     * 
     * @param {Number} startIndex the first index which has changed, inclusive
     * @param {Number} endIndex the last index which changed, exclusive (if unspecified, this value defaults to
     *        startIndex + 1, indicating only one value, startIndex, was changed)
     */
    update: function(startIndex, endIndex) {
        this._listeners.fireEvent({ 
            source: this, 
            type: "update", 
            startIndex: startIndex, 
            endIndex: endIndex == null ? startIndex + 1 : endIndex 
        });
    }
});

/**
 * An empty, immutable default model implementation that contains no items.
 */
Extras.Viewer.NullModel = Core.extend(Extras.Viewer.Model, {

    fetch: function(startIndex, endIndex) { },
    
    get: function(row) { 
        return null;
    },
    
    size: function() { 
        return 0;
    }
});

/**
 * Abstract Viewer model with caching support.
 */
Extras.Viewer.CachingModel = Core.extend(Extras.Viewer.Model, {
    
    _cache: null,
    _count: null,
    
    /**
     * Constructor.  Must be invoked by derivative classes.
     */
    $construct: function() {
        Extras.Viewer.Model.call(this);
        this._cache = {};
    },
    
    $abstract: {
        
        /**
         * Invoked when items are not found in cache and must be fetched.
         * Derivative classes should only override this method, rather
         * than overriding fetch() itself.
         * 
         * @param startIndex the first model item index to retrieve, inclusive
         * @param endIndex the last model item index to retrieve, exclusive
         * @return an array containing the fetched model items, with 
         *         index 0 representing the item at startIndex 
         */
        fetchImpl: function(startIndex, endIndex) { }
    },

    $virtual: {
        
        /**
         * The number of items to fetch when no data is in the model.  Generally This value
         * should be sized to be at least greater than the anticipated initial number
         * of items on the screen.
         * @type Number
         */
        emptyFetch: 20,

        /**
         * The number of extra items to fetch beyond what is absolutely required.
         * Setting this value higher can avoid roundtrip requests to the datastore.
         */
        overFetch: 10
    },
    
    /**
     * Stores values in the cache.
     *
     * @param startIndex the index of the first item to store (inclusive)
     * @param endIndex the index of the last item to store (exclusive)
     * @param items the items to store
     * @param newCount the updated item count (the pre-existing cache will be invalidated if this value
     *        does not match the current count value)
     * @param {Boolean} invalidate flag indicating whether or not the cache should be invalidated
     */
    cacheStore: function(startIndex, endIndex, items, newCount, invalidate) {
        for (var i = 0; i < items.length; ++i) {
            this._cache[startIndex + i] = items[i];
        }
        
        if (invalidate || this._count !== newCount) {
            this._count = newCount;
            this.refresh();
        } else {
            this.update(startIndex, endIndex);
        }
    },
    
    /**
     * Fetch implementation, should not be overriden.  This method will invoke
     * fetchImpl() when required.
     */
    fetch: function(startIndex, endIndex) {
        startIndex = Math.max(startIndex - this.overFetch, 0);
        endIndex = Math.min(endIndex + this.overFetch, this.size());
        
        if (endIndex === 0) {
            this.fetchImpl(0, this.emptyFetch);
        } else {
            var firstMiss = null, lastMiss = null;
            for (var i = startIndex; i < endIndex; ++i) {
                if (!this._cache[i]) {
                    if (firstMiss === null) {
                        firstMiss = i;
                    }
                    lastMiss = i;
                }
            }
            
            if (firstMiss !== null) {
                this.fetchImpl(firstMiss, lastMiss + 1);
            }
        }
    },
    
    /**
     * get() implementation, returns cached values.
     */
    get: function(index) { 
        return this._cache[index];
    },

    /**
     * size() implementation, returns size specified in most recent cacheStore() invocation.
     */
    size: function() { 
        return this._count || 0;
    }
});
/**
 * Component rendering peer: AccordionPane.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.AccordionPane = Core.extend(Echo.Render.ComponentSync, {

    $static: {
    
        /**
         * Supported partial update properties. 
         * @type Array
         */
        _supportedPartialProperties: { "activeTabId": true, "activeTabIndex": true },

        /**
         * Default component property settings, used when supported component object does not provide settings. 
         */
        _DEFAULTS: {
            tabBackground: "#cfcfcf",
            tabBorder: "1px outset #cfcfcf",
            tabForeground: "#000000",
            tabInsets: "2px 5px",
            tabContentInsets: 0
        }
    },
    
    $load: function() {
        Echo.Render.registerPeer("Extras.AccordionPane", this);
    },
    
    /**
     * Tab rotation animation runtime, in milliseconds.
     * @type Number
     */
    _animationTime: 0,
    
    /**
     * Root DIV.
     * @type Element
     */
    div: null,
    
    /**
     * renderId of currently active tab.
     * @type String
     */
    _activeTabId: null,

    /**
     * Flag indicating whether new images have been loaded, requiring a redraw/possible-resize of tabs.
     * @type Boolean
     */
    _newImagesLoaded: null,
    
    /**
     * Flag indicating whether renderDisplay is scheduled to be executed.
     * @type Boolean
     */
    _pendingRenderDisplay: false,
    
    /**
     * Animated rotation currently in progress (null when not animating).
     * @type Extras.Sync.AccordionPane.Rotation
     */
    rotation: null,
    
    /**
     * Array of Extras.Sync.AccordionPane.Tab instances representing individual tabs.
     * @type Array
     */
    tabs: null,
    
    /**
     * Flag indicating whether content overflow should be set to hidden during animation.
     * Set based on browser type, used to prevent rendering artifacts in certain browsers.
     * @type Boolean
     */
    resetOverflowForAnimation: false,
    
    /** 
     * Method reference to <code>_tabSelectListener</code> of instance.
     * @type Function 
     */
    _tabSelectListenerRef: null,
    
    /**
     * Method reference to image load monitoring function.
     * Rendering tabs register image loading listeners to this reference.
     * @type Function
     */
    imageMonitorRef: null,

    /** Constructor. */
    $construct: function() {
        this.tabs = [];
        this.resetOverflowForAnimation = Core.Web.Env.ENGINE_GECKO || Core.Web.Env.ENGINE_MSHTML;
        this._tabSelectListenerRef = Core.method(this, this._tabSelectListener);
        this.imageMonitorRef = Core.method(this, this._imageMonitor);
    },
    
    /**
     * Retrieves the tab instance with the specified tab id.
     * 
     * @param tabId the tab id
     * @return the tab, or null if no tab is present with the specified id
     */
    _getTabById: function(tabId) {
        for (var i = 0; i < this.tabs.length; ++i) {
            var tab = this.tabs[i];
            if (tab.childComponent.renderId == tabId) {
                return tab;
            }
        }
        return null;
    },
    
    /**
     * Determines the height of one or more tabs.
     *
     * If only beginIndex is specified, the height of the tab at index beginIndex will be returned.
     * Note that if endIndex is specified, the tab at index endIndex will NOT be included in the calculation,
     * that is, to measure the height of tabs 2, 3, and 4, it is necessary specify beginIndex as 2 and endIndex as 5 (not 4).
     *
     * @param {Number} beginIndex the begin index, inclusive
     * @param {Number} endIndex the end index, exclusive
     * @return the tab height(s), in pixels
     * @type Number
     */
    getTabHeight: function(beginIndex, endIndex) {
        if (endIndex == null || endIndex < beginIndex) {
            throw new Error("Invalid indices: begin=" + beginIndex + ",end=" + endIndex);
        } else {
            var tabHeight = 0;
            for (var i = beginIndex; i < endIndex; ++i) {
                tabHeight += this.tabs[i].tabDiv.offsetHeight;
            }
            return tabHeight;
        }
    },
    
    /**
     * Image monitor implementation.
     */
    _imageMonitor: function() {
        if (this._newImagesLoaded) {
            return;
        }
        this._newImagesLoaded = true;
        Core.Web.Scheduler.run(Core.method(this, function() {
            if (this.client && !this._pendingRenderDisplay) {
                this.redrawTabs(false);
            }
            this._newImagesLoaded = false;
        }));
    },
    
    /**
     * Capturing Mouseover/out listener to prevent rollover effects from firing on children during transitions.
     * Returns false if transition present.
     * 
     * @param e the rollover event
     */
    _processRollover: function(e) {
        return !this.rotation;
    },
    
    /**
     * Immediately redraws tabs in the appropriate positions, exposing the content of the 
     * selected tab.  Any active animated rotation is aborted.
     * 
     * @param {Boolean} notifyComponentUpdate flag indicating whether child component should be notified to perform
     *        renderDisplay() operations
     */
    redrawTabs: function(notifyComponentUpdate) {
        if (this.rotation) {
            this.rotation.abort();
        }
        
        if (this._activeTabId == null || this._getTabById(this._activeTabId) == null) {
            if (this.tabs.length > 0) {
                this._activeTabId = this.tabs[0].childComponent.renderId;
            } else {
                this._activeTabId = null;
            }
        }
        
        var selectionPassed = false;
        for (var i = 0; i < this.tabs.length; ++i) {
            if (selectionPassed) {
                this.tabs[i].tabDiv.style.top = "";
                this.tabs[i].tabDiv.style.bottom = this.getTabHeight(i + 1, this.tabs.length ) + "px";
            } else {
                this.tabs[i].tabDiv.style.bottom = "";
                this.tabs[i].tabDiv.style.top = this.getTabHeight(0, i) + "px";
            }
    
            this.tabs[i].containerDiv.style.height = "";
            
            if (this._activeTabId == this.tabs[i].childComponent.renderId) {
                selectionPassed = true;
                this.tabs[i].containerDiv.style.display = "block";
                this.tabs[i].containerDiv.style.top = this.getTabHeight(0, i + 1) + "px";
                this.tabs[i].containerDiv.style.bottom = this.getTabHeight(i + 1, this.tabs.length) + "px";
                this.tabs[i].contentDiv.style.top = 0;
                this.tabs[i].contentDiv.style.bottom = 0;
                this.tabs[i].contentDiv.style.height = "";
                Core.Web.VirtualPosition.redraw(this.tabs[i].contentDiv);
            } else {
                this.tabs[i].containerDiv.style.display = "none";
            }
        }
        
        if (notifyComponentUpdate) {
            Echo.Render.notifyResize(this.component);
            this.renderDisplayTabs();
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this.component.addListener("tabSelect", this._tabSelectListenerRef);
        
        this._animationTime = this.component.render("animationTime", Extras.AccordionPane.DEFAULT_ANIMATION_TIME);
        this._activeTabId = this.component.get("activeTabId");
        
        this.div = document.createElement("div");
        this.div.id = this.component.renderId;
        this.div.style.cssText = "position:absolute;width:100%;height:100%;";
        Echo.Sync.renderComponentDefaults(this.component, this.div);
        
        var rolloverMethod = Core.method(this, this._processRollover);
        Core.Web.Event.add(this.div, "mouseover", rolloverMethod, true);
        Core.Web.Event.add(this.div, "mouseout", rolloverMethod, true);
        
        var componentCount = this.component.getComponentCount();
        for (var i = 0; i < componentCount; ++i) {
            var child = this.component.getComponent(i);
            var tab = new Extras.Sync.AccordionPane.Tab(child, this);
            this.tabs.push(tab);
            tab.render(update);
            this.div.appendChild(tab.tabDiv);
            this.div.appendChild(tab.containerDiv);
        }
        
        parentElement.appendChild(this.div);
        
        this._pendingRenderDisplay = true;
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        this._pendingRenderDisplay = false;
        if (!this.rotation) {
            this.redrawTabs(false);
        }
        this.renderDisplayTabs();
    },
    
    /**
     * Invokes renderDisplay() implementations on tabs.
     */
    renderDisplayTabs: function() {
        for (var i = 0; i < this.tabs.length; ++i) {
            this.tabs[i].renderDisplay();
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Core.Web.Event.removeAll(this.div);
        this.component.removeListener("tabSelect", this._tabSelectListenerRef);

        if (this.rotation) {
            this.rotation.abort();
        }
        this._activeTabId = null;
        for (var i = 0; i < this.tabs.length; i++) {
            this.tabs[i].dispose();
        }
        this.tabs = [];
        this.div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var fullRender;

        if (update.hasUpdatedLayoutDataChildren() || update.hasAddedChildren() || update.hasRemovedChildren()) {
            // Add/remove/layout data change: full render.
            fullRender = true;
        } else {
            if (update.isUpdatedPropertySetIn(Extras.Sync.AccordionPane._supportedPartialProperties) &&
                   update.getUpdatedProperty("activeTabId")) {
                this._selectTab(update.getUpdatedProperty("activeTabId").newValue);
                fullRender = false;
            } else {
                fullRender = true;
            }
        }

        if (fullRender) {
            var element = this.div;
            var containerElement = element.parentNode;
            Echo.Render.renderComponentDispose(update, update.parent);
            containerElement.removeChild(element);
            this.renderAdd(update, containerElement);
        }

        return fullRender;
    },
    
    /**
     * "Rotates" the AccordionPane to display the specified tab.
     *
     * @param {String} oldTabId the currently displayed tab id
     * @param {String} newTabId the id of the tab that will be displayed
     */
    _rotateTabs: function(oldTabId, newTabId) {
        var oldTab = this._getTabById(oldTabId);
        if (oldTab == null) {
            // Old tab has been removed.
            this.redrawTabs(true);
            return;
        }
        if (this.rotation) {
            // Rotation was already in progress, cancel
            this.rotation.abort();
            this.redrawTabs(true);
        } else {
            // Start new rotation.
            var newTab = this._getTabById(newTabId);
            this.rotation = new Extras.Sync.AccordionPane.Rotation(this, oldTab, newTab);
            this.rotation.runTime = this._animationTime;
            this.rotation.start();
        }
    },
    
    /**
     * Selects a specific tab.
     * 
     * @param {String} tabId the id of the tab to select
     */
    _selectTab: function(tabId) {
        if (tabId == this._activeTabId) {
            return;
        }
        
        var oldTabId = this._activeTabId;
        this._activeTabId = tabId;
        if (oldTabId != null && this._animationTime > 0) {
            this._rotateTabs(oldTabId, tabId);
        } else {
            this.redrawTabs(true);
        }
    },
    
    /**
     * Event listener to component instance for user tab selections.
     * 
     * @param e the event
     */
    _tabSelectListener: function(e) {
        this._selectTab(e.tab.renderId);
    }
});

/**
 * Representation of a single tab (child component) within the accordion pane.
 * Provides tab-specific rendering functionality.
 */
Extras.Sync.AccordionPane.Tab = Core.extend({
    
    /**
     * DIV element containing the tab header
     * @type Element
     */
    tabDiv: null,
    
    /**
     * The AccordionPane synchronization peer.
     * @type Extras.Sync.AccordionPane
     */
    _parent: null,
    
    /**
     * The content container DIV (contains content DIV).
     * @type Element
     */
    containerDiv: null,
    
    /**
     * The content DIV (contains child component rendering).
     * @type Element
     */
    contentDiv: null,
    
    /**
     * The child component which will be rendered within the tab.
     * @type Echo.Component
     */
    childComponent: null,
    
    /**
     * Creates a new Tab instance.
     * 
     * @param {Echo.Component} childComponent the child component which will be rendered within the tab
     * @param {Extras.Sync.AccordionPane} parent the AccordionPane synchronization peer
     */
    $construct: function(childComponent, parent) {
        this.childComponent = childComponent;
        this._parent = parent;
    },
    
    /**
     * Adds event listeners to the tab to handle click and mouse events.
     */
    _addEventListeners: function() {
        Core.Web.Event.add(this.tabDiv, "click", Core.method(this, this._processClick), false);
        if (this._parent.component.render("tabRolloverEnabled", true)) {
            Core.Web.Event.add(this.tabDiv, 
                    Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseenter" : "mouseover", 
                    Core.method(this, this._processEnter), false);
            Core.Web.Event.add(this.tabDiv, 
                    Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseleave" : "mouseout", 
                    Core.method(this, this._processExit), false);
        }
        Core.Web.Event.Selection.disable(this.tabDiv);
    },
    
    /**
     * Disposes of the tab, releasing any resources.
     */
    dispose: function() {
        Core.Web.Event.removeAll(this.tabDiv);
        this._parent = null;
        this.childComponent = null;
        this.tabDiv = null;
        this.containerDiv = null;
    },
    
    /**
     * Determine content inset margin.
     * 
     * @return the content inset margin
     * @type #Insets
     */
    getContentInsets: function() {
        if (this.childComponent.pane) {
            return 0;
        } else {
            var insets = this._parent.component.render("defaultContentInsets");
            return insets ? insets : Extras.Sync.AccordionPane._DEFAULTS.tabContentInsets;
        }
    },
    
    /**
     * Tab click handler.
     * 
     * @param e the click event
     */
    _processClick: function(e) {
        if (!this._parent || !this._parent.client || !this._parent.client.verifyInput(this._parent.component)) {
            return;
        }
        this._parent.component.doTabSelect(this.childComponent.renderId);
    },
    
    /**
     * Tab rollover enter handler.
     * 
     * @param e the mouse event
     */
    _processEnter: function(e) {
        if (!this._parent || !this._parent.client || !this._parent.client.verifyInput(this._parent.component)) {
            return;
        }
        this._renderState(true);
    },
    
    /**
     * Tab rollover exit handler.
     * 
     * @param e the mouse event
     */
    _processExit: function(e) {
        if (!this._parent || !this._parent.client || !this._parent.client.verifyInput(this._parent.component)) {
            return;
        }
        this._renderState(false);
    },
    
    /**
     * Renders the tab.
     * 
     * @param {Echo.Update.ComponentUpdate} update the component update 
     */
    render: function(update) {
        var layoutData = this.childComponent.render("layoutData") || {};
        
        this.tabDiv = document.createElement("div");
        this.tabDiv.id = this._parent.component.renderId + "_tab_" + this.childComponent.renderId;
        this.tabDiv.style.cssText = "cursor:pointer;position:absolute;left:0;right:0;overflow:hidden;";
        
        Echo.Sync.Insets.render(this._parent.component.render("tabInsets", Extras.Sync.AccordionPane._DEFAULTS.tabInsets), 
                this.tabDiv, "padding");
        
        if (layoutData.icon) {
            //FIXME Temporary implementation.  Need proper layout for common icon + text case.
            var img = document.createElement("img");
            Echo.Sync.ImageReference.renderImg(layoutData.icon, img);
            img.style.paddingRight = "3px";
            this.tabDiv.appendChild(img);
            
            Core.Web.Image.monitor(this.tabDiv, this._parent.imageMonitorRef);
        }
        
        this.tabDiv.appendChild(document.createTextNode(layoutData.title ? layoutData.title : "\u00a0"));
    
        this.containerDiv = document.createElement("div");
        this.containerDiv.style.cssText = "display:none;position:absolute;left:0;right:0;overflow:hidden;";
        
        this.contentDiv = document.createElement("div");
        this.contentDiv.style.cssText = "position:absolute;left:0;right:0;overflow:auto;";
        Echo.Sync.Insets.render(this.getContentInsets(), this.contentDiv, "padding");
        
        Echo.Render.renderComponentAdd(update, this.childComponent, this.contentDiv);
        
        this.containerDiv.appendChild(this.contentDiv);
        
        this._renderState(false);
        this._addEventListeners();
    },
    
    /**
     * Renders the tab active or inactive, updating header state.
     * 
     * @param {Boolean} rollover the rollover state of the tab, true for active, false for inactive
     */
    _renderState: function(rollover) {
        var tabDiv = this.tabDiv,
            border = this._parent.component.render("tabBorder", Extras.Sync.AccordionPane._DEFAULTS.tabBorder),
            borderData,
            borderDataBottom,
            background = this._parent.component.render("tabBackground", Extras.Sync.AccordionPane._DEFAULTS.tabBackground);
            
        if (rollover) {
            var rolloverBackground = this._parent.component.render("tabRolloverBackground");
            if (!rolloverBackground) {
                rolloverBackground = Echo.Sync.Color.adjust(background, 20, 20, 20);
            }
            Echo.Sync.Color.render(rolloverBackground, tabDiv, "backgroundColor");
            var backgroundImage = this._parent.component.render("tabRolloverBackgroundImage");
            if (backgroundImage) {
                tabDiv.style.backgroundImage = "";
                tabDiv.style.backgroundPosition = "";
                tabDiv.style.backgroundRepeat = "";
                Echo.Sync.FillImage.render(backgroundImage, tabDiv, null);
            }
            var foreground = this._parent.component.render("tabRolloverForeground");
            if (foreground) {
                Echo.Sync.Color.render(foreground, tabDiv, "color");
            }
            Echo.Sync.Font.render(this._parent.component.render("tabRolloverFont"), tabDiv);
            var rolloverBorder = this._parent.component.render("tabRolloverBorder");
            if (!rolloverBorder) {
                rolloverBorder = border;
                if (Echo.Sync.Border.isMultisided(rolloverBorder)) {
                    borderData = Echo.Sync.Border.parse(rolloverBorder.top);
                    borderDataBottom = Echo.Sync.Border.parse(rolloverBorder.bottom);
                    rolloverBorder = {
                            top: Echo.Sync.Border.compose(borderData.size, borderData.style,
                                    Echo.Sync.Color.adjust(borderData.color, 20, 20, 20)),
                            bottom: Echo.Sync.Border.compose(borderDataBottom.size, borderDataBottom.style,
                                    Echo.Sync.Color.adjust(borderDataBottom.color, 20, 20, 20))
                    };
                } else {
                    borderData = Echo.Sync.Border.parse(rolloverBorder);
                    rolloverBorder = Echo.Sync.Border.compose(borderData.size, borderData.style,
                            Echo.Sync.Color.adjust(borderData.color, 20, 20, 20));
                }
            }
        } else {
            Echo.Sync.Color.render(background, tabDiv, "backgroundColor");
            Echo.Sync.Color.render(this._parent.component.render("tabForeground", 
                    Extras.Sync.AccordionPane._DEFAULTS.tabForeground), tabDiv, "color");
            Echo.Sync.Font.renderClear(this._parent.component.render("tabFont"), tabDiv);
            tabDiv.style.backgroundImage = "";
            tabDiv.style.backgroundPosition = "";
            tabDiv.style.backgroundRepeat = "";
            Echo.Sync.FillImage.render(this._parent.component.render("tabBackgroundImage"), tabDiv);
        }

        if (Echo.Sync.Border.isMultisided(border)) {
            Echo.Sync.Border.render(border.top, tabDiv, "borderTop");
            Echo.Sync.Border.render(border.bottom, tabDiv, "borderBottom");
        } else {
            Echo.Sync.Border.render(border, tabDiv, "borderTop");
            Echo.Sync.Border.render(border, tabDiv, "borderBottom");
        }
    },
    
    /**
     * Tab-specific renderDisplay() tasks.
     */
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this.tabDiv);
        Core.Web.VirtualPosition.redraw(this.containerDiv);
        Core.Web.VirtualPosition.redraw(this.contentDiv);
    }
});

/**
 * Manages the rotation animation of an AccordionPane.
 */
Extras.Sync.AccordionPane.Rotation = Core.extend(Extras.Sync.Animation, {
    
    /**
     * The AccordionPane peer.
     * @type Extras.Sync.AccordionPane
     */
    _parent: null,

    /**
     * The old tab.
     * @type Extras.Sync.AccordionPane.Tab 
     */
    _oldTab: null,
    
    /**
     * The new tab.
     * @type Extras.Sync.AccordionPane.Tab 
     */
    _newTab: null,
    
    /**
     * Index of old tab.
     * @type Number
     */
    _oldTabIndex: null,
    
    /**
     * Index of new tab.
     * @type Number
     */
    _newTabIndex: null,
    
    /**
     * Flag indicating whether tabs will be rotating downward (true) or upward (false).
     * @type Boolean
     */
    _directionDown: null,
    
    /**
     * Number of tabs which are rotating.
     * @type Number
     */
    _rotatingTabCount: null,
    
    /**
     * Height of accordion pane.
     * @type Number
     */
    _regionHeight: null,
    
    /**
     * Numbers of tabs above that will not be moving.
     * @type Number
     */
    _numberOfTabsAbove: null,
    
    /**
     * Number of tabs below that will not be moving.
     * @type Number
     */
    _numberOfTabsBelow: null,
    
    /** 
     * Initial position of extreme edge of first moving tab.
     * For downward moves, this value is the top edge of the top tab.
     * For upward moves, this value is the bottom edge of the bottom tab.
     * @param Number
     */
    _startPosition: null,
    
    /**
     * Number of pixels across which animation will occur.
     * @type Number
     */
    _animationDistance: null,
    
    /**
     * Creates a new rotation.
     *
     * @param {Extras.Sync.AccordionPane} parent the AccordionPane peer
     * @param {Extras.Sync.AccordionPane.Tab} oldTab the old (current) tab
     * @param {Extras.Sync.AccordionPane.Tab} newTab the new tab to display
     */
    $construct: function(parent, oldTab, newTab) {
        this._parent = parent;
        this._oldTab = oldTab;
        this._newTab = newTab;
        
        // Calculate and store parameters for rotation.
        this._regionHeight = this._parent.div.offsetHeight;
        this._oldTabIndex = Core.Arrays.indexOf(this._parent.tabs, this._oldTab);
        this._newTabIndex = Core.Arrays.indexOf(this._parent.tabs, this._newTab);
        this._rotatingTabCount = Math.abs(this._newTabIndex - this._oldTabIndex);
        this._directionDown = this._newTabIndex < this._oldTabIndex;
        if (this._directionDown) {
            this._numberOfTabsAbove = this._newTabIndex + 1;
            this._numberOfTabsBelow = this._parent.tabs.length - 1 - this._newTabIndex;
            this._startPosition = this._parent.getTabHeight(0, this._newTabIndex + 1);
            this._animationDistance = this._regionHeight - 
                    this._parent.getTabHeight(this._newTabIndex + 1, this._parent.tabs.length) - this._startPosition;
        } else {
            this._numberOfTabsAbove = this._newTabIndex;
            this._numberOfTabsBelow = this._parent.tabs.length - 1 - this._newTabIndex;
            this._startPosition = this._parent.getTabHeight(this._newTabIndex + 1, this._parent.tabs.length);
            this._animationDistance = this._regionHeight - this._parent.getTabHeight(0, this._newTabIndex + 1) - 
                    this._startPosition;
        }
    },
    
    /** @see Extras.Sync.Animation#complete */
    complete: function() {
        this._parent.rotation = null;

        // Complete Rotation.
        var parent = this._parent;
        
        if (this._parent.resetOverflowForAnimation) {
            this._oldTab.contentDiv.style.overflow = "auto";
            this._newTab.contentDiv.style.overflow = "auto";
        }

        var renderId = this._parent.component.renderId;
        this._parent = null;
        this._oldTab = null;
        this._newTab = null;
        
        parent.redrawTabs(true);
    },
    
    /** @see Extras.Sync.Animation#init */
    init: function() {
        this._newTab.containerDiv.style.height = "";
        if (this._directionDown) {
            this._oldTab.containerDiv.style.bottom = "";
            this._newTab.containerDiv.style.top = this._parent.getTabHeight(0, this._newTabIndex + 1) + "px";
        } else {
            this._newTab.containerDiv.style.top = "";
            this._newTab.containerDiv.style.bottom = 
                    this._parent.getTabHeight(this._newTabIndex + 1, this._parent.tabs.length) + "px";
        }
        this._newTab.containerDiv.style.display = "block";

        // Set size of tab content to be equivalent to available space.
        var regionContentHeight = this._parent.div.offsetHeight - this._parent.getTabHeight(0, this._parent.tabs.length);
        var oldTabInsets = Echo.Sync.Insets.toPixels(this._oldTab.getContentInsets());
        var newTabInsets = Echo.Sync.Insets.toPixels(this._newTab.getContentInsets());
        var oldContentHeight = regionContentHeight - oldTabInsets.top - oldTabInsets.bottom;
        var newContentHeight = regionContentHeight - newTabInsets.top - newTabInsets.bottom;
        oldContentHeight = oldContentHeight > 0 ? oldContentHeight : 0;
        newContentHeight = newContentHeight > 0 ? newContentHeight : 0;

        if (this._parent.resetOverflowForAnimation) {
            this._oldTab.contentDiv.style.overflow = "hidden";
            this._newTab.contentDiv.style.overflow = "hidden";
        }

        this._oldTab.contentDiv.style.bottom = "";
        this._newTab.contentDiv.style.bottom = "";
        this._oldTab.contentDiv.style.height = oldContentHeight + "px";
        this._newTab.contentDiv.style.height = newContentHeight + "px";
    },

    /** @see Extras.Sync.Animation#step */
    step: function(progress) {
        var i,
            oldContainerHeight,
            newContainerHeight,
            stepPosition = Math.round(progress * this._animationDistance);

        if (this._directionDown) {
            // Move each moving tab to next step position.
            for (i = this._oldTabIndex; i > this._newTabIndex; --i) {
                this._parent.tabs[i].tabDiv.style.top = (stepPosition + this._startPosition + 
                        this._parent.getTabHeight(this._newTabIndex + 1, i)) + "px";
            }

            // Adjust height of expanding new tab content to fill expanding space.
            newContainerHeight = stepPosition;
            if (newContainerHeight < 0) {
                newContainerHeight = 0;
            }
            this._newTab.containerDiv.style.height = newContainerHeight + "px";

            // Move top of old content downward.
            var oldTop = stepPosition + this._startPosition + 
                    this._parent.getTabHeight(this._newTabIndex + 1, this._oldTabIndex + 1);
            this._oldTab.containerDiv.style.top = oldTop + "px";

            // Reduce height of contracting old tab content to fit within contracting space.
            oldContainerHeight = this._regionHeight - this._parent.getTabHeight(this._newTabIndex, this._oldTabIndex);
            if (oldContainerHeight < 0) {
                oldContainerHeight = 0;
            }
            this._oldTab.containerDiv.style.height = oldContainerHeight + "px";
        } else {
            // Move each moving tab to next step position.
            for (i = this._oldTabIndex + 1; i <= this._newTabIndex; ++i) {
                this._parent.tabs[i].tabDiv.style.bottom = (stepPosition + this._startPosition + 
                        this._parent.getTabHeight(i + 1, this._newTabIndex + 1)) + "px";
            }

            // Reduce height of contracting old tab content to fit within contracting space.
            oldContainerHeight = this._regionHeight - stepPosition - 
                    this._parent.getTabHeight(this._oldTabIndex, this._newTabIndex); 
            if (oldContainerHeight < 0) {
                oldContainerHeight = 0;
            }
            this._oldTab.containerDiv.style.height = oldContainerHeight + "px";

            // Increase height of expanding tab content to fit within expanding space.
            newContainerHeight = stepPosition;
            if (newContainerHeight < 0) {
                newContainerHeight = 0;
            }
            this._newTab.containerDiv.style.height = newContainerHeight + "px";
        }
    }
});
/**
 * Component rendering peer: BorderPane.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.BorderPane = Core.extend(Echo.Render.ComponentSync, {

    $load: function() {
        Echo.Render.registerPeer("Extras.BorderPane", this);
    },

    /**
     * The main DIV element.
     * @type Element
     */
    _div: null,
    
    /**
     * The content containing DIV element.
     * @type Element
     */
    _content: null,
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._div = Echo.Sync.FillImageBorder.renderContainer(this.component.render("border", Extras.BorderPane.DEFAULT_BORDER),
                { absolute: true, content: true });
        this._div.id = this.component.renderId;
        this._div.style.top = this._div.style.right = this._div.style.bottom = this._div.style.left = 0;
        
        this._content = Echo.Sync.FillImageBorder.getContainerContent(this._div);
        
        Echo.Sync.renderComponentDefaults(this.component, this._content);
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), this._content);
    
        var componentCount = this.component.getComponentCount();
        if (componentCount == 1) {
            var child = this.component.getComponent(0);
            var insets = child.pane ? null : this.component.render("insets");
            if (insets) {
                Echo.Sync.Insets.render(insets, this._content, "padding");
            }
            Echo.Render.renderComponentAdd(update, child, this._content);
        } else if (componentCount > 1) {
            throw new Error("Too many children: " + componentCount);
        }
        
        parentElement.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        Echo.Sync.FillImageBorder.renderContainerDisplay(this._div);
        Core.Web.VirtualPosition.redraw(this._content);
        Core.Web.VirtualPosition.redraw(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._content = null;
        this._div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});
/**
 * Component rendering peer: CalendarSelect.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.CalendarSelect = Core.extend(Echo.Render.ComponentSync, {

    $static: {
    
        /**
         * Default rendering values used when component does not specify a property value.
         */
        DEFAULTS: {
            border: "1px outset #cfcfcf",
            background: "#cfcfcf",
            foreground: "#000000",
            font: {
                size: "10pt"
            },
            dateForeground: "#000000",
            dateBackground: "#dfdfdf",
            dateBorder: {
                top: "1px solid #efefef",
                left: "1px solid #efefef",
                right: "1px solid #bfbfbf",
                bottom: "1px solid #bfbfbf"
            },
            selectedDateForeground: "#ffffff",
            selectedDateBackground: "#2f2f6f",
            adjacentMonthDateForeground: "#8f8f8f"
        },
    
        /**
         * Minimum year to display (1582, beginning of Gregorian calendar).
         * @type Number
         */
        MINIMUM_YEAR: 1582,

        /**
         * Maximum year to display (9999).
         * @type Number
         */
        MAXIMUM_YEAR: 9999,

        /**
         * Array-map mapping month numbers (indices) to numbers of days in the month.
         * February is not specified due to it requiring calculation based on year.
         * @type Array
         */
        _DAYS_IN_MONTH: [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
        
        /**
         * Localization resource bundle.
         */
        resource: new Core.ResourceBundle({
            "DayOfWeek.0":     "Sunday",
            "DayOfWeek.1":     "Monday",
            "DayOfWeek.2":     "Tuesday",
            "DayOfWeek.3":     "Wednesday",
            "DayOfWeek.4":     "Thursday",
            "DayOfWeek.5":     "Friday",
            "DayOfWeek.6":     "Saturday",
            "Month.0":         "January",
            "Month.1":         "February",
            "Month.2":         "March",
            "Month.3":         "April",
            "Month.4":         "May",
            "Month.5":         "June",
            "Month.6":         "July",
            "Month.7":         "August",
            "Month.8":         "September",
            "Month.9":         "October",
            "Month.10":        "November",
            "Month.11":        "December",
            "FirstDayOfWeek":  0
        }),
        
        /**
         * Animation used for sliding new months/years into place.  The foreground color of the old content is also adjusted
         * gradually during the transition.
         */
        Animation: Core.extend(Extras.Sync.Animation, {
        
            /**
             * The container element.
             * @type Element
             */
            _container: null,
            
            /**
             * Measured bounds of <code>_container</code>.
             * @type Core.Web.Measure.Bounds
             */
            _containerBounds: null,
            
            /**
             * The old content DIV.
             * @type Element
             */
            _oldContent: null,

            /**
             * The new content DIV.
             * @type Element
             */
            _newContent: null,
            
            /**
             * Boolean flag indicating a vertical (true) or horizontal (false) direction of animation.
             * @type Boolean
             */
            _vertical: null,
            
            /**
             * Boolean flag indicating a downward/rightward (true) or upward/leftward (false) direction of animation.
             * @type Boolean
             */
            _forward: null,
            
            /**
             * Distance the animated effect will move the next content, in pixels.  May not be same as measured dimension
             * in case of overlap.
             * @type Number
             */
            _travel: null,
            
            /**
             * Number of pixels to overlap new content over old content (used when animating months vertically such that shared 
             * weeks are retained during animation).
             * @type Number
             */
            _overlap: null,
            
            /**
             * Old foreground color for old content.
             * @type #Color
             */
            _oldColor: null,
            
            /**
             * New foreground color for old content.
             * @type #Color
             */
            _newColor: null,
            
            /**
             * CSS positioning property being adjusted to perform animation (top/bottom/left/right). 
             * @type String
             */
            _adjust: null,
        
            /** @see Extras.Sync.Animation#runtime */
            runTime: 500,

            /**
             * Constructor.
             * 
             * @param {Element} container the container element
             * @param {Element} oldContent the old content DIV
             * @param {Element} newContent the new content DIV
             * @param {Boolean} vertical boolean flag indicating a vertical (true) or horizontal (false) direction of animation
             * @param {Boolean} forward boolean flag indicating a downward/rightward (true) or upward/leftward (false) direction
             *                  of animation
             * @param {Number} overlap number of pixels to overlap new content over old content (used when animating months
             *                 vertically such that shared weeks are retained during animation)
             * @param {#Color} oldColor old foreground color for old content
             * @param {#Color} newColor new foreground color for old content
             */
            $construct: function(container, oldContent, newContent, vertical, forward, overlap, oldColor, newColor) {
                this._container = container;
                this._oldContent = oldContent;
                this._newContent = newContent;
                this._vertical = vertical;
                this._forward = forward;
                this._overlap = overlap || 0;
                this._oldColor = oldColor;
                this._newColor = newColor;
            },
        
            /** @see Extras.Sync.Animation#init */
            init: function() {
                this._containerBounds = new Core.Web.Measure.Bounds(this._container);
                this._travel = (this._vertical ? this._containerBounds.height : this._containerBounds.width) - this._overlap;
                this._adjust = this._vertical ? (this._forward ? "top" : "bottom") : (this._forward ? "left" : "right"); 
                this._newContent.style[this._adjust] = this._travel + "px";
                this._container.appendChild(this._newContent);
            },

            /** @see Extras.Sync.Animation#step */
            step: function(progress) {
                var position = Math.round(this._travel * (1 - progress));
                this._oldContent.style.color = Echo.Sync.Color.blend(this._oldColor, this._newColor, 2 * progress);
                this._oldContent.style[this._adjust] = (position - this._travel) + "px";
                this._newContent.style[this._adjust] = position + "px";
            },

            /** @see Extras.Sync.Animation#complete */
            complete: function(abort) {
                this._newContent.style.left = this._newContent.style.top = 
                        this._newContent.style.right = this._newContent.style.bottom = "";
                if (this._oldContent.parentNode) {
                    this._oldContent.parentNode.removeChild(this._oldContent);
                }
            }
        }),
        
        /**
         * Data object describing a month of a specific year in a specific locale (first day of week setting).
         * Determines additional information about the month used for rendering.
         */
        MonthData: Core.extend({
            
            /**
             * First day of week of the month, Sunday = 0.
             * @type Number
             */
            firstDayOfMonth: null,
            
            /**
             * Number of days in the month.
             * @type Number
             */
            daysInMonth: null,
            
            /**
             * Number of days in the previous month.
             * @type Number
             */
            daysInPreviousMonth: null,
            
            /** 
             * The year.
             * @type Number
             */
            year: null,
            
            /**
             * The month.
             * @type Number
             */
            month: null,
            
            /**
             * Number of full or partial weeks in the month.  Varies by firstDayOfWeek value.  
             * @type Number
             */
            weekCount: null,
            
            /**
             * Cell position of day 1 of the month (0 = leftmost cell, 6 = rightmost cell).
             * @type Number
             */
            firstCellPosition: null,
            
            /**
             * Constructor.
             * 
             * @param {Number} year the year
             * @param {Number} month the month
             * @param {Number} first day of week to use when rendering the month (0 = Sunday)
             */
            $construct: function(year, month, firstDayOfWeek) {
                this.year = year;
                this.month = month;
                var firstDate = new Date(year, month, 1);
                this.firstDayOfMonth = firstDate.getDay();

                this.daysInMonth = Extras.Sync.CalendarSelect.getDaysInMonth(year, month);
                this.daysInPreviousMonth = month === 0 ? Extras.Sync.CalendarSelect.getDaysInMonth(year - 1, 11) :
                        this._daysInPreviousMonth = Extras.Sync.CalendarSelect.getDaysInMonth(year, month - 1);
                
                this.firstCellPosition = (7 + this.firstDayOfMonth - firstDayOfWeek) % 7;
                this.nextMonthWeek = Math.floor((this.firstCellPosition + this.daysInMonth) / 7); 
                this.weekCount = Math.ceil((this.firstCellPosition + this.daysInMonth) / 7);
            },
            
            /**
             * Determines the date of the cell at the specified index.
             * 
             * @param {Number} cellIndex the cell index, 0 = top left cell
             * @return an object describing the date at the specified cell, containing numeric month, day, and year properties
             * @type Object
             */
            getCellDate: function(cellIndex) {
                var date;
                if (cellIndex < this.firstCellPosition) {
                    date = this.month === 0 ? { month: 11, year: this.year - 1 } :
                            { month: this.month - 1, year: this.year };
                    date.day = this.daysInPreviousMonth - this.firstCellPosition + cellIndex + 1;
                } else if (cellIndex >= (this.firstCellPosition + this.daysInMonth)) {
                    date = this.month === 11 ? { month: 0, year: this.year + 1 } :
                            { month: this.month + 1, year: this.year };
                    date.day = cellIndex - this.firstCellPosition - this.daysInMonth + 1;
                } else {
                    date = { month: this.month, year: this.year, day: cellIndex - this.firstCellPosition + 1 };
                }
                return date;
            },
            
            /**
             * Determines the cell index of the specified day in the month.
             * 
             * @param {Number} day the day of the month
             * @return the cell index
             * @type Number 
             */
            getCellIndex: function(day) {
                return day + this.firstCellPosition - 1;
            },
            
            /**
             * Determines if the specified cell index lies in the current month or an adjacent month.
             * 
             * @return true if the cell index lies in an adjacent month, false if not
             * @type Boolean
             */
            isCellAdjacent: function(cellIndex) {
                return cellIndex < this.firstCellPosition || cellIndex >= (this.firstDayOfMonth + this.daysInMonth);
            }
        }),
        
        /**
         * Determines the number of days in a specific month.
         *
         * @param year the year of the month
         * @param month the month
         * @return the number of days in the month
         */
        getDaysInMonth: function(year, month) {
            if (month == 1) {
                if (year % 400 === 0) {
                    return 29;
                } else if (year % 100 === 0) {
                    return 28;
                } else if (year % 4 === 0) {
                    return 29;
                } else {
                    return 28;
                }
            } else {
                return this._DAYS_IN_MONTH[month];
            }
        }
    },

    $load: function() {
        Echo.Render.registerPeer("Extras.CalendarSelect", this);
    },
    
    /**
     * Main outer DIV element.
     * @type Element
     */
    _div: null,
    
    /**
     * Container element for month/year fields.
     */
    _monthYearInput: null,
    
    /**
     * Month SELECT field.
     * @type Element
     */
    _monthSelect: null,
    
    /**
     * Year INPUT field.
     * @type element
     */
    _yearField: null,
    
    /**
     * Date rollover background color.
     * @type #Color
     */
    _dateRolloverBackground: null,
    
    /**
     * Date rollover background image.
     * @type #FillImage
     */
    _dateRolloverBackgroundImage: null,

    /**
     * Date rollover border.
     * @type #Border
     */
    _dateRolloverBorder: null,

    /**
     * Date rollover foreground color.
     * @type #Color
     */
    _dateRolloverForeground: null,
    
    /**
     * Date selection background color.
     * @type #Color
     */
    _dateSelectedBackground: null,

    /**
     * Date selection background image.
     * @type #FillImage
     */
    _dateSelectedBackgroundImage: null,

    /**
     * Date selection border.
     * @type #Border
     */
    _dateSelectedBorder: null,

    /**
     * Date selection foreground color.
     * @type #Color
     */
    _dateSelectedForeground: null,
    
    /**
     * Index of currently rolled over cell. 
     * @type Number
     */
    _rolloverCellIndex: null,
    
    /**
     * Currently displayed month.
     * @type Number
     */
    _displayedMonth: null,

    /**
     * Currently displayed year.
     * @type Number
     */
    _displayedYear: null,

    /**
     * First day of week for displayed localization (0 = Sunday).
     * @type Number
     */
    _firstDayOfWeek: null,
    
    /**
     * Currently selected date.  An object with month, day, and year numeric properties.
     * @type Object
     */
    _date: null,
    
    /**
     * Localization data map.
     * @type Object
     */
    _msg: null,
    
    /**
     * Custom icons map.
     * @type object
     */
    _icons: null,
    
    /**
     * Performs an animated update of the calendar.
     *
     * @param {Boolean} vertical transition new content in vertically (true) or horizontally (false)
     * @param {Boolean} forward transition new content in rightward/downward (true) or upward/leftward (false)
     * @param {Number} rowOverlap number of rows to overlap (applicable only in vertical transition)
     */
    _animateUpdate: function(vertical, forward, rowOverlap) {
        if (this._animation) {
            this._animation.abort();
        }
        
        var newDayContainerDiv = this._createDayContainer();
        var overlap = rowOverlap ? (rowOverlap * this._cellHeight + (rowOverlap - 1) * this._vCellSpacing) : 0;
        this._animation = new Extras.Sync.CalendarSelect.Animation(this._scrollContainer, this._dayContainerDiv, newDayContainerDiv, 
                vertical, forward, overlap, this._dateForeground, this._dateAdjacentForeground);
        this._animation.start(Core.method(this, function(abort) {
            this._dayContainerDiv = newDayContainerDiv;
            this._animation = null;
        }));
    },
    
    /**
     * Creates a day-container DIV element, which will hold the days of the calendar.  These elements are added to and removed
     * from the calendar using animation (if desired).
     * 
     * @return the day container element
     * @type Element
     */
    _createDayContainer: function() {
        var dayContainerDiv = document.createElement("div");
        dayContainerDiv.style.cssText = "position:absolute;";
        dayContainerDiv.style.width = this._rowWidth + "px";
        dayContainerDiv.style.height = (this._ySize * this._cellHeight + (this._ySize - 1) * this._vCellSpacing) + "px";
        for (var y = 0; y < this._ySize; ++y) {
            var rowDiv = this._createWeek(y);
            rowDiv.style.top = (y * (this._cellHeight + this._vCellSpacing)) + "px";
            dayContainerDiv.appendChild(rowDiv);
        }
        return dayContainerDiv;
    },
    
    /**
     * Creates the month and year input controls positioned above the calendar.
     * 
     * @return an element containing the month/year controls.
     * @type Element
     */
    _createMonthYearInput: function() {
        var i, option, img,
            enabled = this.component.isRenderEnabled(),
            span = document.createElement("span");
        
        this._monthSelect = document.createElement("select");
        for (i = 0; i < 12; ++i) {
            option = document.createElement("option");
            option.appendChild(document.createTextNode(this._msg["Month." + i]));
            this._monthSelect.appendChild(option);
        }
        if (!enabled) {
            this._monthSelect.disabled = true;
        }
        span.appendChild(this._monthSelect);

        span.appendChild(document.createTextNode(" "));
        
        this._yearDecSpan = document.createElement("span");
        this._yearDecSpan.style.cursor = "pointer";
        img = document.createElement("img");
        img.src = this._icons.decrement ? this._icons.decrement :
                this.client.getResourceUrl("Extras", "image/calendar/Decrement.gif");
        img.alt = "-";
        this._yearDecSpan.appendChild(img);
        span.appendChild(this._yearDecSpan);
        
        this._yearField = document.createElement("input");
        this._yearField.type = "text";
        this._yearField.style.textAlign = "center";
        this._yearField.maxLength = 4;
        this._yearField.size = 5;
        if (!enabled) {
            this._yearField.readOnly = true;
        }
        span.appendChild(this._yearField);

        this._yearIncSpan = document.createElement("span");
        this._yearIncSpan.style.cursor = "pointer";
        img = document.createElement("img");
        img.src = this._icons.increment ? this._icons.increment :
                this.client.getResourceUrl("Extras", "image/calendar/Increment.gif");
        img.alt = "+";
        this._yearIncSpan.appendChild(img);
        span.appendChild(this._yearIncSpan);
        
        return span;
    },

    /**
     * Creates a DIV containing a single week of days.
     *
     * @return the created DIV
     * @type Element
     */
    _createWeek: function(line) {
        var day = 1 - this._monthData.firstCellPosition + (7 * line);
        var rowDiv = document.createElement("div");
        rowDiv.style.cssText = "position:absolute;overflow:hidden;cursor:pointer;";
        rowDiv.style.width = this._rowWidth + "px";
        rowDiv.style.height = this._cellHeight + "px";
        for (var x = 0; x < this._xSize; ++x, ++day) {
            var cellDiv = document.createElement("div");
            cellDiv._cellIndex = 7 * line + x;
            cellDiv.style.cssText = "position:absolute;text-align:right;";
            cellDiv.style.left = (x * (this._cellWidth + this._hCellSpacing)) + "px";
            cellDiv.style.width = this._renderedCellWidth + "px";
            cellDiv.style.height = this._renderedCellHeight + "px";
            Echo.Sync.Border.render(this._dateBorder, cellDiv);
            cellDiv.style.padding = "2px 4px";
            cellDiv.style.overflow = "hidden";
            
            var displayDay;
            if (day < 1) {
                cellDiv.style.color = this._dateAdjacentForeground;
                displayDay = this._monthData.daysInPreviousMonth + day;
            } else if (day > this._monthData.daysInMonth) {
                cellDiv.style.color = this._dateAdjacentForeground;
                displayDay = day - this._monthData.daysInMonth;
            } else {
                if (this._date.day == day) {
                    Echo.Sync.Color.render(this._dateSelectedBackground, cellDiv, "backgroundColor");
                    Echo.Sync.Color.render(this._dateSelectedForeground, cellDiv, "color");
                    Echo.Sync.FillImage.render(this._dateSelectedBackgroundImage, cellDiv);
                    Echo.Sync.Border.render(this._dateSelectedBorder, cellDiv);
                }
                displayDay = day;
            }
            
            cellDiv.appendChild(document.createTextNode(displayDay));

            rowDiv.appendChild(cellDiv);
        }
        return rowDiv;
    },
    
    /**
     * Returns the cell DIV for the specified cell index.
     * 
     * @param {Number} cellIndex the cell index (0 = upper left)
     * @return the DIV element
     * @type Element
     */
    _getCell: function(cellIndex) {
        return this._dayContainerDiv.childNodes[Math.floor(cellIndex / 7)].childNodes[cellIndex % 7];
    },
    
    /**
     * Loads rendering information from component into local object.
     * Calculates required sizes for day elements.
     */
    _loadRenderData: function() {
        this._font = this.component.render("font", Extras.Sync.CalendarSelect.DEFAULTS.font);
        
        // Default Cell Style
        this._dateBackground = this.component.render("dateBackground", Extras.Sync.CalendarSelect.DEFAULTS.dateBackground);
        this._dateBorder = this.component.render("dateBorder", Extras.Sync.CalendarSelect.DEFAULTS.dateBorder);
        this._dateBackgroundImage = this.component.render("dateBackgroundImage");
        this._dateForeground = this.component.render("dateForeground", Extras.Sync.CalendarSelect.DEFAULTS.dateForeground);
        
        // Selected Cell Style
        this._dateSelectedBackground = this.component.render("selectedDateBackground", 
                Extras.Sync.CalendarSelect.DEFAULTS.selectedDateBackground);
        this._dateSelectedBackgroundImage = this.component.render("selectedDateBackgroundImage");
        this._dateSelectedBorder = this.component.render("selectedDateBorder");
        this._dateSelectedForeground = this.component.render("selectedDateForeground",
                Extras.Sync.CalendarSelect.DEFAULTS.selectedDateForeground);
        
        // Rollover Cell Style
        this._dateRolloverBackground = this.component.render("rolloverDateBackground");
        this._dateRolloverBackgroundImage = this.component.render("rolloverDateBackgroundImage");
        this._dateRolloverBorder = this.component.render("rolloverDateBorder");
        this._dateRolloverForeground = this.component.render("rolloverDateForeground");
        if (!this._dateRolloverBackground) {
            this._dateRolloverBackground = Echo.Sync.Color.adjust(this._dateBackground, 0x20, 0x20, 0x20);
        }
        
        // Adjacent Cell Style
        this._dateAdjacentForeground = this.component.render("adjacentMonthDateForeground", 
                Extras.Sync.CalendarSelect.DEFAULTS.adjacentMonthDateForeground);
        this._dateAdjacentBackground = this.component.render("adjacentMonthDateBackground");
        
        // Measure size of date cell text
        var cellMeasure = document.createElement("span");
        cellMeasure.appendChild(document.createTextNode("96"));
        Echo.Sync.Font.render(this._font, cellMeasure);
        var cellBounds = new Core.Web.Measure.Bounds(cellMeasure);

        // FIXME hardcoded
        this._padding = { top: 2, bottom: 2, left: 4, right: 4 };
        this._borderSize = { top: 1, bottom: 1, left: 1, right: 1 };
        
        // Calculate cell size
        this._cellWidth = cellBounds.width + this._padding.left + this._padding.right + 
                this._borderSize.left + this._borderSize.right;
        if (this._cellWidth * 7 < this._monthYearWidth) {
            this._cellWidth = Math.ceil(this._monthYearWidth / 7);
        }
        this._cellHeight = cellBounds.height + this._padding.top + this._padding.bottom +
                this._borderSize.top + this._borderSize.bottom;
        this._hCellSpacing = 0;
        this._vCellSpacing = 0;
        this._headerHeight = cellBounds.height;
        this._headerMargin = 0;
        
        this._xSize = 7;
        this._ySize = 6;
        
        this._rowWidth = this._xSize * this._cellWidth + (this._xSize - 1) * this._hCellSpacing;
        this._calendarHeight = this._ySize * this._cellHeight + (this._ySize - 1) * this._vCellSpacing + 
                this._headerHeight + this._headerMargin;
        
        this._renderedCellWidth = this._cellWidth - this._borderSize.left - this._borderSize.right - 
                this._padding.left - this._padding.right;
        this._renderedCellHeight = this._cellHeight - this._borderSize.top - this._borderSize.bottom - 
                this._padding.top - this._padding.bottom;
    },
    
    /**
     * Processes a date rollover enter event.
     * 
     * @param e the event
     */
    _processDateRolloverEnter: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || e.target._cellIndex == null || this._animation) {
            return;
        }
        if (this._rolloverCellIndex != null) {
            this._setCellStyle(this._rolloverCellIndex, false);
        }
        this._rolloverCellIndex = e.target._cellIndex;
        this._setCellStyle(this._rolloverCellIndex, true);
    },
    
    /**
     * Processes a date rollover exit event.
     * 
     * @param e the event
     */
    _processDateRolloverExit: function(e) {
        if (this._rolloverCellIndex) {
            this._setCellStyle(this._rolloverCellIndex, false);
            this._rolloverCellIndex = null;
        }
    },
    
    /**
     * Processes a date selection (click) event.
     * 
     * @param e the event
     */
    _processDateSelect: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || e.target._cellIndex == null || this._animation) {
            return;
        }
        this._setDate(this._monthData.getCellDate(e.target._cellIndex));
    },
    
    /**
     * Processes a month selection event.
     * 
     * @param e the event
     */
    _processMonthSelect: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            this._monthSelect.selectedIndex = this._date.month;
            return;
        }        
        this._setDate({ year: this._date.year, month: this._monthSelect.selectedIndex, day: this._date.day });
    },
    
    /**
     * Processes a year input field change event.
     * 
     * @param e the event
     */
    _processYearChange: function(e) {
        var newValue = parseInt(this._yearField.value, 10);
        if (!this.client || !this.client.verifyInput(this.component) || isNaN(newValue)) {
            this._yearField.value = this._date.year;
            return;
        }
        this._setDate({ year: newValue, month: this._date.month, day: this._date.day });
    },

    /**
     * Processes a year input field key-up event.
     * 
     * @param e the event
     */
    _processYearKeyUp: function(e) {
        if (e.keyCode == 13) {
            this._processYearChange(e);
        }
    },
    
    /**
     * Processes a year decrement button click event.
     * 
     * @param e the event
     */
    _processYearDecrement: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        this._setDate({ year: this._date.year - 1, month: this._date.month, day: this._date.day });
    },

    /**
     * Processes a year increment button click event.
     * 
     * @param e the event
     */
    _processYearIncrement: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        this._setDate({ year: this._date.year + 1, month: this._date.month, day: this._date.day });
    },
    
    /**
     * Validates the specified date object (containing month/year/day properties to be within the constrained range.
     * The date will be adjusted (if necessary) to comply with the constrained range.
     * 
     * @param date a date object containing month/day/year numeric properties
     */
    _rangeCheck: function(date) {
        if (date.year < Extras.Sync.CalendarSelect.MINIMUM_YEAR) {
            date.year = Extras.Sync.CalendarSelect.MINIMUM_YEAR;
        } else if (date.year > Extras.Sync.CalendarSelect.MAXIMUM_YEAR) {
            date.year = Extras.Sync.CalendarSelect.MAXIMUM_YEAR;
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        update = null; // Update is forcibly set to null, as this method may in some circumstances be invoked internally with
                       // a null update.
        
        this._msg = Extras.Sync.CalendarSelect.resource.get(this.component.getRenderLocale());
        this._icons = { };

        var i, j, td, tr, x, cellDiv, dayOfWeekName, monthYearDiv, headerWidth,
            enabled = this.component.isRenderEnabled(),
            dayOfWeekNameAbbreviationLength = parseInt(this.component.render("dayOfWeekNameAbbreviationLength", 2), 10),
            date = this.component.get("date");

        this._firstDayOfWeek = parseInt(this.component.render("firstDayOfWeek", this._msg["FirstDayOfWeek"]), 10) || 0;

        if (!date) {
            date = new Date();
        }

        this._date = { 
             year: date.getFullYear(), 
             month: date.getMonth(), 
             day: date.getDate()
        };
        this._monthData = new Extras.Sync.CalendarSelect.MonthData(this._date.year, this._date.month, this._firstDayOfWeek);    

        this._monthYearInput = this._createMonthYearInput();
        this._monthYearWidth = new Core.Web.Measure.Bounds(this._monthYearInput).width + 10; //FIXME hardcoded.
    
        this._loadRenderData();

        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        this._div.style.cssText = "text-align:left;width:" + (this._cellWidth * this._xSize) + "px;";
        
        Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), this._div);
        Echo.Sync.Font.render(this._font, this._div);
        Echo.Sync.Color.render(this.component.render("foreground", Extras.Sync.CalendarSelect.DEFAULTS.foreground), this._div,
                "color");
        Echo.Sync.Color.render(this.component.render("background", Extras.Sync.CalendarSelect.DEFAULTS.background), this._div,
                "backgroundColor");
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), this._div);
        Echo.Sync.Border.render(this.component.render("border",  Extras.Sync.CalendarSelect.DEFAULTS.border), this._div);
        Echo.Sync.Font.render(this.component.render("font"), this._div);
        
        monthYearDiv = document.createElement("div");
        monthYearDiv.align = "center";
        monthYearDiv.style.cssText = "padding:2px 5px;white-space:nowrap;overflow:hidden;"; //FIXME hardcoded
        monthYearDiv.appendChild(this._monthYearInput);
        this._div.appendChild(monthYearDiv);
        
        this._calendarDiv = document.createElement("div");
        this._calendarDiv.style.cssText = "position:relative;";

        this._calendarDiv.style.width = this._rowWidth + "px";
        this._calendarDiv.style.height = this._calendarHeight + "px";
        this._div.appendChild(this._calendarDiv);
        
        this._currentRowDivs = [];
        
        var headerDiv = document.createElement("div");
        headerDiv.style.cssText = "position:absolute;";
        headerDiv.style.width = (this._cellWidth * 7) + "px";
        headerDiv.style.height = this._headerHeight + "px";
        Echo.Sync.Color.render(this.component.render("headerForeground", Extras.Sync.CalendarSelect.DEFAULTS.foreground), headerDiv,
                "color");
        Echo.Sync.Color.render(this.component.render("headerBackground", Extras.Sync.CalendarSelect.DEFAULTS.background), headerDiv,
                "backgroundColor");
        Echo.Sync.FillImage.render(this.component.render("headerBackgroundImage"), headerDiv);
        this._calendarDiv.appendChild(headerDiv);
        
        for (x = 0; x < this._xSize; ++x) {
            cellDiv = document.createElement("div");
            cellDiv.style.cssText = "position:absolute;text-align:center;";
            cellDiv.style.left = (x * (this._cellWidth + this._hCellSpacing)) + "px";
            cellDiv.style.width = this._cellWidth + "px";
            cellDiv.style.height = this._headerHeight + "px";
            cellDiv.style.overflow = "hidden";
            
            dayOfWeekName = this._msg["DayOfWeek." + ((this._firstDayOfWeek + x) % 7)];
            if (dayOfWeekNameAbbreviationLength > 0) {
                dayOfWeekName = dayOfWeekName.substring(0, dayOfWeekNameAbbreviationLength);
            }
            cellDiv.appendChild(document.createTextNode(dayOfWeekName));
            
            headerDiv.appendChild(cellDiv);
        }
        
        this._scrollContainer = document.createElement("div");
        this._scrollContainer.style.cssText = "position:absolute;overflow:hidden;";
        this._scrollContainer.style.top = (this._headerHeight + this._headerMargin) + "px";
        this._scrollContainer.style.height = (this._ySize * this._cellHeight + (this._ySize - 1) * this._vCellSpacing) + "px";
        this._scrollContainer.style.width = this._rowWidth + "px";
        Echo.Sync.Color.render(this._dateForeground, this._scrollContainer, "color");
        Echo.Sync.Color.render(this._dateBackground, this._scrollContainer, "backgroundColor");
        Echo.Sync.FillImage.render(this._dateBackgroundImage, this._scrollContainer);
        this._calendarDiv.appendChild(this._scrollContainer);
        
        this._dayContainerDiv = this._createDayContainer();
        this._scrollContainer.appendChild(this._dayContainerDiv);
                
        parentElement.appendChild(this._div);

        Core.Web.Event.add(this._monthSelect, "change", Core.method(this, this._processMonthSelect), false);
        Core.Web.Event.add(this._yearField, "change", Core.method(this, this._processYearChange), false);
        Core.Web.Event.add(this._yearField, "keyup", Core.method(this, this._processYearKeyUp), false);
        Core.Web.Event.add(this._yearDecSpan, "click", Core.method(this, this._processYearDecrement), false);
        Core.Web.Event.add(this._yearIncSpan, "click", Core.method(this, this._processYearIncrement), false);
        Core.Web.Event.add(this._calendarDiv, "click", Core.method(this, this._processDateSelect), false);
        Core.Web.Event.add(this._calendarDiv, "mouseover", Core.method(this, this._processDateRolloverEnter), false);
        Core.Web.Event.add(this._calendarDiv, "mouseout", Core.method(this, this._processDateRolloverExit), false);

        this._updateMonthYearSelection();
        // This stuff handles the runaway recursion that happens in IE 9
        if (this._numMonitorRegistrations === undefined) {
            this._numMonitorRegistrations = 0;
        }

        var registerMonitor = true;
        if ( (Core.Web.Env.BROWSER_INTERNET_EXPLORER && (Core.Web.Env.BROWSER_VERSION_MAJOR >= 9)) ) {
            if (this._numMonitorRegistrations > 1) {
                this._numMonitorRegistrations = 0;
                registerMonitor = false;
            }
        }

        if (registerMonitor) {
            this._numMonitorRegistrations++;
            Core.Web.Image.monitor(this._div, Core.method(this, function() {
                this._renderSizeUpdate();
            }));
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        update = null; // Update is forcibly set to null, as this method may in some circumstances be invoked internally with
                       // a null update.

        Core.Web.Event.removeAll(this._monthSelect);
        Core.Web.Event.removeAll(this._yearField);
        Core.Web.Event.removeAll(this._yearDecSpan);
        Core.Web.Event.removeAll(this._yearIncSpan);
        Core.Web.Event.removeAll(this._calendarDiv);
    
        this._div = null;
        this._monthSelect = null;
        this._yearField = null;
        this._yearDecSpan = null;
        this._yearIncSpan = null;
        this._dayContainerDiv = null;
        this._scrollContainer = null;
        this._calendarDiv = null;
        this._monthYearInput = null;
    },
    
    /**
     * Detects if the CalendarSelect is properly sized (i.e., as a result of additional images having been loaded) and
     * re-renders it if required.
     */
    _renderSizeUpdate: function() {
        var monthYearWidth = new Core.Web.Measure.Bounds(this._monthYearInput).width + 10;  //FIXME hardcoded.
        if (this._monthYearWidth === monthYearWidth) {
            return;
        }
        
        // Perform full render if required.
        var element = this._div;
        var containerElement = element.parentNode;
        this.renderDispose(null);
        containerElement.removeChild(element);
        this.renderAdd(null, containerElement);
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (update && update.isUpdatedPropertySetIn({date: true })) {
            var date = this.component.get("date") || new Date();
            if (this._date.month == date.getMonth() && this._date.day == date.getDate() && this._date.year == date.getFullYear()) {
                 return false;
            }
        }

        // Full Render
        if (this._animation) {
            this._animation.abort();
        }
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return false;
    },
    
    /**
     * Sets the style of a specific day cell.
     * 
     * @param {Number} cellIndex the cell index (0 = upper-left)
     * @param {Boolean} rollover flag indicating whether the mouse is currently rolled over the cell
     * @param {Boolean} reset flag indicating whether the cell should be reset to its default state
     */
    _setCellStyle: function(cellIndex, rollover, reset) {
        var date = this._monthData.getCellDate(cellIndex);
        var cell = this._getCell(cellIndex);
        if (!reset && date.day == this._date.day && date.month == this._date.month && date.year == this._date.year) {
            // Render selected
            Echo.Sync.Color.renderClear(this._dateSelectedBackground, cell, "backgroundColor");
            Echo.Sync.Color.renderClear(this._dateSelectedForeground, cell, "color");
            Echo.Sync.FillImage.render(this._dateSelectedBackgroundImage, cell);
            Echo.Sync.Border.render(this._dateSelectedBorder, cell);
        } else if (!reset && rollover) {
            // Render rollover
            Echo.Sync.Color.renderClear(this._dateRolloverBackground, cell, "backgroundColor");
            Echo.Sync.Color.renderClear(this._dateRolloverForeground, cell, "color");
            Echo.Sync.FillImage.render(this._dateRolloverBackgroundImage, cell);
            Echo.Sync.Border.render(this._dateRolloverBorder, cell);
        } else {
            if (this._monthData.isCellAdjacent(cellIndex)) {
                // Render adjacent
                Echo.Sync.Color.renderClear(this._dateAdjacentBackground, cell, "backgroundColor");
                Echo.Sync.Color.renderClear(this._dateAdjacentForeground, cell, "color");
            } else {
                // Render default
                Echo.Sync.Border.renderClear(this._dateBorder, cell);
                cell.style.backgroundImage = "";
                cell.style.backgroundColor = "";
                cell.style.color = "";
            }
        }
    },
    
    /**
     * Sets the selected date.  Updates month/year fields and animates in new month/year if required.
     * 
     * @param newValue an object providing month, day, and year numeric properties
     */
    _setDate: function(newValue) {
        var oldValue = this._date,
            oldCellIndex = this._monthData.getCellIndex(this._date.day),
            newCellIndex,
            overlap;

        this._setCellStyle(oldCellIndex, false, true);
        
        this._rangeCheck(newValue);
        this._date = newValue;

        this._monthData = new Extras.Sync.CalendarSelect.MonthData(newValue.year, newValue.month, this._firstDayOfWeek);

        if (newValue.year == oldValue.year) {
            if (newValue.month == oldValue.month) {
                // Day Change
                newCellIndex = this._monthData.getCellIndex(this._date.day);
                this._setCellStyle(newCellIndex, false);
            } else {
                // Month/Day Change
                if (oldValue.month - newValue.month == 1) {
                    // Displaying previous month.
                    overlap = this._monthData.nextMonthWeek == 4 ? 2 : 1;
                } else if (oldValue.month - newValue.month == -1) {
                    // Displaying next month.
                    var oldMonthData = new Extras.Sync.CalendarSelect.MonthData(oldValue.year, oldValue.month,
                            this._firstDayOfWeek);
                    overlap = oldMonthData.nextMonthWeek == 4 ? 2 : 1;
                } else {
                    overlap = 0;
                }
                this._animateUpdate(true, oldValue.month < newValue.month, overlap);
            }
        } else {
            // Year/Month/Day Change
            this._animateUpdate(false, oldValue.year < newValue.year);
        }
        
        this._updateMonthYearSelection();
        
        this._storeValue();
        
        this.component.doAction();
    },
    
    /**
     * Stores the selected date in the <code>Echo.Component</code> instance.
     */
    _storeValue: function() {
        this.component.set("date", new Date(this._date.year, this._date.month, this._date.day));
    },
    
    /**
     * Updates the month/year field selection values.
     */
    _updateMonthYearSelection: function() {
        if (parseInt(this._yearField.value, 10) !== this._date.year) {
            this._yearField.value = this._date.year;
        }
        if (this._monthSelect.selectedIndex != this._date.month) {
            this._monthSelect.selectedIndex = this._date.month;
        }
    }
});    
/**
 * Component rendering peer: ColorSelect.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.ColorSelect = Core.extend(Echo.Render.ComponentSync, {
    
    $static: {
    
        /**
         * Representation of an RGB color.
         */
        RGB: Core.extend({
            
            $static: {
                
                /**
                 * Converts an HSV color to an RGB color.
                 * 
                 * @param {Number} h the color hue
                 * @param {Number} s the color saturation
                 * @param {Number} v the color value
                 * @return an RGB color
                 * @type Extras.Sync.ColorSelect.RGB 
                 */
                _fromHsv: function(h, s, v) {
                    var r, g, b;
                    if (s === 0) {
                        r = g = b = v;
                    } else {
                        h /= 60;
                        var i = Math.floor(h);
                        var f = h - i;
                        var p = v * (1 - s);
                        var q = v * (1 - s * f);
                        var t = v * (1 - s * (1 - f));
                        switch (i) {
                        case 0:  r = v; g = t; b = p; break;
                        case 1:  r = q; g = v; b = p; break;
                        case 2:  r = p; g = v; b = t; break;
                        case 3:  r = p; g = q; b = v; break;
                        case 4:  r = t; g = p; b = v; break;
                        default: r = v; g = p; b = q; break;
                        }
                    }
                    return new Extras.Sync.ColorSelect.RGB(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
                }
            },
            
            /** 
             * Red value, 0-255.
             * @type Number
             */
            r: null,
            
            /** 
             * Green value, 0-255.
             * @type Number
             */
            g: null,
            
            /** 
             * Blue value, 0-255.
             * @type Number
             */
            b: null,
        
            /**
             * Creates a new RGB color.
             * 
             * @param {Number} r the red value (0-255)
             * @param {Number} g the green value (0-255)
             * @param {Number} b the blue value (0-255)
             */
            $construct: function(r, g, b) {
                this.r = this._clean(r);
                this.g = this._clean(g);
                this.b = this._clean(b);
            },
            
            /**
             * Bounds the specified value between 0 and 255.
             * 
             * @param {Number} value a color value
             * @return the bounded value
             * @type Number  
             */
            _clean: function(value) {
                value = value ? parseInt(value, 10) : 0;
                if (value < 0) {
                    return 0;
                } else if (value > 255) {
                    return 255;
                } else {
                    return value;
                }
            },
            
            /**
             * Renders the RGB value as a hexadecimal triplet, e.g., #1a2b3c.
             * 
             * @return the hex triplet
             * @type String
             */
            toHexTriplet: function() {
                var rString = this.r.toString(16);
                if (rString.length == 1) {
                    rString = "0" + rString;
                }
                var gString = this.g.toString(16);
                if (gString.length == 1) {
                    gString = "0" + gString;
                }
                var bString = this.b.toString(16);
                if (bString.length == 1) {
                    bString = "0" + bString;
                }
                return "#" + rString + gString + bString;
            },
            
            /** @see Object#toString */
            toString: function() {
                return this.toHexTriplet();
            }
        })
    },

    $load: function() {
        Echo.Render.registerPeer("Extras.ColorSelect", this);
    },
    
    /**
     * Currently selected color hue.  Range: 0 <= h < 360.
     * @type Number
     */
    _h: 0,

    /**
     * Currently selected color saturation.  Range: 0 <= s <= 1
     * @type Number
     */
    _s: 0,

    /**
     * Currently selected color value.  Range: 0 <= v <= 1.
     * @type Number
     */
    _v: 0,

    /**
     * Method reference to _processHMouseMove.
     * @type Function
     */
    _processHMouseMoveRef: null,

    /**
     * Method reference to _processHMouseUp.
     * @type Function
     */
    _processHMouseUpRef: null,

    /**
     * Method reference to _processSVMouseMove.
     * @type Function
     */
    _processSVMouseMoveRef: null,

    /**
     * Method reference to _processSVMouseUp.
     * @type Function
     */
    _processSVMouseUpRef: null,
    
    _cursorBorderLight: "1px solid #ffffff",
    
    _cursorBorderDark: "1px solid #cfcfcf",
    
    _cursorBorderShadow: "1px solid #000000",
    
    _lineOpacity: 0.8,
    
    _shadowOpacity: 0.3,
    
    _svXOffset: 7,
    
    _svYOffset: 7,

    _barRadius: 2,
    
    _boxRadius: 2,
    
    $construct: function() {
        this._processHMouseMoveRef = Core.method(this, this._processHMouseMove);
        this._processHMouseUpRef = Core.method(this, this._processHMouseUp);
        this._processSVMouseMoveRef = Core.method(this, this._processSVMouseMove);
        this._processSVMouseUpRef = Core.method(this, this._processSVMouseUp);
    },
        
    /**
     * Processes a hue selector mouse down event.
     * 
     * @param e the event
     */
    _processHMouseDown: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return;
        }
        Core.Web.Event.add(this._hListenerDiv, "mousemove", this._processHMouseMoveRef, false);
        Core.Web.Event.add(this._hListenerDiv, "mouseup", this._processHMouseUpRef, false);
        this._processHUpdate(e);
    },
    
    /**
     * Processes a hue selector mouse move event.
     * 
     * @param e the event
     */
    _processHMouseMove: function(e) {
        this._processHUpdate(e);
    },
    
    /**
     * Processes a hue selector mouse up event.
     * 
     * @param e the event
     */
    _processHMouseUp: function(e) {
        Core.Web.Event.remove(this._hListenerDiv, "mousemove", this._processHMouseMoveRef, false);
        Core.Web.Event.remove(this._hListenerDiv, "mouseup", this._processHMouseUpRef, false);
        this._storeColor();
    },
    
    /**
     * Processes a mouse event which will update the selected hue (invoked by mouse/down move events).
     * 
     * @param e the event
     */
    _processHUpdate: function(e) {
        var offset = Core.Web.DOM.getEventOffset(e);
        this._h = (this._svHeight - (offset.y - 7)) * 360 / this._svHeight;
        this._updateDisplayedColor();
        Core.Web.DOM.preventEventDefault(e);
    },
    
    /**
     * Processes a saturation-value selector mouse down event.
     * 
     * @param e the event
     */
    _processSVMouseDown: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return;
        }
        Core.Web.Event.add(this._svListenerDiv, "mousemove", this._processSVMouseMoveRef, false);
        Core.Web.Event.add(this._svListenerDiv, "mouseup", this._processSVMouseUpRef, false);
        this._processSVUpdate(e);
    },
    
    /**
     * Processes a saturation-value selector mouse move event.
     * 
     * @param e the event
     */
    _processSVMouseMove: function(e) {
        this._processSVUpdate(e);
    },
    
    /**
     * Processes a saturation-value selector mouse up event.
     * 
     * @param e the event
     */
    _processSVMouseUp: function(e) {
        Core.Web.Event.remove(this._svListenerDiv, "mousemove", this._processSVMouseMoveRef, false);
        Core.Web.Event.remove(this._svListenerDiv, "mouseup", this._processSVMouseUpRef, false);
        this._storeColor();
    },
    
    /**
     * Processes a mouse event which will update the selected saturation/value (invoked by mouse/down move events).
     * 
     * @param e the event
     */
    _processSVUpdate: function(e) {
        var offset = Core.Web.DOM.getEventOffset(e);
        this._v = (offset.x - this._svXOffset) / this._svWidth;
        this._s = 1 - ((offset.y - this._svYOffset) / this._svHeight);
        this._updateDisplayedColor();
        Core.Web.DOM.preventEventDefault(e);
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._svWidth = Echo.Sync.Extent.toPixels(
                this.component.render("valueWidth", Extras.ColorSelect.DEFAULT_VALUE_WIDTH), true);
        this._svHeight = Echo.Sync.Extent.toPixels(
                this.component.render("saturationHeight", Extras.ColorSelect.DEFAULT_SATURATION_HEIGHT), false);
        this._hWidth = Echo.Sync.Extent.toPixels(
                this.component.render("hueWidth", Extras.ColorSelect.DEFAULT_HUE_WIDTH), true);
        var displayHeight = Core.Web.Measure.extentToPixels("1em", false);
    
        var svGradientImageSrc = this.client.getResourceUrl("Extras", "image/colorselect/ColorSelectSVGradient.png");
        var hGradientImageSrc = this.client.getResourceUrl("Extras", "image/colorselect/ColorSelectHGradient.png");
        
        // Create main container div element, relatively positioned.
        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        this._div.style.cssText = "position:relative;left:0;top:0;overflow:hidden;";
        this._div.style.width = (this._svWidth + this._hWidth + 29) + "px";
        this._div.style.height = (this._svHeight + 18 + displayHeight) +"px";
        
        // Create saturation / value selector.
        this._svDiv = document.createElement("div");
        this._svDiv.style.cssText = "position:absolute;background-color:#ff0000;overflow:hidden;";
        this._svDiv.style.left = this._svXOffset + "px";
        this._svDiv.style.top = this._svYOffset + "px";
        this._svDiv.style.width = this._svWidth + "px";
        this._svDiv.style.height = this._svHeight + "px";
        this._div.appendChild(this._svDiv);
        
        if (svGradientImageSrc) {
            if (Core.Web.Env.PROPRIETARY_IE_PNG_ALPHA_FILTER_REQUIRED) {
                this._svDiv.style.filter = "progid:DXImageTransform.Microsoft.AlphaImageLoader(" +
                        "src='" + svGradientImageSrc + "', sizingMethod='scale');";
            } else {
                var svGradientImg = document.createElement("img");
                svGradientImg.src = svGradientImageSrc;
                svGradientImg.style.width = this._svWidth + "px";
                svGradientImg.style.height = this._svHeight + "px";
                this._svDiv.appendChild(svGradientImg);
            }
        }
        
        this._svCursorDiv = this._createSVCursor();
        this._svDiv.appendChild(this._svCursorDiv);
        
        // Create hue selector.
        var hDiv = document.createElement("div");
        hDiv.style.cssText = "position:absolute;top:7px;overflow:hidden;";
        hDiv.style.left = (this._svWidth + 22) + "px";
        hDiv.style.width = this._hWidth + "px";
        hDiv.style.height = this._svHeight + "px";
        this._div.appendChild(hDiv);
    
        if (hGradientImageSrc) {
            var hGradientImg = document.createElement("img");
            hGradientImg.src = hGradientImageSrc;
            hGradientImg.style.cssText = "position:absolute;left:0;top:0;";
            hGradientImg.style.width = this._hWidth + "px";
            hGradientImg.style.height = this._svHeight + "px";
            hDiv.appendChild(hGradientImg);
        }
        
        this._hCursorDiv = this._createHCursor();
        hDiv.appendChild(this._hCursorDiv);
        
        this._colorDiv = document.createElement("div");
        this._colorDiv.style.cssText = 
                "position:absolute;left:7px;color:#ffffff;background-color:#000000;text-align:center;vertical-align:middle;" +
                "overflow:hidden;border:1px #000000 outset;font-family:monospace;text-align:center;";
        this._colorDiv.style.height = displayHeight + "px";
        this._colorDiv.style.top = (this._svHeight + 16) + "px";
        this._colorDiv.style.width = (this._svWidth + this._hWidth + 13) + "px";
        if (this.component.render("displayValue")) {
            this._colorDiv.appendChild(document.createTextNode("#000000"));
        }
        this._div.appendChild(this._colorDiv);
        
        this._svListenerDiv = document.createElement("div");
        this._svListenerDiv.style.cssText = "position:absolute;z-index:1;left:0;top:0;cursor:crosshair;";
        this._svListenerDiv.style.width = (this._svWidth + 14) + "px";
        this._svListenerDiv.style.height = (this._svHeight + 14) + "px";
        this._svListenerDiv.style.backgroundImage = "url(" +
                this.client.getResourceUrl("Echo", "resource/Transparent.gif") + ")";
        this._div.appendChild(this._svListenerDiv);
        
        this._hListenerDiv = document.createElement("div");
        this._hListenerDiv.style.cssText = "position:absolute;z-index:1;top:0;cursor:crosshair;";
        this._hListenerDiv.style.left = (this._svWidth + 15) + "px";
        this._hListenerDiv.style.width = (this._hWidth + 14) + "px";
        this._hListenerDiv.style.height = (this._svHeight + 16) + "px";
        this._hListenerDiv.style.backgroundImage = "url(" +
                this.client.getResourceUrl("Echo", "resource/Transparent.gif") + ")";
        this._div.appendChild(this._hListenerDiv);
    
        parentElement.appendChild(this._div);
        
        Core.Web.Event.add(this._svListenerDiv, "mousedown", Core.method(this, this._processSVMouseDown), false);
        Core.Web.Event.add(this._hListenerDiv, "mousedown", Core.method(this, this._processHMouseDown), false);
        this._setColor(this.component.get("color"));
    },
    
    _createHCursor: function() {
        var container = document.createElement("div");
        container.style.cssText = "position:absolute;";
        var div;

        div = document.createElement("div");
        div.style.cssText = "position:absolute;font-size:1px;line-height:0;top:1px;";
        div.style.opacity = this._shadowOpacity;
        div.style.width = this._hWidth + "px";
        div.style.height = (this._barRadius * 2 - 1) + "px";
        div.style.borderTop = this._cursorBorderShadow;
        div.style.borderBottom = this._cursorBorderShadow;
        container.appendChild(div);
        
        div = document.createElement("div");
        div.style.cssText = "position:absolute;font-size:1px;line-height:0;";
        div.style.opacity = this._lineOpacity;
        div.style.width = this._hWidth + "px";
        div.style.height = (this._barRadius * 2 - 1) + "px";
        div.style.borderTop = this._cursorBorderLight;
        div.style.borderBottom = this._cursorBorderDark;
        container.appendChild(div);
        
        return container;
    },
    
    _createSVCursor: function() {
        var div = document.createElement("div");
        div.style.cssText = "position:absolute;";
        div.style.width = (this._svWidth * 2 - 1) + "px";
        div.style.height = (this._svHeight * 2 - 1) + "px";
        
        var light, dark, o;

        light = dark = this._cursorBorderShadow;
        
        o = this._shadowOpacity;
        
        div.appendChild(this._createSVCursorLine(1, 1, true, true, light, dark, o));
        div.appendChild(this._createSVCursorLine(1, 1, false, true, light, dark, o));
        div.appendChild(this._createSVCursorLine(1, 1, true, false, light, dark, o));
        div.appendChild(this._createSVCursorLine(1, 1, false, false, light, dark, o));

        light = this._cursorBorderLight;
        dark = this._cursorBorderDark;
        
        o = this._lineOpacity;

        div.appendChild(this._createSVCursorLine(0, 0, true, true, light, dark, o));
        div.appendChild(this._createSVCursorLine(0, 0, false, true, light, dark, o));
        div.appendChild(this._createSVCursorLine(0, 0, true, false, light, dark, o));
        div.appendChild(this._createSVCursorLine(0, 0, false, false, light, dark, o));
        
        return div;
    },
    
    _createSVCursorLine: function(x, y, leading, vertical, light, dark, opacity) {
        var line = document.createElement("div");
        line.style.cssText = "position:absolute;line-height:0;font-size:1px;";
        line.style.opacity = opacity;
        
        line.style[vertical ? "borderLeft" : "borderTop"] = light;
        line.style[vertical ? "borderRight" : "borderBottom"] = dark;
        
        if (vertical) {
            line.style.left = (x + this._svWidth - this._barRadius) + "px";
            line.style.height = (this._svHeight - this._boxRadius) + "px";
            line.style.width = (this._barRadius * 2 - 1) + "px";
            if (!leading) {
                line.style.top = (1 + y + this._svHeight + this._boxRadius) + "px";
            }
        } else {
            line.style.top = (y + this._svHeight - this._barRadius) + "px";
            line.style.width = (this._svWidth - this._boxRadius) + "px";
            line.style.height = (this._barRadius * 2 - 1) + "px";
            if (!leading) {
                line.style.left = (1 + x + this._svWidth + this._boxRadius) + "px";
            }
        }
        
        return line;
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) { 
        Core.Web.Event.removeAll(this._svListenerDiv);
        Core.Web.Event.removeAll(this._hListenerDiv);
        this._div = null;
        this._svDiv = null;
        this._svListenerDiv = null;
        this._hListenerDiv = null;
        this._svCursorDiv = null;
        this._hCursorDiv = null;
        this._colorDiv = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var div = this._div;
        var parentElement = div.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        parentElement.removeChild(div);
        this.renderAdd(update, parentElement);
        return false;
    },
    
    /**
     * Sets the selected color.
     *
     * @param rgb the color to select as an 24 bit hexadecimal string color value
     * @private
     */
    _setColor: function(color) {
        var r, g, b;
        
        if (color) {
            // Remove leading #.
            color = color.substring(1); 
            r = Math.floor(parseInt(color, 16) / 0x10000) / 255;
            g = (Math.floor(parseInt(color, 16) / 0x100) % 0x100) / 255;
            b = (parseInt(color, 16) % 0x100) / 255;
        } else {
            r = g = b = 0;
        }
        
        var min = Math.min(r, g, b);
        var max = Math.max(r, g, b);
        this._v = max;
        
        var delta = max - min;
        if (max === 0 || delta === 0) {
            this._s = 0;
        } else {
            this._s = delta / max;
            if (r == max) {
                this._h = 60 * ((g - b) / delta);
            } else if (g == max) {
                this._h = 60 * (2 + (b - r) / delta);
            } else {
                this._h = 60 * (4 + (r - g) / delta);
            }
            if (this._h < 0) {
                this._h += 360;
            }
        }

        this._updateDisplayedColor();
    },
    
    /**
     * Stores color value in _h, _s, and _v in the component object.
     * @private
     */
    _storeColor: function() {
        var renderColor = Extras.Sync.ColorSelect.RGB._fromHsv(this._h, this._s, this._v);
        var renderHexTriplet = renderColor.toHexTriplet();
        this.component.set("color", renderHexTriplet);
    },
    
    /**
     * Updates the displayed color.
     */
    _updateDisplayedColor: function() {
        var baseColor;
        if (this.component.isRenderEnabled()) {
            baseColor = Extras.Sync.ColorSelect.RGB._fromHsv(this._h, 1, 1);
        } else {
            // Use a dull base color to enable a disabled effect.
            baseColor = Extras.Sync.ColorSelect.RGB._fromHsv(this._h, 0.3, 0.7);
        }
        this._svDiv.style.backgroundColor = baseColor.toHexTriplet();
    
        var renderColor = Extras.Sync.ColorSelect.RGB._fromHsv(this._h, this._s, this._v);
        
        var renderHexTriplet = renderColor.toHexTriplet();
        this._colorDiv.style.backgroundColor = renderHexTriplet;
        this._colorDiv.style.borderColor = renderHexTriplet;
        this._colorDiv.style.color = this._v < 0.67 ? "#ffffff" : "#000000";
        if (this.component.render("displayValue")) {
            this._colorDiv.childNodes[0].nodeValue = renderHexTriplet;
        }
        
        var sy = Math.floor((1 - this._s) * this._svHeight);
        if (sy < 0) {
             sy = 0;
        } else if (sy > this._svHeight) {
            sy = this._svHeight;
        }
        
        var vx = Math.floor(this._v * this._svWidth);
        if (vx < 0) {
            vx = 0;
        } else if (vx > this._svWidth) {
            vx = this._svWidth;
        }
        
        this._svCursorDiv.style.top = (sy - this._svHeight) + "px";
        this._svCursorDiv.style.left = (vx - this._svWidth) + "px";
        
        var hy = Math.floor((360 - this._h) / 360 * this._svHeight);
        if (hy < 0) {
            hy = 0;
        } else if (hy > this._svHeight) {
            hy = this._svHeight;
        }
        this._hCursorDiv.style.top = hy - this._barRadius + "px";
    }
});
/**
 * Component rendering peer: DataGrid.
 * This class should not be extended by developers, the implementation is subject to change.
 *
 * This is an EXPERIMENTAL component, it should not be used at this point for any purpose other than testing it.
 */
Extras.Sync.DataGrid = Core.extend(Echo.Render.ComponentSync, {

    $load: function() {
        Echo.Render.registerPeer("Extras.DataGrid", this);
    },
    
    $static: {
                
        /**
         * Horizontal/Vertical constant for left direction.
         */
        LEFT: { h: -1, v: 0 },
        
        /**
         * Horizontal/Vertical constant for right direction.
         */
        RIGHT: { h: 1, v: 0 },
        
        /**
         * Horizontal/Vertical constant for up direction.
         */
        UP: { h: 0, v: -1 },

        /**
         * Horizontal/Vertical constant for down direction.
         */
        DOWN: { h: 0, v: 1 },

        REGION_LOCATIONS: {
            topLeft:     { h: -1, v: -1 },
            top:         { h:  0, v: -1 },
            topRight:    { h:  1, v: -1 },
            left:        { h: -1, v:  0 },
            center:      { h:  0, v:  0 },
            right:       { h:  1, v:  0 },
            bottomLeft:  { h: -1, v:  1 },
            bottom:      { h:  0, v:  1 },
            bottomRight: { h:  1, v:  1 }
        },
        
        /**
         * Determines if two segments in a line share any points.
         *
         * @param {Number} a1 first point of segment A
         * @param {Number} a2 second point of segment A
         * @param {Number} b1 first point of segment B
         * @param {Number} b2 second point of segment B
         * @return true if the segments share any points
         */
        intersect: function(a1, a2, b1, b2) {
            return (b1 <= a1 && a1 <= b2) || (a1 <= b1 && b1 <= a2);
        },
        
        ScrollPosition: Core.extend({
            
            xIndex: null,
            
            yIndex: null,
            
            xScroll: 0,
            
            yScroll: 0,
            
            load: function(component) {
                this.setIndex(component.get("columnIndex"), component.get("rowIndex"));
                this.setScroll(component.get("columnScroll"), component.get("rowScroll"));
            },
            
            setIndex: function(x, y) {
                if (x != null) {
                    this.xIndex = x;
                    this.xScroll = null;
                }
                if (y != null) {
                    this.yIndex = y;
                    this.yScroll = null;
                }
            },
            
            setScroll: function(x, y) {
                if (x != null) {
                    this.xScroll = x;
                    this.xIndex = null;
                }
                if (y != null) {
                    this.yScroll = y;
                    this.yIndex = null;
                }
            },
            
            store: function(component) {
                component.set("columnScroll", this.xScroll, true);
                component.set("rowScroll", this.yScroll, true);
                component.set("columnIndex", this.xIndex, true);
                component.set("rowIndex", this.yIndex, true);
            }
        }),
        
        /**
         * Abstract base class for cell renderers.
         */
        CellRenderer: Core.extend({
            
            $abstract: {
            
                /**
                 * Returns an HTML representation of a DataGrid cell.
                 * 
                 * @param {Extras.Sync.DataGrid.RenderContext} context contextual information
                 *        (provides reference to DataGrid instance, capabilities to get/set state object for cell)
                 * @param value the value provided by the model
                 * @param {Number} column the column index
                 * @param {Number} row the row index 
                 * 
                 * @return a rendered node which should be added to the DOM in the cell (may return null)
                 * @type Node
                 */
                render: function(context, value, column, row) { }
            },
            
            $virtual: {

                /**
                 * Optional disposal method to deallocate resources used by a rendered DataGrid cell.
                 * May be used for purposes such as unregistering listeners on interactive cell renderings.
                 * A state object must have been set in the RenderContext in order for this method to be invoked.
                 * 
                 * @param {Extras.Sync.DataGrid.RenderContext} context contextual information
                 *        (provides reference to DataGrid instance, capabilities to get/set state object for cell) 
                 * @param {Number} column
                 * @param {Number} row 
                 */
                dispose: null
            }
        }),
        
        /**
         * Contextual data used by cell renderers.
         * Provides capability to get/set state of cell, access to DataGrid instance.
         * RenderContexts are created and disposed with tiles.
         */
        RenderContext: Core.extend({
            
            _states: null,
            
            /**
             * The relevant DataGrid.
             * @type Extras.DataGrid
             */
            dataGrid: null,
            
            /**
             * Creates a new RenderContext.
             * 
             * @param {Extras.DataGrid} dataGrid the relevant DataGrid.
             */
            $construct: function(dataGrid) {
                this.dataGrid = dataGrid;
                this._states = {};
            },
            
            /**
             * Invoked by the tile when it is disposed.  Should never be manually invoked.
             */
            dispose: function() {
                for (var x in this._states) {
                    //FIXME implement cell disposal
                }
            },
            
            /**
             * Retrieves the state object for a rendered cell.
             * 
             * @param {Number} column the cell column index
             * @param {Number} row the cell row index 
             * @return the state object
             */
            getState: function(column, row) {
                return this._states[column + "," + row];
            },
            
            /**
             * Sets the state object for a rendered cell.
             * State objects are arbitrary renderer-defined objects containing state information about a cell.
             * A typical use for a state object would be for an interactive cell to store elements such that listeners 
             * may be removed from them when a cell is disposed.
             * 
             * @param {Number} column the cell column index
             * @param {Number} row the cell row index
             * @param state the state object, an arbitrary renderer-defined object containing state information about the
             *        cell  
             */
            setState: function(column, row, state) {
                this._states[column + "," + row] = state;
            }
        }),

        /**
         * Representation of a "tile", a sub-table that renders a portion of the DataGrid.
         * Tiles are contained within Regions.
         */
        Tile: Core.extend({
            
            /** 
             * The containing DataGrid instance. 
             * @type Extras.Sync.DataGrid
             */
            dataGrid: null,
            
            /** 
             * Flag indicating whether the tile is displayed. 
             * @type Boolean
             */
            displayed: false,
            
            /** 
             * The div element.  Outermost element of a tile, contains the <code>_table</code> element as its only child.
             * @type Element
             */
            div: null,
            
            /** 
             * The table element.  Contained within the <code>div</code> element.
             * @type Element
             */
            _table: null,
            
            /** 
             * The region containing the tile. 
             * @type Extras.Sync.DataGrid.Region
             */
            region: null,
            
            /**
             * Edge information object.  Contains boolean "top", "right", "left", and "bottom" properties, 
             * each of which evaluates to true if the tile is at that extreme edge.
             */
            edge: null,
            
            /**
             * Cell index information object.  Contains integer "top", "right", "left", and "bottom" properties, 
             * each of which indicates the index of cells at that edge of the tile.  
             *
             * As an example, if the DataGrid's tile size were 12 columns by 6 rows, then for the tile in the second column 
             * of the second row, this value would be { top: 6, left: 12, bottom: 11, right: 23 } assuming that the the data 
             * grid had at least  12 rows and 24 columns.  If the data grid only had 9 rows and 18 columns, this value would 
             * be { top: 6, left: 12, bottom: 8, right: 17 }.
             */
            cellIndex: null,
            
            /**
             * Tile index information object.  Contains row and column properties indicating the row/column of the tile
             * within the grid of tiles.  The upper left tile would be at column 0, row 0.  The tile to the right would 
             * be at column 1, row 0.
             */
            tileIndex: null,

            /**
             * The rendered position/size of the tile.  Contains "top", "left", "width", and "height" properties describing
             * rendered bounds of the tile.  Initialized when the tile is displayed.
             */
            positionPx: null,
            
            /**
             * The RenderContext instance specific to this tile.
             * @type Extras.Sync.DataGrid.RenderContext
             */
            _renderContext: null,
            
            /**
             * Creates a new <code>Tile</code>.
             *
             * @param {Extras.Sync.DataGrid} dataGrid the containing data grid peer
             * @param {Extras.Sync.DataGrid.Region} region the containing region
             * @param {Number} tileColumnIndex the column index of the tile
             * @param {Number} tileRowIndex the row index of the tile
             */
            $construct: function(dataGrid, region, tileColumnIndex, tileRowIndex) {
                this.dataGrid = dataGrid;
                this._renderContext = new Extras.Sync.DataGrid.RenderContext(dataGrid);
                this.containerElement = region.element;
                this.tileIndex = { column: tileColumnIndex, row: tileRowIndex };
                this.region = region;
                
                this.edge = { 
                    left: this.tileIndex.column === 0,
                    top: this.tileIndex.row === 0
                };
                
                this.cellIndex = { };
                
                // Determine horizontal data.
                switch (this.region.location.h) {
                case -1:
                    this.cellIndex.left = this.tileIndex.column * this.dataGrid.tileSize.columns;
                    this.cellIndex.right = this.cellIndex.left + this.dataGrid.tileSize.columns - 1;
                    if (this.cellIndex.right >= this.dataGrid.fixedCells.left) {
                        this.cellIndex.right = this.dataGrid.fixedCells.left - 1;
                        this.edge.right = true;
                    }
                    break;
                case 0: 
                    this.cellIndex.left = this.tileIndex.column * this.dataGrid.tileSize.columns + this.dataGrid.fixedCells.left;
                    this.cellIndex.right = this.cellIndex.left + this.dataGrid.tileSize.columns - 1;
                    if (this.cellIndex.right >= this.dataGrid.size.columns - this.dataGrid.fixedCells.right - 1) {
                        this.cellIndex.right = this.dataGrid.size.columns - this.dataGrid.fixedCells.right - 1;
                        this.edge.right = true;
                    }
                    break;
                case 1:
                    this.cellIndex.left = this.dataGrid.size.columns - this.dataGrid.fixedCells.right + 
                            (this.tileIndex.column * this.dataGrid.tileSize.columns);
                    this.cellIndex.right = this.cellIndex.left + this.dataGrid.tileSize.columns - 1;
                    if (this.cellIndex.right >= this.dataGrid.size.columns - 1) {
                        this.cellIndex.right = this.dataGrid.size.columns - 1;
                        this.edge.right = true;
                    }
                    break;
                }
                
                // Determine vertical data.
                switch (this.region.location.v) {
                case -1:
                    this.cellIndex.top = this.tileIndex.row * this.dataGrid.tileSize.rows;
                    this.cellIndex.bottom = this.cellIndex.top + this.dataGrid.tileSize.rows - 1;
                    if (this.cellIndex.bottom >= this.dataGrid.fixedCells.top) {
                        this.cellIndex.bottom = this.dataGrid.fixedCells.top - 1;
                        this.edge.bottom = true;
                    }
                    break;
                case 0: 
                    this.cellIndex.top = this.tileIndex.row * this.dataGrid.tileSize.rows + this.dataGrid.fixedCells.top;
                    this.cellIndex.bottom = this.cellIndex.top + this.dataGrid.tileSize.rows - 1;
                    if (this.cellIndex.bottom >= this.dataGrid.size.rows - this.dataGrid.fixedCells.bottom - 1) {
                        this.cellIndex.bottom = this.dataGrid.size.rows - this.dataGrid.fixedCells.bottom - 1;
                        this.edge.bottom = true;
                    }
                    break;
                case 1:
                    this.cellIndex.top = this.dataGrid.size.rows - this.dataGrid.fixedCells.bottom + 
                            (this.tileIndex.row * this.dataGrid.tileSize.rows);
                    this.cellIndex.bottom = this.cellIndex.top + this.dataGrid.tileSize.rows - 1;
                    if (this.cellIndex.bottom >= this.dataGrid.size.rows - 1) {
                        this.cellIndex.bottom = this.dataGrid.size.rows - 1;
                        this.edge.bottom = true;
                    }
                    break;
                }
            },
            
            /**
             * Adjusts the position of the tile.
             */
            adjustPositionPx: function(px, horizontal) {
                if (this.div) {
                    if (horizontal) {
                        this.positionPx.left += px;
                        this.div.style.left = this.positionPx.left + "px";
                    } else {
                        this.positionPx.top += px;
                        this.div.style.top = this.positionPx.top + "px";
                    }
                }
                
                if (!this.isOnScreen()) {
                    this.remove();
                }
            },
            
            /**
             * Renders the tile.  Sets the div and _table element properties, measures rendered tile and sets
             * positionPx property.
             */
            create: function() {
                if (this.div) {
                    return;
                }
                
                var tr, td, row, column;

                var columnWidths = [];
                
                this.positionPx = { };
                
                this.positionPx.width = 0;
                for (column = this.cellIndex.left; column <= this.cellIndex.right; ++column) {
                    this.positionPx.width += columnWidths[column] = this.dataGrid._getColumnWidth(column);
                }

                this.div = document.createElement("div");
                this.div.style.cssText = "position:absolute;";

                this._table = this.dataGrid.getPrototypeTable().cloneNode(true);
                this._table.style.width = this.positionPx.width + "px";

                this.div.appendChild(this._table);

                for (row = this.cellIndex.top; row <= this.cellIndex.bottom; ++row) {
                    tr = document.createElement("tr");
                    for (column = this.cellIndex.left; column <= this.cellIndex.right; ++column) {
                        td = document.createElement("td");
                        td.style.cssText = "padding:0;overflow:hidden;";
                        Echo.Sync.Border.render(this.dataGrid._cellBorder, td);
                        if (row === this.cellIndex.top) {
                            td.style.width = (columnWidths[column] - this.dataGrid._cellBorderWidthPx) + "px";
                        }
                        var value = this.dataGrid._model.get(column, row);
                        if (value == null) {
                            // FIXME Temporary fix for zero-height cells causing rendering to take forever.
                            // Remove when bounding is working properly.
                            value = "\u00a0";
                        }
                        
                        var values = value.toString().split("\n");
                        for (var iValue = 0; iValue < values.length; ++iValue) {
                            if (iValue > 0) {
                                td.appendChild(document.createElement("br"));
                            }
                            td.appendChild(document.createTextNode(values[iValue]));
                        }
                        tr.appendChild(td);
                    }
                    this._table.firstChild.appendChild(tr);
                }
                
                this.div.style.width = this.positionPx.width + "px";
                
                this.dataGrid.measureDiv.appendChild(this.div);
                this.positionPx.height = this.div.offsetHeight || 100;
                
                this.positionPx.rowHeights = [];
                tr = this._table.firstChild.firstChild;
                while (tr) {
                    this.positionPx.rowHeights.push(tr.offsetHeight);
                    tr = tr.nextSibling;
                }
                
                this.dataGrid.measureDiv.removeChild(this.div);
            },
            
            /**
             * Displays the tile at the specified coordinates.
             * Does nothing if the tile is already displayed.
             * The right and bottom positions will override left and top, if specified.
             * Note that the tile's CSS position will be set using left/top, even when 
             * right/bottom are specified (measured width/height will be used to position
             * it correctly in such a scenario). 
             *
             * @param {Number} left the left pixel coordinate of the tile within the region
             * @param {Number} top the top pixel coordinate of the tile within the region
             * @param {Number} right the right pixel coordinate of the tile within the region
             * @param {Number} bottom the bottom pixel coordinate of the tile within the region
             */
            display: function(left, top, right, bottom) {
                if (this.displayed) {
                    return;
                }
                this.create();

                if (right != null) {
                    left = right - this.positionPx.width;
                }
                if (bottom != null) {
                    top = bottom - this.positionPx.height;
                }
                
                this.div.style.top = top + "px";
                this.div.style.left = left + "px";
                this.positionPx.top = top;
                this.positionPx.left = left;
                
                this.containerElement.appendChild(this.div);
                this.displayed = true;
            },
            
            /**
             * Disposes resources used by the tile.
             * Must be invoked before the tile is discarded.
             */
            dispose: function() {
                this._renderContext.dispose();
                this.div = this._table = null;
            },
            
            /**
             * Determines if this tile is currently covering the bottom edge of the screen (pixel 0).
             */ 
            isEdgeBottom: function() {
                return this.edge.bottom || (this.positionPx.top < this.region.bounds.height && 
                        this.positionPx.top + this.positionPx.height >= this.region.bounds.height);
            },
            
            /**
             * Determines if this tile is currently covering the left edge of the screen (pixel 0).
             */ 
            isEdgeLeft: function() {
                return this.edge.left || this.tileIndex.column === 0 || 
                        (this.positionPx.left <= 0 && this.positionPx.left + this.positionPx.width > 0);
            },
            
            /**
             * Determines if this tile is currently covering the left edge of the screen (pixel 0).
             */ 
            isEdgeRight: function() {
                return this.edge.right || (this.positionPx.left < this.region.bounds.width && 
                        this.positionPx.left + this.positionPx.width >= this.region.bounds.width);
            },
            
            /**
             * Determines if this tile is currently covering the top edge of the screen (pixel 0).
             */ 
            isEdgeTop: function() {
                return this.edge.top || this.tileIndex.row === 0 || 
                        (this.positionPx.top <= 0 && this.positionPx.top + this.positionPx.height > 0);
            },
        
            /**
             * Determines if any portion of this tile is currently on screen.
             */
            isOnScreen: function() {
                if (!this.displayed) {
                    return false;
                }
                return Extras.Sync.DataGrid.intersect(this.positionPx.left, this.positionPx.left + 
                        this.positionPx.width, 0, this.region.bounds.width) &&
                        Extras.Sync.DataGrid.intersect(this.positionPx.top, this.positionPx.top + 
                        this.positionPx.height, 0, this.region.bounds.height);
            },

            /**
             * Disposes of resources used by the tile.
             */
            remove: function() {
                if (this.displayed) {
                    this.div.parentNode.removeChild(this.div);
                    this.displayed = false;
                }
            },
            
            setRowHeight: function(row, newHeight) {
                var oldHeight = this.positionPx.rowHeights[row];
                var tbody = this._table.firstChild;
                tbody.childNodes[row].style.height = newHeight + "px";
                this.positionPx.rowHeights[row] = newHeight;
                this.positionPx.height += newHeight - oldHeight;
            },
            
            /** @see Object#toString */
            toString: function() {
                return "Tile (" + this.tileIndex.column + "," + this.tileIndex.row + ")";
            }
        }),
        
        /**
         * Represents a region of the DataGrid.  A DataGrid may have up to nine regions, arranged as three
         * rows and three columns.  Regions in the center row can be vertically scrolled, while the top and bottom rows
         * are vertically fixed.  Regions in the center column can be horizontally scrolled , while the left and right
         * columns are horizontally fixed.
         */
        Region: Core.extend({

            /**
             * The containing Extras.Sync.DataGrid instance.
             * @type Extras.Sync.DataGrid
             */
            dataGrid: null,
            
            /**
             * Object containing all <code>Tile</code> instances held within the region.
             * This object maps tile row indices to tile column maps.
             * The tile column maps map column indices to actual tiles.
             * The indices used are the indices of tiles, not the indices of the cells they contain.
             * This object is organized like a two dimensional array, with rows as the first dimension and columns as the seccond,
             * e.g., requesting _tiles[4][2] would return the tile at row 4 (the fifth row) and column 2 (the third column).
             * Before making such a query one would have to ensure that _tiles[4] is defined.
             * Though integer values are used, note that this is an object, not an array mapping.
             */
            _tiles: null,
            
            /**
             * Cell count size for region, contains rows and columns numeric properties.
             */
            size: null,
            
            /**
             * 
             */
            bounds: null,

            /**
             * The region name one of the following values: 
             * topLeft, top, topRight, left, center, right, bottomLeft, bottom, bottomRight
             * @type String
             */
            name: null,
            
            /** 
             * The location of the region, an object containing h and v properties.
             * These h and v properties may have values of -1, 0, or 1.
             * A value of 0 indicates center, -1 indicates left/top, 1 indicates right/bottom.
             */
            location: null,
            
            /**
             * Creates a new Region.
             *
             * @param {Extras.Sync.DataGrid} dataGrid the containing data grid synchronization peer
             * @param {String} name the region name, one of the following values: 
             *        topLeft, top, topRight, left, center, right, bottomLeft, bottom, bottomRight
             */
            $construct: function(dataGrid, name) {
                var rows, columns;

                this.dataGrid = dataGrid;
                this.name = name;
                this._tiles = { };
                this.location = Extras.Sync.DataGrid.REGION_LOCATIONS[name];

                this.element = document.createElement("div");
                this.element.style.cssText = "position:absolute;overflow:hidden;";
                if (this.location.h !== 0 || this.location.v !== 0) {
                    //FIXME temporary background color for non center regions.
                    this.element.style.backgroundColor = "#dfffdf";
                }
                
                switch (this.location.v) {
                case -1:
                    this.element.style.top = 0;
                    rows = this.dataGrid.fixedCells.top;
                    break;
                case 0:
                    rows = this.dataGrid.scrollSize.rows;
                    break;
                case 1:
                    this.element.style.bottom = 0;
                    rows = this.dataGrid.fixedCells.bottom;
                    break;
                }
                
                switch (this.location.h) {
                case -1:
                    this.element.style.left = 0;
                    columns = this.dataGrid.fixedCells.left;
                    break;
                case 0:
                    columns = this.dataGrid.scrollSize.columns;
                    break;
                case 1:
                    this.element.style.right = 0;
                    columns = this.dataGrid.fixedCells.right;
                    break;
                }
                
                this.size = { columns: columns, rows: rows };
                
                this.tileCount = { 
                    columns: Math.ceil(columns / this.dataGrid.tileSize.columns), 
                    rows: Math.ceil(rows / this.dataGrid.tileSize.rows)
                };
            },

            /**
             * Adjusts the positions of tiles within the region, additionally filling in any areas that become
             * unoccupied as a result of the adjustment.
             */
            adjustPositionPx: function(px, horizontal) {
                if ((this.location.h && horizontal) || (this.location.v && !horizontal)) {
                    // Return immediately if region is not scrollable in specified direction.
                    return;
                }
            
                var row, rowIndex, tile;
                for (rowIndex in this._tiles) {
                    row = this._tiles[rowIndex];
                    for (var columnIndex in row) {
                        tile = row[columnIndex];
                        tile.adjustPositionPx(px, horizontal);
                    }
                }
                
                this.fill(false);
                this.fill(true);
                
                var hasTop = false, hasBottom = false;
                for (rowIndex in this._tiles) {
                    if (rowIndex === 0) {
                        hasTop = true;
                    }
                    if (hasTop && hasBottom) {
                        break;
                    }
                }
            },
            
            /**
             * Clears the region of tiles, removing/disposing all tile objects in the process.
             */
            clear: function() {
                for (var rowIndex in this._tiles) {
                    var row = this._tiles[rowIndex];
                    for (var columnIndex in row) {
                        var tile = row[columnIndex];
                        tile.remove();
                        tile.dispose();
                    }
                }
                this._tiles = { };
            },

            /**
             * Positions a tile immediately adjacent to another tile.
             *
             * @param {Echo.Sync.DataGrid.Tile} tile the origin tile
             * @param {Echo.Sync.DataGrid.Tile} adjacentTile the adjacent tile
             * @param direction the adjacent direction, one of the following values (defined in Extras.Sync.DataGrid):
             *        <ul>
             *         <li><code>LEFT</code></li>
             *         <li><code>RIGHT</code></li>
             *         <li><code>UP</code></li>
             *         <li><code>DOWN</code></li>
             *        </ul>
             */
            positionTileAdjacent: function(tile, adjacentTile, direction) {
                var left, right, top, bottom;
                switch (direction.h) {
                case -1:
                    right = tile.positionPx.left;
                    break;
                case 1:
                    left = tile.positionPx.left + tile.positionPx.width;
                    break;
                default:
                    left = tile.positionPx.left;
                }
                
                switch (direction.v) {
                case -1:
                    bottom = tile.positionPx.top;
                    break;
                case 1:
                    top = tile.positionPx.top + tile.positionPx.height;
                    break;
                default:
                    top = tile.positionPx.top;
                }
                
                adjacentTile.display(left, top, right, bottom);
            },
            
            /**
             * Ensures the region is filled with content.  Invoked after the viewport has been scrolled.
             *
             * @param {Boolean} fromBottom flag indicating whether filling should start from the bottom (true) or top (false)
             */
            fill: function(fromBottom) {
                // Find top/bottommost tile.
                var tile = this._findVerticalEdgeTile(fromBottom),
                    adjacentTile;

                // Move left, displaying tiles until left edge tile is reached.
                while (!tile.isEdgeLeft()) {
                    adjacentTile = this.getTile(tile.tileIndex.column - 1, tile.tileIndex.row);
                    this.positionTileAdjacent(tile, adjacentTile, Extras.Sync.DataGrid.LEFT);
                    tile = adjacentTile;
                }
                    
                var leftEdgeTile = tile;
                
                if (leftEdgeTile == null) {
                    //FIXME impl.
                    alert("FIXME...can't find left edge tile, scenario not handled yet.");
                } else {
                    do {
                        // Move right.
                        tile = leftEdgeTile;
                        while (tile.isOnScreen() && !tile.isEdgeRight()) {
                            adjacentTile = this.getTile(tile.tileIndex.column + 1, tile.tileIndex.row);
                            this.positionTileAdjacent(tile, adjacentTile, Extras.Sync.DataGrid.RIGHT);
                            tile = adjacentTile;
                        }
                        
                        this.synchronizeHeights(leftEdgeTile);

                        // Move down/up.
                        adjacentTile = this.getTile(leftEdgeTile.tileIndex.column, 
                                leftEdgeTile.tileIndex.row + (fromBottom ? -1 : 1));
                        if (adjacentTile == null) {
                            break;
                        }
                        this.positionTileAdjacent(leftEdgeTile, adjacentTile, 
                                fromBottom ? Extras.Sync.DataGrid.UP : Extras.Sync.DataGrid.DOWN);
                        leftEdgeTile = adjacentTile;
                    } while (leftEdgeTile.isOnScreen());
                }
            },
            
            /**
             * Finds the topmost or bottommost tile that is on screen.  The found tile may be anywhere in the row.
             *
             * @param {Boolean} bottom flag indicating whether topmost (false) or bottommost (true) tile should be returned
             */
            _findVerticalEdgeTile: function(bottom) {
                var row, tile, topRowIndex = null, rowIndex;
                for (rowIndex in this._tiles) {
                    if (topRowIndex == null || (bottom ? (rowIndex > topRowIndex) : (rowIndex < topRowIndex))) {
                        row = this._tiles[rowIndex];
                        for (var columnIndex in row) {
                            if (row[columnIndex].isOnScreen()) {
                                tile = row[columnIndex];
                                topRowIndex = rowIndex;
                                break;
                            }
                        }
                    }
                }
                return tile;
            },
            
            getTile: function(columnIndex, rowIndex) {
                if (columnIndex < 0 || rowIndex < 0 || columnIndex > this.size.columns / this.dataGrid.tileSize.columns || 
                        rowIndex > this.size.rows / this.dataGrid.tileSize.rows) {
                    return null;
                }
                var cachedRow = this._tiles[rowIndex];
                if (!cachedRow) {
                    cachedRow = { };
                    this._tiles[rowIndex] = cachedRow;
                }

                var tile = cachedRow[columnIndex];
                if (!tile) {
                    tile = new Extras.Sync.DataGrid.Tile(this.dataGrid, this, columnIndex, rowIndex);
                    cachedRow[columnIndex] = tile;
                }
                return tile;
            },
            
            getBorderTilesX: function() {
                if (this.location.h !== 0 || this.location.v !== 0) {
                    throw new Error("Cannot invoke getPositionV on tile other than center.");
                }
                
                var leftTile, rightTile;
                
                for (var rowIndex in this._tiles) {
                    var row = this._tiles[rowIndex];
                    for (var columnIndex in row) {
                        var tile = row[columnIndex];
                        if (tile.displayed && tile.isOnScreen()) {
                            if (tile.positionPx.left <= 0) {
                                leftTile = tile;
                            }
                            if (tile.positionPx.left + tile.positionPx.width > this.bounds.width) {
                                rightTile = tile;
                            }
                            break;
                        }
                    }
                    if (leftTile && rightTile) {
                        break;
                    }
                }
                
                return {
                    left: leftTile, right: rightTile
                };
            },
            
            getBorderTilesY: function() {
                if (this.location.h !== 0 || this.location.v !== 0) {
                    throw new Error("Cannot invoke getPositionV on tile other than center.");
                }
                
                var topTile, bottomTile, topPx = null, bottomPx = null;
                
                for (var rowIndex in this._tiles) {
                    var row = this._tiles[rowIndex];
                    for (var columnIndex in row) {
                        var tile = row[columnIndex];
                        if (tile.displayed && tile.isOnScreen()) {
                            if (topPx == null || tile.positionPx.top < topPx) {
                                topPx = tile.positionPx.top;
                                if (topPx <= 0) {
                                    topTile = tile;
                                }
                            }
                            var tileBottomPx = this.bounds.height - (tile.positionPx.top + tile.positionPx.height);
                            if (bottomPx == null || tileBottomPx < bottomPx) {
                                bottomPx = tileBottomPx;
                                if (bottomPx <= 0) {
                                    bottomTile = tile;
                                }
                            }
                            break;
                        }
                    }
                    if (topTile && bottomTile) {
                        break;
                    }
                }
                
                return {
                    top: topTile, bottom: bottomTile, topPx: topPx, bottomPx: bottomPx
                };
            },
            
            /**
             * Renders all tiles in the region.  Invocation will clear all existing tiles.
             */
            renderTiles: function() {
                var xFactor, yFactor, originColumn, originRow, tileRowIndex = 0, tileColumnIndex = 0, tile, 
                    xPosition = 0, yPosition = 0;
                   
                // Clear.
                this.clear();
                    
                // Calculate horizontal scroll position, if required.
                if (this.location.h === 0) {
                    if (this.dataGrid.scrollPosition.xScroll != null) {
                        xFactor = this.dataGrid.scrollPosition.xScroll / 100;
                        originColumn = this.dataGrid.scrollSize.columns * xFactor;
                    } else {
                        originColumn = this.dataGrid.scrollPosition.xIndex || 0;
                    }
                    tileColumnIndex = Math.floor(originColumn / this.dataGrid.tileSize.columns);
                }
                
                // Calculate vertical scroll position, if required.
                if (this.location.v === 0) {
                    if (this.dataGrid.scrollPosition.yScroll != null) {
                        yFactor = this.dataGrid.scrollPosition.yScroll / 100;
                        originRow = this.dataGrid.scrollSize.rows * yFactor;
                    } else {
                        originRow = this.dataGrid.scrollPosition.yIndex || 0;
                    }
                    tileRowIndex = Math.floor(originRow / this.dataGrid.tileSize.rows);
                }
                
                // Create origin tile.
                tile = this.getTile(tileColumnIndex, tileRowIndex);
                tile.create();
                
                // Determine horizontal position.
                if (this.location.h === 0) {
                    if (this.dataGrid.scrollPosition.xScroll != null) {
                        xPosition = xFactor * (this.bounds.width - tile.positionPx.width);
                    }
                }

                // Determine vertical position.
                if (this.location.v === 0) {
                    if (this.dataGrid.scrollPosition.yScroll != null) {
                        yPosition = yFactor * (this.bounds.height - tile.positionPx.height);
                    }
                }
                
                // Display origin tile.
                tile.display(xPosition, yPosition); 
                
                // Fill region.
                this.fill(false);
                this.fill(true);
            },
            
            /**
             * Updates the rendered bounds of the region.  The values passed always indicate the pixel bounds of the
             * center region of the DataGrid.
             */
            notifySeparatorUpdate: function() {
                var s = this.dataGrid.separatorPx;
                
                this.bounds = { };
                switch (this.location.h) {
                case -1: 
                    this.element.style.width = s.left + "px"; 
                    this.bounds.width = s.left;
                    break;
                case  0: 
                    this.element.style.left = s.left + "px"; 
                    this.element.style.right = s.right + "px"; 
                    this.bounds.width = this.dataGrid.scrollContainer.bounds.width - s.left - s.right;
                    break;
                case  1: 
                    this.element.style.width = s.right + "px"; 
                    this.bounds.width = s.right;
                    break;
                }
                switch (this.location.v) {
                case -1: 
                    this.element.style.height = s.top + "px"; 
                    this.bounds.height = s.top;
                    break;
                case  0: 
                    this.element.style.top = s.top + "px"; 
                    this.element.style.bottom = s.bottom + "px"; 
                    this.bounds.height = this.dataGrid.scrollContainer.bounds.height - s.top - s.bottom;
                    break;
                case  1: 
                    this.element.style.height = s.bottom + "px"; 
                    this.bounds.height = s.bottom;
                    break;
                }
            },
            
            synchronizeHeights: function(leftEdgeTile) {
                var tile = leftEdgeTile, 
                    tiles = [ leftEdgeTile ],
                    maxHeight, 
                    differentHeights,
                    iRow,
                    iTile;
                    
                while (tile.isOnScreen() && !tile.isEdgeRight()) {
                    tile = this.getTile(tile.tileIndex.column + 1, tile.tileIndex.row);
                    tiles.push(tile);
                }
                tile = null;
                
                for (iRow = 0; iRow < leftEdgeTile.positionPx.rowHeights.length; ++iRow) {
                    maxHeight = leftEdgeTile.positionPx.rowHeights[iRow];
                    differentHeights = false;
                    for (iTile = 1; iTile < tiles.length; ++iTile) {
                        if (tiles[iTile].positionPx.rowHeights[iRow] != maxHeight) {
                            differentHeights = true;
                            if (tiles[iTile].positionPx.rowHeights[iRow] > maxHeight) {
                                maxHeight = tiles[iTile].positionPx.rowHeights[iRow];
                            }
                        }
                    }
                    if (differentHeights) {
                        for (iTile = 0; iTile < tiles.length; ++iTile) {
                            tiles[iTile].setRowHeight(iRow, maxHeight);
                        }
                        Core.Debug.consoleWrite("adjust");
                    } else {
                        Core.Debug.consoleWrite("no adjust");
                    }
                }
            }
        })
    },
    
    /**
     * Number of rows per tile.  The last tile may have fewer rows.
     */
    tileSize: {
        columns: 5,
        rows: 3
    },
    
    _fullRenderRequired: null,
    
    /**
     * Root DIV element of rendered component.
     */ 
    _div: null,
    
    measureDiv: null,
    
    /**
     * Current displayed scroll position.
     * @type Extras.Sync.DataGrid.ScrollPosition 
     */
    scrollPosition: null,
    
    /**
     * The displayed visible range of cell indices in the center region.
     * Contains top, left, right, and bottom properties.  Values may be fractional when part of a cell is displayed.
     * Bottom/right values will indicate an index of n + 1 if the entirety of cell n is displayed, 
     * but none of cell n + 1 is displayed.
     */
    visibleRange: null,
    
    /**
     * Amount by which the edges of the top-/left-/right-bottom-most tiles are overscrolling their maximums.
     * Contains top, left, right, and bottom properties as pixels values.
     * This property is used to take corrective action to avoid overscrolling content.
     * Example, a value of 48 for the "top" property indicates that the topmost tile of the center region has been scrolled
     * such that its top edge is 48 pixels below the top edge of the region.  
     */
    overscroll: null,
        
    regions: null,
    
    /**
     * Data model.
     */ 
    _model: null,
    
    /**
     * Separator positions (separating fixed from scrolling content), in pixels.
     * These values are calculated from the widths of the fixed cells.
     * Contains top, left, right, and bottom integer properties.
     * @type Object
     */
    separatorPx: null,

    /**
     * Size of grid in rows and columns.  Contains numeric rows and columns properties.
     */
    size: null,
    
    /**
     * Size of scrolling region of grid in rows and columns.  Contains numeric rows and columns properties.
     */
    scrollSize: null,
    
    /**
     * Combined pixel width of the left and right borders of a cell.
     * @type Number
     */
    _cellBorderWidthPx: null,
    
    /**
     * combined pixel height of the top and bottom borders of a cell.
     * @type Number
     */
    _cellBorderHeightPx: null,
    
    /**
     * Number of fixed cells in left, top, right, and bottom sides of the DataGrid.
     * Contains numeric left, top, right, and bottom properties.
     */
    fixedCells: null,
    
    /**
     * The <code>ScrollContainer</code>.
     * @type Extras.Sync.DataGrid.ScrollContainer
     */
    scrollContainer: null,
    
    $construct: function() {
        this._div = null;
        this.visibleRange = {};
        this.overscroll = {};
        this.scrollPosition = new Extras.Sync.DataGrid.ScrollPosition();
    },
    
    adjustPositionPx: function(px, horizontal) {
        if (horizontal) {
            // Limit adjustment to 1/2 screen width.
            if (Math.abs(px) > this.regions.center.bounds.width / 2) {
                px = this.regions.center.bounds.width / 2 * (px < 0 ? -1 : 1);
            }
        } else {
            // Limit adjustment to 1/2 screen height.
            if (Math.abs(px) > this.regions.center.bounds.height / 2) {
                px = this.regions.center.bounds.height / 2 * (px < 0 ? -1 : 1);
            }
        }
        
        this._adjustRegionPositionPx(px, horizontal);

        if (horizontal) {
            this._updateScrollContainerX();
            this.scrollPosition.setIndex(this.visibleRange.left, null);
            this.scrollPosition.store(this.component);
        } else {
            if (this.overscroll.top && this.overscroll.top > 0) {
                this._adjustRegionPositionPx(0 - this.overscroll.top, horizontal);
            } else if (this.overscroll.bottom && this.overscroll.bottom > 0) {
                this._adjustRegionPositionPx(this.overscroll.bottom, horizontal);
                if (this.overscroll.top && this.overscroll.top > 0) {
                    this._adjustRegionPositionPx(0 - this.overscroll.top, horizontal);
                }
            }
            
            this._updateScrollContainerY();
            this.scrollPosition.setIndex(null, this.visibleRange.top); 
            this.scrollPosition.store(this.component);
        }
    },
    
    _adjustRegionPositionPx: function(px, horizontal) {
        for (var name in this.regions) {
            this.regions[name].adjustPositionPx(px, horizontal);
        }
        if (horizontal) {
            this.updateVisibleRangeX();
        } else {
            this.updateVisibleRangeY();
        }
    },

    /**
     * Creates the <code>regions</code> property, containg 
     * topLeft, top, topRight, left, center, right, bottomLeft, bottom, and bottomRight properties addressing each
     * individual region.
     * Calculates separator positions.
     */
    _createRegions: function() {
        this.regions = { };
    
        // Create top regions.
        if (this.fixedCells.top) {
            if (this.fixedCells.left) {
                this.regions.topLeft = new Extras.Sync.DataGrid.Region(this, "topLeft");
            }
            this.regions.top = new Extras.Sync.DataGrid.Region(this, "top");
            if (this.fixedCells.right) {
                this.regions.topRight = new Extras.Sync.DataGrid.Region(this, "topRight");
            }
        }
        
        // Create top bottom.
        if (this.fixedCells.bottom) {
            if (this.fixedCells.left) {
                this.regions.bottomLeft = new Extras.Sync.DataGrid.Region(this, "bottomLeft");
            }
            this.regions.bottom = new Extras.Sync.DataGrid.Region(this, "bottom");
            if (this.fixedCells.right) {
                this.regions.bottomRight = new Extras.Sync.DataGrid.Region(this, "bottomRight");
            }
        }
        
        // Create center regions.
        if (this.fixedCells.left) {
            this.regions.left = new Extras.Sync.DataGrid.Region(this, "left");
        }
        this.regions.center = new Extras.Sync.DataGrid.Region(this, "center");
        if (this.fixedCells.right) {
            this.regions.right = new Extras.Sync.DataGrid.Region(this, "right");
        }
        
        // Add region elements to scroll container
        for (var name in this.regions) {
            this.scrollContainer.contentElement.appendChild(this.regions[name].element);
        }
        
        // Calculate separator positions.
        this._updateSeparators();
    },
    
    /**
     * Determines the width of the specified column.
     * 
     * @param column the column index
     * @return the pixel width
     * @type Number
     */
    _getColumnWidth: function(column) {
        return 80; //FIXME
    },
    
    /**
     * Creates or retrieves the prototype table, consisting of a TABLE element with a single TBODY as its child.
     * 
     * @return the prototype table
     * @type Element
     */
    getPrototypeTable: function() {
        if (!this._prototypeTable) {
            this._prototypeTable = document.createElement("table");
            this._prototypeTable.cellPadding = this._prototypeTable.cellSpacing = 0;
            this._prototypeTable.style.cssText = "table-layout:fixed;padding:0;border:0px none;";
            var tbody = document.createElement("tbody");
            this._prototypeTable.appendChild(tbody);
        }
        return this._prototypeTable;
    },
    
    /**
     * Determines the height of the specified row.
     * 
     * @param row the row index
     * @return the pixel width
     * @type Number
     */
    _getRowHeight: function(row) {
        return 19; //FIXME, manually set to approximate value until measuring code in place.
    },

    _loadProperties: function() {
        this._cellBorder = this.component.render("cellBorder");
        this._cellBorderHeightPx = Echo.Sync.Border.getPixelSize(this._cellBorder, "top") +
                Echo.Sync.Border.getPixelSize(this._cellBorder, "bottom");
        this._cellBorderWidthPx = Echo.Sync.Border.getPixelSize(this._cellBorder, "left") +
                Echo.Sync.Border.getPixelSize(this._cellBorder, "right");
        this._model = this.component.get("model");
        this.scrollPosition.load(this.component);
        this.fixedCells = {
            left: parseInt(this.component.render("fixedColumnsLeft", 0), 10),
            top: parseInt(this.component.render("fixedRowsTop", 0), 10),
            right: parseInt(this.component.render("fixedColumnsRight", 0), 10),
            bottom: parseInt(this.component.render("fixedRowsBottom", 0), 10)
        };
    },
    
    _processScroll: function(e) {
        if (e.incremental) {
            if (e.verticalIncrement) {
                this._scrollIncremental(e.verticalIncrement, false);
            } else if (e.horizontalIncrement) {
                this._scrollIncremental(e.horizontalIncrement, true);
            }
        } else {
            this.scrollPosition.setScroll(e.horizontal == null ? null : e.horizontal, 
                    e.vertical == null ? null : e.vertical);
            this.scrollPosition.store(this.component);
            
            for (var name in this.regions) {
                if ((e.horizontal && this.regions[name].location.h === 0) ||
                        (e.vertical && this.regions[name].location.v === 0)) {
                    this.regions[name].renderTiles();
                }
            }
            this.scrollContainer.setPosition(this.scrollPosition.xScroll, this.scrollPosition.yScroll);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._div = document.createElement("div");
        this._div.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;";
        this._div.id = this.component.renderId;
        
        this.measureDiv = document.createElement("div");
        this.measureDiv.style.cssText = "position:absolute;top:0;width:1600px;height:1200px;left:-1600px;overflow:hidden;";
        this._div.appendChild(this.measureDiv);
        
        this.scrollContainer = new Extras.Sync.DataGrid.ScrollContainer();
        this.scrollContainer.configure(10, 10);
        this.scrollContainer.onScroll = Core.method(this, this._processScroll);
        this._div.appendChild(this.scrollContainer.rootElement);
        
        this._loadProperties();
        this._fullRenderRequired = true;

        parentElement.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this._div);
        this.scrollContainer.renderDisplay();
        
        if (this._fullRenderRequired) {
            if (this._model == null) {
                this.size = { columns: 0, rows: 0 };
                this.scrollSize = { columns: 0, rows: 0 };
            } else {
                this.size = {
                    columns: this._model.getColumnCount(),
                    rows: this._model.getRowCount()
                };
                this.scrollSize = {
                    columns: this.size.columns - this.fixedCells.left - this.fixedCells.right,
                    rows: this.size.rows - this.fixedCells.top - this.fixedCells.bottom
                };
            }
            
            this._createRegions();
            
            if (this._model) {
                this.renderRegionTiles();
            }
            this._fullRenderRequired = false;
        }

        this._updateSeparators();
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._cachedTileRows = { };
        this._prototypeTable = null;
        this.regions = null;
        this._div = null;
        this.measureDiv = null;
    },

    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    },
    
    /**
     * Scrolls the viewable area horizontally or vertically by a percentage of the viewable area width/height.
     */
    _scrollIncremental: function(percent, horizontal) {
        var scrollPixels = Math.round((horizontal ? this.scrollContainer.bounds.width : this.scrollContainer.bounds.height) * 
                percent / 10);
        this.adjustPositionPx(0 - scrollPixels, horizontal);
    },
    
    /**
     */
    renderRegionTiles: function() {
        for (var name in this.regions) {
            this.regions[name].renderTiles();
        }
        this.scrollContainer.setPosition(this.scrollPosition.xScroll, this.scrollPosition.yScroll);
    },
    
    /**
     * Updates the horizontal position of the scroll container based on the <code>visibleRange</code> property.
     */
    _updateScrollContainerX: function() {
        var x = 0;
        if (this.visibleRange.left != null && this.visibleRange.right != null) {
            x = 100 * (this.visibleRange.left + this.visibleRange.right) / 2 / this.size.columns;
        } else if (this.visibleRange.left != null) {
            x = 100 * this.visibleRange.left / this.size.columns;
        }
        this.scrollContainer.setPosition(x, null);
    },
    
    /**
     * Updates the vertical position of the scroll container based on the <code>visibleRange</code> property.
     */
    _updateScrollContainerY: function() {
        var y = 0;
        if (this.visibleRange.top != null && this.visibleRange.bottom != null) {
            y = 100 * (this.visibleRange.top + this.visibleRange.bottom) / 2 / this.size.rows;
        } else if (this.visibleRange.top != null) {
            y = 100 * this.visibleRange.top / this.size.rows;
        }
        this.scrollContainer.setPosition(null, y);
    },

    /**
     * Updates the positions of region separators, storing left/top/right/bottom pixel position values in 
     * the <code>separatorPx</code> property.
     * Notifies regions of the update.
     */
    _updateSeparators: function() {
        var i, name;
        this.separatorPx = { left: 0, top: 0, right: 0, bottom: 0 };
        
        if (this.fixedCells.top) {
            for (i = 0; i < this.fixedCells.top; ++i) {
                this.separatorPx.top += this._getRowHeight(i);
            }
        }

        if (this.fixedCells.bottom) {
            for (i = 0; i < this.fixedCells.bottom; ++i) {
                this.separatorPx.bottom += this._getRowHeight(this.size.rows - i - 1);
            }
        }

        if (this.fixedCells.left) {
            for (i = 0; i < this.fixedCells.left; ++i) {
                this.separatorPx.left += this._getColumnWidth(i);
            }
        }
        
        if (this.fixedCells.right) {
            for (i = 0; i < this.fixedCells.right; ++i) {
                this.separatorPx.right += this._getColumnWidth(this.size.columns - i - 1);
            }
        }
        
        for (name in this.regions) {
            this.regions[name].notifySeparatorUpdate();
        }
    },
    
    /**
     * Updates the <code>visibleRange.left</code> and <code>visibleRange.right</code> properties based on the displayed
     * position of the center region.
     */
    updateVisibleRangeX: function() {
        var borderTiles = this.regions.center.getBorderTilesX(), columns;
        
        if (borderTiles.left) {
            columns = borderTiles.left.cellIndex.right - borderTiles.left.cellIndex.left + 1;
            this.visibleRange.left = borderTiles.left.cellIndex.left + 
                    columns * (0 - borderTiles.left.positionPx.left) / borderTiles.left.positionPx.width;
        } else {
            this.visibleRange.left = null;
        }
        
        if (borderTiles.right) {
            columns = borderTiles.right.cellIndex.right - borderTiles.right.cellIndex.left + 1;
            this.visibleRange.right = 1 + borderTiles.right.cellIndex.right - 
                    columns * (borderTiles.right.positionPx.left + borderTiles.right.positionPx.width - 
                    this.regions.center.bounds.width) / borderTiles.right.positionPx.width;
        } else {
            this.visibleRange.right = null;
        }
    },
    
    /**
     * Updates the <code>visibleRange.top</code> and <code>visibleRange.bottom</code> properties based on the displayed
     * position of the center region.
     */
    updateVisibleRangeY: function() {
        var borderTiles = this.regions.center.getBorderTilesY(), rows;
        if (borderTiles.top) {
            rows = borderTiles.top.cellIndex.bottom - borderTiles.top.cellIndex.top + 1;
            this.visibleRange.top = borderTiles.top.cellIndex.top + 
                    rows * (0 - borderTiles.top.positionPx.top) / borderTiles.top.positionPx.height;
            this.overscroll.top = null;
        } else {
            this.visibleRange.top = null;
            this.overscroll.top = borderTiles.topPx;
        }
        
        if (borderTiles.bottom) {
            rows = borderTiles.bottom.cellIndex.bottom - borderTiles.bottom.cellIndex.top + 1;
            this.visibleRange.bottom = 1 + borderTiles.bottom.cellIndex.bottom - 
                    rows * (borderTiles.bottom.positionPx.top + borderTiles.bottom.positionPx.height - 
                    this.regions.center.bounds.height) / borderTiles.bottom.positionPx.height;
            this.overscroll.bottom = null;
        } else {
            this.visibleRange.bottom = null;
            this.overscroll.bottom = borderTiles.bottomPx;
        }
    }
});

/**
 * Renders a scrolling container for the DataGrid, processing scroll events and managing scroll bar positions.
 * Features an "accumulator" so as not to fire events overly frequently, e.g., mousewheel scrolling must stop for a (very) 
 * brief period of time before a scroll event is fired.
 */
Extras.Sync.DataGrid.ScrollContainer = Core.extend({

    _hScrollAccumulator: 0,
    _vScrollAccumulator: 0,
    
    bounds: null,

    rootElement: null,
    contentElement: null,
    _lastScrollSetTime: 0,
    
    size: 5,
    
    /**
     * Horizontal scroll position, a value between 0 and 100.
     * @type Number
     */
    scrollX: 0,

    /**
     * Vertical scroll position, a value between 0 and 100.
     * @type Number
     */
    scrollY: 0,
    
    /**
     * Singleton listener to invoke when scroll position changes.
     * @type Function
     */
    onScroll: null,

    /**
     * Creates a ScrollContainer.  The dispose() method should be invoked when the ScrollContainer will no longer be used.
     *
     * @param horizontal
     * @param vertical
     */
    $construct: function(horizontal, vertical) {
        this.rootElement = document.createElement("div");
        this.rootElement.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;";
        
        this._vScrollContainer = document.createElement("div");
        this._vScrollContainer.style.cssText = "position:absolute;top:0;bottom:0;right:0;overflow:scroll;";
        this._vScrollContainer.style.width = (1 + Core.Web.Measure.SCROLL_WIDTH) + "px";
        this._vScrollContent = document.createElement("div");
        this._vScrollContent.style.cssText = "width:1px;height:" + (this.size * 100) + "%;";
        this._vScrollContainer.appendChild(this._vScrollContent);
        this.rootElement.appendChild(this._vScrollContainer);
        
        this._hScrollContainer = document.createElement("div");
        this._hScrollContainer.style.cssText = "position:absolute;bottom:0;left:0;right:0;overflow:scroll;";
        this._hScrollContainer.style.height = (1 + Core.Web.Measure.SCROLL_HEIGHT) + "px";
        this._hScrollContent = document.createElement("div");
        this._hScrollContent.style.cssText = "height:1px;width:" + (this.size * 100) + "%;";
        this._hScrollContainer.appendChild(this._hScrollContent);
        this.rootElement.appendChild(this._hScrollContainer);
        
        this.contentElement = document.createElement("div");
        this.contentElement.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;background:white;";
        this.rootElement.appendChild(this.contentElement);
        
        Core.Web.Event.add(this._vScrollContainer, "scroll", Core.method(this, this._processScrollV), true);
        Core.Web.Event.add(this._hScrollContainer, "scroll", Core.method(this, this._processScrollH), true);
        Core.Web.Event.add(this.rootElement, Core.Web.Env.BROWSER_MOZILLA ? "DOMMouseScroll" :  "mousewheel",
                Core.method(this, this._processWheel), true);
    },
    
    _accumulatedScroll: function() {
        if (this._vScrollAccumulator || this._hScrollAccumulator) {
            var v = this._vScrollAccumulator;
            this._vScrollAccumulator = 0;
            var h = this._hScrollAccumulator;
            this._hScrollAccumulator = 0;
            if (this.onScroll) {
                // FIXME
                this.onScroll({source: this, type: "scroll", incremental: true, horizontalIncrement: h, verticalIncrement:  v });
            }
        }
    },
    
    configure: function(horizontal, vertical) {
        if (horizontal > 1) {
            this._vScrollContainer.style.bottom = this.contentElement.style.bottom = Core.Web.Measure.SCROLL_HEIGHT + "px";
        } else {
            this._vScrollContainer.style.bottom = this.contentElement.style.bottom = 0;
        }
        if (vertical > 1) {
            this._hScrollContainer.style.right = this.contentElement.style.right = Core.Web.Measure.SCROLL_WIDTH + "px";
        } else {
            this._hScrollContainer.style.right = this.contentElement.style.right = 0;
        }
    },
    
    /**
     * Disposes of the ScrollContainer, releasing any resources in use.
     */
    dispose: function() {
        Core.Web.Event.removeAll(this._hScrollContainer);
        Core.Web.Event.removeAll(this._vScrollContainer);
        Core.Web.Event.removeAll(this.rootElement);
    
        this.rootElement = null;
        this.contentElement = null;
    },
    
    /**
     * Determines if a just-received scroll event is the result of a user adjusting a scroll bar or a result of the
     * scroll bar having been adjusted programmatically.  
     */
    _isUserScroll: function() {
        //FIXME this is not going to work.
        return (new Date().getTime() - this._lastScrollSetTime) > 400; 
    },
    
    /**
     * Process a horizontal scroll bar drag adjustment event.
     *
     * @param e the event
     */
    _processScrollH: function(e) {
        if (!this._isUserScroll()) {
            return;
        }

        this.scrollX = 100 * this._hScrollContainer.scrollLeft / ((this.size - 1) * this.bounds.width);
        
        if (this.onScroll) {
            this.onScroll({source: this, type: "scroll", incremental: false,  horizontal: this.scrollX });
        }
    },
    
    /**
     * Process a vertical scroll bar drag adjustment event.
     *
     * @param e the event
     */
    _processScrollV: function(e) {
        if (!this._isUserScroll()) {
            return;
        }
        
        this.scrollY = 100 * this._vScrollContainer.scrollTop / ((this.size - 1) * this.bounds.height);
        
        if (this.onScroll) {
            this.onScroll({source: this, type: "scroll", incremental: false,  vertical: this.scrollY });
        }
    },
    
    /**
     * Processes a scroll wheel event.
     *
     * @param e the event
     */
    _processWheel: function(e) {
        // Convert scroll wheel direction/distance data into uniform/cross-browser format:
        // A value of 1 indicates one notch scroll down, -1 indicates one notch scroll up.
        var wheelScroll;
        if (e.wheelDelta) {
            wheelScroll = e.wheelDelta / -120;
        } else if (e.detail) {
            wheelScroll = e.detail / 3;
        } else {
            return;
        }
        
        if (e.shiftKey) {
            // Scroll horizontally.
            this._hScrollAccumulator += wheelScroll;
        } else {
            // Scroll vertically.
            this._vScrollAccumulator += wheelScroll;
        }
        Core.Web.Scheduler.run(Core.method(this, this._accumulatedScroll), 10);
        
        // Prevent default scrolling action, or in the case of modifier keys, font adjustments, etc.
        Core.Web.DOM.preventEventDefault(e);
        
        return true;
    },
    
    /**
     * Executes operations which should be performed when the containing component synchronize peer's <code>renderDisplay</code>
     * method is invoked.
     */
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this.rootElement);
        Core.Web.VirtualPosition.redraw(this.contentElement);
        Core.Web.VirtualPosition.redraw(this._hScrollContainer);
        Core.Web.VirtualPosition.redraw(this._vScrollContainer);
        
        this.bounds = new Core.Web.Measure.Bounds(this.contentElement);
        this._scrollHeight = new Core.Web.Measure.Bounds(this._hScrollContent).height;
        this._scrollWidth = new Core.Web.Measure.Bounds(this._vScrollContent).width;
    },
    
    setPosition: function(scrollX, scrollY) {
        this._lastScrollSetTime = new Date().getTime();
        if (scrollX != null) {
            this.scrollX = scrollX;
            this._hScrollContainer.scrollLeft = this.scrollX / 100 * ((this.size - 1) * this.bounds.width);
        }
        if (scrollY != null) {
            this.scrollY = scrollY;
            this._vScrollContainer.scrollTop = this.scrollY / 100 * ((this.size - 1) * this.bounds.height);
        }
    }
});

/**
 * Component rendering peer: DragSource.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.DragSource = Core.extend(Echo.Render.ComponentSync, {
    
    $load: function() {
        Echo.Render.registerPeer("Extras.DragSource", this);
    },
    
    /**
     * The dragging element.  This element is created by cloning the rendered DIV (and its descendants), reducing their
     * opacity, and then absolutely positioning it adjacent the mouse cursor position.
     * @type Element
     */
    _dragDiv: null,
    
    /**
     * Rendered DIV element.
     * @type Element 
     */
    _div: null,
    
    /**
     * Overlay DIV which covers other elements (such as IFRAMEs) when dragging which may otherwise suppress events.
     * @type Element
     */
    _overlayDiv: null,
    
    /**
     * Method reference to <code>_processMouseMove()</code>.
     * @type Function
     */
    _processMouseMoveRef: null,

    /**
     * Method reference to <code>_processMouseUp()</code>.
     * @type Function
     */
    _processMouseUpRef: null,

    /**
     * Constructor.
     */
    $construct: function() {
        this._processMouseMoveRef = Core.method(this, this._processMouseMove);
        this._processMouseUpRef = Core.method(this, this._processMouseUp);
    },
    
    /**
     * Prepare for a drag operation, register move/up listeners.
     * 
     * @param e the relevant mouse down event which started the drag operation
     */
    _dragPreStart: function(e) {
        this._dragStop();

        Core.Web.Event.add(document.body, "mousemove", this._processMouseMoveRef, true);
        Core.Web.Event.add(document.body, "mouseup", this._processMouseUpRef, true);
    },
    
    /**
     * Mouse has moved since drag operation was prepared, draw overlay DIV, create clone of
     * dragged item.
     * 
     * @param e the relevant mouse move event
     */
    _dragMoveStart: function(e) {
        this._overlayDiv = document.createElement("div");
        this._overlayDiv.style.cssText = "position:absolute;z-index:30000;width:100%;height:100%;cursor:pointer;";
        Echo.Sync.FillImage.render(this.client.getResourceUrl("Echo", "resource/Transparent.gif"), this._overlayDiv);

        this._dragDiv = this._div.cloneNode(true);
        this._dragDiv.style.position = "absolute";
        this._setDragOpacity(0.75);
        this._overlayDiv.appendChild(this._dragDiv);

        document.body.appendChild(this._overlayDiv);
    },
    
    /**
     * Performs a drop operation.
     * 
     * @param e the relevant mouse up event describing where the dragged item was dropped
     */
    _dragDrop: function(e) {
        var i,
            specificTarget = null,
            dropTarget, 
            testTarget,
            dropTargetIds,
            targetElement = this._findElement(this.client.domainElement, e.clientX, e.clientY);
        
        // Find specific target component.
        while (!specificTarget && targetElement && targetElement != this.client.domainElement) {
            if (targetElement.id) {
                specificTarget = this.client.application.getComponentByRenderId(targetElement.id);
            }
            targetElement = targetElement.parentNode;
        }
        
        // Return if specific target component could not be found.
        if (!specificTarget) {
            return;
        }

        // Retrieve valid drop target renderIds from component.
        dropTargetIds = this.component.get("dropTargetIds");
        if (!dropTargetIds) {
            dropTargetIds = [];
        }
        
        // Find actual drop target.
        testTarget = specificTarget;
        while (testTarget && !dropTarget) {
            for (i = 0; i < dropTargetIds.length; ++i) {
                if (dropTargetIds[i] == testTarget.renderId) {
                    // Drop target found.
                    dropTarget = testTarget;
                    break;
                }
            }
            testTarget = testTarget.parent;
        }
        
        // Return immediately if target is not a descendent of a drop target.
        if (!dropTarget) {
            return;
        }
        
        this.component.doDrop(dropTarget.renderId, specificTarget.renderId);
    },
    
    /**
     * Stop a drag operation.
     */
    _dragStop: function() {
        Core.Web.Event.remove(document.body, "mousemove", this._processMouseMoveRef, true);
        Core.Web.Event.remove(document.body, "mouseup", this._processMouseUpRef, true);

        if (this._overlayDiv) {
            document.body.removeChild(this._overlayDiv);
            this._overlayDiv = null;
        }
        this._dragDiv = null;
    },
    
    /**
     * Updates the position of the dragged object in response to mouse movement.
     * 
     * @param e the relevant mouse move event which necessitated the drag update
     */
    _dragUpdate: function(e) {
        this._dragDiv.style.top = e.clientY + "px";
        this._dragDiv.style.left = e.clientX + "px";
    },
    
    /**
     * Finds the highest-level (z-index) element at the specified x/y coordinate.
     * 
     * @param {Element} searchElement the element at which to begin searching
     * @param {Number} x the x coordinate
     * @param {Number} y the y coordinate
     * @return the element
     * @type Element
     */
    _findElement: function(searchElement, x, y) {
        if (searchElement.style.display == "none") {
            // Not displayed.
            return null;
        }

        if (searchElement.style.visibility == "hidden") {
            // Not visible.
            return null;
        }
        
        if (searchElement.nodeName && searchElement.nodeName.toLowerCase() == "colgroup") {
            // Ignore colgroups.
            return null;
        }

        var searchElementIsCandidate = false;
        if (!(searchElement.nodeName && searchElement.nodeName.toLowerCase() == "tr")) {
            var bounds = new Core.Web.Measure.Bounds(searchElement);
            if (this._isBoundsDefined(bounds)) {
                // Only take action if bounds is defined, as elements without positioning can contain positioned elements.
            
                if (this._isInBounds(bounds, x, y)) {
                    // Mark search element as being in candidate.
                    // This flag will be used to ensure that elements with undefined bounds are not returned as candidate.
                    // In any case, it is necessary to continue to search them for children that might be candidates though.
                    searchElementIsCandidate = true;
                } else {
                    // Out of bounds.
                    return null;
                }
            }
        }
        
        var candidates = null;

        // At this point, element is still a candidate.  Now we look for child elements with greater specificity.
        for (var i = 0; i < searchElement.childNodes.length; ++i) {
            if (searchElement.childNodes[i].nodeType != 1) {
                continue;
            }
            
            var resultElement = this._findElement(searchElement.childNodes[i], x, y);
            if (resultElement) {
                if (candidates == null) {
                    candidates = [];
                }
                candidates.push(resultElement);
            }
        }
        
        if (candidates != null) {
            if (candidates.length == 1) {
                return candidates[0];
            } else {
                return this._findHighestCandidate(searchElement, candidates);
            }
        }
        
        // The 'searchElement' is the best candidate found.  Return it only in the case where its bounds are actually defined.
        return searchElementIsCandidate ? searchElement : null;
    },
    
    /**
     * Determine which element amongst candidates is displayed above others (based on z-index).
     * 
     * @param {Element} searchElement the highest-level element from which all candidate elements descend
     * @param {Array} candidates an array of candidate elements to test
     * @return the highest candidate element
     * @type Element
     */
    _findHighestCandidate: function(parentElement, candidates) {
        var candidatePaths = [];
        var iCandidate;
        for (iCandidate = 0; iCandidate < candidates.length; ++iCandidate) {
            candidatePaths[iCandidate] = [];
            var element = candidates[iCandidate];
            do {
                if (element.style.zIndex) {
                    candidatePaths[iCandidate].unshift(element.style.zIndex);
                }
                element = element.parentNode;
            } while (element != parentElement);
        }
        
        var elementIndex = 0;
        var elementsFoundOnIteration;
        do {
            elementsFoundOnIteration = false;
            var highestZIndex = 0;
            var highestCandidateIndices = [];
            for (iCandidate = 0; iCandidate < candidatePaths.length; ++iCandidate) {
                if (elementIndex < candidatePaths[iCandidate].length) {
                    var zIndex = candidatePaths[iCandidate][elementIndex];
                    if (zIndex && zIndex > 0 && zIndex >= highestZIndex) {
                        if (zIndex == highestZIndex) {
                            // Value is equal to previous highest found, add to list of highest.
                            highestCandidateIndices.push(iCandidate);
                        } else {
                            // Value is greater than highest found, clear list of highest and add.
                            highestCandidateIndices = [];
                            highestCandidateIndices.push(iCandidate);
                            highestZIndex = zIndex;
                        }
                    }
                    elementsFoundOnIteration = true;
                }
            }
            
            if (highestCandidateIndices.length == 1) {
                // Only one candidate remains: return it.
                return candidates[highestCandidateIndices[0]];
            } else if (highestCandidateIndices.length > 0) {
                // Remove candidates that are now longer in contention.
                var remainingCandidates = [];
                for (var i = 0; i < highestCandidateIndices.length; ++i) {
                    remainingCandidates[i] = candidates[highestCandidateIndices[i]];
                }
                candidates = remainingCandidates;
            }
            ++elementIndex;
        } while (elementsFoundOnIteration);
        
        return candidates[candidates.length - 1];
    },
    
    /**
     * Determines if the specified bounding area is defined (has contained pixels).
     * 
     * @param {Core.Web.Measure.Bounds} bounds the bounding region
     * @return true if the bounds has a defined, nonzero area
     * @type Boolean
     */
    _isBoundsDefined: function(bounds) {
        return bounds.width !== 0 && bounds.height !== 0;
    },

    /**
     * Determines if a point is within a bounding region.
     * 
     * @param {Core.Web.Measure.Bounds} bounds the bounding region
     * @param {Number} x the horizontal coordinate of the point
     * @param {Number} y the vertical coordinate of the point
     * @return true if the point is in the bounding region
     * @type Boolean
     */
    _isInBounds: function(bounds, x, y) {
        return x >= bounds.left && y >= bounds.top && x <= bounds.left + bounds.width && y <= bounds.top + bounds.height;
    },

    /**
     * Processes a mouse down event on the drag source container element.
     * 
     * @param e the event
     */
    _processMouseDown: function(e) {
        Core.Web.DOM.preventEventDefault(e);

        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        
        this._dragPreStart(e);
    },
    
    /**
     * Processes a mouse move event (on the overlay DIV).
     * 
     * @param e the event
     */
    _processMouseMove: function(e) {
        Core.Web.DOM.preventEventDefault(e);
        if (!this._dragDiv) {
            this._dragMoveStart();
        }
        this._dragUpdate(e);
    },
    
    /**
     * Processes a mouse up event (on the overlay DIV).
     * 
     * @param e the event
     */
    _processMouseUp: function(e) {
        var inProgress = !!this._dragDiv;
        if (inProgress) {
            Core.Web.DOM.preventEventDefault(e);
        }
        this._dragStop();
        if (inProgress) {
            this._dragDrop(e);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        this._div.style.cssText = "cursor:pointer;";
        if (this.component.children.length > 0) {
            Echo.Render.renderComponentAdd(update, this.component.children[0], this._div);
        }

        Core.Web.Event.add(this._div, "mousedown", Core.method(this, this._processMouseDown), true);
        
        parentElement.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._dragStop();
        Core.Web.Event.removeAll(this._div);

        this._dragDiv = null;
        this._div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
    },
    
    /**
     * Sets the opacity of the dragged item.
     * 
     * @param value the new opacity
     */
    _setDragOpacity: function(value) {
        if (Core.Web.Env.NOT_SUPPORTED_CSS_OPACITY) {
            if (Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
                this._dragDiv.style.filter = "alpha(opacity=" + (value * 100) + ")";
            }
        } else {
            this._dragDiv.style.opacity = value;
        }
    }
});
Extras.Sync.FlowViewer = Core.extend(Echo.Render.ComponentSync, { 
    
    $static: {
        DOUBLE_CLICK_TIME: 500
    },
    
    $load: function() {
        Echo.Render.registerPeer("Extras.FlowViewer", this);
    },

    /**
     * The desired first displayed row position.  This value is not a row index, but a possibly fractional value
     * denoting the row position at the very top of the viewing area.  For example, if half of the second
     * row were visible at the top, then _position would be 1.5. 
     */
    _position: 0,

    /**
     * The currently rendered first displayed row position.
     */
    _renderedPosition: 0,
    
    _columnsRendered: false,

    $construct: function() {
        this._updateListenerRef = Core.method(this, this._updateListener);
    },
    
    _clearContent: function() {
        this._columnsRendered = false;
        while (this._flowDiv.firstChild) {
            this._flowDiv.removeChild(this._flowDiv.firstChild);
        }
    },

    _createProtoCell: function() {
        this._protoCell = document.createElement("div");
        this._protoCell.style.cssText = "overflow:hidden;";
        this._protoCell.style.height = this._cellSize.height + "px";
        this._protoCell.style.width = this._cellSize.width + "px";
    },
    
    _getIndexFromNode: function(node) {
        var x, y;
        var testNode;
        var columnContentDiv;
        var columnDiv;
        
        // Find containing column content div.
        testNode = node;
        while (testNode && testNode.parentNode !== this._flowDiv) {
            testNode = testNode.parentNode;
        }
        if (!testNode) {
            return -1;
        }
        columnDiv = testNode;
        
        // Determine containing column index.
        x = 0;
        testNode = columnDiv.parentNode.firstChild;
        while (testNode) {
            if (testNode == columnDiv) {
                break;
            }
            ++x;
            testNode = testNode.nextSibling;
        }
        if (!testNode) {
            return -1;
        }
        
        // Move node reference to  child of column content div. 
        columnContentDiv = columnDiv.firstChild;
        while (node && node.parentNode !== columnContentDiv) {
            node = node.parentNode;
        }
        if (!node) {
            return -1;
        }
        
        testNode = columnContentDiv.firstChild;
        y = 0;
        while (testNode) {
            if (testNode === node) {
                var index = (y + this._renderedStartRow) * this._columnCount + x;
                return index < this._model.size() ? index : -1;
            }
            testNode = testNode.nextSibling;
            ++y; 
        }

        return -1;
    },
    
    _processClick: function(e, contextClick) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }

        var index = this._getIndexFromNode(e.target);
        if (index === -1) {
            return;
        }
        
        var time = new Date().getTime();
        if (!contextClick && this._lastClickIndex == index && 
                time - this._lastClickTime < Extras.Sync.FlowViewer.DOUBLE_CLICK_TIME) {
            this._processDoubleClick(e);
            return;
        }
        
        this._lastClickIndex = index;
        this._lastClickTime = new Date().getTime();

        if (e.ctrlKey || e.metaKey || e.altKey) {
            var selection = this.component.get("selection") || {};
            if (!contextClick && selection[index]) {
                delete selection[index];
            } else {
                selection[index] = true;
            }
            this.component.set("selection", null, true);
            this.component.set("selection", selection, true);
            this._setHighlight(index, true);
        } else {
            var oldSelection = this.component.get("selection") || {};

            selection = { };
            selection[index] = true;
            this.component.set("selection", selection, true);
            
            for (var selectedIndex in oldSelection) {
                if (selectedIndex !== index) {
                    this._setHighlight(selectedIndex, false);
                }
            }
            
            this._setHighlight(index, true);
        }
    },
    
    _processContextMenu: function(e) {
        this._processClick(e, true);
        return true;
    },
    
    _processDoubleClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }

        var index = this._getIndexFromNode(e.target);
        if (index !== -1) {
            this.component.doAction(index);
        }
    },
    
    _processScroll: function(e) {
        this._setPosition(e.row);
    },
    
    renderAdd: function(update, parentElement) {
        this._columnsRendered = false;
        
        this._model = this.component.get("model") || new Extras.Viewer.NullModel();
        this._model.addUpdateListener(this._updateListenerRef);

        this._renderer = this.component.get("renderer") || new Extras.Sync.FlowViewer.NullRenderer();
        var cellSize = this._renderer.getCellSize();
        this._cellSize = { width: cellSize.width || 100, height: cellSize.height || 100 }; 

        this._createProtoCell();

        this._div = document.createElement("div");
        this._div.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;";

        this._scrollContainer = new Extras.Sync.Viewer.ScrollContainer(this.client, this.component, this._model.size(), 
                this._cellSize.height);
        this._scrollContainer.onScroll = Core.method(this, this._processScroll);
        this._div.appendChild(this._scrollContainer.rootElement);
        
        this._flowDiv = document.createElement("div");
        this._flowDiv.style.cssText = "position:absolute;left:0;top:0;bottom:0;right:0;cursor:pointer;";
        Echo.Sync.Color.renderFB(this.component, this._flowDiv);
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), this._flowDiv);
        this._scrollContainer.contentElement.appendChild(this._flowDiv);
        
        parentElement.appendChild(this._div);
        
        Core.Web.Event.add(this._div, "contextmenu", Core.method(this, this._processContextMenu), false);
        Core.Web.Event.add(this._div, "mouseup", Core.method(this, this._processClick), false);
        Core.Web.Event.Selection.disable(this._div);
    },
    
    _renderCellsFull: function() {
        var x, y, contentDiv, cellDiv, cellDivs, index, columnContentDiv,
            size = this._model.size();
        var selection = this.component.get("selection") || {};
        
        this._renderedPosition = this._position;
        this._renderedStartRow = Math.floor(this._position);
        this._renderedEndRow = Math.min(this._rowCount, 
                Math.ceil(1 + this._renderedStartRow + this._flowBounds.height / this._cellSize.height));
               
        var topPosition = 0 - Math.floor((this._position - Math.floor(this._position)) * this._cellSize.height);
        
        contentDiv = document.createElement("div");
        for (y = this._renderedStartRow; y < this._renderedEndRow; ++y) {
            cellDiv = this._protoCell.cloneNode(false);
            contentDiv.appendChild(cellDiv);
        }

        cellDivs = [];
        for (x = 0; x < this._columnDivs.length; ++x) {
            columnContentDiv = contentDiv.cloneNode(true);
            cellDivs.push(columnContentDiv.firstChild);
            this._columnDivs[x].appendChild(columnContentDiv);
            this._columnDivs[x].style.top = topPosition + "px";
        }
        
        this._model.fetch(this._renderedStartRow * this._columnCount, this._renderedEndRow * this._columnCount);
        
        for (y = this._renderedStartRow; y < this._renderedEndRow; ++y) {
            for (x = 0; x < this._columnCount; ++x) {
                index = y * this._columnCount + x;
                if (index < size) {
                    this._renderer.render(this.component, this._model.get(index), index, cellDivs[x], 
                            { selected: selection[index] });
                }
                cellDivs[x] = cellDivs[x].nextSibling;
            }
        }
    },
    
    _renderCellsIncremental: function(up) {
        var newStartRow = Math.floor(this._position);
        var newEndRow = Math.min(this._rowCount, Math.ceil(newStartRow + this._flowBounds.height / this._cellSize.height + 1));
        var topPosition = 0 - Math.floor((this._position - Math.floor(this._position)) * this._cellSize.height);
        var rowsToRemove, rowsToAdd, contentDiv, cellDiv, x, y, index;
        var size = this._model.size();
        var selection = this.component.get("selection") || {};

        this._renderedPosition = this._position;
        
        this._model.fetch(newStartRow * this._columnCount, newEndRow * this._columnCount);

        for (x = 0; x < this._columnDivs.length; ++x) {
            this._columnDivs[x].style.top = topPosition + "px";
            Core.Web.VirtualPosition.redraw(this._columnDivs[x]);
        }
        
        if (up) {
            rowsToRemove = this._renderedEndRow - newEndRow;
            rowsToAdd = this._renderedStartRow - newStartRow;

            for (y = 0; y < rowsToRemove; ++y) {
                for (x = 0; x < this._columnDivs.length; ++x) {
                    contentDiv = this._columnDivs[x].firstChild;
                    if (contentDiv.lastChild) {
                        contentDiv.removeChild(contentDiv.lastChild);
                    }
                }
            }
            
            for (y = this._renderedStartRow - 1; y >= newStartRow; --y) {
                for (x = 0; x < this._columnDivs.length; ++x) {
                    index = y * this._columnCount + x;
                    contentDiv = this._columnDivs[x].firstChild;
                    cellDiv = this._protoCell.cloneNode(false);
                    contentDiv.insertBefore(cellDiv, contentDiv.firstChild);
                    if (index < size) {
                        this._renderer.render(this.component, this._model.get(index), index, cellDiv, 
                                { selected: selection[index] });
                    }
                }
            }
        } else {
            rowsToRemove = newStartRow - this._renderedStartRow;
            rowsToAdd = newEndRow - this._renderedEndRow;

            for (y = 0; y < rowsToRemove; ++y) {
                for (x = 0; x < this._columnDivs.length; ++x) {
                    contentDiv = this._columnDivs[x].firstChild;
                    if (contentDiv.firstChild) {
                        contentDiv.removeChild(contentDiv.firstChild);
                    }
                }
            }
            
            for (y = this._renderedEndRow; y < newEndRow; ++y) {
                for (x = 0; x < this._columnDivs.length; ++x) {
                    index = y * this._columnCount + x;
                    contentDiv = this._columnDivs[x].firstChild;
                    cellDiv = this._protoCell.cloneNode(false);
                    contentDiv.appendChild(cellDiv);
                    if (index < size) {
                        this._renderer.render(this.component, this._model.get(index), index, cellDiv, 
                                { selected: selection[index] });
                    }
                }
            }
        }

        this._renderedStartRow = newStartRow;
        this._renderedEndRow = newEndRow;
    },
    
    _renderCellsUpdate: function() {
        if (this._position === this._renderedPosition) {
            return;
        }
        
        var incremental = Math.abs(this._renderedPosition - this._position) < 
                (0.75 * this._flowBounds.height / this._cellSize.height);
        
        if (incremental) {
            this._renderCellsIncremental(this._position < this._renderedPosition);
        } else {
            this._clearContent();
            this._renderColumns();
            this._renderCellsFull();
        }
    },

    _renderColumns: function() {
        if (this._columnsRendered) {
            return;
        }
        
        this._columnDivs = [];
        var position = Math.max(0, Math.floor((this._flowBounds.width - this._columnCount * this._cellSize.width) / 2));
        for (var i = 0; i < this._columnCount; ++i) {
            this._columnDivs[i] = document.createElement("div");
            this._columnDivs[i].style.cssText = "position:absolute;top:0;bottom:0;overflow:hidden;";
            this._columnDivs[i].style.width = this._cellSize.width + "px";
            this._columnDivs[i].style.left = position + "px";
            this._flowDiv.appendChild(this._columnDivs[i]);
            position += this._cellSize.width;
            Core.Web.VirtualPosition.redraw(this._columnDivs[i]);
        }
        this._columnsRendered = true;
    },
    
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this._div);
        Core.Web.VirtualPosition.redraw(this._flowDiv);
        
        var oldBounds = this._bounds || {};
        var newBounds = new Core.Web.Measure.Bounds(this._div);
        this._bounds = newBounds;
        
        var size = this._model.size();
        
        this._columnCount = Math.max(1, Math.floor((newBounds.width - Core.Web.Measure.SCROLL_WIDTH) / this._cellSize.width));
        this._rowCount = Math.ceil(size / this._columnCount);
        
        var totalHeight = size * this._cellSize.height;
        this._scrollContainer.setActive(this._bounds.height < totalHeight);
        this._scrollContainer.setRows(this._rowCount);

        this._flowBounds = new Core.Web.Measure.Bounds(this._flowDiv);
        this._scrollContainer.renderDisplay();

        if (newBounds.width != oldBounds.width || newBounds.height != oldBounds.height) {
            this._clearContent();
            this._renderColumns();
            this._renderCellsFull();
        }
    },
    
    renderDispose: function(update) {
        this._bounds = null;
        Core.Web.Event.removeAll(this._div);
        this._scrollContainer.dispose();
        this._model.removeUpdateListener(this._updateListenerRef);
        this._scrollContainer = null;
        this._flowDiv = null;
        this._div = null;
    },
    
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    },
    
    _setHighlight: function(index, rollover) {
        if (index < this._renderedStartRow * this._columnCount || index >= this._renderedEndRow * this._columnCount) {
            return;
        }
        
        var contentDiv, x, y, cellDiv;
        var selection = this.component.get("selection") || {};
        
        y = Math.floor(index / this._columnCount);
        x = index % this._columnCount;
        contentDiv = this._columnDivs[x].firstChild;
        cellDiv = contentDiv.childNodes[y - this._renderedStartRow];
        while (cellDiv.firstChild) {
            cellDiv.removeChild(cellDiv.firstChild);
        }
        this._renderer.render(this.component, this._model.get(index), index, cellDiv, { selected: selection[index] });
    },

    _setPosition: function(row) {
        this._position = row;
        this._renderCellsUpdate();
    },
    
    _updateListener: function(e) {
        if (e.refresh) {
            Echo.Render.renderComponentDisplay(this.component);
            this._clearContent();
            this._renderColumns();
            this._renderCellsFull();
            return;
        }
        
        var start = Math.max(this._renderedStartRow * this._columnCount, e.startIndex),
            stop = Math.min(this._renderedEndRow * this._columnCount, e.endIndex),
            contentDiv, i, y, x, cellDivs, cellDiv;
        
        if (stop < start) {
            return;
        }
        
        var selection = this.component.get("selection") || {};
        
        for (i = start; i < stop; ++i) {
            y = Math.floor(i / this._columnCount);
            x = i % this._columnCount;
            contentDiv = this._columnDivs[x].firstChild;
            cellDiv = contentDiv.childNodes[y - this._renderedStartRow];
            while (cellDiv.firstChild) {
                cellDiv.removeChild(cellDiv.firstChild);
            }
            this._renderer.render(this.component, this._model.get(i), i, cellDiv, { selected: selection[i] });
        }
    }
});

Extras.Sync.FlowViewer.Renderer = Core.extend({
    
    $abstract: {
        
        /**
         * Returns the cell size, an object containing width and height pixel values, 
         * e.g.: { width: 200, height: 150 }.
         */
        getCellSize: function() { },
        
        render: function(component, modelValue, index, targetCell) { },
        
        dispose: function(component, modelValue, index, targetCell) { }
    }
});

Extras.Sync.FlowViewer.NullRenderer = Core.extend(Extras.Sync.FlowViewer.Renderer, {
    
    getCellSize: function() {
        return { width: 100, height: 100 };
    },
    
    render: function(component, modelValue, index, targetCell) {
        targetCell.appendChild(document.createTextNode((modelValue || "\u00a0").toString()));
    },
    
    dispose: function(component, modelValue, index, targetCell) { }
});
/**
 * Component rendering peer: Group.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.Group = Core.extend(Echo.Render.ComponentSync, {

    $static: {
    
        /**
         * Default rendering values used when component does not specify a property value.
         */
        DEFAULTS: {
            borderImages: [
                "image/group/TopLeft.png",
                "image/group/Top.png",
                "image/group/TopRight.png",
                "image/group/Left.png",
                "image/group/Right.png",
                "image/group/BottomLeft.png",
                "image/group/Bottom.png",
                "image/group/BottomRight.png"
            ],
            borderInsets: "10px",
            titleInsets: "0px 2px"
        }
    },

    $load: function() {
        Echo.Render.registerPeer("Extras.Group", this);
    },
    
    /**
     * Main outer DIV element.
     * @type Element
     */
    _div: null,
    
    /**
     * Array of component-provided border images (may be null if unspecified).
     * @type Array
     */
    _borderImages: null,
    
    /**
     * Creates a FillImage value for the given position, repeat, and position settings.
     * Images are retrieved from component-set or default border image array.
     * 
     * @param {Number} position the position index (0-7)
     * @param {String} repeat the repeat setting
     * @param {#Extent} x the rendered horizontal position, e.g., 0, or "100%" 
     * @param {#Extent} y the rendered vertical position, e.g., 0, or "100%"
     * @return the rendered image
     * @type #FillImage 
     */
    _getBorderImage: function(position, repeat, x, y) {
        var image = this._borderImages ? this._borderImages[position] : 
                this.client.getResourceUrl("Extras", Extras.Sync.Group.DEFAULTS.borderImages[position]);
        return image ? { url: image, repeat: repeat, x: x, y: y } : null; 
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._borderImages = this.component.render("borderImage");
        
        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        if (Core.Web.Env.QUIRK_IE_HAS_LAYOUT) {
            this._div.style.cssText = "zoom:1;";
        }
        Echo.Sync.Color.render(this.component.render("foreground"), this._div, "color");
        Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), this._div);
    
        this._renderBorder(update);
        
        parentElement.appendChild(this._div);
    },
    
    /**
     * Renders border element, appends to main DIV.  Invokes _renderContent() to render content and append to
     * DOM hierarchy in appropriate position.
     * 
     * @param {Echo.Update.ComponentUpdate} the update
     */
    _renderBorder: function(update) {
        var borderInsets = this.component.render("borderInsets", Extras.Sync.Group.DEFAULTS.borderInsets);
        var borderPixelInsets = Echo.Sync.Insets.toPixels(borderInsets);
        var flags = 0;
        
        var topRightDiv = document.createElement("div");
        topRightDiv.style.width = "100%";
        Echo.Sync.FillImage.render(this._getBorderImage(2, "no-repeat", "100%", "100%"), topRightDiv, flags);
        
        var topLeftDiv = document.createElement("div");
        topLeftDiv.style.paddingRight = borderPixelInsets.right + "px";
        topLeftDiv.style.paddingLeft = borderPixelInsets.left + "px";
        Echo.Sync.FillImage.render(this._getBorderImage(0, "no-repeat", 0, "100%"), topLeftDiv, flags);
        topRightDiv.appendChild(topLeftDiv);
        
        var title = this.component.render("title");
        if (title) {
            var topTable = document.createElement("table");
            topTable.style.padding = "0px";
            topTable.style.borderCollapse = "collapse";
            topTable.style.width = "100%";
            var topTbody = document.createElement("tbody");
            topTable.appendChild(topTbody);
            var topTr = document.createElement("tr");
            topTbody.appendChild(topTr);
            
            var titlePosition = this.component.render("titlePosition");
            if (titlePosition) {
                var topPositionTd = document.createElement("td");
                if (Echo.Sync.Extent.isPercent(titlePosition)) {
                    topPositionTd.style.width = titlePosition.toString();
                }
                var topPositionImg = document.createElement("img");
                topPositionImg.src = this.client.getResourceUrl("Echo", "resource/Transparent.gif");
                if (Echo.Sync.Extent.isPercent(titlePosition)) {
                    topPositionImg.style.width = titlePosition.toString();
                }
                topPositionImg.style.height = "1px";
                topPositionTd.appendChild(topPositionImg);
                Echo.Sync.FillImage.render(
                        this._getBorderImage(1, "repeat-x", 0, "100%"), topPositionTd, flags);
                topTr.appendChild(topPositionTd);
            }
            
            var titleTd = document.createElement("td");
            titleTd.style.whiteSpace = "nowrap";
            Echo.Sync.Font.render(this.component.render("titleFont"), titleTd);
            Echo.Sync.Insets.render(this.component.render("titleInsets",
                    Extras.Sync.Group.DEFAULTS.titleInsets), titleTd, "padding");
            var titleImage = this.component.render("titleBackgroundImage");
            if (titleImage) {
                Echo.Sync.FillImage.render({ url: titleImage, repeat: "repeat-x", x: 0, y: "100%" }, titleTd, flags);
            }
            titleTd.appendChild(document.createTextNode(title));
            topTr.appendChild(titleTd);
            
            var topFillTd = document.createElement("td");
            if (titlePosition && Echo.Sync.Extent.isPercent(titlePosition)) {
                topFillTd.style.width = (100 - parseInt(titlePosition, 10)) + "%";
            } else {
                topFillTd.style.width = "100%";
            }
            topFillTd.style.height = borderPixelInsets.top + "px";
            Echo.Sync.FillImage.render(this._getBorderImage(1, "repeat-x", 0, "100%"), 
                    topFillTd, flags);
            topTr.appendChild(topFillTd);
            
            topLeftDiv.appendChild(topTable);
        } else {
            var topDiv = document.createElement("div");
            topDiv.style.width = "100%";
            topDiv.style.height = borderPixelInsets.top + "px";
            topDiv.style.fontSize = "1px";
            Echo.Sync.FillImage.render(this._getBorderImage(1, "repeat-x", 0, "100%"), 
                    topDiv, flags);
            topLeftDiv.appendChild(topDiv);
        }
        
        this._div.appendChild(topRightDiv);
        
        var rightDiv = document.createElement("div");
        rightDiv.style.width = "100%";
        Echo.Sync.FillImage.render(this._getBorderImage(4, "repeat-y", "100%", 0), 
                rightDiv, flags);
        
        var leftDiv = document.createElement("div");
        leftDiv.style.paddingRight = borderPixelInsets.right + "px";
        leftDiv.style.paddingLeft = borderPixelInsets.left + "px";
        Echo.Sync.FillImage.render(this._getBorderImage(3, "repeat-y", 0, 0), 
                leftDiv, flags);
        this._renderContent(update, leftDiv);
        rightDiv.appendChild(leftDiv);
        this._div.appendChild(rightDiv);
        
        var bottomRightDiv = document.createElement("div");
        bottomRightDiv.style.width = "100%";
        bottomRightDiv.style.height = borderPixelInsets.bottom + "px";
        bottomRightDiv.style.fontSize = "1px";
        Echo.Sync.FillImage.render(this._getBorderImage(7, "no-repeat", "100%", "100%"), bottomRightDiv, flags);
        
        var bottomLeftDiv = document.createElement("div");
        bottomLeftDiv.style.paddingRight = borderPixelInsets.right + "px";
        bottomLeftDiv.style.paddingLeft = borderPixelInsets.left + "px";
        Echo.Sync.FillImage.render(this._getBorderImage(5, "no-repeat", 0, "100%"), bottomLeftDiv, flags);
        bottomRightDiv.appendChild(bottomLeftDiv);
        
        var bottomDiv = document.createElement("div");
        bottomDiv.style.width = "100%";
        bottomDiv.style.height = borderPixelInsets.bottom + "px";
        bottomDiv.style.fontSize = "1px";
        Echo.Sync.FillImage.render(this._getBorderImage(6, "repeat-x", 0, "100%"), 
                bottomDiv, flags);
        bottomLeftDiv.appendChild(bottomDiv);
        this._div.appendChild(bottomRightDiv);
    },
    
    /**
     * Renders the content (child) of the Group.
     * 
     * @param {Echo.Update.ComponentUpdate} the update
     * @param {Element} the element to which the content should be appended  
     */
    _renderContent: function(update, parentElement) {
        var div = document.createElement("div");
        
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), div);
        Echo.Sync.Color.render(this.component.render("background"), div, "backgroundColor");
        Echo.Sync.Font.render(this.component.render("font"), div);
        Echo.Sync.Insets.render(this.component.render("insets"), div, "padding");
        
        var componentCount = this.component.getComponentCount();
        for (var i = 0; i < componentCount; i++) {
            var child = this.component.getComponent(i);
            Echo.Render.renderComponentAdd(update, child, div);
        }
        
        parentElement.appendChild(div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._borderImages = null;
        this._div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});
Extras.Sync.ListViewer = Core.extend(Echo.Render.ComponentSync, { 
    
    $load: function() {
        Echo.Render.registerPeer("Extras.ListViewer", this);
    },
    
    _columnsRendered: false,
    
    /** Overall cell height, including border. */
    _cellHeight: null,
    
    _borderHeight: 0,
    _columnWidthPx: null,
    _columnDivs: null,
    _protoCell: null,
    _div: null,
    _listDiv: null,

    /** The first rendered row index, inclusive. */
    _renderedStartIndex: null,
    
    /** The last rendered row index, exclusive. */
    _renderedEndIndex: null, 
    
    /**
     * The currently rendered first displayed row position.
     */
    _renderedPosition: 0,
    
    /**
     * The desired first displayed row position.  This value is not a row index, but a possibly fractional value
     * denoting the row position at the very top of the viewing area.  For example, if half of the second
     * row were visible at the top, then _position would be 1.5. 
     */
    _position: 0,
    
    $construct: function() {
        this._updateListenerRef = Core.method(this, this._updateListener);
    },
    
    _calculateCellHeight: function() {
        // Measure a test text line.
        var testDiv = document.createElement("div");
        testDiv.appendChild(document.createTextNode("Test Height"));
        this._cellInnerHeight = new Core.Web.Measure.Bounds(testDiv).height;

        var border = this.component.render("border");
        var insets = Echo.Sync.Insets.toPixels(this.component.render("insets"));
        this._borderHeight = Echo.Sync.Border.getPixelSize(border, "top") + Echo.Sync.Border.getPixelSize(border, "bottom");
        
        var headerInsets = Echo.Sync.Insets.toPixels(this.component.render("headerInsets"));

        this._cellHeight = this._cellInnerHeight + this._borderHeight + insets.top + insets.bottom;
        this._headerCellHeight = this._columnNames ? this._cellInnerHeight + headerInsets.top + headerInsets.bottom : 0;
        
    },
    
    _calculateColumnWidths: function() {
        var i = 0,
            availableWidth = this._listBounds.width;
        
        this._columnWidthPx = [];
        var totalPercentWidth = 0;
        var columnWidth = this.component.render("columnWidth", ["100%"]);
        
        // Calculate sum of percentage widths *and* store absolute widths.
        // Subtract absolute widths from available width.
        for (i = 0; i < columnWidth.length; ++i) {
            if (Echo.Sync.Extent.isPercent(columnWidth[i])) {
                totalPercentWidth += parseInt(columnWidth[i], 10);
            } else {
                this._columnWidthPx[i] = Echo.Sync.Extent.toPixels(columnWidth[i]);
                availableWidth -= this._columnWidthPx[i];
            }
        }
        
        // Divide remaining width amongst percent-based columns.
        var availablePercentWidth = availableWidth;
        for (i = 0; i < columnWidth.length; ++i) {
            if (Echo.Sync.Extent.isPercent(columnWidth[i])) {
                this._columnWidthPx[i] = Math.floor(availablePercentWidth * parseInt(columnWidth[i], 10) / 100);
                availableWidth -= this._columnWidthPx[i];
            }
        }
        
        // Add any remaining width to final column to ensure 100% coverage.
        this._columnWidthPx[this._columnWidthPx.length - 1] += availableWidth;
    },
    
    _clearContent: function() {
        this._columnsRendered = false;
        while (this._listDiv.firstChild) {
            this._listDiv.removeChild(this._listDiv.firstChild);
        }
        if (this._columnNames) {
            while (this._headerDiv.firstChild) {
                this._headerDiv.removeChild(this._headerDiv.firstChild);
            }
        }
    },
    
    _createProtoCell: function() {
        this._protoCell = document.createElement("div");
        this._protoCell.style.cssText = "overflow:hidden;white-space:nowrap;";
        Echo.Sync.Insets.render(this.component.render("insets"), this._protoCell, "padding");
        this._protoCell.style.height = (this._cellInnerHeight) + "px";
        Echo.Sync.Border.render(this.component.render("border"), this._protoCell);
    },
    
    _getCellDiv: function(column, row) {
        if (row < this._renderedStartIndex || row >= this._renderedEndIndex) {
            return null;
        }
        var contentDiv = this._columnDivs[column].firstChild;
        return contentDiv.childNodes[row - this._renderedStartIndex];
    },
    
    _getIndexFromNode: function(node) {
        var x, y;
        var testNode;
        var columnContentDiv;
        
        // Find containing column content div.
        testNode = node;
        while (testNode && testNode.parentNode !== this._listDiv) {
            testNode = testNode.parentNode;
        }
        if (!testNode) {
            return -1;
        }
        
        // Move node reference to  child of column content div. 
        columnContentDiv = testNode.firstChild;
        while (node && node.parentNode !== columnContentDiv) {
            node = node.parentNode;
        }
        if (!node) {
            return -1;
        }
        
        testNode = columnContentDiv.firstChild;
        y = 0;
        while (testNode) {
            if (testNode === node) {
                return y + this._renderedStartIndex;
            }
            testNode = testNode.nextSibling;
            ++y; 
        }

        return -1;
    },
    
    _processRolloverEnter: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        var index = this._getIndexFromNode(e.target);
        this._setHighlight(index, true);
    },
    
    _processRolloverExit: function(e) {
        var index = this._getIndexFromNode(e.target);
        this._setHighlight(index, false);
    },
    
    _processClick: function(e, contextClick) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        var index = this._getIndexFromNode(e.target);
        if (index === -1) {
            return;
        }
        
        if (e.ctrlKey || e.metaKey || e.altKey) {
            var selection = this.component.get("selection") || {};
            if (!contextClick && selection[index]) {
                delete selection[index];
            } else {
                selection[index] = true;
            }
            // Force update.
            this.component.set("selection", null, true);
            this.component.set("selection", selection, true);
            this._setHighlight(index, true);
        } else {
            var oldSelection = this.component.get("selection") || {};

            selection = { };
            selection[index] = true;
            this.component.set("selection", selection, true);
            
            for (var selectedIndex in oldSelection) {
                if (selectedIndex !== index) {
                    this._setHighlight(selectedIndex, false);
                }
            }
            
            this._setHighlight(index, true);
        }
    },

    _processContextMenu: function(e) {
        this._processClick(e, true);
        return true;
    },
    
    _processDoubleClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        var row = this._getIndexFromNode(e.target);
        if (row !== -1) {
            this.component.doAction(row);
        }
    },
    
    _processScroll: function(e) {
        this._setPosition(e.row);
    },
    
    renderAdd: function(update, parentElement) {
        this._columnsRendered = false;

        this._columnNames = this.component.render("columnName");
        
        this._model = this.component.get("model") || new Extras.Viewer.NullModel();
        this._model.addUpdateListener(this._updateListenerRef);
        
        this._renderer = this.component.get("renderer") || new Extras.Sync.ListViewer.ColumnRenderer();
        
        this._calculateCellHeight();
        
        this._div = document.createElement("div");
        this._div.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;";
        
        if (this._columnNames) {
            this._headerDiv = document.createElement("div");
            this._headerDiv.style.cssText = "position:absolute;left:0;top:0;right:0;overflow:hidden;";
            this._headerDiv.style.height = this._headerCellHeight + "px";
            Echo.Sync.Color.render(this.component.render("headerBackground"), this._headerDiv, "backgroundColor");
            Echo.Sync.Color.render(this.component.render("headerForeground"), this._headerDiv, "color");
            this._div.appendChild(this._headerDiv);
        }
        
        this._containerDiv = document.createElement("div");
        this._containerDiv.style.cssText = "position:absolute;left:0;right:0;bottom:0;";
        this._containerDiv.style.top = this._headerCellHeight + "px";
        this._div.appendChild(this._containerDiv);
        
        this._scrollContainer = new Extras.Sync.Viewer.ScrollContainer(this.client, this.component, this._model.size(), 
                this._cellHeight);
        this._scrollContainer.onScroll = Core.method(this, this._processScroll);
        this._containerDiv.appendChild(this._scrollContainer.rootElement);

        this._listDiv = document.createElement("div");
        this._listDiv.style.cssText = "position:absolute;left:0;top:0;bottom:0;right:0;cursor:pointer;";
        Echo.Sync.Color.renderFB(this.component, this._listDiv);
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), this._listDiv);
        this._scrollContainer.contentElement.appendChild(this._listDiv);

        parentElement.appendChild(this._div);
        
        this._createProtoCell();
        
        Core.Web.Event.add(this._div, "click", Core.method(this, this._processClick), false);
        Core.Web.Event.add(this._div, "contextmenu", Core.method(this, this._processContextMenu), false);
        Core.Web.Event.add(this._div, "dblclick", Core.method(this, this._processDoubleClick), false);
        if (this.component.render("rolloverEnabled")) {
            Core.Web.Event.add(this._div, "mouseover", Core.method(this, this._processRolloverEnter), false);
            Core.Web.Event.add(this._div, "mouseout", Core.method(this, this._processRolloverExit), false);
        }
        Core.Web.Event.Selection.disable(this._div);
    },
    
    _renderHighlight: function(cellDivs, row, rollover) {
        var selection = this.component.get("selection") || {};
        var selected = selection[row];
        
        var prefix = selected ? "selection" : "rollover";
        var background, foreground;
        if (rollover || selected) {
            background = this.component.render(prefix + "Background");
            foreground = this.component.render(prefix + "Foreground");
        }
        
        for (var i = 0; i < cellDivs.length; ++i) {
            Echo.Sync.Color.renderClear(background, cellDivs[i], "backgroundColor"); 
            Echo.Sync.Color.renderClear(foreground, cellDivs[i], "color"); 
        }
    },
    
    _renderColumns: function() {
        if (this._columnsRendered) {
            return;
        }
        
        this._calculateColumnWidths();
        this._headerColumnDivs = [];
        this._columnDivs = [];
        var position = 0;
        for (var i = 0; i < this._columnWidthPx.length; ++i) {
            var width = Math.max(0, this._columnWidthPx[i]);
            if (this._columnNames && this._columnNames[i]) {
                this._headerColumnDivs[i] = document.createElement("div");
                this._headerColumnDivs[i].style.cssText = "position:absolute;top:0;overflow:hidden;";
                this._headerColumnDivs[i].style.width = width + "px";
                this._headerColumnDivs[i].style.left = position + "px";
                Echo.Sync.Insets.render(this.component.render("headerInsets"), this._headerColumnDivs[i], "padding");
                this._headerColumnDivs[i].appendChild(document.createTextNode(this._columnNames[i]));
                this._headerDiv.appendChild(this._headerColumnDivs[i]);
            }
            
            this._columnDivs[i] = document.createElement("div");
            this._columnDivs[i].style.cssText = "position:absolute;top:0;bottom:0;overflow:hidden;";
            this._columnDivs[i].style.width = width + "px";
            this._columnDivs[i].style.left = position + "px";
            this._listDiv.appendChild(this._columnDivs[i]);
            position += width;
            
            Core.Web.VirtualPosition.redraw(this._columnDivs[i]);
        }
        this._columnsRendered = true;
    },

    renderDispose: function(update) {
        Core.Web.Event.removeAll(this._div);
        this._model.removeUpdateListener(this._updateListenerRef);
        this._scrollContainer.dispose();
        
        this._bounds = null;
        this._listBounds = null;
        this._div = null;
        this._listDiv = null;
        this._columnDivs = null;
        this._protoCell = null;
        this._scrollContainer = null;
    },
    
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this._div);
        Core.Web.VirtualPosition.redraw(this._headerDiv);
        Core.Web.VirtualPosition.redraw(this._containerDiv);
        Core.Web.VirtualPosition.redraw(this._listDiv);
        
        var oldBounds = this._bounds || {};
        var newBounds = new Core.Web.Measure.Bounds(this._containerDiv);
        this._bounds = newBounds;
        
        var totalHeight = this._model.size() * this._cellHeight;
        this._scrollContainer.setActive(this._bounds.height < totalHeight);
        
        this._listBounds = new Core.Web.Measure.Bounds(this._listDiv);
        this._scrollContainer.renderDisplay();
        if (newBounds.width != oldBounds.width || newBounds.height != oldBounds.height) {
            this._clearContent();
            this._renderColumns();
            this._renderRowsFull();
        }
    },
    
    _renderRowsFull: function() {
        var cellDiv, cellDivs, x, y, columnContentDiv, contentDiv,
            selection = this.component.get("selection") || {},
            rowCount = this._model.size();
        
        this._renderedPosition = this._position;
        this._renderedStartIndex = Math.floor(this._position);
        this._renderedEndIndex = Math.min(rowCount, 
                Math.ceil(this._renderedStartIndex + this._listBounds.height / this._cellHeight));
        
        contentDiv = document.createElement("div");
        for (y = this._renderedStartIndex; y < this._renderedEndIndex; ++y) {
            cellDiv = this._protoCell.cloneNode(false);
            contentDiv.appendChild(cellDiv);
        }
        
        var topPosition = 0 - Math.floor((this._position - Math.floor(this._position)) * this._cellHeight);
        
        this._model.fetch(this._renderedStartIndex, this._renderedEndIndex);
        
        cellDivs = [];
        for (x = 0; x < this._columnDivs.length; ++x) {
            columnContentDiv = contentDiv.cloneNode(true);
            cellDivs.push(columnContentDiv.firstChild);
            this._columnDivs[x].appendChild(columnContentDiv);
            this._columnDivs[x].style.top = topPosition + "px";
        }
        for (y = this._renderedStartIndex; y < this._renderedEndIndex && y < rowCount; ++y) {
            this._renderer.render(this.component, this._model.get(y), y, cellDivs);
            
            if (selection[y]) {
                this._renderHighlight(cellDivs, y, false);
            }
            
            for (x = 0; x < this._columnDivs.length; ++x) {
                cellDivs[x] = cellDivs[x].nextSibling;
            }
        }
    },
    
    _renderRowsIncremental: function(up) {
        var newStartRow = Math.floor(this._position);
        var newEndRow = Math.min(this._model.size(), Math.ceil(newStartRow + this._listBounds.height / this._cellHeight + 1));
        var contentDiv, cellDivs, cellDiv, cellsToRemove, cellsToAdd, x, y,
            selection = this.component.get("selection") || {};
            
        var topPosition = 0 - Math.floor((this._position - Math.floor(this._position)) * this._cellHeight);
        this._renderedPosition = this._position;

        this._model.fetch(newStartRow, newEndRow);

        for (x = 0; x < this._columnDivs.length; ++x) {
            this._columnDivs[x].style.top = topPosition + "px";
        }
        
        if (up) {
            cellsToRemove = this._renderedEndIndex - newEndRow;
            cellsToAdd = this._renderedStartIndex - newStartRow;

            for (y = 0; y < cellsToRemove; ++y) {
                for (x = 0; x < this._columnDivs.length; ++x) {
                    contentDiv = this._columnDivs[x].firstChild;
                    contentDiv.removeChild(contentDiv.lastChild);
                }
            }
            
            for (y = this._renderedStartIndex - 1; y >= newStartRow; --y) {
                cellDivs = [];
                for (x = 0; x < this._columnDivs.length; ++x) {
                    contentDiv = this._columnDivs[x].firstChild;
                    cellDiv = this._protoCell.cloneNode(false);
                    contentDiv.insertBefore(cellDiv, contentDiv.firstChild);
                    cellDivs.push(cellDiv);
                }
                this._renderer.render(this.component, this._model.get(y), y, cellDivs);
                if (selection[y]) {
                    this._renderHighlight(cellDivs, y, false);
                }
            }
        } else {
            cellsToRemove = newStartRow - this._renderedStartIndex;
            cellsToAdd = newEndRow - this._renderedEndIndex;

            for (y = 0; y < cellsToRemove; ++y) {
                for (x = 0; x < this._columnDivs.length; ++x) {
                    contentDiv = this._columnDivs[x].firstChild;
                    contentDiv.removeChild(contentDiv.firstChild);
                }
            }
            
            for (y = this._renderedEndIndex; y < newEndRow; ++y) {
                cellDivs = [];
                for (x = 0; x < this._columnDivs.length; ++x) {
                    contentDiv = this._columnDivs[x].firstChild;
                    cellDiv = this._protoCell.cloneNode(false);
                    contentDiv.appendChild(cellDiv);
                    cellDivs.push(cellDiv);
                }
                this._renderer.render(this.component, this._model.get(y), y, cellDivs);
                if (selection[y]) {
                    this._renderHighlight(cellDivs, y, false);
                }
            }
        }

        this._renderedStartIndex = newStartRow;
        this._renderedEndIndex = newEndRow;
    },
    
    _renderRowsUpdate: function() {
        if (this._position === this._renderedPosition) {
            return;
        }
        
        var incremental = Math.abs(this._renderedPosition - this._position) < (0.75 * this._listBounds.height / this._cellHeight);
        
        if (incremental) {
            this._renderRowsIncremental(this._position < this._renderedPosition);
        } else {
            this._clearContent();
            this._renderColumns();
            this._renderRowsFull();
        }
    },
    
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    },
    
    _setPosition: function(row) {
        this._position = row;
        this._renderRowsUpdate();
    },
    
    _setHighlight: function(index, rollover) {
        var cellDivs = [];
        for (var column = 0; column < this._columnDivs.length; ++column) {
            var cellDiv = this._getCellDiv(column, index);
            if (!cellDiv) {
                return;
            }
            cellDivs.push(cellDiv);
        }
        this._renderHighlight(cellDivs, index, rollover);
    },
    
    _updateListener: function(e) {
        if (e.refresh) {
            Echo.Render.renderComponentDisplay(this.component);
            this._scrollContainer.setRows(this._model.size());
            this._clearContent();
            this._renderColumns();
            this._renderRowsFull();
            return;
        }
        
        var start = Math.max(this._renderedStartIndex, e.startIndex),
            stop = Math.min(this._renderedEndIndex, e.endIndex),
            contentDiv, y, x, cellDivs, cellDiv,
            selection = this.component.get("selection") || {};
        
        if (stop <= start) {
            return;
        }
        
        cellDivs = [];
        for (x = 0; x < this._columnDivs.length; ++x) {
            contentDiv = this._columnDivs[x].firstChild;
            cellDiv = contentDiv.childNodes[start - this._renderedStartIndex];
            cellDivs.push(cellDiv);
        }
        
        for (y = start; y < stop; ++y) {
            for (x = 0; x < this._columnDivs.length; ++x) {
                while (cellDivs[x].firstChild) {
                    cellDivs[x].removeChild(cellDivs[x].firstChild);                
                }
            }
            
            this._renderer.render(this.component, this._model.get(y), y, cellDivs);
            if (selection[y]) {
                this._renderHighlight(cellDivs, y, false);
            }
            
            for (x = 0; x < this._columnDivs.length; ++x) {
                cellDivs[x] = cellDivs[x].nextSibling;
            }
        }
    }
});

Extras.Sync.ListViewer.Renderer = Core.extend({
    
    $abstract: {
        
        render: function(component, modelValue, index, targetCells) { },
        
        dispose: function(component, modelValue, index, targetCells) { }
    }
});

Extras.Sync.ListViewer.ColumnRenderer = Core.extend(Extras.Sync.ListViewer.Renderer, {
    
    $virtual: {
        renderColumn: function(component, modelValue, index, targetCell, columnModelValue, columnIndex) {
            targetCell.appendChild(document.createTextNode(columnModelValue.toString()));
        }
    },
    
    columnPropertyNames: null,
    
    render: function(component, modelValue, index, targetCells) {
        var value, i;
        if (!modelValue) {
            return;
        }
        for (i = 0; i < targetCells.length; ++i) {
            if (this.columnPropertyNames) {
                value = modelValue[this.columnPropertyNames[i] || i];
            } else if (modelValue instanceof Array) {
	            value = modelValue[i];
            } else if (i === 0) {
                value = modelValue;
            } else {
                value = null;
            }
            if (value != null) {
                this.renderColumn(component, modelValue, index, targetCells[i], value, i);
            }
        }
    },
    
    dispose: function(component, modelValue, index, targetCells) { }
});
/**
 * Abstract base class for menu rendering peers.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.Menu = Core.extend(Echo.Render.ComponentSync, {
    
    $static: {
    
        /**
         * Default rendering values used when component does not specify a property value.
         */
        DEFAULTS: {
            foreground: "#000000",
            background: "#cfcfcf",
            disabledForeground: "#7f7f7f",
            selectionForeground: "#ffffff",
            selectionBackground: "#3f3f3f",
            border: "1px outset #cfcfcf"
        }
    }, 
    
    /**
     * The root menu model.
     * @type Extras.MenuModel
     */
    menuModel: null,
    
    /**
     * The menu state model.
     * @type Extras.MenuStateModel
     */
    stateModel: null,
    
    /**
     * The root DOM element of the rendered menu.
     * @type Element
     */
    element: null,
    
    /**
     * The active state of the menu, true when the menu is open.
     * @type Boolean
     */
    active: false,

    /** 
     * Array containing <code>Extras.MenuModel</code>s representing currently open menu path. 
     * @type Array
     */
    _openMenuPath: null,
    
    /** 
     * Flag indicating whether menu mask is deployed. 
     * @type Boolean
     */
    _maskDeployed: false,
    
    /**
     * Reference to the mask click listener.
     * @type Function 
     */
    _processMaskClickRef: null,
    
    /**
     * The collection of named overlay elements (top/left/right/bottom) deployed to cover non-menu elements of the
     * screen with transparent DIVs when the menu is active.  This allows the menu to receive de-activation events,
     * event if a mouse click is received in an IFRAME document.
     */
    _overlay: null,
    
    /**
     * Constructor.  Must be invoked by derivative class constructors.
     */
    $construct: function() {
        this._processMaskClickRef = Core.method(this, this._processMaskClick);
        this._openMenuPath = [];
    },

    $abstract: {
    
        /**
         * Returns an object containing 'x' and 'y' properties indicating the position at 
         * which a submenu should be placed.
         * 
         * @param {Extras.MenuModel} menuModel the submenu
         */
        getSubMenuPosition: function(menuModel) { },

        /**
         * Renders the top level menu of the menu component (that which resides in the DOM at all times).
         * 
         * @param {Echo.Update.ComponentUpdate} the hierarchy update for which the rendering is being performed
         */
        renderMain: function(update) { }
    },
    
    $virtual: {

        /**
         * Activates the menu component.
         * Adds rendering mask to screen, sets menu component as modal.
         */
        activate: function() {
            if (this.active) {
                return false;
            }
            this.component.set("modal", true);
            this.active = true;
            this.addMask();
            
            this.client.application.setFocusedComponent(this.component);
            Core.Web.DOM.focusElement(this.element);
            
            return true;
        },

        /**
         * Activates a menu item.  Displays submenu if item is a submenu.  Invokes menu action if item
         * is a menu option.
         * 
         * @param {Extras.ItemModel} itemModel the item model to activate.
         */
        activateItem: function(itemModel) {
            if (this.stateModel && !this.stateModel.isEnabled(itemModel.modelId)) {
                return;
            }
            if (itemModel instanceof Extras.OptionModel) {
                this.deactivate();
                this.processAction(itemModel);
            } else if (itemModel instanceof Extras.MenuModel) {
                this._openMenu(itemModel);
            }
        },
        
        /**
         * Fires an action event in response to a menu option being activated.
         */
        processAction: function(itemModel) {
            this.component.doAction(itemModel);
        }
    },

    /**
     * Adds a menu to the open menu path.
     * 
     * @param {Extras.MenuModel} menu the menu to add
     */
    addMenu: function(menu) {
        this._openMenuPath.push(menu);
    },
    
    /**
     * Adds the menu mask, such that click events on elements other than the menu will be captured by the menu.
     */
    addMask: function() {
        if (this.maskDeployed) {
            return;
        }
        this.maskDeployed = true;
        this._overlayAdd(new Core.Web.Measure.Bounds(this.element));
        
        Core.Web.Event.add(document.body, "click", this._processMaskClickRef, false);
        Core.Web.Event.add(document.body, "contextmenu", this._processMaskClickRef, false);
    },
    
    /**
     * Processes a key down event.
     */
    clientKeyDown: function(e) {
        if (e.keyCode == 27) {
            this.deactivate();
            return false;
        }
        return true;
    },
    
    /**
     * Closes all open menus.
     */
    closeAll: function() {
        while (this._openMenuPath.length > 0) {
            var menu = this._openMenuPath.pop();
            menu.close();
        }
    },
    
    /**
     * Closes all open menus which are descendants of the specified parent menu.
     * 
     * @param {Extras.MenuModel} parentMenu the parent menu
     */
    closeDescendants: function(parentMenu) {
        while (parentMenu != this._openMenuPath[this._openMenuPath.length - 1]) {
            var menu = this._openMenuPath.pop();
            menu.close();
        }
    },
    
    /**
     * Deactivates the menu component, closing any open menus.
     * Removes rendering mask from screen, sets menu component as non-modal.
     */
    deactivate: function() {
        this.component.set("modal", false);
        if (!this.active) {
            return;
        }
        this.active = false;

        this.closeAll();
        this.removeMask();
    },
    
    /**
     * Determines if the specified menu is currently open (on-screen).
     * 
     * @param {Extras.MenuModel} menuModel the menu
     * @return true if the menu is open
     * @type Boolean
     */
    isOpen: function(menuModel) {
        for (var i = 0; i < this._openMenuPath.length; ++i) {
            if (this._openMenuPath[i].menuModel == menuModel) {
                return true;
            }
        }
        return false;
    },
    
    /**
     * Creates and adds the overlay mask elements to the screen, blocking all content except that within the specified bounds.
     * 
     * @param bounds an object containing the pixel bounds of the region NOT to be blocked, must provide top, left, width, and
     *        height integer properties
     */
    _overlayAdd: function(bounds) {
        this._overlayRemove();
        
        var bottom = bounds.top + bounds.height,
            right = bounds.left + bounds.width,
            domainBounds = new Core.Web.Measure.Bounds(document.body);
        this._overlay = { };

        if (bounds.top > 0) {
            this._overlay.top = document.createElement("div");
            this._overlay.top.style.cssText = "position:absolute;z-index:30000;top:0;left:0;width:100%;" +
                    "height:" + bounds.top + "px;";
            document.body.appendChild(this._overlay.top);
        }
        
        if (bottom < domainBounds.height) {
            this._overlay.bottom = document.createElement("div");
            this._overlay.bottom.style.cssText = "position:absolute;z-index:30000;bottom:0;left:0;width:100%;" +
                    "top:" + bottom + "px;";
            document.body.appendChild(this._overlay.bottom);
        }

        if (bounds.left > 0) {
            this._overlay.left = document.createElement("div");
            this._overlay.left.style.cssText = "position:absolute;z-index:30000;left:0;" +
                    "width:" + bounds.left + "px;top:" + bounds.top + "px;height:" + bounds.height + "px;";
            document.body.appendChild(this._overlay.left);
        }

        if (right < domainBounds.width) {
            this._overlay.right = document.createElement("div");
            this._overlay.right.style.cssText = "position:absolute;z-index:30000;right:0;" +
                    "left:" + right + "px;top:" + bounds.top + "px;height:" + bounds.height + "px;";
            document.body.appendChild(this._overlay.right);
        }
        
        for (var name in this._overlay) {
            Echo.Sync.FillImage.render(this.client.getResourceUrl("Echo", "resource/Transparent.gif"), this._overlay[name]);
            Core.Web.VirtualPosition.redraw(this._overlay[name]);
        }
      
        // Force redraw after body modification.
        this.client.forceRedraw();
    },
    
    /**
     * Removes the overlay mask from the screen, if present.
     */
    _overlayRemove: function() {
        if (!this._overlay) {
            return;
        }
        for (var name in this._overlay) {
            document.body.removeChild(this._overlay[name]);
        }
        this._overlay = null;

        // Force redraw after body modification.
        this.client.forceRedraw();
    },
    
    /**
     * Opens a menu.
     * 
     * @param {Extras.MenuModel} menuModel the menu to open
     */
    _openMenu: function(menuModel) {
        if (this.isOpen(menuModel)) {
            return;
        }
        
        var subMenu = new Extras.Sync.Menu.RenderedMenu(this, menuModel);
        subMenu.create();

        var parentMenu = null;
        for (var i = 0; i < this._openMenuPath.length; ++i) {
            if (this._openMenuPath[i].menuModel == menuModel.parent) {
                parentMenu = this._openMenuPath[i];
                break;
            }
        }
        
        if (parentMenu == null) {
            parentMenu = this;
        } else {
            this.closeDescendants(parentMenu);
        }

        var position = parentMenu.getSubMenuPosition(menuModel);
        var windowBounds = new Core.Web.Measure.Bounds(document.body);
        
        if (position.x + subMenu.width > windowBounds.width) {
            position.x = windowBounds.width - subMenu.width;
            if (position.x < 0) {
                position.x = 0;
            }
        }
        if (position.y + subMenu.height > windowBounds.height) {
            position.y = windowBounds.height - subMenu.height;
            if (position.y < 0) {
                position.y = 0;
            }
        }
        
        subMenu.open(position.x, position.y);
        
        this.addMenu(subMenu);
    },

    /**
     * Handler for clicks on the overlay mask: de-activates menu.
     */
    _processMaskClick: function(e) {
        this.deactivate();
        return true;
    },
    
    /** 
     * Removes the menu mask.
     */
    removeMask: function() {
        if (!this.maskDeployed) {
            return;
        }
        this._overlayRemove();
        this.maskDeployed = false;
        Core.Web.Event.remove(document.body, "click", this._processMaskClickRef, false);
        Core.Web.Event.remove(document.body, "contextmenu", this._processMaskClickRef, false);
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this.menuModel = this.component.get("model");
        this.stateModel = this.component.get("stateModel");
        
        this.element = this.renderMain(update);
        this.element.tabIndex = "-1";
        this.element.style.outlineStyle = "none";
        parentElement.appendChild(this.element);
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderDispose: function(update) {
        this.deactivate();
        this.element = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderFocus */
    renderFocus: function() {
        Core.Web.DOM.focusElement(this.element);
    },
    
    /** @see Echo.Render.ComponentSync#renderHide */
    renderHide: function() {
        this.deactivate();
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (update.isUpdatedPropertySetIn({modal: true})) {
            // Do not re-render on update to modal state.
            return;
        }
        var element = this.element;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return false;
    }
});

/**
 * A single on-screen rendered menu.
 */
Extras.Sync.Menu.RenderedMenu = Core.extend({

    $static: {

        /**
         * Default rendering values used when component does not specify a property value.
         */
        DEFAULTS: {
            iconTextMargin: 5,
            menuInsets: "2px",
            menuItemInsets: "1px 12px"
        },
    
        /**
         * Animation effect to fade-in a DOM element.
         */
        FadeAnimation: Core.extend(Extras.Sync.Animation, {
            
            /**
             * The faded-in element.
             * @type Element
             */
            _element: null,
            
            /**
             * Creates a new FadeAnimation.
             * 
             * @param {Element} element the element to fade in.
             * @param {Number} runTime the animation run time (in milliseconds)
             */
            $construct: function(element, runTime) {
                this._element = element;
                this.runTime = runTime;
            },
        
            /** @see Extras.Sync.Animation#init */
            init: function() { },
            
            /** @see Extras.Sync.Animation#step */
            step: function(progress) {
                this._element.style.opacity = progress;
            },

            /** @see Extras.Sync.Animation#complete */
            complete: function(abort) {
                this._element.style.opacity = 1;
            }
        })
    },
    
    /**
     * The containing menu synchronization peer.
     * @type Extras.Sync.Menu
     */
    menuSync: null,
    
    /**
     * The menu component.
     * @type Echo.Component
     */
    component: null,
    
    /**
     * The relevant client instance.
     * @type Echo.Client
     */
    client: null,
    
    /**
     * The root element of the menu.
     * @type Element
     */
    element: null,
    
    /**
     * Mapping between model ids and menu item TR elements.
     * @type Object
     */
    itemElements: null,
    
    /**
     * The displayed menu model.
     * @type Extras.MenuModel
     */
    menuModel: null,
    
    /**
     * The rendered pixel width of the model.
     * @type Number
     */
    width: null,
    
    /**
     * The rendered pixel height of the model.
     * @type Number
     */
    height: null,
    
    /**
     * The currently active menu item.
     * @type Extras.ItemModel
     */
    _activeItem: null,
    
    /**
     * The menu state model.
     * @type Extras.MenuStateModel
     */
    stateModel: null,
    
    /**
     * Creates a new <code>RenderedMenu</code>.
     * 
     * @param {Extras.Sync.Menu} menuSync the menu synchronization peer
     * @param {Extras.MenuModel} menuModel the menu model
     */
    $construct: function(menuSync, menuModel) {
        this.menuSync = menuSync;
        this.menuModel = menuModel;
        this.component = this.menuSync.component;
        this.client = this.menuSync.client;
        this.stateModel = this.menuSync.stateModel;
        this.itemElements = { };
    },

    /**
     * Closes the menu, removing it from the screen.
     * Disposes all resources, object should be released for garbage collection after invocation.
     */
    close: function() {
        Core.Web.Event.removeAll(this.element);
        document.body.removeChild(this.element);
        // Force redraw after body modification.
        this.client.forceRedraw();
        this.element = null;
        this.itemElements = null;
        this._activeItem = null;
    },

    /**
     * Renders DOM element hierarchy of menu.  Does not display it within document (open() method will later
     * be used to perform this operation).  
     */
    create: function() {
        var i,
            item,
            img,
            menuItemContentTd,
            menuItemIconTd,
            menuItemTr;

        this.element = document.createElement("div");
        this.element.style.position = "absolute";
        this.element.style.zIndex = 30050;
        
        var opacity = (Core.Web.Env.NOT_SUPPORTED_CSS_OPACITY ? 100 : this.component.render("menuOpacity", 100)) / 100;

        var menuContentDiv = document.createElement("div");
        menuContentDiv.style.cssText = "position:relative;z-index:10;";
        this.element.appendChild(menuContentDiv);

        Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), menuContentDiv);
        Echo.Sync.Insets.render(Extras.Sync.Menu.RenderedMenu.DEFAULTS.menuInsets, 
                menuContentDiv, "padding");
        Echo.Sync.Border.render(this.component.render("menuBorder", Extras.Sync.Menu.DEFAULTS.border),
                menuContentDiv);
        var foreground;
        var menuForeground = this.component.render("menuForeground");
        if (menuForeground) {
            foreground = menuForeground;
        } else {
            foreground = this.component.render("foreground", Extras.Sync.Menu.DEFAULTS.foreground);
        }
        Echo.Sync.Color.render(foreground, menuContentDiv, "color");
        Echo.Sync.Extent.render(this.component.render("menuWidth"),
                menuContentDiv, "width", true, false);

        // Apply menu font if it is set, or apply default font 
        // if it is set and the menu font is NOT set.
        var font = this.component.render("menuFont");
        if (!font) {
            font = this.component.render("font");
        }
        if (font) {
            Echo.Sync.Font.render(font, menuContentDiv);
        }

        var backgroundDiv;
        if (opacity < 1) {
            backgroundDiv = document.createElement("div");
            backgroundDiv.style.cssText = "position:absolute;z-index:1;width:100%;height:100%;top:0;bottom:0;";
            backgroundDiv.style.opacity = opacity;
            this.element.appendChild(backgroundDiv);
        } else {
            backgroundDiv = this.element;
        }

        var background;
        var menuBackground = this.component.render("menuBackground");
        if (menuBackground) {
            background = menuBackground;
        } else {
            background = this.component.render("background", Extras.Sync.Menu.DEFAULTS.background);
        }
        Echo.Sync.Color.render(background, backgroundDiv, "backgroundColor");

        // Apply menu background image if it is set, or apply default background 
        // image if it is set and the menu background is NOT set.
        var backgroundImage;
        var menuBackgroundImage = this.component.render("menuBackgroundImage");
        if (menuBackgroundImage) {
            backgroundImage = menuBackgroundImage;
        } else if (menuBackground == null) {
            backgroundImage = this.component.render("backgroundImage");
        }
        if (backgroundImage) {
            Echo.Sync.FillImage.render(backgroundImage, backgroundDiv, null); 
        }

        var menuTable = document.createElement("table");
        menuTable.style.borderCollapse = "collapse";
        menuTable.style.width = "100%";
        menuContentDiv.appendChild(menuTable);

        var menuTbody = document.createElement("tbody");
        menuTable.appendChild(menuTbody);

        var items = this.menuModel.items;

        // Determine if any icons are present.
        var hasIcons = false;
        for (i = 0; i < items.length; ++i) {
            item = items[i];
            if (item.icon || item instanceof Extras.ToggleOptionModel) {
                hasIcons = true;
                break;
            }
        }
        var textPadding, iconPadding;

        if (hasIcons) {
            var pixelInsets = Echo.Sync.Insets.toPixels(Extras.Sync.Menu.RenderedMenu.DEFAULTS.menuItemInsets);
            iconPadding = "0px 0px 0px " + pixelInsets.left + "px";
            textPadding = pixelInsets.top + "px " + pixelInsets.right + "px " + 
                    pixelInsets.bottom + "px " + pixelInsets.left + "px";
        } else {
            textPadding = Extras.Sync.Menu.RenderedMenu.DEFAULTS.menuItemInsets;
        }

        for (i = 0; i < items.length; ++i) {
            item = items[i];
            if (item instanceof Extras.OptionModel || item instanceof Extras.MenuModel) {
                menuItemTr = document.createElement("tr");
                this.itemElements[item.id] = menuItemTr;
                menuItemTr.style.cursor = "pointer";
                menuTbody.appendChild(menuItemTr);

                if (hasIcons) {
                    menuItemIconTd = document.createElement("td");
                    Echo.Sync.Insets.render(iconPadding, menuItemIconTd, "padding");
                    Echo.Sync.Extent.render("0px", menuItemIconTd, "width", true, false);
                    if (item instanceof Extras.ToggleOptionModel) {
                        var iconIdentifier;
                        var selected = this.stateModel && this.stateModel.isSelected(item.modelId);
                        if (item instanceof Extras.RadioOptionModel) {
                            iconIdentifier = selected ? "image/menu/RadioOn.gif" : "image/menu/RadioOff.gif";
                        } else {
                            iconIdentifier = selected ? "image/menu/ToggleOn.gif" : "image/menu/ToggleOff.gif";
                        }
                        img = document.createElement("img");
                        img.src = this.client.getResourceUrl("Extras", iconIdentifier);
                        menuItemIconTd.appendChild(img);
                    } else if (item.icon) {
                        img = document.createElement("img");
                        Echo.Sync.ImageReference.renderImg(item.icon, img);
                        menuItemIconTd.appendChild(img);
                    }
                    menuItemTr.appendChild(menuItemIconTd);
                }

                menuItemContentTd = document.createElement("td");
                Echo.Sync.Insets.render(textPadding, menuItemContentTd, "padding");
                menuItemContentTd.style.whiteSpace = "nowrap";
                if (this.stateModel && !this.stateModel.isEnabled(item.modelId)) {
                    Echo.Sync.Color.render(this.component.render("disabledForeground", 
                            Extras.Sync.Menu.DEFAULTS.disabledForeground), menuItemContentTd, "color");
                }
                menuItemContentTd.appendChild(document.createTextNode(item.text));
                menuItemTr.appendChild(menuItemContentTd);

                if (item instanceof Extras.MenuModel) {
                    // Submenus have adjacent column containing 'expand' icons.
                    var menuItemArrowTd = document.createElement("td");
                    menuItemArrowTd.style.textAlign = "right";
                    img = document.createElement("img");
                    var expandImage = this.component.render("menuExpandIcon", 
                            this.client.getResourceUrl("Extras", "image/menu/ArrowRight.gif"));
                    img.setAttribute("src", expandImage.url ? expandImage.url : expandImage);
                    img.setAttribute("alt", "");
                    menuItemArrowTd.appendChild(img);
                    menuItemTr.appendChild(menuItemArrowTd);
                } else {
                    // Menu items fill both columns.
                    menuItemContentTd.colSpan = 2;
                }
            } else if (item instanceof Extras.SeparatorModel) {
                if (i === 0 || i === items.length - 1 || items[i - 1] instanceof Extras.SeparatorModel ||
                        items[i + 1] instanceof Extras.SeparatorModel) {
                    // Ignore separators at zero position.
                    continue;
                }
                menuItemTr = document.createElement("tr");
                menuTbody.appendChild(menuItemTr);
                menuItemContentTd = document.createElement("td");
                menuItemContentTd.colSpan = hasIcons ? 3 : 2;
                menuItemContentTd.style.padding = "3px 0px";
                var hrDiv = document.createElement("div");
                hrDiv.style.cssText = "border-top:1px solid #a7a7a7;height:0;font-size:1px;line-height:0";
                menuItemContentTd.appendChild(hrDiv);
                menuItemTr.appendChild(menuItemContentTd);
            }
        }

        var bounds = new Core.Web.Measure.Bounds(this.element);
        this.width = bounds.width;
        this.height = bounds.height;
    },

    /**
     * Returns the menu item TR element which is a parent of the specified element.
     * 
     * @param element an element which is a descendant of a TR element representing a menu item
     * @return the TR element
     * @type Element
     */
    _getItemElement: function(element) {
        if (element == null) {
            return null;
        }
        // Find TD element.
        while (element.nodeName.toLowerCase() != "tr") {
            if (element == this.element) {
                return null;
            }
            element = element.parentNode;
        }
        return element;
    },
    
    /**
     * Determines a ItemModel id based on a menu item DOM element.
     * 
     * @param element the DOM element
     * @return the ItemModel id
     * @type String
     */
    _getItemModel: function(element) {
        var itemModelId = null;
        element = this._getItemElement(element);
        if (element == null) {
            return null;
        }

        // Find item model id of clicked element.
        for (var x in this.itemElements) {
            if (this.itemElements[x] == element) {
                itemModelId = x;
                break;
            }
        }

        if (itemModelId == null) {
            return null;
        } else {
            return this.menuModel.findItem(itemModelId);
        }
    },
    
    /** @see Extras.Sync.Menu#getSubMenuPosition */
    getSubMenuPosition: function(menuModel) {
        var menuElement = this.itemElements[menuModel.id];
        var itemBounds = new Core.Web.Measure.Bounds(menuElement);
        var menuBounds = new Core.Web.Measure.Bounds(this.element);
        return { x: menuBounds.left + menuBounds.width, y: itemBounds.top };
    },
    
    /**
     * Opens the rendered menu, displaying it on the screen at the specified position.
     * 
     * @param {Number} x the horizontal pixel position
     * @param {Number} y the vertical pixel position
     */
    open: function(x, y) {
        this.element.style.left = x + "px";
        this.element.style.top = y + "px";

        var animationTime = this.component.render("animationTime", 0);
        if (animationTime && !Core.Web.Env.NOT_SUPPORTED_CSS_OPACITY) {
            this.element.style.opacity = 0;
            var fadeAnimation = new Extras.Sync.Menu.RenderedMenu.FadeAnimation(this.element, animationTime);
            fadeAnimation.start();
        }
        document.body.appendChild(this.element);
        // Force redraw after body modification.
        this.client.forceRedraw();

        Core.Web.Event.add(this.element, "click", Core.method(this, this._processClick), false);
        Core.Web.Event.add(this.element, "mouseover", Core.method(this, this._processItemEnter), false);
        Core.Web.Event.add(this.element, "mouseout", Core.method(this, this._processItemExit), false);
        Core.Web.Event.Selection.disable(this.element);
    },

    /**
     * Processes a mouse click event.
     * 
     * @param e the event
     */
    _processClick: function(e) {
        Core.Web.DOM.preventEventDefault(e);
        var itemModel = this._getItemModel(Core.Web.DOM.getEventTarget(e));
        if (itemModel) {
            this._setActiveItem(itemModel, true);
        }
    },
    
    /**
     * Processes a mouse rollover enter event.
     * 
     * @param e the event
     */
    _processItemEnter: function(e) {
        this._processRollover(e, true);
    },

    /**
     * Processes a mouse rollover exit event.
     * 
     * @param e the event
     */
    _processItemExit: function(e) {
        this._processRollover(e, false);
    },
    
    /**
     * Processes mouse rollover events.
     * 
     * @param e the event
     * @param {Boolean} state the rollover state, true indicating the mouse is currently rolled over an item
     */
    _processRollover: function(e, state) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return true;
        }
        
        var element = this._getItemElement(Core.Web.DOM.getEventTarget(e));
        if (!element) {
            return;
        }
        var itemModel = this._getItemModel(element);
        if (!itemModel) {
            return;
        }
        
        if (this.stateModel && !this.stateModel.isEnabled(itemModel.modelId)) {
            return;
        }
        
        if (state) {
            this._setActiveItem(itemModel, false);
        }
    },
    
    /**
     * Sets the active item.
     * 
     * @param {Extras.ItemModel} itemModel the item
     * @param {Boolean} execute flag indicating whether the item should be executed
     */
    _setActiveItem: function(itemModel, execute) {
        if (this._activeItem) {
            this._setItemHighlight(this._activeItem, false);
            this._activeItem = null;
        }

        if (itemModel instanceof Extras.MenuModel) {
            this.menuSync.activateItem(itemModel);
        } else {
            if (execute) {
                this.menuSync.activateItem(itemModel);
                // Executing item, menu will close: return immediately.
                return;
            } else {
                this.menuSync.closeDescendants(this);
            }
        }

        if (itemModel) {
            this._activeItem = itemModel;
            this._setItemHighlight(this._activeItem, true);
        }
    },

    /**
     * Sets the highlight state of an item.
     * 
     * @param {Extras.ItemModel} itemModel the item
     * @param {Boolean} state the highlight state
     */
    _setItemHighlight: function(itemModel, state) {
        var element = this.itemElements[itemModel.id];
        if (state) {
            Echo.Sync.FillImage.render(this.component.render("selectionBackgroundImage"), element);
            Echo.Sync.Color.render(this.component.render("selectionBackground", 
                    Extras.Sync.Menu.DEFAULTS.selectionBackground), element, "backgroundColor");
            Echo.Sync.Color.render(this.component.render("selectionForeground", 
                    Extras.Sync.Menu.DEFAULTS.selectionForeground), element, "color");
        } else {
            element.style.backgroundImage = "";
            element.style.backgroundColor = "";
            element.style.color = "";
        } 
    }
});

/**
 * Component rendering peer: ContextMenu
 */
Extras.Sync.ContextMenu = Core.extend(Extras.Sync.Menu, {

    $load: function() {
        Echo.Render.registerPeer("Extras.ContextMenu", this);
    },
    
    /** 
     * X coordinate of activation mouse click.
     * @type Number
     */
    _mouseX: null,
    
    /**
     * Y coordinate of activation mouse click.
     * @type Number
     */
    _mouseY: null,
    
    /** @see Extras.Sync.Menu#getSubMenuPosition */
    getSubMenuPosition: function(menuModel) {
        return { x: this._mouseX, y: this._mouseY };
    },

    /**
     * Processes a mouse click/context-click event.
     * 
     * @param e the event
     */
    _processContextClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return true;
        }
    
        Core.Web.DOM.preventEventDefault(e);
        
        this._mouseX = e.pageX || (e.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft));
        this._mouseY = e.pageY || (e.clientY + (document.documentElement.scrollTop || document.body.scrollTop));
        
        this.activate();
        this.activateItem(this.menuModel);
    },

    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Core.Web.Event.removeAll(this.element);
        Extras.Sync.Menu.prototype.renderDispose.call(this, update);
    },
    
    /** @see Extras.Sync.Menu#renderMain */
    renderMain: function(update) {
        var contextMenuDiv = document.createElement("div");
        contextMenuDiv.id = this.component.renderId;
        
        var activationMode = this.component.render("activationMode", Extras.ContextMenu.ACTIVATION_MODE_CONTEXT_CLICK);
        if (activationMode & Extras.ContextMenu.ACTIVATION_MODE_CLICK) {
            Core.Web.Event.add(contextMenuDiv, "click", Core.method(this, this._processContextClick), false);
        }
        if (activationMode & Extras.ContextMenu.ACTIVATION_MODE_CONTEXT_CLICK) {
            Core.Web.Event.add(contextMenuDiv, "contextmenu", Core.method(this, this._processContextClick), false);
        }
        
        var componentCount = this.component.getComponentCount();
        if (componentCount > 0) {
            Echo.Render.renderComponentAdd(update, this.component.getComponent(0), contextMenuDiv);
        }
        
        return contextMenuDiv;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (update.isUpdatedPropertySetIn({ modal: true, stateModel: true, model: true })) {
            // partial update
            var removedChildren = update.getRemovedChildren();
            if (removedChildren) {
                Core.Web.DOM.removeNode(this.element.firstChild);
            }
            var addedChildren = update.getAddedChildren();
            if (addedChildren) {
                Echo.Render.renderComponentAdd(update, addedChildren[0], this.element);
            }
            var modelUpdate = update.getUpdatedProperty("model");
            var stateModelUpdate = update.getUpdatedProperty("stateModel");
            
            var reOpenMenu = this.maskDeployed && (modelUpdate || stateModelUpdate);
            if (reOpenMenu) {
                this.deactivate();
            }
            if (modelUpdate) {
                this.menuModel = modelUpdate.newValue;
            }
            if (stateModelUpdate) {
                this.stateModel = stateModelUpdate.newValue;
            }
            if (reOpenMenu) {
                this.activate();
                this.activateItem(this.menuModel);
            }
            return false;
        }
        // full update
        Extras.Sync.Menu.prototype.renderUpdate.call(this, update);
        return true;
    }
});

//FIXME 'selection' property should be an itemmodel id.  We should have a remote peer for this path-string business.
/**
 * Component rendering peer: DropDownMenu
 */
Extras.Sync.DropDownMenu = Core.extend(Extras.Sync.Menu, {

    $load: function() {
        Echo.Render.registerPeer("Extras.DropDownMenu", this);
    },
    
    /**
     * DIV containing selected item / root content.
     * @type Element
     */
    _contentDiv: null,

    /**
     * The selected item.
     * @type Extras.ItemModel
     */
    _selectedItem: null,
    
    /**
     * Creates the selection item content to display as the menu's root node.
     * 
     * @param {Extras.ItemModel} itemModel the selected item
     */
    _createSelectionContent: function(itemModel) {
        var img;
        if (itemModel.icon) {
            if (itemModel.text) {
                // Render Text and Icon
                var table = document.createElement("table");
                table.style.cssText = "border-collapse:collapse;padding:0;";
                var tbody = document.createElement("tbody");
                var tr = document.createElement("tr");
                var td = document.createElement("td");
                td.style.cssText = "padding:0vertical-align:top;";
                img = document.createElement("img");
                Echo.Sync.ImageReference.renderImg(itemModel.icon, img);
                td.appendChild(img);
                tr.appendChild(td);
                td = document.createElement("td");
                td.style.cssText = "padding:width:3px;";
                var spacingDiv = document.createElement("div");
                spacingDiv.style.cssText = "width:3px";
                td.appendChild(spacingDiv);
                tr.appendChild(td);
                td = document.createElement("td");
                td.style.cssText = "padding:0vertical-align:top;";
                td.appendChild(document.createTextNode(itemModel.text));
                tr.appendChild(td);
                tbody.appendChild(tr);
                table.appendChild(tbody);
                return table;
            } else {
                // Render Icon Only
                img = document.createElement("img");
                Echo.Sync.ImageReference.renderImg(itemModel.icon, img);
                return img;
            }
        } else {
            // Text (or Empty)
            return document.createTextNode(itemModel.text ? itemModel.text : "\u00a0");
        }
    },

    /** @see Extras.Sync.Menu#getSubMenuPosition */
    getSubMenuPosition: function(menuModel) {
        var bounds = new Core.Web.Measure.Bounds(this.element);
        return { x: bounds.left, y: bounds.top + bounds.height };
    },
    
    /** 
     * Processes a menu action, updating selection state if selection is enabled.
     * 
     * @see Extras.Sync.Menu#processAction 
     */
    processAction: function(itemModel) {
        if (this.component.render("selectionEnabled")) {
            this._setSelection(itemModel);
        }
        var path = itemModel.getItemPositionPath().join(".");
        this.component.set("selection", path);
        Extras.Sync.Menu.prototype.processAction.call(this, itemModel);
    },

    /**
     * Processes a mouse click event.
     * 
     * @param e the event
     */
    _processClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return true;
        }
        
        Core.Web.DOM.preventEventDefault(e);
    
        this.activate();
        this.activateItem(this.menuModel);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Core.Web.Event.removeAll(this.element);
        this._contentDiv = null;
        Extras.Sync.Menu.prototype.renderDispose.call(this, update);
    },
    
    /** @see Extras.Sync.Menu#renderMain */
    renderMain: function() {
        var dropDownDiv = document.createElement("div");
        dropDownDiv.id = this.component.renderId;
        dropDownDiv.style.cssText = "overflow:hidden;cursor:pointer;";
        
        Echo.Sync.LayoutDirection.render(this.component.getLayoutDirection(), dropDownDiv);
        Echo.Sync.Color.render(this.component.render("foreground", Extras.Sync.Menu.DEFAULTS.foreground), dropDownDiv, "color");
        Echo.Sync.Color.render(this.component.render("background", Extras.Sync.Menu.DEFAULTS.background), 
                dropDownDiv, "backgroundColor");
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), dropDownDiv); 
        Echo.Sync.Border.render(this.component.render("border", Extras.Sync.Menu.DEFAULTS.border), dropDownDiv); 
        Echo.Sync.Extent.render(this.component.render("width"), dropDownDiv, "width", true, true);
        Echo.Sync.Extent.render(this.component.render("height"), dropDownDiv, "height", false, true);

        var relativeDiv = document.createElement("div");
        relativeDiv.style.cssText = "float:right;position:relative;";
        dropDownDiv.appendChild(relativeDiv);

        var expandDiv = document.createElement("div");
        expandDiv.style.cssText = "position:absolute;top:2px;right:2px;";
        var expandIcon = this.component.render("expandIcon", this.client.getResourceUrl("Extras", "image/menu/ArrowDown.gif"));
        var img = document.createElement("img");
        Echo.Sync.ImageReference.renderImg(expandIcon, img);
        expandDiv.appendChild(img);
        relativeDiv.appendChild(expandDiv);
  
        this._contentDiv = document.createElement("div");
        this._contentDiv.style.cssText = "float:left;";
        if (!this.component.render("lineWrap")) {
            this._contentDiv.style.whiteSpace = "nowrap";
        }
        Echo.Sync.Insets.render(this.component.render("insets", "2px 5px"), this._contentDiv, "padding");
        Echo.Sync.Font.render(this.component.render("font"), this._contentDiv);
        dropDownDiv.appendChild(this._contentDiv);
        
        var clearDiv = document.createElement("div");
        clearDiv.style.cssText = "clear:both;";
        dropDownDiv.appendChild(clearDiv);

        Core.Web.Event.add(dropDownDiv, "click", Core.method(this, this._processClick), false);
        Core.Web.Event.Selection.disable(dropDownDiv);

        if (this.component.render("selectionEnabled")) {
            var selection = this.component.render("selection");
            if (selection) {
                this._selectedItem = this.menuModel.getItemModelFromPositions(selection.split("."));
            }
        } else {
            this._selectedItem = null;
        }
        
        if (this._selectedItem) {
            this._contentDiv.appendChild(this._createSelectionContent(this._selectedItem));
        } else {
            var contentText = this.component.render("selectionText");
            this._contentDiv.appendChild(document.createTextNode(contentText ? contentText : "\u00a0"));
        }
        
        if (!this.component.render("height")) {
            var contentBounds = new Core.Web.Measure.Bounds(this._contentDiv);
            relativeDiv.style.height = contentBounds.height + "px";
        }

        return dropDownDiv;
    },

    /**
     * Sets the selection to the given menu model.
     *
     * @param itemModel the model to select
     */
    _setSelection: function(itemModel) {
        this._selectedItem = itemModel;
        for (var i = this._contentDiv.childNodes.length - 1; i >= 0; --i) {
            this._contentDiv.removeChild(this._contentDiv.childNodes[i]);
        }
        this._contentDiv.appendChild(this._createSelectionContent(itemModel));
    }
});    

/**
 * Component rendering peer: MenuBarPane
 */
Extras.Sync.MenuBarPane = Core.extend(Extras.Sync.Menu, {

    $static: {
    
        /**
         * Default rendering values used when component does not specify a property value.
         */
        DEFAULTS: {
            itemInsets: "0px 12px",
            insets: "3px 0px"
        }
    },
    
    $load: function() {
       Echo.Render.registerPeer("Extras.MenuBarPane", this);
    },
    
    /**
     * The currently active menu item.
     * @type Extras.ItemModel
     */
    _activeItem: null,
    
    /**
     * The menu bar's main TABLE element.
     * @type Element
     */
    _menuBarTable: null,
    
    /**
     * The total height contribution of the menu bar's border, in pixels.
     * @type Number
     */
    _menuBarBorderHeight: null,
    
    /**
     * Mapping between model ids and menu item TD elements.
     * @type Object
     */
    itemElements: null,
    
    /**
     * Constructor.
     */
    $construct: function() {
        Extras.Sync.Menu.call(this);
        this.itemElements = { };
    },
    
    /** @see Extras.Sync.Menu#activate */
    activate: function() {
        if (Extras.Sync.Menu.prototype.activate.call(this)) {
            this.addMenu(this);
        }
    },

    /**
     * Closes the menu.
     */
    close: function() {
        if (this._activeItem) {
            this._setItemHighlight(this._activeItem, false);
            this._activeItem = null;
        }
    },
    
    /**
     * Returns the menu item TD element which is a parent of the specified element.
     * 
     * @param element an element which is a descendant of a TD element representing a menu item
     * @return the TD element
     * @type Element
     */
    _getItemElement: function(element) {
        if (element == null) {
            return null;
        }
        // Find TD element.
        while (element.nodeName.toLowerCase() != "td") {
            if (element == this.element) {
                return null;
            }
            element = element.parentNode;
        }
        return element;
    },
    
    /**
     * Determines a ItemModel id based on a menu item DOM element.
     * 
     * @param element the DOM element
     * @return the ItemModel id
     * @type String
     */
    _getItemModel: function(element) {
        var itemModelId = null;
        element = this._getItemElement(element);
        if (element == null) {
            return null;
        }

        // Find item model id of clicked element.
        for (var x in this.itemElements) {
            if (this.itemElements[x] == element) {
                itemModelId = x;
                break;
            }
        }

        if (itemModelId == null) {
            return null;
        } else {
            return this.menuModel.findItem(itemModelId);
        }
    },
    
    /** @see Echo.Render.ComponnetSync#getPreferredSize */
    getPreferredSize: function() {
        this._menuBarTable.style.height = "";
        var insets = Echo.Sync.Insets.toPixels(this.component.render("insets", Extras.Sync.MenuBarPane.DEFAULTS.insets));
        return { height: new Core.Web.Measure.Bounds(this.element).height + insets.top + insets.bottom };
    },
    
    /** @see Extras.Sync.Menu#getSubMenuPosition */
    getSubMenuPosition: function(menuModel) {
        var itemElement = this.itemElements[menuModel.id];
        if (!itemElement) {
            throw new Error("Invalid menu: " + menuModel);
        }
        
        var containerBounds = new Core.Web.Measure.Bounds(this.element);
        var itemBounds = new Core.Web.Measure.Bounds(itemElement);

        return { x: itemBounds.left, y: containerBounds.top + containerBounds.height };
    },
    
    /**
     * Processes a mouse click event.
     * 
     * @param e the event
     */
    _processClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        
        Core.Web.DOM.preventEventDefault(e);

        var itemModel = this._getItemModel(Core.Web.DOM.getEventTarget(e));
        if (itemModel) {
            if (itemModel instanceof Extras.OptionModel) {
                this.deactivate();
                this.processAction(itemModel);
            } else {
                this.activate();
                this._setActiveItem(itemModel, true);
            }
        } else {
            this.deactivate();
        }
    },
    
    /**
     * Processes a mouse rollover enter event.
     * 
     * @param e the event
     */
    _processItemEnter: function(e) {
        this._processRollover(e, true);
    },
    
    /**
     * Processes a mouse rollover exit event.
     * 
     * @param e the event
     */
    _processItemExit: function(e) {
        this._processRollover(e, false);
    },
    
    /**
     * Processes mouse rollover events.
     * 
     * @param e the event
     * @param {Boolean} state the rollover state, true indicating the mouse is currently rolled over an item
     */
    _processRollover: function(e, state) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return true;
        }
        
        var element = this._getItemElement(Core.Web.DOM.getEventTarget(e));
        if (!element) {
            return;
        }
        var itemModel = this._getItemModel(element);
        
        if (this.stateModel && !this.stateModel.isEnabled(itemModel.modelId)) {
            return;
        }
        
        if (this.active) {
            if (state) {
                this._setActiveItem(itemModel, itemModel instanceof Extras.MenuModel);
            }
        } else {
            this._setItemHighlight(itemModel, state);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this.element);
        var bounds = new Core.Web.Measure.Bounds(this.element.parentNode);
        var height = bounds.height - this._menuBarBorderHeight;
        this._menuBarTable.style.height = height <= 0 ? "" : height + "px";
    },

    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._menuBarTable = null;
        Core.Web.Event.removeAll(this.element);
        Extras.Sync.Menu.prototype.renderDispose.call(this, update);
    },
    
    /** @see Extras.Sync.Menu#renderMain */
    renderMain: function(update) {
        var menuBarDiv = document.createElement("div");
        menuBarDiv.id = this.component.renderId;
        menuBarDiv.style.cssText = "overflow:hidden;";
        
        Echo.Sync.renderComponentDefaults(this.component, menuBarDiv);
        var border = this.component.render("border", Extras.Sync.Menu.DEFAULTS.border);
        var multisided = Echo.Sync.Border.isMultisided(border);
        this._menuBarBorderHeight = Echo.Sync.Border.getPixelSize(border, "top") + Echo.Sync.Border.getPixelSize(border, "bottom");
        Echo.Sync.Border.render(multisided ? border.top : border, menuBarDiv, "borderTop");
        Echo.Sync.Border.render(multisided ? border.bottom : border, menuBarDiv, "borderBottom");
        Echo.Sync.FillImage.render(this.component.render("backgroundImage"), menuBarDiv); 
        
        this._menuBarTable = document.createElement("table");
        this._menuBarTable.style.borderCollapse = "collapse";
        menuBarDiv.appendChild(this._menuBarTable);
        
        var menuBarTbody = document.createElement("tbody");
        this._menuBarTable.appendChild(menuBarTbody);
        
        var menuBarTr = document.createElement("tr");
        menuBarTbody.appendChild(menuBarTr);
        
        if (this.menuModel == null || this.menuModel.items.length === 0) {
            menuBarTr.appendChild(this._createMenuBarItem("\u00a0", null));
        } else {
            var items = this.menuModel.items;
            for (var i = 0; i < items.length; ++i) {
                var item = items[i];
                if (item instanceof Extras.OptionModel || item instanceof Extras.MenuModel) {
                    var menuBarItemTd = this._createMenuBarItem(item.text, item.icon);
                    menuBarTr.appendChild(menuBarItemTd);
                    this.itemElements[item.id] = menuBarItemTd;
                }
            }

            Core.Web.Event.add(menuBarDiv, "click", Core.method(this, this._processClick), false);
            Core.Web.Event.add(menuBarDiv, "mouseover", Core.method(this, this._processItemEnter), false);
            Core.Web.Event.add(menuBarDiv, "mouseout", Core.method(this, this._processItemExit), false);
        }
        
        Core.Web.Event.Selection.disable(menuBarDiv);
        
        return menuBarDiv;
    },
    
    _createMenuBarItem: function(text, icon) {
        var menuBarItemTd = document.createElement("td");
        menuBarItemTd.style.padding = "0px";
        menuBarItemTd.style.cursor = "pointer";
        
        var menuBarItemDiv = document.createElement("div");
        menuBarItemDiv.style.whiteSpace = "nowrap";
        Echo.Sync.Insets.render(Extras.Sync.MenuBarPane.DEFAULTS.itemInsets, menuBarItemDiv, "padding");
        
        menuBarItemTd.appendChild(menuBarItemDiv);
        if (icon) {
            // FIXME no load listeners being set on images for auto-resizing yet.
            var img = document.createElement("img");
            img.style.verticalAlign = "middle";
            img.src = icon;
            menuBarItemDiv.appendChild(img);
            if (text) {
                // FIXME Does not handle RTL.
                img.style.paddingRight = "1ex";
            }
        }
        if (text) {
            var textSpan = document.createElement("span");
            textSpan.style.verticalAlign = "middle";
            textSpan.appendChild(document.createTextNode(text));
            menuBarItemDiv.appendChild(textSpan);
        }
        return menuBarItemTd;
    },
    
    /**
     * Sets the active item.
     * 
     * @param {Extras.ItemModel} itemModel the item
     * @param {Boolean} execute flag indicating whether the item should be executed
     */
    _setActiveItem: function(itemModel, execute) {
        if (this._activeItem == itemModel) {
            return;
        }
        
        if (this._activeItem) {
            this._setItemHighlight(this._activeItem, false);
            this._activeItem = null;
        }
    
        if (execute) {
            this.activateItem(itemModel);
        }

        if (itemModel) {
            this._activeItem = itemModel;
            this._setItemHighlight(this._activeItem, true);
        }
    },
    
    /**
     * Sets the highlight state of an item.
     * 
     * @param {Extras.ItemModel} itemModel the item
     * @param {Boolean} state the highlight state
     */
    _setItemHighlight: function(itemModel, state) {
        var element = this.itemElements[itemModel.id];
        if (state) {
            Echo.Sync.FillImage.render(this.component.render("selectionBackgroundImage"), element);
            Echo.Sync.Color.render(this.component.render("selectionBackground", 
                    Extras.Sync.Menu.DEFAULTS.selectionBackground), element, "backgroundColor");
            Echo.Sync.Color.render(this.component.render("selectionForeground", 
                    Extras.Sync.Menu.DEFAULTS.selectionForeground), element, "color");
        } else {
            element.style.backgroundImage = "";
            element.style.backgroundColor = "";
            element.style.color = "";
        } 
    }
});
/**
 * Component rendering peer: Reorder
 */
Extras.Reorder.Sync = Core.extend(Echo.Render.ComponentSync, {
    
    $load: function() {
        Echo.Render.registerPeer("Extras.Reorder", this);
    },
    
    _div: null,
    _mouseUpRef: null,
    _mouseMoveRef: null,
    _movingDiv: null,
    _dragDiv: null,
    _overlayDiv: null,
    _order: null,
    
    _sourceIndex: null,
    _targetIndex: null,
    
    /**
     * Array of <code>Core.Web.Measure.Bounds</code> instances describing boundaries of child elements.
     * Indices of this array correspond to render ordered of child elements.  This array is nulled when
     * elements are reordered, and recalculated by <code>_getIndex()</code> when required.
     * @type Array
     */
    _childBounds: null,
    
    $construct: function() {
        this._mouseUpRef = Core.method(this, this._mouseUp);
        this._mouseMoveRef = Core.method(this, this._mouseMove);
    },
    
    /**
     * Starts a drag operation.
     */
    _dragStart: function() {
        this._dragStop();

        this._overlayDiv = document.createElement("div");
        this._overlayDiv.style.cssText = "position:absolute;z-index:30000;width:100%;height:100%;cursor:pointer;";
        Echo.Sync.FillImage.render(this.client.getResourceUrl("Echo", "resource/Transparent.gif"), this._overlayDiv);
 
        document.body.appendChild(this._overlayDiv);

        Core.Web.Event.add(document.body, "mousemove", this._mouseMoveRef, true);
        Core.Web.Event.add(document.body, "mouseup", this._mouseUpRef, true);
    },
    
    /**
     * Stop a drag operation.
     */
    _dragStop: function() {
        Core.Web.Event.remove(document.body, "mousemove", this._mouseMoveRef, true);
        Core.Web.Event.remove(document.body, "mouseup", this._mouseUpRef, true);

        if (this._overlayDiv) {
            document.body.removeChild(this._overlayDiv);
            this._overlayDiv = null;
        }
    },
    
    /**
     * Determines the index of the child element at the specified y-coordinate.
     * 
     * @param mouseY the event clientY value, i.e., distance from top of screen.
     */
    _getIndex: function(mouseY) {
        if (!this._childBounds) {
            this._childBounds = [];
            var childDiv = this._div.firstChild;
            while (childDiv) {
                this._childBounds.push(new Core.Web.Measure.Bounds(childDiv));
                childDiv = childDiv.nextSibling;
            }
        }
        
        if (mouseY < this._childBounds[0].top) {
            // Before first index: return first index.
            return 0;
        }

        for (var i = 0; i < this._childBounds.length; ++i) {
            if (mouseY >= this._childBounds[i].top && 
                    mouseY <= this._childBounds[i].top + this._childBounds[i].height) {
                return i;
            }
        }
        
        // After last index: return last index.
        return this._childBounds.length - 1;
    },
    
    _mouseDown: function(e) {
        var handle = null,
            index,
            node = e.target;
        while (node != null && node != this._div) {
            if (node.__REORDER_HANDLE) {
                handle = node;
                break;
            }
            node = node.parentNode;
        }
        if (!handle) {
            return;
        }
        
        Core.Web.dragInProgress = true;
        Core.Web.DOM.preventEventDefault(e);
        
        while (node.parentNode != this._div) {
            node = node.parentNode;
        }
        this._movingDiv = node;
        
        node = this._div.firstChild;
        index = 0;
        while (node != this._movingDiv) {
            node = node.nextSibling;
            ++index;
        }
        
        this._sourceIndex = index;
        this._targetIndex = index;
        
        this._dragStart();
        
        this._movingDivBounds = new Core.Web.Measure.Bounds(this._movingDiv);
        
        this._dragOffsetY =  e.clientY - this._movingDivBounds.top;
        
        this._dragDiv = this._movingDiv.cloneNode(true);
        this._dragDiv.style.opacity = 0.8;
        this._dragDiv.style.position = "absolute";
        this._dragDiv.style.zIndex = 1000;
        this._dragDiv.style.left = this._movingDivBounds.left + "px";
        this._dragDiv.style.top = this._movingDivBounds.top + "px";
        this._dragDiv.style.width = this._movingDivBounds.width + "px";
        this._dragDiv.style.height = this._movingDivBounds.height + "px";
        document.body.appendChild(this._dragDiv);

        this._movingDiv.style.visibility = "hidden";
    },
    
    _mouseMove: function(e) {
        this._dragDiv.style.top = (e.clientY - this._dragOffsetY) + "px";
        var hoverIndex = this._getIndex(e.clientY);
        if (hoverIndex != this._targetIndex) {
            this._div.removeChild(this._movingDiv);
            if (hoverIndex < this._div.childNodes.length) {
                this._div.insertBefore(this._movingDiv, this._div.childNodes[hoverIndex]);
            } else {
                this._div.appendChild(this._movingDiv);
            }
            this._childBounds = null;
            this._targetIndex = hoverIndex; 
        }
    },
    
    _mouseUp: function(e) {
        Core.Web.dragInProgress = false;
        document.body.removeChild(this._dragDiv);
        this._dragDiv = null;
        
        this._dragStop();
        
        this._movingDiv.style.visibility = "visible";
        this._movingDiv = null;
        this.component.reorder(this._sourceIndex, this._targetIndex);
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parent) {
        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        this._div.style.cssText = "";
        
        var order = this.component.getOrder();
        for (var i = 0; i < order.length; ++i) {
            var cell = document.createElement("div");
            Echo.Render.renderComponentAdd(update, this.component.children[order[i]], cell);
            this._div.appendChild(cell);
        }
        
        Core.Web.Event.add(this._div, "mousedown", Core.method(this, this._mouseDown));
        parent.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Core.Web.Event.removeAll(this._div);
        this._div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        this.renderDispose(update);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});

/**
 * Component rendering peer: Reorder.Handle
 */
Extras.Reorder.Handle.Sync = Core.extend(Echo.Render.ComponentSync, {
    
    $load: function() {
        Echo.Render.registerPeer("Extras.Reorder.Handle", this);
    },
    
    _span: null,
    _img: null,
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parent) {
        this._span = document.createElement("span");
        this._span.__REORDER_HANDLE = true;
        this._span.id = this.component.renderId;
        this._span.style.cssText = "cursor:pointer;";
        
        this._img = document.createElement("img");
        this._img.src = this.component.render("icon", this.client.getResourceUrl("Extras", "image/reorder/Icon32Move.png"));
        this._span.appendChild(this._img);
        
        parent.appendChild(this._span);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Core.Web.Event.removeAll(this._span);
        this._span = null;
        this._img = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._span;
        var containerElement = element.parentNode;
        this.renderDispose(update);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return false; // Does not allow child components.
    }
});
/**
 * Component rendering peer: RichTextArea
 */
Extras.Sync.RichTextArea = Core.extend(Echo.Arc.ComponentSync, {
    
    $static: {

        /**
         * Default rendering values used when component does not specify a property value.
         */
        DEFAULTS: {
    
            /**
             * Default style object applied to control panes.
             */
            controlPaneStyle: {
                separatorColor: "#dfdfef",
                separatorHeight: 1,
                autoPositioned: true
            },
            
            /**
             * Default style object applied to control pane option button container rows.
             */
            controlPaneRowStyle: {
                insets: "2px 10px",
                cellSpacing: 3,
                layoutData: {
                    overflow: Echo.SplitPane.OVERFLOW_HIDDEN,
                    background: "#cfcfdf"
                }
            },
            
            /**
             * Default style object applied to control pane option buttons.
             */
            controlPaneButtonStyle: {
                insets: "0px 8px",
                lineWrap: false,
                foreground: "#000000",
                rolloverEnabled: true,
                rolloverForeground: "#6f0f0f"
            },
            
            /**
             * Default enabled feature set.
             */
            features: {
                menu: true, toolbar: true, undo: true, clipboard: true, alignment: true, foreground: true, background: true,
                list: true, table: true, image: true, horizontalRule: true, hyperlink: true, subscript: true, 
                bold: true, italic: true, underline: true, strikethrough: true, paragraphStyle: true, indent: true
            }
        },
        
        /**
         * Default localization strings.
         */
        resource: new Core.ResourceBundle({
            "ColorDialog.Title.Foreground":     "Text Color",
            "ColorDialog.Title.Background":     "Highlight Color",
            "ColorDialog.PromptForeground":     "Foreground:",
            "ColorDialog.PromptBackground":     "Background:",
            "Error.ClipboardAccessDisabled":    "This browser has clipboard access disabled. " + 
                                                "Use keyboard shortcuts or change your security settings.",
            "Generic.Cancel":                   "Cancel",
            "Generic.Error":                    "Error",
            "Generic.Ok":                       "Ok",
            "HyperlinkDialog.Title":            "Insert Hyperlink",
            "HyperlinkDialog.PromptURL":        "URL:",
            "HyperlinkDialog.PromptDescription":
                                                "Description Text:",
            "HyperlinkDialog.ErrorDialogTitle": "Cannot Insert Hyperlink",
            "HyperlinkDialog.ErrorDialog.URL":  "The URL entered is not valid.",
            "ImageDialog.Title":                "Insert Image",
            "ImageDialog.PromptURL":            "URL:",
            "ImageDialog.ErrorDialogTitle":     "Cannot Insert Image",
            "ImageDialog.ErrorDialog.URL":      "The URL entered is not valid.",
            "Menu.Edit":                        "Edit",
            "Menu.Undo":                        "Undo",
            "Menu.Redo":                        "Redo",
            "Menu.Cut":                         "Cut",
            "Menu.Copy":                        "Copy",
            "Menu.Paste":                       "Paste",
            "Menu.Delete":                      "Delete",
            "Menu.SelectAll":                   "Select All",
            "Menu.Insert":                      "Insert",
            "Menu.InsertImage":                 "Image...",
            "Menu.InsertHyperlink":             "Hyperlink...",
            "Menu.InsertHorizontalRule":        "Horizontal Rule",
            "Menu.Table":                       "Table",
            "Menu.Table.New":                   "New Table...",
            "Menu.Table.DeleteRow":             "Delete Row",
            "Menu.Table.DeleteColumn":          "Delete Column",
            "Menu.Table.InsertRow":             "Insert Row",
            "Menu.Table.InsertColumn":          "Insert Column",
            "Menu.BulletedList":                "Bulleted List",
            "Menu.NumberedList":                "Numbered List",
            "Menu.Format":                      "Format",
            "Menu.Bold":                        "Bold",
            "Menu.Italic":                      "Italic",
            "Menu.Underline":                   "Underline",
            "Menu.Strikethrough":               "Strikethrough",
            "Menu.Superscript":                 "Superscript",
            "Menu.Subscript":                   "Subscript",
            "Menu.PlainText":                   "Plain Text",
            "Menu.TextStyle":                   "Text Style",
            "Menu.ParagraphStyle":              "Paragraph Style",
            "Menu.Alignment":                   "Alignment",
            "Menu.Left":                        "Left",
            "Menu.Right":                       "Right",
            "Menu.Center":                      "Center",
            "Menu.Justified":                   "Justified",
            "Menu.Indent":                      "Indent",
            "Menu.Outdent":                     "Outdent",
            "Menu.SetForeground":               "Set Text Color...",
            "Menu.SetBackground":               "Set Highlight Color...",
            "Menu.Heading1":                    "Heading 1",
            "Menu.Heading2":                    "Heading 2",
            "Menu.Heading3":                    "Heading 3",
            "Menu.Heading4":                    "Heading 4",
            "Menu.Heading5":                    "Heading 5",
            "Menu.Heading6":                    "Heading 6",
            "Menu.Normal":                      "Normal",
            "Menu.Preformatted":                "Preformatted",
            "TableDialog.Title":                "Insert Table",
            "TableDialog.PromptRows":           "Rows:",
            "TableDialog.PromptColumns":        "Columns:",
            "TableDialog.ErrorDialogTitle":     "Cannot Insert Table",
            "TableDialog.ErrorDialog.Columns":  "The entered columns value is not valid.  " +
                                                "Please specify a number between 1 and 50.",
            "TableDialog.ErrorDialog.Rows":     "The entered rows value is not valid.  Please specify a number between 1 and 50."
        })
    },
    
    /**
     * Method reference to _processDialogClose().
     * @type Function
     */
    _processDialogCloseRef: null,

    /**
     * Listener to receive execCommand events from component.
     * @type Function
     */
    _execCommandListener: null,

    $load: function() {
        Echo.Render.registerPeer("Extras.RichTextArea", this);
    },

    $virtual: {
    
        /**
         * Creates/returns the icon set for this RichTextArea.
         * 
         * @return the icon set (name to URL mapping) object
         */
        getIcons: function() {
            var icons = this._getDefaultIcons();
            var customIcons = this.component.get("icons");
            if (customIcons) {
                for (var x in customIcons) {
                    icons[x] = customIcons[x];
                }
            }
            return icons;
        },
        
        /**
         * Event handler for user request (from menu/toolbar) to insert a hyperlink.
         * 
         * @param e the event
         */
        processInsertHyperlink: function(e) {
            var hyperlinkDialog = new Extras.Sync.RichTextArea.HyperlinkDialog(this.component);
            hyperlinkDialog.addListener("insertHyperlink", Core.method(this, function(e) {
                this._richTextInput.insertHtml("<a href=\"" + e.data.url + "\">" +
                        (e.data.description ? e.data.description : e.data.url) + "</a>");
                this.focusDocument();
            }));
            this._openDialog(hyperlinkDialog);
        },
        
        /**
         * Event handler for user request (from menu/toolbar) to insert an image.
         * 
         * @param e the event
         */
        processInsertImage: function(e) {
            var imageDialog = new Extras.Sync.RichTextArea.ImageDialog(this.component);
            imageDialog.addListener("insertImage", Core.method(this, function(e) {
                this._richTextInput.insertHtml("<img src=\"" + e.data.url + "\">");
                this.focusDocument();
            }));
            this._openDialog(imageDialog);
        },

        /**
         * Event handler for user request (from menu/toolbar) to insert a table.
         * 
         * @param e the event
         */
        processInsertTable: function(e) {
            var tableDialog = new Extras.Sync.RichTextArea.TableDialog(this.component);
            tableDialog.addListener("insertTable", Core.method(this, function(e) {
                this.newTable(e.data.columns, e.data.rows);
                this.focusDocument();
            }));
            this._openDialog(tableDialog);
        },

        /**
         * Event handler for user request (from menu/toolbar) to set the background color.
         * 
         * @param e the event
         */
        processSetBackground: function(e) {
            var colorDialog = new Extras.Sync.RichTextArea.ColorDialog(this.component, true,
                    this._toolbarButtons.background.get("color"));
            colorDialog.addListener("colorSelect", Core.method(this, function(e) {
                this.execCommand("background", e.data);
                this._toolbarButtons.background.set("color", e.data);
                this.focusDocument();
            }));
            this._openDialog(colorDialog);
        },
        
        /**
         * Event handler for user request (from menu/toolbar) to set the foreground color.
         * 
         * @param e the event
         */
        processSetForeground: function(e) {
            var colorDialog = new Extras.Sync.RichTextArea.ColorDialog(this.component, false,
                    this._toolbarButtons.foreground.get("color"));
            colorDialog.addListener("colorSelect", Core.method(this, function(e) {
                this.execCommand("foreground", e.data);
                this._toolbarButtons.foreground.set("color", e.data);
                this.focusDocument();
            }));
            this._openDialog(colorDialog);
        }
    },
    
    /**
     * Localized messages for rendered locale.
     */
    msg: null,
    
    /**
     * Mapping between icon names and icon URLs.
     */
    icons: null,
    
    /**
     * {Boolean} Flag indicating whether the parent component is a pane, and thus whether the RichTextArea should consume
     * horizontal and vertical space.
     * @type Boolean
     */
    _paneRender: false,
    
    /**
     * Mapping between toolbar button action commands and toolbar buttons.
     */
    _toolbarButtons: null,
    
    /**
     * Style selection drop down.
     * @type Echo.SelectField
     */
    _styleSelect: null,
    
    /**
     * The rich text input component.
     * 
     * @type Extras.RichTextInput
     */
    _richTextInput: null,
    
    /**
     * Root rendered DIV element.
     */
    _mainDiv: null,
    
    /** Constructor. */
    $construct: function() {
        this._execCommandListener = Core.method(this, function(e) {
            this.execCommand(e.commandName, e.value);
        });
        this._processDialogCloseRef = Core.method(this, this._processDialogClose);
        this._toolbarButtons = { };
    },
    
    /**
     * Adds listeners to supported Extras.RichTextArea object.
     */
    _addComponentListeners: function() {
        this.component.addListener("execCommand", this._execCommandListener);
    },

    /** @see #Echo.Arc.ComponentSync#createComponent */
    createComponent: function() {
        var features = this.component.render("features", Extras.Sync.RichTextArea.DEFAULTS.features);

        var contentPane = new Echo.ContentPane();
        var cursor = contentPane;

        if (features.menu) {
            var menuSplitPane = new Echo.SplitPane({
                orientation: Echo.SplitPane.ORIENTATION_VERTICAL_TOP_BOTTOM,
                autoPositioned: true,
                children: [
                    this._createMenu()
                ]
            });
            cursor.add(menuSplitPane);
            cursor = menuSplitPane;
        }
        
        if (features.toolbar) {
            var toolbarContainer = new Echo.SplitPane({
                orientation: Echo.SplitPane.ORIENTATION_VERTICAL_TOP_BOTTOM,
                autoPositioned: true,
                children: [
                    this._createToolbar()
                ]
            });
            cursor.add(toolbarContainer);
            cursor = toolbarContainer;
        }
        
        this._richTextInput = new Extras.RichTextInput({
            layoutData: {
                overflow: Echo.SplitPane.OVERFLOW_HIDDEN
            },
            background: this.component.render("background"),
            backgroundImage: this.component.render("backgroundImage"),
            border: this.component.render("border"),
            foreground: this.component.render("foreground"),
            text: this.component.get("text"),
            events: {
                action: Core.method(this, function(e) {
                    this.component.doAction();
                }),
                cursorStyleChange: Core.method(this, this._processCursorStyleChange),
                property: Core.method(this, function(e) {
                    if (e.propertyName == "text") {
                        this._processTextUpdate(e);
                    }
                })
            }
        });
        cursor.add(this._richTextInput);
        
        return contentPane;
    },
    
    /**
     * Creates the model for the menu bar based on enable feature set.
     *
     * @return the menu model
     * @type Extras.MenuModel
     */
    _createMainMenuBarModel: function() {
        var features = this.component.render("features", Extras.Sync.RichTextArea.DEFAULTS.features);
        var menu = new Extras.MenuModel(null, null, null);
        
        if (features.undo || features.clipboard) {
            var editMenu = new Extras.MenuModel(null, this.msg["Menu.Edit"], null);
            if (features.undo) {
                editMenu.addItem(new Extras.OptionModel("/undo", this.msg["Menu.Undo"], this.icons.undo));
                editMenu.addItem(new Extras.OptionModel("/redo", this.msg["Menu.Redo"], this.icons.redo));
            }
            if (features.undo && features.clipboard) {
                editMenu.addItem(new Extras.SeparatorModel());
            }
            if (features.clipboard) {
                editMenu.addItem(new Extras.OptionModel("cut", this.msg["Menu.Cut"], this.icons.cut));
                editMenu.addItem(new Extras.OptionModel("copy", this.msg["Menu.Copy"], this.icons.copy));
                editMenu.addItem(new Extras.OptionModel("paste", this.msg["Menu.Paste"], this.icons.paste));
                editMenu.addItem(new Extras.OptionModel("delete", this.msg["Menu.Delete"], this.icons["delete"]));
                editMenu.addItem(new Extras.SeparatorModel());
                editMenu.addItem(new Extras.OptionModel("/selectall", this.msg["Menu.SelectAll"], this.icons.selectAll));
            }
            menu.addItem(editMenu);
        }
        
        if (features.list || features.horizontalRule || features.image || features.hyperlink) {
            var insertMenu = new Extras.MenuModel(null, this.msg["Menu.Insert"], null);
            if (features.list || features.unorderedList) {
                insertMenu.addItem(new Extras.OptionModel("/insertunorderedlist", this.msg["Menu.BulletedList"],
                        this.icons.bulletedList));
            }
            if (features.list || features.orderedList) {
                insertMenu.addItem(new Extras.OptionModel("/insertorderedlist", this.msg["Menu.NumberedList"],
                        this.icons.numberedList));
            }
            insertMenu.addItem(new Extras.SeparatorModel());
            if (features.horizontalRule) {
                insertMenu.addItem(new Extras.OptionModel("/inserthorizontalrule", this.msg["Menu.InsertHorizontalRule"],
                        this.icons.horizontalRule));
            }
            if (features.image) {
                insertMenu.addItem(new Extras.OptionModel("insertimage", this.msg["Menu.InsertImage"], this.icons.image));
            }
            if (features.hyperlink) {
                insertMenu.addItem(new Extras.OptionModel("inserthyperlink", this.msg["Menu.InsertHyperlink"],
                        this.icons.hyperlink));
            }
            menu.addItem(insertMenu);
        }
        
        if (features.bold || features.italic || features.underline || features.strikeThrough || 
                features.subscript || features.paragraphStyle || features.alignment || features.indent || 
                features.foreground || features.background) {
            var formatMenu =  new Extras.MenuModel(null, this.msg["Menu.Format"], null);
            if (features.bold || features.italic || features.underline || features.strikeThrough || 
                    features.subscript) {
            }
            if (features.paragraphStyle) {
                formatMenu.addItem(new Extras.MenuModel(null, this.msg["Menu.ParagraphStyle"], this.icons.paragraphStyle, [
                    new Extras.OptionModel("/formatblock/<p>", this.msg["Menu.Normal"], this.icons.styleNormal),
                    new Extras.OptionModel("/formatblock/<pre>", this.msg["Menu.Preformatted"], this.icons.stylePreformatted),
                    new Extras.OptionModel("/formatblock/<h1>", this.msg["Menu.Heading1"], this.icons.styleH1),
                    new Extras.OptionModel("/formatblock/<h2>", this.msg["Menu.Heading2"], this.icons.styleH2),
                    new Extras.OptionModel("/formatblock/<h3>", this.msg["Menu.Heading3"], this.icons.styleH3),
                    new Extras.OptionModel("/formatblock/<h4>", this.msg["Menu.Heading4"], this.icons.styleH4),
                    new Extras.OptionModel("/formatblock/<h5>", this.msg["Menu.Heading5"], this.icons.styleH5),
                    new Extras.OptionModel("/formatblock/<h6>", this.msg["Menu.Heading6"], this.icons.styleH6)
                ]));
            }
            if (features.bold || features.italic || features.underline || features.strikeThrough || features.subscript) {
                var textMenu = new Extras.MenuModel(null, this.msg["Menu.TextStyle"], this.icons.textStyle);
                textMenu.addItem(new Extras.OptionModel("/removeformat",  this.msg["Menu.PlainText"], this.icons.plainText));
                textMenu.addItem(new Extras.SeparatorModel());
                if (features.bold) {
                    textMenu.addItem(new Extras.OptionModel("/bold",  this.msg["Menu.Bold"], this.icons.bold));
                }
                if (features.italic) {
                    textMenu.addItem(new Extras.OptionModel("/italic",  this.msg["Menu.Italic"], this.icons.italic));
                }
                if (features.underline) {
                    textMenu.addItem(new Extras.OptionModel("/underline",  this.msg["Menu.Underline"], this.icons.underline));
                }
                if (features.strikethrough) {
                    textMenu.addItem(new Extras.OptionModel("/strikethrough",  this.msg["Menu.Strikethrough"],
                            this.icons.strikethrough));
                }
                textMenu.addItem(new Extras.SeparatorModel());
                if (features.subscript) {
                    textMenu.addItem(new Extras.OptionModel("/superscript", this.msg["Menu.Superscript"], 
                            this.icons.superscript));
                    textMenu.addItem(new Extras.OptionModel("/subscript", this.msg["Menu.Subscript"], this.icons.subscript));
                }
                formatMenu.addItem(textMenu);
            }
            if (features.alignment) {
                formatMenu.addItem(new Extras.MenuModel(null, this.msg["Menu.Alignment"], this.icons.alignment, [
                    new Extras.OptionModel("/justifyleft",  this.msg["Menu.Left"], this.icons.alignmentLeft),
                    new Extras.OptionModel("/justifycenter",  this.msg["Menu.Center"], this.icons.alignmentCenter),
                    new Extras.OptionModel("/justifyright",  this.msg["Menu.Right"], this.icons.alignmentRight),
                    new Extras.OptionModel("/justifyfull",  this.msg["Menu.Justified"], this.icons.alignmentJustify)
                ]));
            }
            formatMenu.addItem(new Extras.SeparatorModel());
            if (features.indent) {
                formatMenu.addItem(new Extras.OptionModel("/indent",  this.msg["Menu.Indent"], this.icons.indent));
                formatMenu.addItem(new Extras.OptionModel("/outdent",  this.msg["Menu.Outdent"], this.icons.outdent));
            }
            formatMenu.addItem(new Extras.SeparatorModel());
            if (features.foreground || features.background) {
                if (features.foreground) {
                    formatMenu.addItem(new Extras.OptionModel("foreground",  this.msg["Menu.SetForeground"], 
                            this.icons.foreground));
                }
                if (features.background) {
                    formatMenu.addItem(new Extras.OptionModel("background",  this.msg["Menu.SetBackground"], 
                            this.icons.background));
                }
            }
            menu.addItem(formatMenu);
        }

        if (features.table) {
            var tableMenu = new Extras.MenuModel(null, this.msg["Menu.Table"], null);
            tableMenu.addItem(new Extras.OptionModel("tableNew", this.msg["Menu.Table.New"], this.icons.table));
            tableMenu.addItem(new Extras.SeparatorModel());
            tableMenu.addItem(new Extras.OptionModel("/tableInsertRow", this.msg["Menu.Table.InsertRow"], 
                    this.icons.tableInsertRow));
            tableMenu.addItem(new Extras.OptionModel("/tableInsertColumn", this.msg["Menu.Table.InsertColumn"], 
                    this.icons.tableInsertColumn));
            tableMenu.addItem(new Extras.SeparatorModel());
            tableMenu.addItem(new Extras.OptionModel("/tableDeleteRow", this.msg["Menu.Table.DeleteRow"], 
                    this.icons.tableDeleteRow));
            tableMenu.addItem(new Extras.OptionModel("/tableDeleteColumn", this.msg["Menu.Table.DeleteColumn"], 
                    this.icons.tableDeleteColumn));
            
            menu.addItem(tableMenu);
        }
        
        return menu;
    },
    
    /**
     * Creates main menu bar component.
     *
     * @return the main menu bar
     * @type Extras.MenuBarPane
     */
    _createMenu: function() {
        return new Extras.MenuBarPane({
            styleName: this.component.render("menuStyleName"),
            model: this._createMainMenuBarModel(),
            events: {
                action: Core.method(this, this._processMenuAction)
            }
        });
    },
    
    /**
     * Creates tool bar component.
     * 
     * @return the toolbar
     * @type Echo.Component
     */
    _createToolbar: function() {
        var row, button;
        var features = this.component.render("features", Extras.Sync.RichTextArea.DEFAULTS.features);
        var controlsRow;
        var panel = new Echo.Panel({
            styleName: this.component.render("toolbarPanelStyleName"),
            layoutData: {
                overflow: Echo.SplitPane.OVERFLOW_HIDDEN
            },
            insets: 2,
            children: [
                controlsRow = new Echo.Row({
                    styleName: this.component.render("toolbarRowStyleName"),
                    cellSpacing: 10
                })
            ]
        });
        
        // Style Dropdown.
        if (features.paragraphStyle) {
            var actionListener = Core.method(this, function(e) {
                var style = this._styleSelect.get("selectedId");
                this._richTextInput.execCommand("formatblock", "<" + style + ">");
            });
            this._styleSelect = new Echo.SelectField({
                items: [
                    { id: "p", text: this.msg["Menu.Normal"] },
                    { id: "pre", text: this.msg["Menu.Preformatted"] },
                    { id: "h1", text: this.msg["Menu.Heading1"] },
                    { id: "h2", text: this.msg["Menu.Heading2"] },
                    { id: "h3", text: this.msg["Menu.Heading3"] },
                    { id: "h4", text: this.msg["Menu.Heading4"] },
                    { id: "h5", text: this.msg["Menu.Heading5"] },
                    { id: "h6", text: this.msg["Menu.Heading6"] }
                ],
                events: {
                    action: actionListener
                }
            });
            controlsRow.add(this._styleSelect);
        }

        // Undo/Redo Tools
        if (features.undo) {
            controlsRow.add(new Echo.Row({
                children: [
                    this._createToolbarButton("<<<", this.icons.undo, this.msg["Menu.Undo"], this._processCommand, "undo"),
                    this._createToolbarButton(">>>", this.icons.redo, this.msg["Menu.Redo"], this._processCommand, "redo")
                ]
            }));
        }
        
        // Font Bold/Italic/Underline Tools
        if (features.bold || features.italic || features.underline) {
            row = new Echo.Row();
            if (features.bold) {
                button = this._createToolbarButton("B", this.icons.bold, this.msg["Menu.Bold"], this._processCommand, "bold");
                button.set("toggle", true);
                row.add(button);
            }
            if (features.italic) {
                button = this._createToolbarButton("I", this.icons.italic, this.msg["Menu.Italic"], 
                        this._processCommand, "italic");
                button.set("toggle", true);
                row.add(button);
            }
            if (features.underline) {
                button = this._createToolbarButton("U", this.icons.underline, this.msg["Menu.Underline"], 
                        this._processCommand, "underline");
                button.set("toggle", true);
                row.add(button);
            }
            controlsRow.add(row);
        }
        
        //Super/Subscript Tools
        if (features.subscript) {
            controlsRow.add(new Echo.Row({
                children: [
                    this._createToolbarButton("^", this.icons.superscript, this.msg["Menu.Superscript"], 
                            this._processCommand, "superscript"),
                    this._createToolbarButton("v", this.icons.subscript,this.msg["Menu.Subscript"], 
                            this._processCommand, "subscript")
                ]
            }));
        }
        
        // Alignment Tools
        if (features.alignment) {
            controlsRow.add(new Echo.Row({
                children: [
                    this._createToolbarButton("<-", this.icons.alignmentLeft, this.msg["Menu.Left"], 
                            this._processCommand, "justifyleft"),
                    this._createToolbarButton("-|-", this.icons.alignmentCenter, this.msg["Menu.Center"], 
                            this._processCommand, "justifycenter"),
                    this._createToolbarButton("->", this.icons.alignmentRight, this.msg["Menu.Right"], 
                            this._processCommand, "justifyright"),
                    this._createToolbarButton("||", this.icons.alignmentJustify, this.msg["Menu.Justified"], 
                            this._processCommand, "justifyfull")
                ]
            }));
        }
        
        // Color Tools
        if (features.foreground || features.background) {
            row = new Echo.Row();
            if (features.foreground) {
                row.add(this._createToolbarButton("FG", this.icons.foreground, this.msg["Menu.SetForeground"], 
                        this.processSetForeground, "foreground"));
            }
            if (features.background) {
                row.add(this._createToolbarButton("BG", this.icons.background, this.msg["Menu.SetBackground"], 
                        this.processSetBackground, "background"));
            }
            controlsRow.add(row);
        }
        
        // Insert Tools
        if (features.list || features.horizontalRule || features.image || features.hyperlink || features.table) {
            row = new Echo.Row();
            if (features.list || features.unorderedList) {
                row.add(this._createToolbarButton("Bulleted List", this.icons.bulletedList, this.msg["Menu.BulletedList"], 
                        this._processCommand, "insertunorderedlist"));
            }
            if (features.list || features.orderedList) {
                row.add(this._createToolbarButton("Numbered List", this.icons.numberedList, this.msg["Menu.NumberedList"], 
                        this._processCommand, "insertorderedlist"));
            }
            if (features.horizontalRule) {
                row.add(this._createToolbarButton("Horizontal Rule", this.icons.horizontalRule,
                        this.msg["Menu.InsertHorizontalRule"],  this._processCommand, "inserthorizontalrule"));
            }
            if (features.image) {
                row.add(this._createToolbarButton("Image", this.icons.image, this.msg["Menu.InsertImage"], 
                        this.processInsertImage));
            }
            if (features.hyperlink) {
                row.add(this._createToolbarButton("Hyperlink", this.icons.hyperlink, this.msg["Menu.InsertHyperlink"], 
                        this.processInsertHyperlink));
            }
            if (features.table) {
                row.add(this._createToolbarButton("Table", this.icons.table, this.msg["Menu.NewTable"], 
                        this.processInsertTable));
            }
            controlsRow.add(row);
        }
        
        return panel;
    },
    
    /**
     * Creates a toolbar button.
     * 
     * @param {String} text the button text
     * @param {#ImageReference} icon the button icon
     * @param {String} toolTipText the rollover tool tip text
     * @param {Function} eventMethod the method to invoke when the button is clicked (must be a method of this object,
     *        will automatically be wrapped using Core.method()) 
     * @param {String} actionCommand the action command to send in fired events
     * @return the toolbar button
     * @type Extras.Sync.RichTextArea.ToolbarButton
     */
    _createToolbarButton: function(text, icon, toolTipText, eventMethod, actionCommand) {
        var button = new Extras.Sync.RichTextArea.ToolbarButton({
            actionCommand: actionCommand,
            styleName: this.component.render("toolbarButtonStyleName"),
            text: icon ? null : text,
            icon: icon,
            toolTipText: toolTipText
        });
        if (eventMethod) {
            button.addListener("action", Core.method(this, eventMethod));
        }
        this._toolbarButtons[actionCommand] = button;
        return button;
    },
    
    /**
     * Executes a rich-text editing command.  Delegates to RichTextInput peer.
     * 
     * @param {String} commandName the command name
     * @param {String} value the (optional) value to send
     */
    execCommand: function(commandName, value) {
        this._richTextInput.execCommand(commandName, value);
    },
    
    /**
     * Focuses the edited document.  Delegates to RichTextInput peer.
     */
    focusDocument: function() {
        this.arcApplication.setFocusedComponent(this._richTextInput);
    },
    
    /** @see Echo.Arc.ComponentSync#getDomainElement */
    getDomainElement: function() { 
        return this._mainDiv;
    },
    
    /**
     * Creates and returns a default icon name to URL map object.
     * @type Object
     */
    _getDefaultIcons: function() {
        var iconNames = {
            "16": [ "alignment", "alignmentCenter", "alignmentJustify", "alignmentLeft", "alignmentRight",
                "background", "bold", "bulletedList", "cancel", "copy", "cut", "delete", "foreground", "horizontalRule",
                "hyperlink", "image", "indent", "italic", "numberedList", "ok", "outdent", "paragraphStyle", "paste", "plainText", 
                "redo", "selectAll", "strikethrough", 
                "subscript", "superscript", "table", "tableInsertRow", "tableDeleteRow", "tableInsertColumn", "tableDeleteColumn",
                "textStyle", "underline", "undo" ],
            "24": [ "ok", "cancel" ]
        };
        var defaultIcons = { };
        for (var size in iconNames) {
            for (var i = 0; i < iconNames[size].length; ++i) {
                var iconResource = iconNames[size][i].charAt(0).toUpperCase() + iconNames[size][i].substring(1);
                defaultIcons[iconNames[size][i]] = this.client.getResourceUrl("Extras", 
                        "image/richtext/Icon" + size + iconResource + ".png");
            }
        }
        return defaultIcons;
    },
    
    /**
     * Inserts an image at the cursor position.
     * 
     * @param {String} url the image URL
     */
    insertImage: function(url) {
        this._richTextInput.insertHtml("<img src=\"" + url + "\">");
    },
    
    /**
     * Inserts an HTML table at the cursor position.
     * 
     * @param {Number} columns the number of columns
     * @param {Number} rows the number of rows
     */
    newTable: function(columns, rows) {
        var rowHtml = "",
            i,
            cellContent = Core.Web.Env.ENGINE_MSHTML ? "" : "<br/>";
        for (i = 0; i < columns; ++i) {
            rowHtml += "<td>" + cellContent + "</td>";
        }
        rowHtml = "<tr>" + rowHtml + "</tr>";
        var tableHtml = "<table width=\"100%\" border=\"1\" cellspacing=\"0\" cellpadding=\"1\"><tbody>";
        for (i = 0; i < rows; ++i) {
            tableHtml += rowHtml;
        }
        tableHtml += "</tbody></table>";
        this._richTextInput.insertHtml(tableHtml);
    },
    
    /**
     * Opens a dialog window.  The dialog is displayed in an OverlayPane which shows
     * the dialog over the application, rather than simply over the RichTextArea itself. 
     * 
     * @param {Echo.WindowPane} dialogWindow the dialog to open 
     */
    _openDialog: function(dialogWindow) {
        // Activate overlay pane (if required).
        var contentPane;
        if (this._overlayPane == null) {
            this._overlayPane = new Extras.Sync.RichTextArea.OverlayPane();
            this._overlayPane.rta = this.component;
            contentPane = new Echo.ContentPane();
            this._overlayPane.add(contentPane);
            this.baseComponent.add(this._overlayPane);
        } else {
            contentPane = this._overlayPane.children[0];
        }
        
        // Add dialog to overlay pane.
        contentPane.add(dialogWindow);

        // Add parent-change listener to dialog so that overlay pane can be
        // deactivated when necessary.
        dialogWindow.addListener("parent", this._processDialogCloseRef);
    },
    
    /**
     * Processes a simple editor command action.  The event's actionCommand is sent to the input peer as the editor command name.
     * This method is registered as a listener to various toolbar buttons.
     * 
     * @param e the event
     */
    _processCommand: function(e) {
        this.execCommand(e.actionCommand);
        this.focusDocument();
    },
    
    /**
     * Updates the status of various press-able toolbar buttons to indicate the state of the text at the cursor position
     * (e.g., bold/italic/underline, color, style selection).  
     */
    _processCursorStyleChange: function(e) {
        if (this._toolbarButtons.bold) {
            this._toolbarButtons.bold.set("pressed", e.style.bold);
        }
        if (this._toolbarButtons.italic) {
            this._toolbarButtons.italic.set("pressed", e.style.italic);
        }
        if (this._toolbarButtons.underline) {
            this._toolbarButtons.underline.set("pressed", e.style.underline);
        }
        if (this._toolbarButtons.foreground) {
            this._toolbarButtons.foreground.set("color", e.style.foreground || "#000000");
        }
        if (this._toolbarButtons.background) {
            this._toolbarButtons.background.set("color", e.style.background || "#ffffff");
        }
        if (this._styleSelect) {
            this._styleSelect.set("selectedId", e.style.paragraphStyle);
        }
    },
    
    /**
     * Processes a dialog closing (de-parenting) event.
     * Removes the OverlayPane.
     * 
     * @param e the event
     */
    _processDialogClose: function(e) {
        if (e.newValue != null) {
            return;
        }
        
        // Deactivate overlay pane if it has no content.
        if (this._overlayPane.children[0].children.length === 0) {
            this.baseComponent.remove(this._overlayPane);
            this._overlayPane = null;
        }
        
        // Remove dialog parent-change listener.
        e.source.removeListener("parent", this._processDialogCloseRef);
    },
    
    /**
     * Processes an action received from the menu bar.
     * 
     * @param e the event
     */
    _processMenuAction: function(e) {
        if (e.modelId.charAt(0) == '/') {
            var separatorIndex = e.modelId.indexOf("/", 1);
            if (separatorIndex == -1) {
                this._richTextInput.execCommand(e.modelId.substring(1));
            } else {
                this._richTextInput.execCommand(e.modelId.substring(1, separatorIndex),
                        e.modelId.substring(separatorIndex + 1));
            }
        } else {
            switch (e.modelId) {
            case "foreground":
                this.processSetForeground();
                break;
            case "background":
                this.processSetBackground();
                break;
            case "tableNew":
                this.processInsertTable();
                break;
            case "inserthyperlink":
                this.processInsertHyperlink();
                break;
            case "insertimage":
                this.processInsertImage();
                break;
            case "cut":
            case "copy":
            case "paste":
            case "delete":
                try {
                    this._richTextInput.execCommand(e.modelId);
                } catch (ex) {
                    this._openDialog(new Extras.Sync.RichTextArea.MessageDialog(this.component,
                            this.msg["Generic.Error"], this.msg["Error.ClipboardAccessDisabled"])); 
                }
            }
        }
    },
    
    _processTextUpdate: function(e) {
        this.component.set("text", e.newValue);
    },
    
    /**
     * Removes listeners from supported Extras.RichTextArea object.
     */
    _removeComponentListeners: function() {
        this.component.removeListener("execCommand", this._execCommandListener);
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._addComponentListeners();
        this.msg = Extras.Sync.RichTextArea.resource.get(this.component.getRenderLocale());

        this.icons = this.getIcons();
        if (!this.icons) {
            this.icons = {};
        }
        
        this._paneRender = this.component.parent.pane;
        
        this._mainDiv = document.createElement("div");
        this._mainDiv.id = this.component.renderId;

        if (this._paneRender) {
            this._mainDiv.style.cssText = "position:absolute;top:0px;left:0px;right:0px;bottom:0px;";
        } else {
            this._mainDiv.style.position = "relative";
            // FIXME. set height of component based on height setting.
            this._mainDiv.style.height = "300px";
        }
        
        parentElement.appendChild(this._mainDiv);
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this._mainDiv);
        Echo.Arc.ComponentSync.prototype.renderDisplay.call(this);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._removeComponentListeners();
        Echo.Arc.ComponentSync.prototype.renderDispose.call(this, update);
        this._mainDiv = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderFocus */
    renderFocus: function() {
        this.arcApplication.setFocusedComponent(this._richTextInput);
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (update.isUpdatedPropertySetIn({text: true })) {
            if (this._richTextInput) {
                this._richTextInput.set("text", this.component.get("text"));
            }
            update.renderContext.displayRequired = [];
            return;
        }
    
        var element = this._mainDiv;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
    }
});

/**
 * Abstract dialog message box.  Displays arbitrary content and  provides the user "Ok" and/or "Cancel" options.
 */
Extras.Sync.RichTextArea.AbstractDialog = Core.extend(Echo.WindowPane, {

    $static: {

        /**
         * Type flag indicating only an "Ok" option should be made available.
         */
        TYPE_OK: 0,

        /**
         * Type flag indicating both "Ok" and "Cancel" options should be made available.
         */
        TYPE_OK_CANCEL: 1
    },
    
    $abstract: true,
    
    /**
     * The owning RichTextArea.
     * @type Extras.RichTextArea
     */
    rta: null,

    /**
     * Constructor.
     * 
     * @param {Extras.RichTextArea} rta the owning RichTextArea
     * @param {Number} type the dialog type, either <code>TYPE_OK</code> or <code>TYPE_OK_CANCEL</code>
     * @param properties initial properties to be set on the WindowPane
     * @param {Echo.Component} content the component to display within the dialog 
     */
    $construct: function(rta, type, properties, content) {
        this.rta = rta;
    
        var controlPaneSplitPaneStyleName = rta.render("controlPaneSplitPaneStyleName");
        var controlPaneRowStyleName = rta.render("controlPaneRowStyleName");
        var controlPaneButtonStyleName = rta.render("controlPaneButtonStyleName"); 
        
        // Build control.
        Echo.WindowPane.call(this, {
            styleName: rta.render("windowPaneStyleName"),
            contentWidth: "25em",
            modal: true,
            resizable: false,
            events: {
                close: Core.method(this, this.processCancel)
            },
            children: [
                new Echo.SplitPane({
                    orientation: Echo.SplitPane.ORIENTATION_VERTICAL_BOTTOM_TOP,
                    autoPositioned: true,
                    styleName: controlPaneSplitPaneStyleName,
                    style: controlPaneSplitPaneStyleName ? null : Extras.Sync.RichTextArea.DEFAULTS.controlPaneStyle,
                    children: [
                        this.controlsRow = new Echo.Row({
                            styleName: controlPaneRowStyleName,
                            style: controlPaneRowStyleName ? null : Extras.Sync.RichTextArea.DEFAULTS.controlPaneRowStyle
                        }),
                        content
                    ]
                })
            ]
        });
        
        // Add OK button.
        this.controlsRow.add(new Echo.Button({
            styleName: controlPaneButtonStyleName,
            style: controlPaneButtonStyleName ? null : Extras.Sync.RichTextArea.DEFAULTS.controlPaneButtonStyle,
            text: rta.peer.msg["Generic.Ok"],
            icon: rta.peer.icons.ok,
            events: {
                action: Core.method(this, this.processOk)
            }
        }));
        
        // Add Cancel button.
        if (type == Extras.Sync.RichTextArea.AbstractDialog.TYPE_OK_CANCEL) {
            this.controlsRow.add(new Echo.Button({
                styleName: controlPaneButtonStyleName,
                style: controlPaneButtonStyleName ? null : Extras.Sync.RichTextArea.DEFAULTS.controlPaneButtonStyle,
                text: rta.peer.msg["Generic.Cancel"],
                icon: rta.peer.icons.cancel,
                events: {
                    action: Core.method(this, this.processCancel)
                }
            }));
        }
        
        // Set properties.
        for (var x in properties) {
            this.set(x, properties[x]);
        }
    },
    
    $virtual: {
        
        /**
         * Processes a user selection of the "Cancel" button.
         * 
         * @param e the event
         */
        processCancel: function(e) {
            this.parent.remove(this);
        },
        
        /**
         * Processes a user selection of the "OK" button.
         * 
         * @param e the event
         */
        processOk: function(e) {
            this.parent.remove(this);
        }
    }
});

/**
 * Color selection dialog.
 */
Extras.Sync.RichTextArea.ColorDialog = Core.extend(Extras.Sync.RichTextArea.AbstractDialog, {

    $static: {
    
        /**
         * Default color swatch values.  
         * Sourced from Tango color palete: http://tango.freedesktop.org/Tango_Icon_Theme_Guidelines
         * @type Array
         */
        COLORS: [ 
                "#fce94f", "#edd400", "#c4a000",
                "#fcaf3e", "#f57900", "#e8b86e",
                "#e9b96e", "#c17d11", "#8f5902",
                "#8ae234", "#73d216", "#4e9a06",
                "#729fcf", "#3465a4", "#204a87",
                "#ad7fa8", "#75507b", "#5c3566",
                "#ef2929", "#cc0000", "#a40000",
                "#eeeeec", "#d3d7cf", "#babdb6",
                "#888a85", "#555753", "#2e3436",
                "#ffffff", "#7f7f7f", "#000000"
        ]
    },
    
    /**
     * Constructor.
     * 
     * @param {Extras.RichTextArea} rta the RichTextArea
     * @param {Boolean} setBackground flag indicating whether background (true) or foreground (false) is being set
     * @param {#Color} initialColor the initially selected color
     */
    $construct: function(rta, setBackground, initialColor) {
        Extras.Sync.RichTextArea.AbstractDialog.call(this, rta,
                Extras.Sync.RichTextArea.AbstractDialog.TYPE_OK_CANCEL, 
                {
                    title: rta.peer.msg[setBackground ? 
                            "ColorDialog.Title.Background" : "ColorDialog.Title.Foreground"],
                    icon: setBackground ? rta.peer.icons.background : rta.peer.icons.foreground,
                    contentWidth: "32em"
                },
                new Echo.Row({
                    cellSpacing: "1em",
                    insets: "1em",
                    children: [
                        new Echo.Column({
                            children: [
                                new Echo.Label({
                                    text: rta.peer.msg[
                                            setBackground ? "ColorDialog.PromptBackground" : "ColorDialog.PromptForeground"]
                                }),
                                this._colorSelect = new Extras.ColorSelect({
                                    color: initialColor,
                                    displayValue: true
                                })
                            ]
                        }),
                        new Echo.Grid({
                            insets: 2,
                            size: 3,
                            children: this._createSwatches()
                        })
                    ]
                }));
    },
    
    /**
     * Creates and returns an array of Echo.Button components which are used to select pre-set color values.
     * 
     * @return the color swatch buttons
     * @type Array
     */
    _createSwatches: function() {
        var children = [];
        var COLORS = Extras.Sync.RichTextArea.ColorDialog.COLORS;
        var actionListener = Core.method(this, function(e) {
            this._colorSelect.set("color", e.actionCommand);
        });
        for (var i = 0; i < COLORS.length; ++i) {
            children.push(new Echo.Button({
                height: "1em",
                width: "3em",
                background: COLORS[i],
                border: "1px outset " + COLORS[i],
                actionCommand: COLORS[i],
                events: {
                    action: actionListener
                }
            }));
        }
        return children;
    },
    
    /** @see Extras.Sync.RichTextArea.AbstractDialog#processOk */
    processOk: function(e) {
        var color = this._colorSelect.get("color");
        this.parent.remove(this);
        this.fireEvent({type: "colorSelect", source: this, data : color});
    }
});

/**
 * Add Hyperlink Dialog.
 */
Extras.Sync.RichTextArea.HyperlinkDialog = Core.extend(Extras.Sync.RichTextArea.AbstractDialog, {

    /**
     * Constructor.
     * 
     * @param {Extras.RichTextArea} rta the RichTextArea
     */
    $construct: function(rta) {
        Extras.Sync.RichTextArea.AbstractDialog.call(this, rta,
                Extras.Sync.RichTextArea.AbstractDialog.TYPE_OK_CANCEL,
                {
                    title: rta.peer.msg["HyperlinkDialog.Title"], 
                    icon: rta.peer.icons.hyperlink
                },
                new Echo.Column({
                    insets: 10,
                    children: [
                        new Echo.Label({
                            text: rta.peer.msg["HyperlinkDialog.PromptURL"]
                        }),
                        this._urlField = new Echo.TextField({
                            width: "100%"
                        }),
                        new Echo.Label({
                            text: rta.peer.msg["HyperlinkDialog.PromptDescription"]
                        }),
                        this._descriptionField = new Echo.TextField({
                            width: "100%"
                        })
                    ]
                }));
    },
    
    /** @see Extras.Sync.RichTextArea.AbstractDialog#processOk */
    processOk: function(e) {
        var data = {
            url: this._urlField.get("text"),
            description: this._descriptionField.get("text")
        };
        if (!data.url) {
            this.parent.add(new Extras.Sync.RichTextArea.MessageDialog(this.rta, 
                    this.rta.peer.msg["HyperlinkDialog.ErrorDialogTitle"], 
                    this.rta.peer.msg["HyperlinkDialog.ErrorDialog.URL"]));
            return;
        }
        this.parent.remove(this);
        this.fireEvent({type: "insertHyperlink", source: this, data: data});
    }
});

/**
 * Add Image Dialog.
 */
Extras.Sync.RichTextArea.ImageDialog = Core.extend(Extras.Sync.RichTextArea.AbstractDialog, {

    /**
     * Constructor.
     * 
     * @param {Extras.RichTextArea} rta the RichTextArea
     */
    $construct: function(rta) {
        Extras.Sync.RichTextArea.AbstractDialog.call(this, rta,
                Extras.Sync.RichTextArea.AbstractDialog.TYPE_OK_CANCEL,
                {
                    title: rta.peer.msg["ImageDialog.Title"], 
                    icon: rta.peer.icons.image
                },
                new Echo.Column({
                    insets: 10,
                    children: [
                        new Echo.Label({
                            text: rta.peer.msg["ImageDialog.PromptURL"]
                        }),
                        this._urlField = new Echo.TextField({
                            width: "100%"
                        })
                    ]
                }));
    },
    
    /** @see Extras.Sync.RichTextArea.AbstractDialog#processOk */
    processOk: function(e) {
        var data = {
            url: this._urlField.get("text")
        };
        if (!data.url) {
            this.parent.add(new Extras.Sync.RichTextArea.MessageDialog(this.rta, 
                    this.rta.peer.msg["ImageDialog.ErrorDialogTitle"], 
                    this.rta.peer.msg["ImageDialog.ErrorDialog.URL"]));
            return;
        }
        this.parent.remove(this);
        this.fireEvent({type: "insertImage", source: this, data: data});
    }
});

/**
 * Pane which renders its content over the entire domain of the application.  
 */
Extras.Sync.RichTextArea.OverlayPane = Core.extend(Echo.Component, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.RichTextOverlayPane", this);
    },
    
    /**
     * The supported RichTextArea.
     * @type Extras.RichTextArea
     */
    rta: null,
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.RichTextOverlayPane",
    
    /** @see Echo.Component#floatingPane */
    floatingPane: true,
    
    /** @see Echo.Component#pane */
    pane: true
});

/**
 * Component rendering peer: OverlayPane.
 * 
 * This component renders itself over the EchoClient's domainElement, rather than beneath its
 * specified parent element.
 */
Extras.Sync.RichTextArea.OverlayPanePeer = Core.extend(Echo.Render.ComponentSync, {

    /**
     * The rendered DIV.
     * @type Element
     */
    _div: null,

    $load: function() {
        Echo.Render.registerPeer("Extras.RichTextOverlayPane", this);
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._div = document.createElement("div");
        this.client.addElement(this._div);
        this._div.style.cssText = "position:absolute;top:0;right:0;bottom:0;left:0;z-index:20000;";
        if (this.component.children.length == 1) {
            Echo.Render.renderComponentAdd(update, this.component.children[0], this._div);
        } else if (this.component.children.length > 1) {
            throw new Error("Too many children added to OverlayPane.");
        }
        document.body.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function(update) {
        if (this._div.style.display != "block") {
            this._div.style.display = "block";
            this.client.forceRedraw();
        }
        Core.Web.VirtualPosition.redraw(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        if (!this._div) {
            return;
        }
        this.client.removeElement(this._div);
        if (this._div.parentNode) {
            this._div.parentNode.removeChild(this._div);
        }
        this._div = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderHide */
    renderHide: function() {
        this._div.style.display = "none";
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});

/**
 * Dialog window which displays a message.
 */
Extras.Sync.RichTextArea.MessageDialog = Core.extend(
        Extras.Sync.RichTextArea.AbstractDialog, {
   
    /**
     * Constructor.
     * 
     * @param {Extras.RichTextArea} the RichTextArea
     * @param {String} title the dialog title
     * @param {String} message the dialog message
     */
    $construct: function(rta, title, message) {
        Extras.Sync.RichTextArea.AbstractDialog.call(this, rta,
                Extras.Sync.RichTextArea.AbstractDialog.TYPE_OK, {
                    title: title
                },
                new Echo.Label({
                    text: message,
                    layoutData: {
                        insets: 30
                    }
                }));
    }
});

/**
 * Table creation dialog.  Prompts user for initial settings to insert table.
 */
Extras.Sync.RichTextArea.TableDialog = Core.extend(Extras.Sync.RichTextArea.AbstractDialog, {

    /**
     * Constructor.
     * 
     * @param {Extras.RichTextArea} rta the supported RichTextArea
     */
    $construct: function(rta) {
        Extras.Sync.RichTextArea.AbstractDialog.call(this, rta,
                Extras.Sync.RichTextArea.AbstractDialog.TYPE_OK_CANCEL, {
                    title: rta.peer.msg["TableDialog.Title"], 
                    icon: rta.peer.icons.table,
                    contentWidth: "35em"
                },
                new Echo.Row({
                    insets: "1em",
                    cellSpacing: "1em",
                    children: [
                        this._sizeSelector = new Extras.Sync.RichTextArea.TableSizeSelector({
                            rows: 2,
                            columns: 3,
                            events: {
                                property: Core.method(this, this._processSelectorUpdate)
                            }
                        }),
                        new Echo.Grid({
                            width: "100%",
                            insets: 3,
                            children: [
                                new Echo.Label({
                                    text: rta.peer.msg["TableDialog.PromptRows"],
                                    layoutData: {
                                        alignment: "trailing"
                                    }
                                }),
                                this._rowsField = new Echo.TextField({
                                    text: "2",
                                    alignment: "center",
                                    width: "5em",
                                    events: {
                                        property: Core.method(this, this._processTextUpdate)
                                    }
                                }),
                                new Echo.Label({
                                    text: rta.peer.msg["TableDialog.PromptColumns"],
                                    layoutData: {
                                        alignment: "trailing"
                                    }
                                }),
                                this._columnsField = new Echo.TextField({
                                    text: "3",
                                    alignment: "center",
                                    width: "5em",
                                    events: {
                                        property: Core.method(this, this._processTextUpdate)
                                    }
                                })
                            ]
                        })                    
                    ]
                }));
    },
    
    /** @see Extras.Sync.RichTextArea.AbstractDialog#processOk */
    processOk: function(e) {
        var data = {
            rows: parseInt(this._rowsField.get("text"), 10),
            columns: parseInt(this._columnsField.get("text"), 10)
        };
        if (isNaN(data.rows) || data.rows < 1 || data.rows > 50) {
            this.parent.add(new Extras.Sync.RichTextArea.MessageDialog(this.rta, 
                    this.rta.peer.msg["TableDialog.ErrorDialogTitle"], 
                    this.rta.peer.msg["TableDialog.ErrorDialog.Rows"]));
            return;
        }
        if (isNaN(data.columns) || data.columns < 1 || data.columns > 50) {
            this.parent.add(new Extras.Sync.RichTextArea.MessageDialog(this.rta, 
                    this.rta.peer.msg["TableDialog.ErrorDialogTitle"], 
                    this.rta.peer.msg["TableDialog.ErrorDialog.Columns"]));
            return;
        }
        this.parent.remove(this);
        this.fireEvent({type: "insertTable", source: this, data: data});
    },
    
    _processSelectorUpdate: function(e) {
        var columns = parseInt(this._sizeSelector.get("columns"), 10),
            rows = parseInt(this._sizeSelector.get("rows"), 10);
        this._columnsField.set("text", columns);
        this._rowsField.set("text", rows);
    },
    
    _processTextUpdate: function(e) {
        var columns = parseInt(this._columnsField.get("text"), 10),
            rows = parseInt(this._rowsField.get("text"), 10);
        if (!isNaN(columns)) {
            this._sizeSelector.set("columns", columns);
        }
        if (!isNaN(rows)) {
            this._sizeSelector.set("rows", rows);
        }
        return true;
    }
});

/**
 * Component to interactively select initial number of columns/rows for a table.
 * 
 * @cp {Number} rows the selected number of rows
 * @cp {Number} columns the selected number of columns
 * @sp {Number} rowSize the number of rows to display
 * @sp {Number} columnSize the number of columns to display
 * @sp {#Border} border the border to use for drawing table cells
 * @sp {#Color} selectedBackground the background color for drawing selected table cells
 * @sp {#Border} selectedBorder the border to use for drawing selected table cells
 */
Extras.Sync.RichTextArea.TableSizeSelector = Core.extend(Echo.Component, {
    
    $load: function() {
        Echo.ComponentFactory.registerType("Extras.RichTextTableSizeSelector", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.RichTextTableSizeSelector"
});

Extras.Sync.RichTextArea.TableSizeSelectorPeer = Core.extend(Echo.Render.ComponentSync, {

    $load: function() {
        Echo.Render.registerPeer("Extras.RichTextTableSizeSelector", this);
    },
    
    /**
     * Main container DIV element.
     * @type Element
     */
    _div: null,
    
    /**
     * Table element.
     * @type Element
     */
    _table: null,
    
    _dragInProgress: false,
    
    _drawSelection: function() {
        var rows = parseInt(this.component.render("rows", 0), 10),
            columns = parseInt(this.component.render("columns", 0), 10),
            tr = this._table.firstChild.firstChild,
            y = 0,
            td, x, selected, border, background;
            
        while (tr) {
            td = tr.firstChild;
            x = 0;
            while (td) {
                selected = x < columns  && y < rows;
                background = selected ? this._selectedBackground : null;
                border = selected ? this._selectedBorder : this._border;
                Echo.Sync.Color.renderClear(background, td, "backgroundColor");
                Echo.Sync.Border.renderClear(border, td);
                td = td.nextSibling;
                ++x;
            }
            tr = tr.nextSibling;
            ++y;
        }
    },
    
    _processMouseDown: function(e) {
        this._dragInProgress = true;
        this._processMouseSelection(e);
        return true;
    },
    
    _processMouseMove: function(e) {
        if (this._dragInProgress) {
            this._processMouseSelection(e);
        }
        return true;
    },
    
    _processMouseSelection: function(e) {
        var x = 0, y = 0,
            element = e.target;
        if (!element.nodeName || element.nodeName.toLowerCase() != "td") {
            return;
        }
        while (element.previousSibling) {
            ++x;
            element = element.previousSibling;
        }
        element = element.parentNode;
        while (element.previousSibling) {
            ++y;
            element = element.previousSibling;
        }
        this.component.set("columns", x + 1);
        this.component.set("rows", y + 1);
        
    },
    
    _processMouseUp: function(e) {
        this._dragInProgress = false;
        return true;
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        var tbody, protoTr, tr, td, y, x;
        
        this._rowSize = this.component.render("rowSize", 10);
        this._columnSize = this.component.render("columnSize", 15);
            
        this._border = this.component.render("border", "1px outset #dfdfdf");
        this._selectedBorder = this.component.render("selectedBorder", "1px outset #4f4f5f");
        this._selectedBackground = this.component.render("selectedBackground", "#4f4f5f");
        
        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        
        this._table = document.createElement("table");
        this._table.cellPadding = 0;
        this._table.cellSpacing = 0;
        this._table.style.cssText = "padding:0;border:none;font-size:1px;";
        this._table.style.width = (this._columnSize * 18) + "px";
        Echo.Sync.Color.render(this.component.render("background", "#dfdfdf"), this._table, "backgroundColor");
        tbody = document.createElement("tbody");
        this._table.appendChild(tbody);
        
        protoTr = document.createElement("tr");
        for (x = 0; x < this._columnSize; ++x) {
            td = document.createElement("td");
            td.style.cssText = "padding:0;width:16px;height:16px;";
            td.appendChild(document.createTextNode("\u00a0"));
            Echo.Sync.Border.render(this._border, td);
            protoTr.appendChild(td);
        }
        
        for (y = 0; y < this._rowSize; ++y) {
            tbody.appendChild(protoTr.cloneNode(true));
        }
        
        this._div.appendChild(this._table);
        
        Core.Web.Event.Selection.disable(this._div);
        Core.Web.Event.add(this._div, "mousedown", Core.method(this, this._processMouseDown), false);
        Core.Web.Event.add(this._div, "mousemove", Core.method(this, this._processMouseMove), false);
        Core.Web.Event.add(this._div, "mouseup", Core.method(this, this._processMouseUp), false);
        parentElement.appendChild(this._div);
        
        this._drawSelection();
    },
    
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Core.Web.Event.removeAll(this._div);
        this._table = null;
        this._div = null;
    },
    
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (update.isUpdatedPropertySetIn({ columns: true, rows: true })) {
            this._drawSelection();
            return;
        }

        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});

/**
 * Toolbar button component: a simple button component which optionally provides the capability to be toggled on/off.
 * Additionally provides the capability to show a currently selected color value (used by color selection buttons).
 * 
 * @cp {Boolean} pressed flag indicating whether button should be displayed as pressed (toggled on)
 * @sp {Boolean} toggle flag indicating whether the button supports a toggled state.
 * @sp {#Color} color the selected color. 
 */
Extras.Sync.RichTextArea.ToolbarButton = Core.extend(Echo.Button, {

    $load: function() {
        Echo.ComponentFactory.registerType("Extras.RichTextToolbarButton", this);
    },
    
    /** @see Echo.Component#componentType */
    componentType: "Extras.RichTextToolbarButton",
    
    /**
     * Programmatically performs a button action.
     */
    doAction: function() {
        if (this.render("toggle")) {
            this.set("pressed", !this.get("pressed"));
        } 
        this.fireEvent({ source: this, type: "action", actionCommand: this.render("actionCommand") });
    }
});

/**
 * Component rendering peer for ToolbarButton component. 
 */
Extras.Sync.RichTextArea.ToolbarButtonPeer = Core.extend(Echo.Render.ComponentSync, {

    $load: function() {
        Echo.Render.registerPeer("Extras.RichTextToolbarButton", this);
    },
    
    /**
     * Main DIV rendered DIV element.
     * @type Element
     */
    _div: null,

    /**
     * Processes a mouse click event.
     * 
     * @param e the event
     */
    _processClick: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        this.client.application.setFocusedComponent(this.component);
        this.component.doAction();
    },
    
    /**
     * Processes a mouse rollover enter event.
     * 
     * @param e the event
     */
    _processRolloverEnter: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return true;
        }
        this._renderButtonState(true);
    },

    /**
     * Processes a mouse rollover exit event.
     * 
     * @param e the event
     */
    _processRolloverExit: function(e) {
        this._renderButtonState(false);
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        var icon = this.component.render("icon");
        
        this._div = document.createElement("div");
        this._div.style.cssText = "position:relative;";
        
        this._renderButtonState(false);
        if (this.component.render("color")) {
            this._renderColor();
        }
        
        Echo.Sync.Insets.render(this.component.render("insets"), this._div, "padding");
        
        if (icon) {
            var imgElement = document.createElement("img");
            Echo.Sync.ImageReference.renderImg(icon, imgElement);
            this._div.appendChild(imgElement);
        }
        
        Core.Web.Event.add(this._div, "click", Core.method(this, this._processClick), false);
        Core.Web.Event.add(this._div, "mouseover", Core.method(this, this._processRolloverEnter), false);
        Core.Web.Event.add(this._div, "mouseout", Core.method(this, this._processRolloverExit), false);
        
        parentElement.appendChild(this._div);
    },
       
    /**
     * Renders the state of the button (pressed/rollover effects).
     * 
     * @param {Boolean} rolloverState flag indicating whether component is currently rolled over.
     */
    _renderButtonState: function(rolloverState) {
        var foreground = this.component.render("foreground");
        var background = this.component.render("background");
        var border = this.component.render("border");
        var backgroundImage = this.component.render("backgroundImage");
        
        // Apply pressed effect.
        if (this.component.render("pressed")) {
            foreground = this.component.render("pressedForeground", foreground);
            background = this.component.render("presssedBackground", background);
            border = this.component.render("pressedBorder", border);
            backgroundImage = this.component.render("pressedBackgroundImage", backgroundImage);
        }
        
        // Apply rollover effect.
        if (rolloverState) {
            foreground = this.component.render("rolloverForeground", foreground);
            background = this.component.render("rolloverBackground", background);
            backgroundImage = this.component.render("rolloverBackgroundImage", backgroundImage);
        }
                        
        Echo.Sync.Color.renderClear(foreground, this._div, "color");
        Echo.Sync.Color.renderClear(background, this._div, "backgroundColor");
        Echo.Sync.Border.renderClear(border, this._div);
        Echo.Sync.FillImage.renderClear(backgroundImage, this._div);
    },
    
    /**
     * Renders the selected color of the button.
     */
    _renderColor: function() {
        var color = this.component.render("color");
        if (!this._colorDiv) {
            this._colorDiv = document.createElement("div");
            this._colorDiv.style.cssText = "position:absolute;bottom:0;left:0;right:0;height:5px;line-height:0px;font-size:1px;";
            if (Core.Web.Env.BROWSER_INTERNET_EXPLORER && Core.Web.Env.BROWSER_VERSION_MAJOR === 6) {
                this._colorDiv.style.width = "16px";
            }
            this._colorDiv.style.backgroundColor = color || "#ffffff";
            this._div.appendChild(this._colorDiv);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        Core.Web.Event.removeAll(this._div);
        this._div = null;
        this._colorDiv = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderFocus */
    renderFocus: function() {
        // Empty implementation required due to supported component extending (focusable) Echo.Button.
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});
/**
 * Component rendering peer: Extras.RichTextInput.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.RichTextInput = Core.extend(Echo.Render.ComponentSync, {
    
    $load: function() {
        Echo.Render.registerPeer("Extras.RichTextInput", this);
    },
    
    $static: {
        
        DEFAULTS: {
            border: "1px inset #7f7f7f"
        },
        
        /**
         * HTML block-style nodes.
         * Used for Gecko browsers for determining if insertion point is within a block-style node.
         */
        BLOCK_NODES: {
            p: true, h1: true, h2: true, h3: true, h4: true, h5: true, h6: true, pre: true, li: true
        },
        
        /**
         * Property containing browser-modified HTML, used for lazy-processing (cleaning).
         * Invoking toString() method returns processed HTML.
         */
        EditedHtml: Core.extend({
            
            /**
             * The supported RichTextInput peer.
             * @type Extras.Sync.RichTextInput
             */
            _peer: null,
            
            /**
             * Class name (for serialization).
             * @type String
             */
            className: "Extras.RichTextInput.EditedHtml",
            
            /**
             * Creates a new <code>EditedHtml</code> wrapper.
             * 
             * @param {Extras.Sync.RichTextInput} peer the peer
             */
            $construct: function(peer) {
                this._peer = peer;
            },

            /** @see Object#toString */
            toString: function() {
                return this._peer._getProcessedHtml();
            }
        }),
        
        /**
         * HTML manipulation/cleaning utilities.
         */
        Html: {
        
            //FIXME Verify no illegal tags are present or correct.
            //FIXME Verify no unclosed tags are present or correct.
            //FIXME Verify no illegal characters are present or correct.
            //FIXME Provide option to only remove the one trailing BR we add by default.
            
            /**
             * Regular expression to capture leading whitespace.
             * @type RegExp
             */
            _LEADING_WHITESPACE: /^(\s|<br\/?>|&nbsp;)+/i,
        
            /**
             * Regular expression to capture trailing whitespace.
             * @type RegExp
             */
            _TRAILING_WHITESPACE: /(\s|<br\/?>|&nbsp;)+$/i,
            
            /**
             * Regular expression used to correct MSIE's FONT element color attributes which do not enclose attribute values 
             * in quotes.
             * @type RegExp
             */
            _MSIE_INVALID_FONT_COLOR_REPL: /(<font .*?color\=)(#[0-9a-fA-F]{3,6})(.*?>)/ig,
        
            /**
             * Regular expression used to correct MSIE's FONT element background attributes which do not enclose attribute values 
             * in quotes.
             * @type RegExp
             */
            _MSIE_INVALID_FONT_BACKGROUND_REPL: /(<font .*?)(background-color)/ig,
            
            /**
             * Regular expression to determine if a style attribute is setting a bold font.
             * @type RegExp 
             */
            _CSS_BOLD: /font-weight\:\s*bold/i,
    
            /**
             * Regular expression to determine if a style attribute is setting a foreground color.
             * @type RegExp 
             */
            _CSS_FOREGROUND_TEST: /^-?color\:/i,
            
            /**
             * Regular expression to determine the foreground color being set by a style attribute.
             * @type RegExp 
             */
            _CSS_FOREGROUND_RGB: /^-?color\:\s*rgb\s*\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})/i,
                    
            /**
             * Regular expression to determine if a style attribute is setting a background color.
             * @type RegExp 
             */
            _CSS_BACKGROUND_TEST: /background-color\:/i,
    
            /**
             * Regular expression to determine the background color being set by a style attribute.
             * @type RegExp 
             */
            _CSS_BACKGROUND_RGB: /background-color\:\s*rgb\s*\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})/i,
                    
            /**
             * Regular expression to determine if a style attribute is setting an italic font.
             * @type RegExp 
             */
            _CSS_ITALIC: /font-style\:\s*italic/i,
            
            /**
             * Regular expression to determine if a style attribute is setting an underline font.
             * @type RegExp 
             */
            _CSS_UNDERLINE: /text-decoration\:\s*underline/i,
            
            /**
             * An object which reports style information about a specific node's text content, including inherited style properties.
             */
            StyleData: Core.extend({
                
                /**
                 * Flag indicating whether the text is bold.
                 * @type Boolean
                 */
                bold: false,
                
                /**
                 * Flag indicating whether the text is italicized.
                 * @type Boolean
                 */
                italic: false,
                
                /**
                 * Flag indicating whether the text is underlined.
                 * @type Boolean
                 */
                underline: false,
                
                /**
                 * The paragraph style, one of the following values:
                 * <ul>
                 *  <li>p</li>
                 *  <li>pre</li>
                 *  <li>h1</li>
                 *  <li>h2</li>
                 *  <li>h3</li>
                 *  <li>h4</li>
                 *  <li>h5</li>
                 *  <li>h6</li>
                 * </ul>
                 * 
                 * @type String
                 */
                paragraphStyle: null,
                
                /**
                 * The text foreground color.
                 * @type #Color
                 */
                foreground: null,
                
                /**
                 * The text background color.
                 * @type #Color
                 */
                background: null,
                
                /**
                 * Creates a new style for a specific DOM node.
                 * 
                 * @param {Node} node the node
                 */
                $construct: function(node) {
                    var rgb;
            
                    while (node) { 
                        if (node.nodeType == 1) {
                            switch (node.nodeName.toLowerCase()) {
                            case "b": case "strong":
                                this.bold = true;
                                break;
                            case "i": case "em":
                                this.italic = true;
                                break;
                            case "u":
                                this.underline = true;
                                break;
                            case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": case "p": case "pre":
                                if (!this.paragraphStyle) {
                                    this.paragraphStyle = node.nodeName.toLowerCase();
                                }
                                break;
                            }
                        
                            var css = node.style.cssText;
                            this.bold |= Extras.Sync.RichTextInput.Html._CSS_BOLD.test(css);
                            this.italic |= Extras.Sync.RichTextInput.Html._CSS_ITALIC.test(css);
                            this.underline |= Extras.Sync.RichTextInput.Html._CSS_UNDERLINE.test(css);
                            
                            if (!this.foreground && Extras.Sync.RichTextInput.Html._CSS_FOREGROUND_TEST.test(css)) {
                                rgb = Extras.Sync.RichTextInput.Html._CSS_FOREGROUND_RGB.exec(css);
                                if (rgb) {
                                    this.foreground = Echo.Sync.Color.toHex(
                                            parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10));
                                }
                            }
            
                            if (!this.background && Extras.Sync.RichTextInput.Html._CSS_BACKGROUND_TEST.test(css)) {
                                rgb = Extras.Sync.RichTextInput.Html._CSS_BACKGROUND_RGB.exec(css);
                                if (rgb) {
                                    this.background = Echo.Sync.Color.toHex(
                                            parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10));
                                }
                            }
                        }
                        node = node.parentNode;
                    }
                }
            }),
            
            /**
             * Cleans HTML input/output.
             * 
             * @param {String} html the HTML to clean
             * @return the cleaned HTML
             * @type String
             */
            clean: function(html) {
                html = html || "<p></p>";
                html = html.replace(Extras.Sync.RichTextInput.Html._LEADING_WHITESPACE, "");
                html = html.replace(Extras.Sync.RichTextInput.Html._TRAILING_WHITESPACE, "");
                if (Core.Web.Env.ENGINE_MSHTML) {
                    html = html.replace(Extras.Sync.RichTextInput.Html._MSIE_INVALID_FONT_COLOR_REPL, "$1\"$2\"$3");
                    html = html.replace(Extras.Sync.RichTextInput.Html._MSIE_INVALID_FONT_BACKGROUND_REPL, "$1background-color");
                }
                return html;
            }
        },
        
        /**
         * A cross-platform range implementation, which provides a subset of functionality available from W3C DOM Range and
         * Internet Explorer's TextRange objects. 
         */
        Range: Core.extend({
            
            /**
             * An Internet Explorer-specific proprietary <code>TextRange</code> object.  Available only when DOM range API is 
             * unavailable, in MSIE-based browsers.
             *
             * @type TextRange
             */
            ieRange: null,
            
            /**
             * W3C DOM Range.  Available on all browsers where supported (i.e., not IE).
             * 
             * @type Range
             */
            domRange: null,
            
            /**
             * The <code>Window</code> containing the range.
             * 
             * @type Window
             */
            window: null,
            
            /**
             * Creates a new <code>Range</code> withing the target <code>Window</code>.
             * 
             * @param {Window} targetWindow the browser window in which the range should exist
             */
            $construct: function(targetWindow) {
                this.window = targetWindow;
                if (Core.Web.Env.ENGINE_MSHTML) {
                    this.ieRange = targetWindow.document.selection.createRange();
                    if (this.ieRange.parentElement().ownerDocument != targetWindow.document) {
                        targetWindow.focus();
                        this.ieRange = targetWindow.document.selection.createRange();
                        if (this.ieRange.parentElement().ownerDocument != targetWindow.document) {
                            this.ieRange = null;
                        }
                    }
                } else {
                    this.domRange = targetWindow.getSelection().getRangeAt(0);
                }
            },
            
            /**
             * Activates the range, moving the client's cursor/selection positions to it.
             */
            activate: function() {
                if (this.domRange) {
                    var selection = this.window.getSelection();
                    if (!selection) {
                        return;
                    }
                    selection.removeAllRanges();
                    selection.addRange(this.domRange);
                } else if (this.ieRange) {
                    this.ieRange.select();
                }
            },
            
            /**
             * Disposes of the range.
             */
            dispose: function() {
                this.domRange = null;
                this.ieRange = null;
                this.window = null;
            },
            
            /**
             * Returns the element/node which contains the range.
             * If an <code>elementName</code> is specified, the returned node will be an element of the specified name,
             * or null if none exists.
             * 
             * @param {String} elementName (optional) the enclosing element name
             */
            getContainingNode: function(elementName) {
                var node;
                if (this.domRange) {
                    node = this.domRange.commonAncestorContainer;
                } else if (this.ieRange) {
                    node = this.ieRange.parentElement();
                }
                
                if (elementName) {
                    while (node != null) {
                        if (node.nodeType == 1 && node.nodeName.toLowerCase() == elementName) {
                            return node;
                        }
                        node = node.parentNode;
                    }
                }
                
                return node;
            }
        }),
        
        /**
         * Key codes which may result in cursor navigating into new style, resulting in a "cursorStyleChange" event being fired.
         */
        _NAVIGATION_KEY_CODES: {
            38: 1, 40: 1, 37: 1, 39: 1, 33: 1, 34: 1, 36: 1, 35: 1, 8: 1, 46: 1
        }
    },
    
    /**
     * Flag indicating whether a style information update is required due to the cursor/selection having been moved/changed.
     * @type Boolean
     */
    _cursorStyleUpdateRequired: false,

    /**
     * Flag indicating whether an action event should be fired.
     * Set by _processKeyPress(), used by _processKeyUp().
     * @type Boolean
     */
    _fireAction: false,
    
    /**
     * The most recently retrieved document HTML.
     * @type String 
     */
    _renderedHtml: null,
    
    /**
     * Listener to receive property events from component.
     * @type Function
     */
    _propertyListener: null,

    /**
     * Listener to receive execCommand events from component.
     * @type Function
     */
    _execCommandListener: null,
    
    /**
     * Root DIV element of rendered DOM hierarchy.
     * @type Element
     */
    _div: null,
    
    /**
     * Rendered IFRAME element containing editable document.
     * @type Element
     */
    _iframe: null,
    
    /**
     * The IFRAME's contained document.
     * @type Document
     */
    _document: null,
    
    _temporaryCssStyleEnabled: false,

    /**
     * Constructor.
     */
    $construct: function() { 
        this._propertyListener = Core.method(this, function(e) {
            if (e.propertyName == "text") {
                this._loadData();
            }
        });
        this._execCommandListener = Core.method(this, function(e) {
            this._execCommand(e.commandName, e.value);
        });
    },
    
    /**
     * Adds listeners to supported Extras.RichTextInput object.
     */
    _addComponentListeners: function() {
        this.component.addListener("execCommand", this._execCommandListener);
        this.component.addListener("property", this._propertyListener);
    },
    

    /**
     * Deletes a column from an HTML table containing the current selection.
     * Takes no action in the event that the selection is not in a table cell. 
     * This method assumes no column or row spans.
     */
    _deleteTableColumn: function() {
        var action = Core.method(this, function(td) {
            td.parentNode.removeChild(td);
        });
        this._updateSelectedTableColumn(action);
    },
    
    /**
     * Deletes a row from an HTML table containing the current selection.
     * Takes no action in the event that the selection is not in a table cell.
     * This method assumes no column or row spans.
     */
    _deleteTableRow: function() {
        var tr = this._selectionRange.getContainingNode("tr");
        if (!tr) {
            return;
        }
        tr.parentNode.removeChild(tr);
    },

    /**
     * Disposes of current selection range.
     */
    _disposeRange: function() {
        if (this._selectionRange) {
            //FIXME 
            this._selectionRange.dispose();
        }
    },
    
    /**
     * Executes a rich text editing command (via document.execCommand()).
     * 
     * @param {String} commandName the command name
     * @param {String} value the command value
     */
    _execCommand: function(commandName, value) {
        if (this._temporaryCssStyleEnabled) {
            this._document.execCommand("styleWithCSS", false, false);
            this._temporaryCssStyleEnabled = false;
        }
        
        if (this._selectionRange) {
            // Select range if it exists.
            this._loadRange();
        } else {
            // Create range if none exists.
            this._storeRange();
        }
        
        switch (commandName) {
        case "tableDeleteColumn":
            this._deleteTableColumn();
            break;
        case "tableDeleteRow":
            this._deleteTableRow();
            break;
        case "tableInsertColumn":
            this._insertTableColumn();
            break;
        case "tableInsertRow":
            this._insertTableRow();
            break;
        case "foreground":
            this._document.execCommand("forecolor", false, value);
            break;
        case "background":
            if (Core.Web.Env.ENGINE_GECKO) {
                this._document.execCommand("styleWithCSS", false, true);
                this._document.execCommand("hilitecolor", false, value);
                this._temporaryCssStyleEnabled = true;
            } else {
                this._document.execCommand(Core.Web.Env.ENGINE_MSHTML ? "backcolor" : "hilitecolor", false, value);
            }
            break;
        case "insertHtml":
            if (Core.Web.Env.ENGINE_MSHTML) {
                if (!this._selectionRange) {
                    this._storeRange(); 
                }
                this._selectionRange.ieRange.pasteHTML(value);
            } else {
                this._document.execCommand("inserthtml", false, value);
            }
            this._storeRange();
            break;
        default: 
            this._document.execCommand(commandName, false, value);
            break;
        }
        
        this._storeData();
        
        this.client.forceRedraw();
        
        // Flag that cursor style update is required.  Some browsers will not render nodes until text is inserted.
        this._cursorStyleUpdateRequired = true;
    },
    
    /**
     * Focuses the rich text input document.
     */
    focusDocument: function() {
        this.client.application.setFocusedComponent(this.component);
        this.client.forceRedraw();
    },
    
    /**
     * Returns a processed version of the currently edited HTML.
     * 
     * @return the processed HTML
     * @type String
     */
    _getProcessedHtml: function() {
        if (this._renderedHtml == null) {
            this._renderedHtml = this._document.body.innerHTML; 
        }
        return Extras.Sync.RichTextInput.Html.clean(this._renderedHtml);
    },
    
    /**
     * Determines the column index of the specified TD or TH element.
     * TD or TH elements contained in a TR are considered columns.
     * This method assumes no column or row spans.
     * 
     * @param {Element} td the TD element
     * @return the column index, or -1 if it cannot be found
     * @type Number 
     */
    _getTableColumnIndex: function(td) {
        var tr = td.parentNode;
        if (tr.nodeName.toLowerCase() != "tr") {
            // Sanity check; should not occur.
            return -1;
        }
        var index = 0;
        var node = tr.firstChild;
        while (node && node != td) {
            var nodeName = node.nodeName.toLowerCase();
            if (nodeName == "td" || nodeName == "th") {
                ++index;
            }
            node = node.nextSibling;
        }
        if (!node) {
            return -1;
        }
        return index;
    },
    
    /**
     * Inserts a column into an HTML table containing the current selection.
     * Takes no action in the event that the selection is not in a table.
     * This method assumes no column or row spans.
     */
    _insertTableColumn: function() {
        var action = Core.method(this, function(td) {
            var newTd = this._document.createElement("td");
            if (!Core.Web.Env.ENGINE_MSHTML) {
                newTd.appendChild(this._document.createElement("br"));
            }
            td.parentNode.insertBefore(newTd, td);
        });
        this._updateSelectedTableColumn(action);
    },
    
    /**
     * Inserts a row into an HTML table containing the current selection.
     * Takes no action in the event that the selection is not in a table.
     * This method assumes no column or row spans.
     */
    _insertTableRow: function() {
        var tr = this._selectionRange.getContainingNode("tr");
        
        var table = this._selectionRange.getContainingNode("table");
        if (!tr || !table) {
            return;
        }
        
        var newTr = this._document.createElement("tr");
        var node = tr.firstChild;
        while (node) {
            if (node.nodeType == 1 && (node.nodeName.toLowerCase() == "td" || node.nodeName.toLowerCase() == "th")) {
                var newTd = this._document.createElement("td");
                if (!Core.Web.Env.ENGINE_MSHTML) {
                    newTd.appendChild(this._document.createElement("br"));
                }
                newTr.appendChild(newTd);
            }
            node = node.nextSibling;
        }
        
        tr.parentNode.insertBefore(newTr, tr);
    },
    
    /**
     * Loads the text data in the component's "text" property into the rendered editable document.
     * @see #_storeData
     */
    _loadData: function() {
        var text = this.component.get("text") || (Core.Web.Env.ENGINE_GECKO ? "<p><br/></p>" : "<p></p>");
        
        if (text instanceof Extras.Sync.RichTextInput.EditedHtml) {
            // Current component text is represented by an EditedHtml object, which references the editable text document 
            // itself: do nothing.
            return;
        }
        
        if (this._renderedHtml == null) {
            this._renderedHtml = this._document.body.innerHTML; 
        }

        if (text == this._renderedHtml) {
            // No update necessary.
            return;
        }

        this._renderedHtml = text;
        this._document.body.innerHTML = text;
        
        if (this._selectionRange) {
            this.component.doCursorStyleChange(new Extras.Sync.RichTextInput.Html.StyleData(
                    this._selectionRange.getContainingNode()));
        }
    },
    
    /**
     * Selects (only) the current stored range.
     * @see #_storeRange
     */
    _loadRange: function() {
        if (this._selectionRange) {
            this._selectionRange.activate();
            if (Core.Web.Env.ENGINE_MSHTML && this.component.application.getFocusedComponent() != this.component) {
                // MSIE: Blur focus from content window in the event that it is not currently focused.
                // If this operation is not performed, text may be entered into the window, but key events
                // will not be processed by listeners, resulting in an out-of-sync condition.
                this._iframe.contentWindow.blur();
            }
        }
    },
    
    /**
     * Notifies component object of a potential cursor style change (such that it may notify registered listeners).
     */
    _notifyCursorStyleChange: function() {
        this._cursorStyleUpdateRequired = false;
        Core.Web.Scheduler.run(Core.method(this, function() {
            this.component.doCursorStyleChange(new Extras.Sync.RichTextInput.Html.StyleData(
                  this._selectionRange.getContainingNode()));
        }));
    },
    
    /**
     * Processes a focus event within the input document.
     * 
     * @param e the event
     */
    _processFocus: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            Core.Web.DOM.preventEventDefault(e);
            return;
        }
        this.client.application.setFocusedComponent(this.component);
    },
    
    /**
     * Processes a key press event within the input document.
     * 
     * @param e the event
     */
    _processKeyDown: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            Core.Web.DOM.preventEventDefault(e);
            return;
        }
        if (e.keyCode == 13) {
            this._processNewLine();
            this._fireAction = true;
        }
    },
    
    /**
     * Processes a key press event within the input document.
     * 
     * @param e the event
     */
    _processKeyPress: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            Core.Web.DOM.preventEventDefault(e);
            return;
        }
    },
    
    /**
     * Processes a key up event within the input document.
     * 
     * @param e the event
     */
    _processKeyUp: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }

        this._storeData();
        this._storeRange();
        
        if (this._cursorStyleUpdateRequired || Extras.Sync.RichTextInput._NAVIGATION_KEY_CODES[e.keyCode]) {
            this._notifyCursorStyleChange();
        }
        
        if (this._fireAction) {
            this._fireAction = false;
            this.component.doAction();
        }
    },
    
    /**
     * Processes a mouse down event within the input document.
     * 
     * @param e the event
     */
    _processMouseDown: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            Core.Web.DOM.preventEventDefault(e);
            return;
        }
        this.client.application.setFocusedComponent(this.component);
    },

    /**
     * Processes a mouse up event within the input document.
     * 
     * @param e the event
     */
    _processMouseUp: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            Core.Web.DOM.preventEventDefault(e);
            return;
        }

        this._storeRange();
        
        this._notifyCursorStyleChange();
    },
    
    /**
     * Processes a user newline entry keyboard event (pressing return/enter).
     * Handles special case in Gecko/WebKit browser where cursor is not within
     * a block element (e.g., "p" tag), which will cause enter key to 
     * insert "<br>" (Gecko) or "<div>" (WebKit) tags.  Such behavior is undesirable for cross-browser
     * editing of content (i.e., editing same rich text document by different
     * browsers).
     */
    _processNewLine: function() {
        var node, inBlock;
        
        if (!Core.Web.Env.ENGINE_GECKO && !Core.Web.Env.ENGINE_WEBKIT) {
            // Allow normal operation in non-Gecko browsers.
            return;
        }
        
        this._storeRange();
        node = this._selectionRange.domRange.endContainer;
        inBlock = false;
        while (node.nodeType != 1 || node.nodeName.toLowerCase() != "body") {
            if (node.nodeType == 1 && Extras.Sync.RichTextInput.BLOCK_NODES[node.nodeName.toLowerCase()]) {
                inBlock = true;
                break;
            }
            node = node.parentNode;
        }
        
        if (inBlock) {
            // In block: Gecko browsers will work properly as 'insertbronreturn' flag has been set false.
            return;
        }
        
        this._document.execCommand("formatblock", null, "<p>");
    },
    
    /**
     * Removes listeners from supported Extras.RichTextInput object.
     */
    _removeComponentListeners: function() {
        this.component.removeListener("execCommand", this._execCommandListener);
        this.component.removeListener("property", this._propertyListener);
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._addComponentListeners();
        
        // Create IFRAME container DIV element.
        this._div = document.createElement("div");
        Echo.Sync.Border.render(this.component.render("border", Extras.Sync.RichTextInput.DEFAULTS.border), this._div);
        
        // Create IFRAME element.
        this._iframe = document.createElement("iframe");
        this._iframe.style.width = this.width ? this.width : "100%";

        if (!this.component.get("paneRender")) {
            this._iframe.style.height = this.height ? this.height : "200px";
        }

        this._iframe.style.border = "0px none";
        this._iframe.frameBorder = "0";
    
        this._div.appendChild(this._iframe);
    
        parentElement.appendChild(this._div);
    },
    
    /**
     * Renders the editable content document within the created IFRAME.
     */
    _renderDocument: function() {
        // Ensure element is on-screen before rendering content/enabling design mode.
        var element = this._iframe;
        while (element != document.body) {
            if (element == null) {
                // Not added to parent.
                return;
            }
            if (element.nodeType == 1 && element.style.display == "none") {
                // Not rendered.
                return;
            }
            element = element.parentNode;
        }
        
        var style = "height:100%;width:100%;margin:0px;padding:0px;";
        var foreground = this.component.render("foreground");
        if (foreground) {
            style += "color:" + foreground + ";";
        }
        var background = this.component.render("background");
        if (background) {
            style += "background-color:" + background + ";";
        }
        var backgroundImage = this.component.render("backgroundImage");
        if (backgroundImage) {
            style += "background-attachment: fixed;";
            style += "background-image:url(" + Echo.Sync.FillImage.getUrl(backgroundImage) + ");";
            var backgroundRepeat = Echo.Sync.FillImage.getRepeat(backgroundImage);
            if (backgroundRepeat) {
                style += "background-repeat:" + backgroundRepeat + ";";
            }
            var backgroundPosition = Echo.Sync.FillImage.getPosition(backgroundImage);
            if (backgroundPosition) {
                style += "background-position:" + backgroundPosition + ";";
            }
        }
        
        var text = this.component.get("text");
        this._document = this._iframe.contentWindow.document;
        this._document.open();
        this._document.write("<html><body tabindex=\"0\" width=\"100%\" height=\"100%\"" +
                (style ? (" style=\"" + style + "\"") : "") + ">" + (text || "") + "</body></html>");
        this._document.close();
        if (Core.Web.Env.BROWSER_MOZILLA && !Core.Web.Env.BROWSER_FIREFOX) {
            // workaround for Mozilla (not Firefox)
            var setDesignModeOn = function() {
                this._document.designMode = "on";
            };
            setTimeout(setDesignModeOn, 0);
        } else {
            this._document.designMode = "on";
            if (Core.Web.Env.ENGINE_GECKO || Core.Web.Env.ENGINE_WEBKIT) {
                this._document.execCommand("insertbronreturn", false, false);
                this._document.execCommand("stylewithcss", false, false);
                this._document.execCommand("enableObjectResizing", false, false);
                this._document.execCommand("enableInlineTableEditing", false, false);
            }
        }
        
        Core.Web.Event.add(this._document, "focus",  Core.method(this, this._processFocus), false);
        Core.Web.Event.add(this._document, "keydown",  Core.method(this, this._processKeyDown), false);
        Core.Web.Event.add(this._document, "keypress",  Core.method(this, this._processKeyPress), false);
        Core.Web.Event.add(this._document, "keyup", Core.method(this, this._processKeyUp), false);
        Core.Web.Event.add(this._document, "mousedown", Core.method(this, this._processMouseDown), false);
        Core.Web.Event.add(this._document, "mouseup", Core.method(this, this._processMouseUp), false);

        this._documentRendered = true;
    },
    
    /**
     * Clears the editable document, disposing any resources related to it.
     * Invoked by renderHide() implementation.
     */
    _renderDocumentRemove: function() {
        Core.Web.Event.removeAll(this._document);
        while (this._document.body.firstChild) {
            this._document.body.removeChild(this._document.body.firstChild);
        }
        this._documentRendered = false;
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._removeComponentListeners();
        Core.Web.Event.removeAll(this._document);
        this._div = null;
        this._iframe = null;
        this._document = null;
        this._documentRendered = false;
        this._selectionRange = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        if (!this._documentRendered) {
            this._renderDocument();
        }

        this.client.forceRedraw();
        
        var bounds = new Core.Web.Measure.Bounds(this._div.parentNode);
        
        if (bounds.height) {
            var border = this.component.render("border", Extras.Sync.RichTextInput.DEFAULTS.border);
            var borderSize = Echo.Sync.Border.getPixelSize(border, "top") + Echo.Sync.Border.getPixelSize(border, "bottom");
    
            var calculatedHeight = (bounds.height < 100 ? 100 : bounds.height - borderSize) + "px";
            if (this._iframe.style.height != calculatedHeight) {
                this._iframe.style.height = calculatedHeight; 
            }
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderFocus */
    renderFocus: function() {
        if (Core.Web.Env.BROWSER_SAFARI) {
            // Focus window first to avoid issue where Safari issue with updating content and then focusing.
            window.focus();
        }
        Core.Web.DOM.focusElement(this._iframe.contentWindow);
        this.client.forceRedraw();
    },
    
    /** @see Echo.Render.ComponentSync#renderHide */
    renderHide: function() {
        // Dispose selection range (critical for MSIE).
        this._disposeRange();
        
        // Store state.
        this._renderedHtml = this._document.body.innerHTML;
        
        // Clear editable document and dispose resources.
        this._renderDocumentRemove();
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        if (update.isUpdatedPropertySetIn({text: true })) {
            this._loadData();
            update.renderContext.displayRequired = [];
            return;
        }
    
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
    },
        
    /**
     * Stores the state of the editable document into the "text" property of the component.
     * The HTML is cleaned first.
     * @see #_loadData
     */
    _storeData: function() {
        this._renderedHtml = null;
        this.component.set("text", new Extras.Sync.RichTextInput.EditedHtml(this), true);
    },
    
    /**
     * Stores the current selection range.
     * @see #_loadRange
     */
    _storeRange: function() {
        this._disposeRange();
        this._selectionRange = new Extras.Sync.RichTextInput.Range(this._iframe.contentWindow);
    },

    /**
     * Updates the selected table column, passing each TD/TH element at the column index
     * to the specified action method.
     * 
     * @param {Function} action function to invoke on each TD/TH element of column, the
     *        TD/TH element will be provided as the only parameter to the function
     */
    _updateSelectedTableColumn: function(action) {
        var td = this._selectionRange.getContainingNode("td");
        if (!td) {
            return;
        }
        var index = this._getTableColumnIndex(td);
        if (index === -1) {
            return;
        }
        var table = this._selectionRange.getContainingNode("table");
        this._updateTableColumnFromTbody(table, index, action);
    },

    /**
     * Work method for <code>_updateSelectedTableColumn</code>.
     * Processes TBODY/TABLE elements, searching for TD/TH elements representing the table column
     * specified by <code>index</code>.
     * 
     * @param {Element} tbody the TABLE or TBODY element
     * @param {Number} index the column index
     * @param {Function} action function to invoke on each TD/TH element of column, the
     *        TD/TH element will be provided as the only parameter to the function
     */
    _updateTableColumnFromTbody: function(tbody, index, action) {
        var node = tbody.firstChild;
        while (node) {
            if (node.nodeType == 1) {
                var nodeName = node.nodeName.toLowerCase();
                if (nodeName == "tbody") {
                    this._updateTableColumnFromTbody(node, index, action);
                } else if (nodeName == "tr") {
                    this._updateTableColumnFromTr(node, index, action);
                }
            }
            node = node.nextSibling;
        }
    },
    
    /**
     * Work method for <code>_updateSelectedTableColumn</code>.
     * Processes TR elements, searching for TD/TH elements representing the table column
     * specified by <code>index</code>.
     * 
     * @param {Element} tr the TR element
     * @param {Number} index the column index
     * @param {Function} action function to invoke on each TD/TH element of column, the
     *        TD/TH element will be provided as the only parameter to the function
     */
    _updateTableColumnFromTr: function(tr, index, action) {
        var i = -1;
        var node = tr.firstChild;
        while (node) {
            if (node.nodeType == 1) {
                var nodeName = node.nodeName.toLowerCase();
                if (nodeName == "td" || nodeName == "th") {
                    ++i;
                    if (i == index) {
                        action(node);
                        return;
                    }
                }
            }
            node = node.nextSibling;
        }
    }
});
/**
 * Component rendering peer: TabPane.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.TabPane = Core.extend(Echo.Render.ComponentSync, {

    $static: {
    
        /**
         * Prototype zero-padding table/tbody/tr hierarchy.
         * @type Element
         */
        _TABLE: null,
    
        /**
         * Generates a zero-pading table/tbody/tr hierarchy.
         * 
         * @return the root table element
         * @type Element
         */
        _createTable: function() {
            if (!this._TABLE) {
                this._TABLE = document.createElement("table");
                this._TABLE.style.cssText = "border-collapse:collapse;padding:0;";
                var tbody = document.createElement("tbody");
                this._TABLE.appendChild(tbody);
                var tr = document.createElement("tr");
                tbody.appendChild(tr);
            }
            return this._TABLE.cloneNode(true);
        },

        /**
         * Supported partial update properties. 
         * @type Array
         */
        _supportedPartialProperties: ["activeTabId", "activeTabIndex"],
        
        /**
         * Default component property settings, used when supported component object does not provide settings. 
         */
        _DEFAULTS: {
            borderType: Extras.TabPane.BORDER_TYPE_ADJACENT_TO_TABS,
            foreground: "#000000",
            insets: 2,
            tabActiveBorder: "1px solid #00004f",
            tabActiveHeightIncrease: 2,
            tabAlignment: "top",
            tabCloseIconTextMargin: 5,
            tabContentInsets: 0,
            tabIconTextMargin: 5,
            tabInactiveBorder: "1px solid #7f7f7f",
            tabInset: 10,
            tabInsets: "1px 8px",
            tabPosition: Extras.TabPane.TAB_POSITION_TOP,
            tabSpacing: 0
        },
        
        /**
         * Runnable to manage scrolling animation.
         */
        ScrollRunnable: Core.extend(Core.Web.Scheduler.Runnable, {
        
            /** @see Core.Web.Scheduler.Runnable#repeat */
            repeat: true,

            /** @see Core.Web.Scheduler.Runnable#timeInterval */
            timeInterval: 20,

            /**
             * Direction of scrolling travel.  True indicates tabs are scrolling in reverse (revealing tabs to the left),
             * true indicating scrolling forward (revealing tabs to the right).
             * @type Boolean
             */
            reverse: false,
            
            /**
             * Current distance scrolled, in pixels.
             * @type Number
             */
            distance: 0,
            
            /** 
             * Minimum distance to move (in case of click rather than hold
             * @type Number 
             */
            clickDistance: 50,
            
            /** 
             * Rate to scroll when scroll button held.
             * @type Number 
             */
            pixelsPerSecond: 400,
            
            /** 
             * Initial scroll position.
             * @type Number 
             */
            initialPosition: null,
            
            /**
             * Flag indicating whether the ScrollRunnable is disposed.
             * @type Boolean
             */
            disposed: false,
            
            /**
             * The TabPane peer for which scrolling is being performed.
             * @type Extras.Sync.TabPane
             */
            peer: null,
            
            /**
             * Last invocation time of run() method.  Used to determine the number of pixels which should be scrolled and 
             * ensure a constant velocity of the tabs.
             */
            lastInvokeTime: null,
        
            /**
             * Creates a new ScrollRunnable.
             * 
             * @param {Extras.Sync.TabPane} the synchronization peer
             * @param {Boolean} direction of scrolling travel
             */
            $construct: function(peer, reverse) {
                this.peer = peer;
                this.reverse = reverse;
                this.initialPosition = peer.scrollPosition;
                this.lastInvokeTime = new Date().getTime();
            },
            
            /**
             * Disposes of the scrolling runnable, removing it from the scheduler.
             */
            dispose: function() {
                if (!this.disposed) {
                    Core.Web.Scheduler.remove(this);
                }
                this.disposed = true;
            },
            
            /**
             * Finishes the tab header scrolling operation in response to the user releasing the scroll button.
             * Ensures the header has been scrolled the minimum "click distance", and if not, scrolls the header
             * that distance.
             */
            finish: function() {
                if (this.distance < this.clickDistance) {
                    this.distance = this.clickDistance;
                    this.updatePosition();
                }
                this.peer.renderDisplay();
                this.dispose();
            },
            
            /** @see Core.Web.Scheduler.Runnable#run */
            run: function() {
                var time = new Date().getTime();
                this.distance += Math.ceil(this.pixelsPerSecond * (time - this.lastInvokeTime) / 1000);
                this.lastInvokeTime = time;
                this.updatePosition();
            },
            
            /**
             * Updates the scroll position of the tab pane header.
             */
            updatePosition: function() {
                var position = this.initialPosition + ((this.reverse ? -1 : 1) * this.distance);
                if (!this.peer.setScrollPosition(position)) {
                    this.dispose();
                }
            }
        })
    },
    
    $load: function() {
        Echo.Render.registerPeer("Extras.TabPane", this);
    },
    
    /**
     * Name-to-ImageReference map for icons used by the TabPane, e.g., tab close and scroll icons.
     * @type Object
     */
    _icons: null,

    /**
     * Primary DIV element.
     * @type Element
     */
    _div: null,

    /**
     * DIV element which contains content.  All child components are rendered within this DIV,
     * only one is allowed to be visibly displayed at a given time.
     * @type Element
     */    
    _contentContainerDiv: null,
    
    /**
     * Element containing _headerContainerDiv.
     */
    _headerContainerBoundsDiv: null,
    
    /**
     * Element containing tab headers.
     * This element is contained withing the _headerContainerBoundsDiv, and positioned left/right to facilitate scrolling of 
     * tab headers.
     * @type Element
     */
    _headerContainerDiv: null,
    
    /**
     * The renderId of the active tab.
     * @type String
     */
    _activeTabId: null,
    
    /**
     * The renderId of the displayed tab.
     * @type String 
     */
    _displayedTabId: null,
    
    /**
     * Scroll previous arrow.
     * @type Element
     */
    _previousControlDiv: null,
    
    /**
     * Scroll next arrow.
     * @type Element
     */
    _nextControlDiv: null,
    
    /**
     * Data object containing information about a pending update to a tab's rollover state.
     */
    _pendingRollover: null,
    
    /**
     * The tab which is currently rolled over.
     * @type String
     */
    _rolloverTabId: null,
    
    /**
     * Flag indicating whether the current rolled over tab's close icon is rolled over.
     * @type Boolean
     */
    _rolloverTabCloseState: false,
    
    /**
     * Runnable used to delay rendering of rollover effects to avoid flicker.
     * @type Core.Web.Scheduler.Runnable
     */
    _rolloverRunnable: null,

    /**
     * Array containing <code>Extras.Sync.TabPane.Tab</code> objects represented the displayed tabs.
     * Each index of this array matches the corresponding child component index.
     * @type Array 
     */
    _tabs: null,
    
    /**
     * Combined width of all tabs, in pixels.
     * @type Number
     */
    _totalTabWidth: 0,
    
    /**
     * Height of the header, in pixels.
     * @type Number
     */
    _headerHeight: null,
    
    /**
     * Flag indicating whether a re-layout operation is required.  Flag is set by renderAdd()/renderUpdate() methods.
     * @type Boolean
     */
    _layoutRequired: false,
    
    /**
     * Flag indicating whether header images have been completely loaded.
     */
    _headerImageLoadingComplete: false,
    
    /**
     * Flag indicating whether a full header re-render operation is required.  Flag is set by renderUpdate() method in response
     * to child layout data changes to avoid full render.
     * @type Boolean
     */
    _headerUpdateRequired: false,
    
    /** 
     * Method reference to <code>_tabSelectListener</code> of instance.
     * @type Function 
     */
    _tabSelectListenerRef: null,
    
    /**
     * The ScrollRunnable currently scrolling the tab headers.  Null when the tab pane is not actively scrolling. 
     * @type Extras.Sync.TabPane#ScrollRunnable
     */
    _scrollRunnable: null,
    
    /** 
     * Current scroll position of tab header, in pixels.
     * @type Number
     */
    scrollPosition: 0,
    
    /**
     * Flag indicating rendered layout direction of component (true if right-to-left).
     * @type Boolean
     */
    _rtl: false,

    /**
     * Focus proxy element which keeps track of the browser focus for the tab pane.
     */
    _focusAnchor: null,
    _focusAnchorDiv: null,
    
    /**
     * Constructor.
     */
    $construct: function() {
        this._tabs = [];
        this._tabSelectListenerRef = Core.method(this, this._tabSelectListener);
    },
    
    /**
     * Adds a tab and renders it.
     *
     * @param {Echo.Update.ComponentUpdate} update the component update 
     * @param {Extras.Sync.TabPane.Tab} tab the tab to be added 
     * @param index the index at which the tab should be added
     */
    _addTab: function(update, tab, index) {
        if (index == null || index == this._tabs.length) {
            this._tabs.push(tab);
            tab._renderAdd(update);
            this._headerContainerDiv.appendChild(tab._headerDiv);
            this._contentContainerDiv.appendChild(tab._contentDiv);
        } else {
            this._tabs.splice(index, 0, tab);
            tab._renderAdd(update);
            this._headerContainerDiv.insertBefore(tab._headerDiv, this._headerContainerDiv.childNodes[index]);
            this._contentContainerDiv.insertBefore(tab._contentDiv, this._contentContainerDiv.childNodes[index]);
        }
    },

    /**
     * Measures the height of the header region of the tab pane, adjusting the content region's size to accommodate it.
     * Invoked in renderDisplay phase when <code>_layoutRequired</code> flag has been set.
     */
    _renderLayout: function() {
        if (!this._layoutRequired) {
            return;
        }
        
        this._renderHeaderPositions();
        
        if (this._headerHeight === 0) {
            return;
        }
        this._layoutRequired = false;
        
        if (this._borderDiv) {
            // Adjust image border DIV to match header height.
            this._borderDiv.style[this._tabSide] = (this._headerHeight - this._ibContentInsetsPx[this._tabSide]) + "px";
        }
        
        var borderSize = this._borderType == Extras.TabPane.BORDER_TYPE_NONE ? 0 : Echo.Sync.Border.getPixelSize(this._border);
        this._headerContainerBoundsDiv.style.height = this._headerHeight + "px";
        this._contentContainerDiv.style.left = this._contentContainerDiv.style.right = 
                this._contentContainerDiv.style[this._oppositeSide] = 0;
        this._contentContainerDiv.style[this._tabSide] = (this._headerHeight - borderSize) + "px";
        
        Core.Web.VirtualPosition.redraw(this._contentContainerDiv);
        Core.Web.VirtualPosition.redraw(this._headerContainerDiv);
        Core.Web.VirtualPosition.redraw(this._headerContainerBoundsDiv);
        for (var i = 0; i < this._tabs.length; ++i) {
            this._tabs[i]._renderDisplay();
        }
        
        if (!this._headerImageLoadingComplete) {
            this._headerImageLoadingComplete = true;
            // Add image monitor to re-execute renderLayout as images are loaded.
            var imageListener = Core.method(this, function() {
                if (this.component) { // Verify component still registered.
                    this._layoutRequired = true;
                    this._renderLayout();
                }
            });
            imageListener.id = "TabPane:" + this.component.renderId;
            Core.Web.Image.monitor(this._headerContainerDiv, imageListener);
        }
    },
    
    /**
     * Positions tabs.
     * Equalizes tab heights to height of tallest tab.
     * Determines and stores the object's <code>_totalTabWidth</code> and <code>_headerHeight</code> properties.
     */
    _renderHeaderPositions: function() {
        var maxActiveHeight = 0,
            maxInactiveHeight = 0,
            tabActiveHeight,
            tabInactiveHeight,
            i,
            clearHeight = this._tabHeight ? (this._tabHeight + "px") : "";
            
        this._totalTabWidth = 0;
        this._headerHeight = 0;

        var maximumTabWidth = this.component.render("tabWidth") ? null : this.component.render("tabMaximumWidth");
        var maximumTabWidthPx;
        if (maximumTabWidth) {
            if (Echo.Sync.Extent.isPercent(maximumTabWidth)) {
                var percent = parseInt(maximumTabWidth, 10);
                maximumTabWidthPx = Math.floor(this._tabContainerWidth * percent / 100); 
            } else {
                maximumTabWidthPx = Echo.Sync.Extent.toPixels(maximumTabWidth);
            }
        }
        
        for (i = 0; i < this._tabs.length; ++i) {
            // Clear height/width settings.
            this._tabs[i]._heightTd.style.height = clearHeight;
            if (maximumTabWidthPx) {
                this._tabs[i]._textDiv.style.width = "";
                var labelBounds = new Core.Web.Measure.Bounds(this._tabs[i]._textDiv, 
                            { flags: Core.Web.Measure.Bounds.FLAG_MEASURE_DIMENSION });
                if (labelBounds.width > maximumTabWidthPx) {
                    this._tabs[i]._textDiv.style.width = maximumTabWidthPx + "px";
                }
            }
            
            // Determine bounds of tab.
            var headerDivBounds = new Core.Web.Measure.Bounds(this._tabs[i]._headerDiv, 
                    { flags: Core.Web.Measure.Bounds.FLAG_MEASURE_DIMENSION });
            
            // Determine adjustment in height of tab when it is active.
            var adjust = this._tabActiveHeightIncreasePx + this._tabInactivePositionAdjustPx +
                    this._tabs[i]._activeSurroundHeight - this._tabs[i]._inactiveSurroundHeight;

            // Load tab active and inactive heights.
            if (this._tabs[i]._active) {
                tabActiveHeight = headerDivBounds.height;
                tabInactiveHeight = headerDivBounds.height - adjust;
            } else {
                tabInactiveHeight = headerDivBounds.height;
                tabActiveHeight = headerDivBounds.height + adjust;
            }
            
            // Set maximum active/inactive heights if necessary.
            maxInactiveHeight = tabInactiveHeight > maxInactiveHeight ? tabInactiveHeight : maxInactiveHeight;
            maxActiveHeight = tabActiveHeight > maxActiveHeight ? tabActiveHeight : maxActiveHeight;
            
            // Horizontally position the tab at rightmost position.
            this._tabs[i]._headerDiv.style.left = this._totalTabWidth + "px";
            
            // Set z-index of tab based on position (left to right increase, but with active tab above all inactive tabs,
            // and rollover tab above all tabs).
            this._tabs[i]._headerDiv.style.zIndex = (this._rolloverTabId === this._tabs[i].id) ? (this._tabs.length) : 
                    (this._tabs[i]._active ? this._tabs.length + 1: i);
            
            // Move rendering cursor to right / calculate total width.
            this._totalTabWidth += headerDivBounds.width;
            if (i < this._tabs.length - 1) {
                // Add tab spacing.
                this._totalTabWidth += this._tabSpacingPx;
            }
        }

        // Set minimum heights of tabs for height equalization.
        for (i = 0; i < this._tabs.length; ++i) {
            if (this._tabs[i]._active) {
                this._tabs[i]._heightTd.style.height = (maxActiveHeight -
                        (this._tabs[i]._activeSurroundHeight + this._tabInactivePositionAdjustPx + 
                        this._tabActiveHeightIncreasePx)) + "px";
            } else {
                this._tabs[i]._heightTd.style.height = (maxInactiveHeight - this._tabs[i]._inactiveSurroundHeight) + "px";
            }
        }
        
        // Determine maximum height of tabs (either active or inactive).
        this._headerHeight = maxActiveHeight > maxInactiveHeight ? maxActiveHeight : maxInactiveHeight;
        
        if (Core.Web.VirtualPosition.enabled) {
            for (i = 0; i < this._tabs.length; ++i) {
                if (this._tabs[i]._fibContainer) {
                    Echo.Sync.FillImageBorder.renderContainerDisplay(this._tabs[i]._fibContainer);
                    Core.Web.VirtualPosition.redraw(this._tabs[i]._backgroundDiv);
                }
            }
        }
    },
    
    /**
     * Determines the renderId of the active tab child component.
     * This method first queries the component's <code>activeTabId</code> property, 
     * and if it is not set, the id is determined by finding the child component at the 
     * index specified by the component's <code>activeTabIndex</code> property.
     *
     * @return the active tab renderId
     * @type String
     */
    _getActiveTabId: function() {
        var activeTabId = this.component.get("activeTabId");
        if (!activeTabId) {
            var activeTabIndex = this.component.get("activeTabIndex");
            if (activeTabIndex != null && activeTabIndex < this.component.children.length) {
                activeTabId = this.component.children[activeTabIndex].renderId;
            }
        }
        return activeTabId;
    },
    
    /**
     * Determines the pxiel height of the separation between inactive tabs and the tab content area.  (For a TAB_POSITION_TOP,
     * this is the bottom of the tabs to the top of tab content).
     * 
     * @return the height
     * @type Number
     */
    _getSeparatorHeight: function() {
        if (this._borderType == Extras.TabPane.BORDER_TYPE_NONE) {
            return 0;
        }
        
        if (this._imageBorder) {
            //FIXME, possibly provide a configurable property for this.
            return 0;
        }

        return Echo.Sync.Border.getPixelSize(this._border, this._tabSide);
    },

    /**
     * Retrieves the tab instance with the specified tab id.
     *
     * @param tabId the tab render id
     * @return the tab, or null if no tab is present with the specified id
     * @type Extras.Sync.TabPane.Tab
     */
    _getTabById: function(tabId) {
        for (var i = 0; i < this._tabs.length; ++i) {
            var tab = this._tabs[i];
            if (tab.id == tabId) {
                return tab;
            }
        }
        return null;
    },
    
    /** @see Echo.Render.ComponentSync#isChildDisplayed */
    isChildVisible: function(component) {
        return component.renderId == this._activeTabId;
    },
    
    /**
     * Handler for mouse rollover enter/exit events on previous/next scroll buttons.
     * 
     * @param e the mouse rollover event
     */
    _processScrollRollover: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        
        var previous = e.registeredTarget === this._previousControlDiv;
        var enter = e.type == "mouseover";
        var icon;
        
        if (enter) {
            // Set rollover icon.
            icon = previous ? this._icons.rolloverScrollLeftIcon : this._icons.rolloverScrollRightIcon;
            if (!icon && !(previous ? this._icons.scrollLeftIcon : this._icons.scrollRightIcon)) {
                // Configured rollover icon not found, Use default rollover icon, but only if default icon is in use.
                icon = this.client.getResourceUrl("Extras", previous ? 
                        "image/tabpane/PreviousRollover.png" : "image/tabpane/NextRollover.png");
            }
        } else {
            // Set default icon.
            icon = previous ? this._icons.scrollLeftIcon : this._icons.scrollRightIcon;
            if (!icon) {
                icon = this.client.getResourceUrl("Extras", previous ? "image/tabpane/Previous.png" : "image/tabpane/Next.png");
            }
        }
        
        if (icon) {
            e.registeredTarget.firstChild.src = Echo.Sync.ImageReference.getUrl(icon);
        }
    },
    
    /**
     * Handler for mouse down event on previous/next scroll buttons.
     * 
     * @param e the mouse down event
     */
    _processScrollStart: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        
        this._scrollRunnable = new Extras.Sync.TabPane.ScrollRunnable(this, e.registeredTarget === this._previousControlDiv);
        Core.Web.Scheduler.add(this._scrollRunnable);
    },
    
    /**
     * Handler for mouse up event on previous/next scroll buttons.
     * 
     * @param e the mouse up event
     */
    _processScrollStop: function(e) {
        if (!this._scrollRunnable) {
            return;
        }
        this._scrollRunnable.finish();
        this._scrollRunnable = null;
    },
    
    /**
     * Removes a specific tab.  Removes its rendering from the DOM.
     *
     * @param {Extras.Sync.TabPane.Tab} tab the tab to remove
     */
    _removeTab: function(tab) {
        var tabIndex = Core.Arrays.indexOf(this._tabs, tab);
        if (tabIndex == -1) {
            return;
        }
        if (tab.id == this._activeTabId) {
            this._activeTabId = null;
        }
        this._tabs.splice(tabIndex, 1);
        
        Core.Web.DOM.removeNode(tab._headerDiv);
        Core.Web.DOM.removeNode(tab._contentDiv);
        
        tab._renderDispose();
    },
    
    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._headerImageLoadingComplete = false;

        this.component.addListener("tabSelect", this._tabSelectListenerRef);
        
        // Store rendering properties.
        this._icons = { 
            scrollLeftIcon: this.component.render("scrollLeftIcon"),
            scrollRightIcon: this.component.render("scrollRightIcon"),
            rolloverScrollLeftIcon: this.component.render("rolloverScrollLeftIcon"),
            rolloverScrollRightIcon: this.component.render("rolloverScrollRightIcon")
        };
        this._rtl = !this.component.getRenderLayoutDirection().isLeftToRight();
        this._activeTabId = this._getActiveTabId();
        this._tabRolloverEnabled = this.component.render("tabRolloverEnabled");
        this._insets = this.component.render("insets", Extras.Sync.TabPane._DEFAULTS.insets);
        this._tabActiveBorder = this.component.render("tabActiveBorder", Extras.Sync.TabPane._DEFAULTS.tabActiveBorder);
        this._imageBorder = this.component.render("imageBorder");
        this._border = this._imageBorder ? null : this._border = this.component.render("border", this._tabActiveBorder);
        this._borderType = this.component.render("borderType", Extras.Sync.TabPane._DEFAULTS.borderType);
        this._tabInactiveBorder = this.component.render("tabInactiveBorder", Extras.Sync.TabPane._DEFAULTS.tabInactiveBorder);
        this._tabInsetPx = Echo.Sync.Extent.toPixels(this.component.render("tabInset",Extras.Sync.TabPane._DEFAULTS.tabInset));
        this._tabPositionBottom = this.component.render("tabPosition", Extras.Sync.TabPane._DEFAULTS.tabPosition) == 
                Extras.TabPane.TAB_POSITION_BOTTOM;
        this._tabSide = this._tabPositionBottom ? "bottom" : "top";
        this._oppositeSide = this._tabPositionBottom ? "top" : "bottom";
        this._tabSpacingPx = Echo.Sync.Extent.toPixels(this.component.render("tabSpacing", 
                Extras.Sync.TabPane._DEFAULTS.tabSpacing));
        this._tabActiveHeightIncreasePx = Echo.Sync.Extent.toPixels(
                this.component.render("tabActiveHeightIncrease", Extras.Sync.TabPane._DEFAULTS.tabActiveHeightIncrease));
        this._tabInactivePositionAdjustPx = this._getSeparatorHeight();
        this._tabCloseEnabled = this.component.render("tabCloseEnabled", false);
        if (this._tabCloseEnabled) {
            this._icons.defaultIcon = this.component.render("tabCloseIcon");
            this._icons.disabledIcon = this.component.render("tabDisabledCloseIcon");
            this._icons.rolloverIcon = this.component.render("tabRolloverCloseIcon");
        }
        this._tabActiveInsets = Echo.Sync.Insets.toPixels(this.component.render("tabActiveInsets"));
        this._tabInactiveInsets = Echo.Sync.Insets.toPixels(this.component.render("tabInactiveInsets"));
        this._tabHeight = Echo.Sync.Extent.toPixels(this.component.render("tabHeight"), false) || 0;

        // Store rendering properties: border/content insets.
        var pixelInsets = Echo.Sync.Insets.toPixels(this._insets);
        if (this._imageBorder) {
            this._ibBorderInsetsPx = Echo.Sync.Insets.toPixels(this._imageBorder.borderInsets);
            this._ibContentInsetsPx = Echo.Sync.Insets.toPixels(this._imageBorder.contentInsets);
        }
        if (this._borderType == Extras.TabPane.BORDER_TYPE_SURROUND) {
            if (this._imageBorder) {
                pixelInsets[this._oppositeSide] += this._ibContentInsetsPx[this._oppositeSide];
                pixelInsets.left += this._ibContentInsetsPx.left;
                pixelInsets.right += this._ibContentInsetsPx.right;
            }
        } else if (this._borderType == Extras.TabPane.BORDER_TYPE_PARALLEL_TO_TABS) {
            if (this._imageBorder) {
                this._imageBorder = {
                    color: this._imageBorder.color,
                    borderInsets: this._ibBorderInsetsPx.top + "px 0 " + this._ibBorderInsetsPx.bottom + "px",
                    contentInsets: this._ibContentInsetsPx.top + "px 0 " + this._ibContentInsetsPx.bottom + "px",
                    top: this._imageBorder.top,
                    bottom: this._imageBorder.bottom
                };
                pixelInsets[this._oppositeSide] += this._ibContentInsetsPx[this._oppositeSide];
            }
            pixelInsets.left = pixelInsets.right = 0;
        } else {
            if (this._imageBorder) {
                var pre = this._tabPositionBottom ? "0 0 " : "";
                var post = this._tabPositionBottom ? "" : " 0 0";
                this._imageBorder = {
                    color: this._imageBorder.color,
                    borderInsets: pre + this._ibBorderInsetsPx[this._tabSide] + "px" + post,
                    contentInsets: pre + this._ibContentInsetsPx[this._tabSide] + "px" + post,
                    top: this._imageBorder.top
                };
            }
            pixelInsets.left = pixelInsets.right = pixelInsets[this._oppositeSide] = 0;
        }

        // Create Main Element.
        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        this._div.style.cssText = "position:absolute;top:" + pixelInsets.top + "px;right:" + pixelInsets.right +
                "px;bottom:" + pixelInsets.bottom + "px;left:" + pixelInsets.left + "px;";
                        
        this._headerContainerBoundsDiv = document.createElement("div");
        this._headerContainerBoundsDiv.style.cssText = "position:absolute;overflow:hidden;z-index:1;" +
                (this._tabPositionBottom ? "bottom" : "top") + ":0;" +
                "left:" + this._tabInsetPx + "px;right:" + this._tabInsetPx + "px;";
        this._div.appendChild(this._headerContainerBoundsDiv);
                
        // Render Header Container.
        this._headerContainerDiv = document.createElement("div");

        if (this._focusAnchor == null) {
            this._focusAnchorDiv = document.createElement("div");
            this._focusAnchorDiv.style.cssText = "width:0;height:0;overflow:hidden;";
            this._focusAnchor = document.createElement("input");
            this._focusAnchorDiv.appendChild(this._focusAnchor);
            this._headerContainerDiv.appendChild(this._focusAnchorDiv);
            this._addEventHandlers();
        }

        this._headerContainerDiv.style.cssText = "position:absolute;left:0;right:0;top:0;bottom:0;";
                
        Echo.Sync.Font.render(this.component.render("font"), this._headerContainerDiv);
        Echo.Sync.FillImage.render(this.component.render("tabBackgroundImage"), this._headerContainerDiv);
        this._headerContainerBoundsDiv.appendChild(this._headerContainerDiv);
        
        // Render Image Border (optional).
        if (this._imageBorder) {
            this._borderDiv = Echo.Sync.FillImageBorder.renderContainer(this._imageBorder, { absolute: true });
            if (this._tabPositionBottom) {
                this._borderDiv.style.top = (0 - this._ibContentInsetsPx.top) + "px";
                this._borderDiv.style.bottom = 0;
            } else {
                this._borderDiv.style.top = 0;
                this._borderDiv.style.bottom = (0 - this._ibContentInsetsPx.bottom) + "px";
            }
            this._borderDiv.style.left = (0 - this._ibContentInsetsPx.left) + "px";
            this._borderDiv.style.right = (0 - this._ibContentInsetsPx.right) + "px";
            this._div.appendChild(this._borderDiv);
        }
        
        // Render Content Container.
        this._contentContainerDiv = document.createElement("div");
        this._contentContainerDiv.style.cssText = "position:absolute;overflow:hidden;";
        Echo.Sync.renderComponentDefaults(this.component, this._contentContainerDiv);
        if (this._border) {
            if (this._borderType == Extras.TabPane.BORDER_TYPE_NONE) {
                this._contentContainerDiv.style.border = "0 none";
            } else if (this._borderType == Extras.TabPane.BORDER_TYPE_SURROUND) {
                Echo.Sync.Border.render(this._border, this._contentContainerDiv);
            } else if (this._borderType == Extras.TabPane.BORDER_TYPE_PARALLEL_TO_TABS) {
                Echo.Sync.Border.render(this._border, this._contentContainerDiv, "borderTop");
                Echo.Sync.Border.render(this._border, this._contentContainerDiv, "borderBottom");
            } else if (this._tabPositionBottom) {
                Echo.Sync.Border.render(this._border, this._contentContainerDiv, "borderBottom");
            } else {
                Echo.Sync.Border.render(this._border, this._contentContainerDiv, "borderTop");
            }
        }
        this._div.appendChild(this._contentContainerDiv);

        this._verifyActiveTabAvailable();
        
        // Create tabs.
        for (var i = 0; i < this.component.children.length; ++i) {
            var tab = new Extras.Sync.TabPane.Tab(this.component.children[i], this);
            this._addTab(update, tab);
        }

        this._layoutRequired = true;
        
        parentElement.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDisplay */
    renderDisplay: function() {
        var i, tab;
        
        Core.Web.VirtualPosition.redraw(this._div);
        this._tabContainerWidth = new Core.Web.Measure.Bounds(this._div, 
                { flags: Core.Web.Measure.Bounds.FLAG_MEASURE_DIMENSION }).width - (2 * this._tabInsetPx);
        
        this._renderHeaderUpdate();
        
        this._renderLayout();
        
        // Process a change in active tab, update displayed tab.
        if (this._displayedTabId != this._activeTabId) {
            if (this._displayedTabId != null) {
                tab = this._getTabById(this._displayedTabId);
                if( tab != null) { // if there is no such tab left continue
                  tab._renderState(false);
                } 
            }
            if (this._activeTabId != null) {
                tab = this._getTabById(this._activeTabId);
                tab._renderState(true);
            }
            this._displayedTabId = this._activeTabId;
        }

        this._renderHeaderPositions();

        // Virtual positioning
        if (this._borderDiv) {
            Core.Web.VirtualPosition.redraw(this._borderDiv);
            Echo.Sync.FillImageBorder.renderContainerDisplay(this._borderDiv);
        }
        
        Core.Web.VirtualPosition.redraw(this._contentContainerDiv);
        Core.Web.VirtualPosition.redraw(this._headerContainerDiv);
        
        for (i = 0; i < this._tabs.length; ++i) {
            this._tabs[i]._renderDisplay();
        }

        // Re-bound scroll position.
        this.setScrollPosition(this.scrollPosition);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this.component.removeListener("tabSelect", this._tabSelectListenerRef);

        this._activeTabId = null;
        for (var i = 0; i < this._tabs.length; i++) {
            this._tabs[i]._renderDispose();
        }
        this._tabs = [];
        this._div = null;
        this._borderDiv = null;
        this._headerContainerBoundsDiv = null;
        this._headerContainerDiv = null;
        this._focusAnchor = null;
        this._focusAnchorDiv = null;
        this._contentContainerDiv = null;
        if (this._previousControlDiv) {
            Core.Web.Event.removeAll(this._previousControlDiv);
            this._previousControlDiv = null;
        }
        if (this._nextControlDiv) {
            Core.Web.Event.removeAll(this._nextControlDiv);
            this._nextControlDiv = null;
        }
    },
    
    /**
     * Renders a full update to the header, if required.
     */
    _renderHeaderUpdate: function() {
        if (!this._headerUpdateRequired) {
            return;
        }
        this._headerUpdateRequired = false;
        for (var i = 0; i < this._tabs.length; ++i) {
            this._tabs[i]._loadProperties();
            this._tabs[i]._renderHeaderState(this._tabs[i].id === this._activeTabId, false, true);
        }
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var fullRender = false,
            tab,
            i;
        
        this._headerImageLoadingComplete = false;
        
        if (update.hasUpdatedLayoutDataChildren()) {
            this._headerUpdateRequired = true;
        }
        if (!fullRender) {
            if (!Core.Arrays.containsAll(Extras.Sync.TabPane._supportedPartialProperties, 
                    update.getUpdatedPropertyNames(), true)) {
                // Update contains property changes that cannot be partially re-rendered.
                fullRender = true;
            }
        }
        if (!fullRender) {
            var activeTabRemoved = false;
            var removedChildren = update.getRemovedChildren();
            if (removedChildren) {
                // Remove children.
                for (i = 0; i < removedChildren.length; ++i) {
                    tab = this._getTabById(removedChildren[i].renderId);
                    if (!tab) {
                        continue;
                    }
                    if (removedChildren[i].renderId == this._displayedTabId) {
                        this._displayedTabId = null;
                    }
                    this._removeTab(tab);
                }
            }
            var addedChildren = update.getAddedChildren();
            if (addedChildren) {
                // Add children.
                for (i = 0; i < addedChildren.length; ++i) {
                    tab = new Extras.Sync.TabPane.Tab(addedChildren[i], this);
                    this._addTab(update, tab, this.component.indexOf(addedChildren[i]));
                }
            }
            if (update.hasUpdatedProperties()) {
                // partial update
                if (update.getUpdatedProperty("activeTabId")) {
                    this._activeTabId = update.getUpdatedProperty("activeTabId").newValue;
                } else if (update.getUpdatedProperty("activeTabIndex")) {
                    var newIndex = update.getUpdatedProperty("activeTabIndex").newValue;
                    if (newIndex >= 0 && newIndex < this.component.children.length) {
                        this._activeTabId = this.component.children[newIndex].renderId;
                    }
                }
            }
            this._verifyActiveTabAvailable();
            this._layoutRequired = true;
        }
    
        if (fullRender) {
            var div = this._div;
            var containerElement = div.parentNode;
            Echo.Render.renderComponentDispose(update, update.parent);
            containerElement.removeChild(div);
            this.renderAdd(update, containerElement);
        }
        return fullRender;
    },
    
    /**
     * Enables/disables the scrolling controls used when the tab header is to wide to be displayed entirely at once.
     * This method will lazy-render the specified scrolling control if it has not been previously enabled. 
     * 
     * @param {Boolean} previous flag indicating which scrolling control should be enabled/disabled, true indicating the
     *        scroll-to-previous control, false indicating the scroll-to-next control
     * @param {Boolean} enabled the new enabled state
     */
    _setOversizeEnabled: function(previous, enabled) {
        var controlDiv = previous ? this._previousControlDiv : this._nextControlDiv,
            img;

        if (enabled) {
            if (controlDiv) {
                controlDiv.style.display = "block";
            } else {
                controlDiv = document.createElement("div");
                controlDiv.style.cssText = "position:absolute;z-index:2;cursor:pointer;";
                
                controlDiv.style[previous ? "left" : "right"] = "2px";
                
                img = document.createElement("img");
                controlDiv.appendChild(img);

                Core.Web.Event.add(controlDiv, "mousedown", Core.method(this, this._processScrollStart));
                Core.Web.Event.add(controlDiv, "mouseup", Core.method(this, this._processScrollStop));
                Core.Web.Event.add(controlDiv, "mouseover", Core.method(this, this._processScrollRollover)); 
                Core.Web.Event.add(controlDiv, "mouseout", Core.method(this, this._processScrollRollover)); 
                Core.Web.Event.Selection.disable(controlDiv);

                if (previous) {
                    img.src = this._icons.scrollLeftIcon ? Echo.Sync.ImageReference.getUrl(this._icons.scrollLeftIcon) :
                            this.client.getResourceUrl("Extras", "image/tabpane/Previous.png");
                    this._previousControlDiv = controlDiv;
                } else {
                    img.src = this._icons.scrollRightIcon ? Echo.Sync.ImageReference.getUrl(this._icons.scrollRightIcon) :
                            this.client.getResourceUrl("Extras", "image/tabpane/Next.png");
                    this._nextControlDiv = controlDiv;
                }
                this._div.appendChild(controlDiv);
                
                var tabContainerHeight = new Core.Web.Measure.Bounds(this._headerContainerDiv,
                        { flags: Core.Web.Measure.Bounds.FLAG_MEASURE_DIMENSION }).height;
                var imageListener = Core.method(this, function() {
                    if (img.height && !isNaN(img.height)) {
                        var imgOffset = Math.floor((tabContainerHeight - img.height) / 2);
                        if (imgOffset > 0) {
                            controlDiv.style[this._tabPositionBottom ? "bottom" : "top"] = imgOffset + "px";
                        }
                    }
                });
                Core.Web.Image.monitor(controlDiv, imageListener);
                imageListener();
            }
        } else if (controlDiv) {
            controlDiv.style.display = "none";
        }
    },
    
    /**
     * Sets the currently rolled-over tab.
     * Enqueues a slightly delayed runnable to perform the operation in order to prevent flicker.
     * 
     * @param {String} tabId the tab id (renderId of child componeent)
     * @param {Boolean} state the rollover state of the tab
     */
    _setRolloverTab: function(tabId, state) {
        this._pendingRollover = { tabId: tabId, state: state };
        if (!this._rolloverRunnable) {
            this._rolloverRunnable = new Core.Web.Scheduler.MethodRunnable(Core.method(this, function() {
                this._setRolloverTabImpl(this._pendingRollover.tabId, this._pendingRollover.state);
            }));
        }
        Core.Web.Scheduler.add(this._rolloverRunnable);
    },
    
    /**
     * Implementation work method for setting currently rolled over tab.
     * 
     * @param {String} tabId the tab id (renderId of child componeent)
     * @param {Boolean} state the rollover state of the tab
     */
    _setRolloverTabImpl: function(tabId, state) {
        var rolloverTab = this._rolloverTabId && this._getTabById(this._rolloverTabId);
        var tab = this._getTabById(tabId);
        if (state) {
            if (this._rolloverTabId != tabId) {
                if (rolloverTab) {
                    rolloverTab.setRollover(false, false);
                }
                this._rolloverTabId = tabId;
                tab.setRollover(true);
            }
        } else {
            if (this._rolloverTabId == tabId) {
                this._rolloverTabId = null;
                if (rolloverTab) {
                    rolloverTab.setRollover(false, false);
                }
            } else {
                // Tab state is already non-rollover, do nothing.
            }
        }
    },
    
    /**
     * Sets the scroll position of the tab header.
     * 
     * @param {Number} position the scroll position, in pixels
     * @return a boolean state indicating whether the scroll position could be set exactly (true) or was bounded by
     *         an attempt too be scrolled to far (false)
     * @type Boolean
     */
    setScrollPosition: function(position) {
        var bounded = false,
            oversize = this._totalTabWidth > this._tabContainerWidth;
            
        // Set position to zero in the event that header is not oversize.
        position = oversize ? position : 0;
            
        if (position < 0) {
            position = 0;
            bounded = true;
        } else if (position > 0 && position > this._totalTabWidth - this._tabContainerWidth) {
            position = this._totalTabWidth - this._tabContainerWidth;
            bounded = true;
        }
        this.scrollPosition = position;
        this._headerContainerDiv.style.left = (0 - position) + "px";
        
        if (oversize) {
            this._setOversizeEnabled(true, position > 0);
            this._setOversizeEnabled(false, position < this._totalTabWidth - this._tabContainerWidth);
        } else {
            this._setOversizeEnabled(true, false);
            this._setOversizeEnabled(false, false);
        }
        
        return !bounded;
    },
    
    /**
     * Event listener to component instance for user tab selections.
     * 
     * @param e the event
     */
    _tabSelectListener: function(e) {
        this._activeTabId = e.tab.renderId;
        Echo.Render.renderComponentDisplay(this.component);
    },
    
    /**
     * Ensures an active tab is present, if possible.
     */
    _verifyActiveTabAvailable: function() {
        for (var i = 0; i < this.component.children.length; ++i) {
            if (this.component.children[i].renderId == this._activeTabId) {
                return;
            }
        }
        this._activeTabId = this.component.children.length === 0 ? null : this.component.children[0].renderId; 
    },

    /**
     * Keydown event handler to change tabs with the keyboard's arrow keys
     *
     * @param e the event
     */
    _processKeyDown: function(e) {
        var activeTabIx = -1;
        for (var i = 0; i < this._tabs.length; i++) {
            if (this._tabs[i].id == this._activeTabId) {
                activeTabIx = i;
            }
        }
        if (e.keyCode == 37) {
            // left
            if (activeTabIx != -1) {
                if (activeTabIx === 0) {
                    this.component.doTabSelect(this._tabs[this._tabs.length - 1].id);
                } else {
                    this.component.doTabSelect(this._tabs[activeTabIx - 1].id);
                }
            }
        } else if (e.keyCode == 39) {
            // right
            if (activeTabIx != -1) {
                this.component.doTabSelect(this._tabs[(activeTabIx + 1) % this._tabs.length].id);
            }
        }
        return true;
    },

    /**
     * Registers event handlers on the text component.
     */
    _addEventHandlers: function() {
        Core.Web.Event.add(this._focusAnchor, "keydown", Core.method(this, this._processKeyDown), false);
        Core.Web.Event.add(this._focusAnchor, "focus", Core.method(this, this.processFocus), false);
        Core.Web.Event.add(this._focusAnchor, "blur", Core.method(this, this.processBlur), false);
    },

    /**
     * Processes a focus blur event.
     * Overriding implementations must invoke.
     */
    processBlur: function(e) {
        this._focused = false;
        this.renderDisplay();
        return true;
    },

    /**
     * Processes a focus event. Notifies application of focus.
     * Overriding implementations must invoke.
     */
    processFocus: function(e) {
        this._focused = true;
        this._headerUpdateRequired = true;
        this.renderDisplay();
        return false;
    },

    /**
     * Focuses the tab pane
     */
    renderFocus: function() {
        if (this._focused) {
            return;
        }
        this._focused = true;
        this._headerUpdateRequired = true;
        this.renderDisplay();
        Core.Web.DOM.focusElement(this._focusAnchor);
    }
});

/**
 * Representation of a single tab (child component) within the tab pane.
 * Provides tab-specific rendering functionality, handles setting active state
 * on/off for an individual tab.
 */
Extras.Sync.TabPane.Tab = Core.extend({
    
    /**
     * Active state of the tab (true indicating the tab is the active tab in its TabPane).
     * Initial (non-rendered) state is indicated by null.
     * @type Boolean
     */
    _active: null,
    
    /**
     * The child component which will be rendered within the tab.
     * @type Echo.Component
     */
    _childComponent: null,
    
    /**
     * The FillImageBorder container component housing the tab, if in use.
     * @type Element
     */
    _fibContainer: null,
    
    /**
     * The TabPane synchronization peer.
     * @type Extras.Sync.TabPane
     */
    _parent: null,
    
    /**
     * DIV element containing tab header (highest level element managed by Tab object in the header).
     * @type Element
     */
    _headerDiv: null,
    
    /**
     * The DIV element which will contain the rendered child component.
     * @type Element
     */
    _contentDiv: null,
    
    /**
     * TD element containing close icon.
     * @type Element
     */
    _closeIconTd: null,
    
    /**
     * Flag indicating whether the tab may be closed.
     * @type Boolean
     */
    _tabCloseEnabled: false,
    
    /**
     * The default set z-index of the tab.  This value is used to store the previous z-index value when
     * a tab is rolled over (and its z-index is thus raised).
     * @type Number
     */
    _defaultZIndex: 0,
    
    /**
     * The total height of the active tab border and insets, in pixels.
     * @type Number 
     */
    _activeSurroundHeight: null,
    
    /**
     * The total height of the inactive tab border and insets, in pixels.
     * @type Number 
     */
    _inactiveSurroundHeight: null,
    
    /**
     * The DIV containing the tab's label, i.e., title and icon.
     * @type Element
     */
    _labelDiv: null,
    
    /**
     * DIV containing the tab's text content.  The width of this DIV is measured and set when using maximum tab widths.
     * @type Element
     */
    _textDiv: null,
    
    /**
     * The tab identifier, i.e., the renderId of the child component.
     * @type String
     */
    id: null,
    
    /**
     * Creates a new Tab instance.
     * 
     * @param {Echo.Component} childComponent the child component which will be rendered within the tab
     * @param {Extras.Sync.TabPane} parent the TabPane synchronization peer
     */
    $construct: function(childComponent, parent) {
        this.id = childComponent.renderId;
        // state
        this._childComponent = childComponent;
        this._parent = parent;
    },
    
    /**
     * Retries the close image (either default or rollover).
     * 
     * @param rollover flag indicating whether rollover (true) or default (false) image should be returned
     * @type #ImageReference
     */
    _getCloseImage: function(rollover) {
        var icons = this._parent._icons;
        var icon;
        if (this._tabCloseEnabled) {
            if (rollover && this._parent.component.render("tabCloseIconRolloverEnabled")) {
                icon = icons.rolloverIcon;
            }
        } else {
            icon = icons.disabledIcon;
        }
        return icon ? icon : icons.defaultIcon || this._parent.client.getResourceUrl("Extras", "image/tabpane/Close.gif");
    },

    /**
     * Determine content inset margin.
     * 
     * @return the content inset margin
     * @type #Insets
     */
    _getContentInsets: function() {
        if (this._childComponent.pane) {
            // Do not render insets on panes.
            return 0;
        } else {
            return this._parent.component.render("defaultContentInsets", Extras.Sync.TabPane._DEFAULTS.tabContentInsets);
        }
    },
    
    /**
     * Returns the style property which should be used for a given tab property.
     * Queries layout data and component properties.
     * Queries rollover properties if applicable (and defaults to non-rollover property if unspecified).
     * 
     * @param {String} name the name of the property, first letter capitalized, e.g., "Background"
     * @param {Boolean} active the active state
     * @param {Boolean} rollover the rollover state
     * @param {Boolean} focus the focus state of the parent tab pane
     * @return the property value
     */
    _getProperty: function(name, active, rollover, focus) {
        var value = this._layoutData[(active ? "active" : "inactive") + name] ||
                this._parent.component.render((active ? "tabActive" : "tabInactive") + name);
        if (!active && rollover) {
            value = this._layoutData["rollover" + name] || this._parent.component.render("tabRollover" + name) || value;
        }
        if (active && focus) {
            // Only use the focus style for the active tab
            value = this._layoutData["focused" + name] || this._parent.component.render("tabFocused" + name) || value;
        }
        return value;
    },
    
    /**
     * Determines the height of the border and insets surrounding the tab (supports both imageBorder and border properties).
     * Uses layout data information if provided.
     * 
     * @param {Boolean} active true to measure the active border, false for the inactive border
     * @return the combined top and bottom border height, in pixels
     * @type Number
     */
    _getSurroundHeight: function(active) {
        var insets, imageBorder, border, padding;

        var focus = this._parent._focused;
        
        insets = Echo.Sync.Insets.toPixels(this._getProperty("Insets", active, false, focus) || Extras.Sync.TabPane._DEFAULTS.tabInsets);
        padding = insets.top + insets.bottom;
        
        if (this._useImageBorder) {
            imageBorder = this._getProperty("ImageBorder", active, false, focus);
            insets = Echo.Sync.Insets.toPixels(imageBorder.contentInsets);
            return padding + insets.top + insets.bottom;
        } else {
            border = this._getProperty("Border", active, false, focus) ||
                    (active ? this._parent._tabActiveBorder : this._parent._tabInactiveBorder);
            return padding + Echo.Sync.Border.getPixelSize(border, this._parent._tabSide); 
        }
    },
    
    /**
     * Loads state information.
     */
    _loadProperties: function() {
        this._layoutData = this._childComponent.render("layoutData") || {};
        this._useImageBorder = this._getProperty("ImageBorder", false, false, false);
        this._tabCloseEnabled = this._parent._tabCloseEnabled && this._layoutData.closeEnabled;
        this._activeSurroundHeight = this._getSurroundHeight(true);
        this._inactiveSurroundHeight = this._getSurroundHeight(false);
    },
    
    /**
     * Tab click handler.
     * 
     * @param e the click event
     */
    _processClick: function(e) {
        if (!this._parent || !this._parent.client || !this._parent.client.verifyInput(this._parent.component)) {
            return true;
        }
        if (this._closeIconTd && Core.Web.DOM.isAncestorOf(this._closeIconTd, e.target)) {
            // close icon clicked
            if (!this._tabCloseEnabled) {
                return;
            }
            this._parent.component.doTabClose(this.id);
        } else {
            // tab clicked
            this._parent.component.doTabSelect(this.id, this._parent._activeTabId == this.id);
        }
    },
    
    /**
     * Tab close icon rollover enter/exit handler.
     * 
     * @param e the mouse event
     */
    _processCloseRollover: function(e) {
        var enter = e.type == "mouseover" || e.type == "mouseenter";
        if (enter && (!this._parent || !this._parent.client || !this._parent.client.verifyInput(this._parent.component))) {
            return true;
        }
        this._closeIconTd.firstChild.src = Echo.Sync.ImageReference.getUrl(this._getCloseImage(enter));
        return true;
    },
    
    /**
     * Tab rollover enter/exit handler.
     * 
     * @param e the mouse event
     */
    _processRollover: function(e) {
        var enter = e.type == "mouseover" || e.type == "mouseenter";
        if (enter && (!this._parent || !this._parent.client || !this._parent.client.verifyInput(this._parent.component))) {
            return true;
        }
        this._parent._setRolloverTab(this.id, enter);
    },
    
    /**
     * Renders the tab.
     * 
     * @param {Echo.Update.ComponentUpdate} update the component update 
     */
    _renderAdd: function(update) {
        this._loadProperties();
        
        // Header DIV
        this._headerDiv = document.createElement("div");
        this._headerDiv.style.cssText = "position:absolute;";

        // Content DIV
        this._contentDiv = document.createElement("div");
        this._contentDiv.style.cssText = "position:absolute;top:0;left:0;overflow:auto;";
        // hide content
        if (Core.Web.Env.BROWSER_MOZILLA && !Core.Web.Env.BROWSER_FIREFOX) {
            //FIXME doc/analyze/remove
            this._contentDiv.style.right = "100%";
            this._contentDiv.style.bottom = "100%";
        } else {
            this._contentDiv.style.display = "none";
            this._contentDiv.style.right = "0";
            this._contentDiv.style.bottom = "0";
        }
        Echo.Sync.Insets.render(this._getContentInsets(), this._contentDiv, "padding");
        Echo.Render.renderComponentAdd(update, this._childComponent, this._contentDiv);
        
        this._renderState(this.id == this._parent._activeTabId);
    },
    
    /**
     * Tab-specific renderDisplay() tasks.
     */
    _renderDisplay: function() {
        if (this._fibContainer) {
            Echo.Sync.FillImageBorder.renderContainerDisplay(this._fibContainer);
            Core.Web.VirtualPosition.redraw(this._backgroundDiv);
        }
        Core.Web.VirtualPosition.redraw(this._contentDiv);
    },
    
    /**
     * Disposes of the tab, releasing any resources.
     */
    _renderDispose: function() {
        Core.Web.Event.removeAll(this._headerDiv);
        if (this._rolloverRunnable) {
            Core.Web.Scheduler.remove(this._rolloverRunnable);
        }
        this._fibContainer = null;
        this._parent = null;
        this._childComponent = null;
        this._headerDiv = null;
        this._contentDiv = null;
        this._closeIconTd = null;
        this._iconImg = null;
        this._textDiv = null;
        this._closeImg = null;
        this._heightTd = null;
        this._labelDiv = null;
        this._backgroundDiv = null;
    },
    
    /**
     * Renders the tab header.
     * 
     * @param {Boolean} active the active state of the tab
     */
    _renderHeader: function(active) {
        var tabPane = this._parent.component,
            img, table, tr, td;

        var focus = this._parent._focused;
        
        Core.Web.Event.removeAll(this._headerDiv);
        Core.Web.DOM.removeAllChildren(this._headerDiv);
        
        // Configure Header DIV.
        this._headerDiv.style[this._parent._tabPositionBottom ? "top" : "bottom"] = 
                active ? 0 : (this._parent._tabInactivePositionAdjustPx + "px");
        if (this._layoutData.toolTipText) {
            this._headerDiv.title = this._layoutData.toolTipText;
        }
        
        // Create Label DIV.
        this._labelDiv = document.createElement("div");
        this._labelDiv.style.cssText = "position:relative;white-space:nowrap;overflow:hidden;";
        Echo.Sync.Extent.render(this._parent.component.render("tabWidth"), this._labelDiv, "width", true, false);
        var headerDivContent = this._labelDiv;

        if (this._useImageBorder) {
            var imageBorder = this._getProperty("ImageBorder", active, false, focus);
            var backgroundInsets = this._getProperty("BackgroundInsets", active, false, focus);
            this._fibContainer = headerDivContent =
                    Echo.Sync.FillImageBorder.renderContainer(imageBorder, { child: this._labelDiv });
            var fibContent = Echo.Sync.FillImageBorder.getContainerContent(this._fibContainer);
            fibContent.style.zIndex = 2;
            this._backgroundDiv = document.createElement("div");
            this._backgroundDiv.style.cssText = "position:absolute;z-index:1;";
            Echo.Sync.Insets.renderPosition(backgroundInsets || imageBorder.borderInsets, this._backgroundDiv);
            this._fibContainer.appendChild(this._backgroundDiv);
            
            if (Core.Web.Env.BROWSER_INTERNET_EXPLORER && Core.Web.Env.BROWSER_VERSION_MAJOR === 6) {
                headerDivContent = Extras.Sync.TabPane._createTable();
                td = document.createElement("td");
                td.style.cssText = "padding:0;";
                td.appendChild(this._fibContainer);
                headerDivContent.firstChild.firstChild.appendChild(td);
            }
        } else {
            var border = this._getProperty("Border", active, false, focus) ||
                    (active ? this._parent._tabActiveBorder : this._parent._tabInactiveBorder);
            this._backgroundDiv = null;
            this._fibContainer = null;
            Echo.Sync.Border.render(border, this._labelDiv, this._parent._tabPositionBottom ? "borderBottom" : "borderTop");
            Echo.Sync.Border.render(border, this._labelDiv, "borderLeft");
            Echo.Sync.Border.render(border, this._labelDiv, "borderRight");
        }
        
        // Render Header Content.
        var icon = this._layoutData && this._layoutData.icon;
        var title = (this._layoutData ? this._layoutData.title : null) || "*";
        var closeIcon = this._parent._tabCloseEnabled && (this._tabCloseEnabled || this._parent._icons.disabledIcon); //FIXME?

        // Render Text and Icon(s)
        table = Extras.Sync.TabPane._createTable();
        tr = table.firstChild.firstChild;
        
        if (icon) {
            td = document.createElement("td");
            td.style.cssText = "padding:0;";
            Echo.Sync.Alignment.render(this._parent.component.render("tabAlignment", 
                    Extras.Sync.TabPane._DEFAULTS.tabAlignment), td, true, this._parent.component);
            this._iconImg = document.createElement("img");
            this._iconImg.style.marginRight = Echo.Sync.Extent.toCssValue(this._parent.component.render("tabIconTextMargin", 
                    Extras.Sync.TabPane._DEFAULTS.tabIconTextMargin), true, false);
            td.appendChild(this._iconImg);
            tr.appendChild(td);
        }

        this._heightTd = document.createElement("td");
        this._heightTd.style.cssText = "padding:0px;width:0px;";
        tr.appendChild(this._heightTd);
        
        td = document.createElement("td");
        td.style.cssText = "padding:0;";
        Echo.Sync.Alignment.render(tabPane.render("tabAlignment", Extras.Sync.TabPane._DEFAULTS.tabAlignment), td, true, tabPane);
        this._textDiv = document.createElement("div");
        this._textDiv.style.cssText = "overflow:hidden;white-space:nowrap;";
        this._textDiv.appendChild(document.createTextNode(title));
        td.appendChild(this._textDiv);
        
        tr.appendChild(td);
        
        if (closeIcon) {
            this._closeIconTd = document.createElement("td");
            this._closeIconTd.style.cssText = "padding:0;";
            Echo.Sync.Alignment.render(this._parent.component.render("tabAlignment", 
                    Extras.Sync.TabPane._DEFAULTS.tabAlignment), this._closeIconTd, true, this._parent.component);
            this._closeIconTd.style.padding = "0 0 0 " + Echo.Sync.Extent.toCssValue(
                    this._parent.component.render("tabCloseIconTextMargin", Extras.Sync.TabPane._DEFAULTS.tabCloseIconTextMargin), 
                    true, false);
            this._closeIconTd.style.cursor = "pointer";
            this._closeImg = document.createElement("img");
            Echo.Sync.ImageReference.renderImg(this._getCloseImage(false), this._closeImg);
            this._closeIconTd.appendChild(this._closeImg);
            tr.appendChild(this._closeIconTd);
        }
        this._labelDiv.appendChild(table);
        
        Core.Web.Event.Selection.disable(this._headerDiv);
        Core.Web.Event.add(this._headerDiv, "click", Core.method(this, this._processClick), false);
        Core.Web.Event.add(this._headerDiv, 
                Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseenter" : "mouseover", 
                Core.method(this, this._processRollover), false);
        Core.Web.Event.add(this._headerDiv,
                Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseleave" : "mouseout",
                Core.method(this, this._processRollover), false);
        if (this._tabCloseEnabled) {
            Core.Web.Event.add(this._closeIconTd, 
                    Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseenter" : "mouseover", 
                    Core.method(this, this._processCloseRollover), false);
            Core.Web.Event.add(this._closeIconTd,
                    Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseleave" : "mouseout",
                    Core.method(this, this._processCloseRollover), false);
        }
        
        this._headerDiv.appendChild(headerDivContent);
    },
    
    /**
     * Renders the appearance of the tab header active or inactive.
     * 
     * @param {Boolean} active the active state of the tab, true for active, false for inactive
     * @param {Boolean} rollover the rollover state of the tab, true for rolled over, false for not
     * @param {Boolean} force force re-render of the tab, even if specified states are identical to rendered states
     *        (method may normally perform no action under such conditions)
     */
    _renderHeaderState: function(active, rollover, force) {
        var fullRender = !this._labelDiv || force;

        if (fullRender) {
            this._renderHeader(active);
        }

        var focus = this._parent._focused;

        if (!force && this._active == active && (active || !this._parent._tabRolloverEnabled || this._rolloverState == rollover)) {
            return;
        }
        
        if (rollover) {
            this._defaultZIndex = this._headerDiv.style.zIndex;
            this._headerDiv.style.zIndex = this._parent.component.children.length;
        } else {
            this._headerDiv.style.zIndex = this._defaultZIndex;
        }
        
        this._rolloverState = rollover;

        var tabPane = this._parent.component,
            img, table, tr, td;
        
        Echo.Sync.Color.renderClear(this._getProperty("Foreground", active, rollover, focus), this._labelDiv, "color");
        Echo.Sync.Font.renderClear(this._getProperty("Font", active, rollover, focus), this._labelDiv);
        this._labelDiv.style.cursor = active ? "default" : "pointer";
        Echo.Sync.Insets.render(this._getProperty("Insets", active, false, focus) || Extras.Sync.TabPane._DEFAULTS.tabInsets,
                this._labelDiv, "padding"); 
                
        this._headerDiv.style[this._parent._tabPositionBottom ? "top" : "bottom"] = 
                active ? 0 : (this._parent._tabInactivePositionAdjustPx + "px");

        if (active) {
            this._labelDiv.style[this._parent._tabPositionBottom ? "paddingTop" : "paddingBottom"] =
                    (parseInt(this._labelDiv.style[this._parent._tabPositionBottom ? "paddingTop" : "paddingBottom"], 10) +
                    (this._parent._tabActiveHeightIncreasePx + this._parent._tabInactivePositionAdjustPx)) + "px";
        }

        if (!fullRender) {
            if (this._useImageBorder) {
                // Render FillImageBorder style.
                var imageBorder = this._getProperty("ImageBorder", active, rollover, focus);
                var backgroundInsets = this._getProperty("BackgroundInsets", active, rollover, focus);
                Echo.Sync.FillImageBorder.renderContainer(imageBorder, { update: this._fibContainer });
                Echo.Sync.Insets.renderPosition(backgroundInsets || imageBorder.borderInsets, this._backgroundDiv);
            } else {
                // Render CSS border style.
                var border = this._getProperty("Border", active, rollover, focus) ||
                        (active ? this._parent._tabActiveBorder : this._parent._tabInactiveBorder);
                Echo.Sync.Border.render(border, this._labelDiv, this._parent._tabPositionBottom ? "borderBottom" : "borderTop");
                Echo.Sync.Border.render(border, this._labelDiv, "borderLeft");
                Echo.Sync.Border.render(border, this._labelDiv, "borderRight");
            }
        }
        
        Echo.Sync.Color.renderClear(this._getProperty("Background", active, rollover, focus),
                this._backgroundDiv || this._labelDiv, "backgroundColor");
        Echo.Sync.FillImage.renderClear(this._getProperty("BackgroundImage", active, rollover, focus),
                this._backgroundDiv || this._labelDiv, null);

        // Update icon.
        if (this._layoutData && this._layoutData.icon) {
            Echo.Sync.ImageReference.renderImg((active && this._layoutData.activeIcon) || 
                    (rollover && this._layoutData.rolloverIcon) || this._layoutData.icon, this._iconImg);
        }
    },
    
    /**
     * Renders the tab active or inactive, updating header state and showing/hiding tab content.
     * 
     * @param {Boolean} active the active state of the tab, true for active, false for inactive
     */
    _renderState: function(active) {
        if (this._active === active) {
            // Do nothing if values are unchanged.   
            // Note initial value of oldValue is null.
            return;
        }
        
        this._renderHeaderState(active);

        if (this._active !== null && !active) {
            // Notify child component hierarchy that it is being hidden (unless performing initial render,
            // i.e., this._active === null).
            Echo.Render.renderComponentHide(this._childComponent);
        }
        // show/hide content
        if (Core.Web.Env.BROWSER_MOZILLA && !Core.Web.Env.BROWSER_FIREFOX) {
            this._contentDiv.style.right = active ? "0" : "100%";
            this._contentDiv.style.bottom = active ? "0" : "100%";
        } else {
            this._contentDiv.style.display = active ? "block" : "none";
        }
        
        this._active = active;
    },
    
    /**
     * Sets the rollover state of the tab.
     * This is performed after a delay to avoid flickering.
     * 
     * @param {Boolean} rollover the desired rollover state
     */
    setRollover: function(rollover) {
        this._renderHeaderState(this._active, rollover);
        this._parent._renderHeaderPositions();
    }
});
/**
 * Component rendering peer: ToolTipContainer.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.ToolTipContainer = Core.extend(Echo.Render.ComponentSync, {
    
    $load: function() {
        Echo.Render.registerPeer("Extras.ToolTipContainer", this);
    },
    
    /**
     * Main container DIV element.
     * @type Element
     */
    _div: null,
    
    /**
     * DIV container for component to which tool tip is being applied.
     * @type Element
     */
    _applyDiv: null,
    
    /**
     * DIV container for tool tip component.
     * @type Element
     */
    _toolTipDiv: null,
    
    /**
     * Positions tool tip over applied-to component based on mouse position.
     * 
     * @param e a mouse event containing mouse cursor positioning information
     */
    _positionToolTip: function(e) {
        this._toolTipDiv.style.height = "";
        
        // Determine cursor position.
        var cursorX = (e.pageX || (e.clientX + (document.documentElement.scrollLeft || document.body.scrollLeft)));
        var cursorY = (e.pageY || (e.clientY + (document.documentElement.scrollTop || document.body.scrollTop)));
        
        // Determine size of window and tip.
        var bodyBounds = new Core.Web.Measure.Bounds(document.body);
        var tipBounds = new Core.Web.Measure.Bounds(this._toolTipDiv.firstChild);
        
        // Load default tip position.
        var tipX = cursorX + 10;
        var tipY = cursorY + 10;
        
        // Ensure tip is on screen vertically.
        if (tipY + tipBounds.height > bodyBounds.height) {
            tipY = bodyBounds.height - tipBounds.height;
            if (tipY < 0) {
                tipY = 0;
            }
        }
        
        // Ensure tip is on screen horizontally (but never position it under cursor).
        if (cursorY < tipY && (tipX + tipBounds.width > bodyBounds.width)) {
            tipX = bodyBounds.width - tipBounds.width;
            if (tipX < 0) {
                tipX = 0;
            }
        }
        
        // Render tip position.
        this._toolTipDiv.style.left = tipX + "px";
        this._toolTipDiv.style.top = tipY + "px";
        
        Core.Web.VirtualPosition.redraw(this._toolTipDiv);
    },
    
    /**
     * Processes a mouse move event.
     * 
     * @param e the event
     */
    _processMove: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return;
        }
        this._positionToolTip(e);
        return true;
    },
    
    /**
     * Processes a mouse rollover enter event.
     * 
     * @param e the event
     */
    _processRolloverEnter: function(e) {
        if (!this.client || !this.client.verifyInput(this.component) || Core.Web.dragInProgress) {
            return;
        }
        
        if (this._toolTipDiv.parentNode !== document.body) {
            document.body.appendChild(this._toolTipDiv);
            this._positionToolTip(e);
        }
        return true;
    },
    
    /**
     * Processes a mouse rollover exit event.
     * 
     * @param e the event
     */
    _processRolloverExit: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }
        if (this._toolTipDiv.parentNode === document.body) {
            document.body.removeChild(this._toolTipDiv);
        }
        return true;
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._div = document.createElement("div");
        this._div.id = this.component.renderId;
        
        if (this.component.children.length > 0) {
            // Render main "apply to" component.
            this._applyDiv = document.createElement("div");
            this._applyDiv.style.cursor = "default";
            Echo.Render.renderComponentAdd(update, this.component.children[0], this._applyDiv);
            this._div.appendChild(this._applyDiv);
            
            if (this.component.children.length > 1) {
                // Register listeners on "apply to" component container.
                Core.Web.Event.add(this._applyDiv,
                        Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseenter" : "mouseover", 
                        Core.method(this, this._processRolloverEnter), true);
                Core.Web.Event.add(this._applyDiv,
                        Core.Web.Env.PROPRIETARY_EVENT_MOUSE_ENTER_LEAVE_SUPPORTED ? "mouseleave" : "mouseout", 
                        Core.method(this, this._processRolloverExit), true);
                Core.Web.Event.add(this._applyDiv, "mousemove", Core.method(this, this._processMove), true);
    
                // Create container for/render "tool tip" component.
                this._toolTipDiv = document.createElement("div");
                this._toolTipDiv.style.cssText = "position:absolute;z-index:30000;overflow:hidden;right:0;bottom:0;";
                
                var toolTipContentDiv = document.createElement("div");
                toolTipContentDiv.style.cssText = "position:absolute;"; 
                var width = this.component.render("width");
                if (width) {
                    toolTipContentDiv.style.width = Echo.Sync.Extent.toCssValue(width);
                }
                Echo.Render.renderComponentAdd(update, this.component.children[1], toolTipContentDiv);
                this._toolTipDiv.appendChild(toolTipContentDiv);
            }
        }
        
        parentElement.appendChild(this._div);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        if (this._applyDiv) {
            Core.Web.Event.removeAll(this._applyDiv);
        }
        
        if (this._toolTipDiv && this._toolTipDiv.parentNode === document.body) {
            document.body.removeChild(this._toolTipDiv);
        }

        this._div = null;
        this._applyDiv = null;
        this._toolTipDiv = null;
    },
    
    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var element = this._div;
        var containerElement = element.parentNode;
        Echo.Render.renderComponentDispose(update, update.parent);
        containerElement.removeChild(element);
        this.renderAdd(update, containerElement);
        return true;
    }
});
/**
 * Component rendering peer: TransitionPane.
 * This class should not be extended by developers, the implementation is subject to change.
 */
Extras.Sync.TransitionPane = Core.extend(Echo.Render.ComponentSync, {

    $load: function() {
        Echo.Render.registerPeer("Extras.TransitionPane", this);
    },

    /**
     * Outermost/top-level container element.
     * @type Element
     */
    _containerDiv: null,
    
    /**
     * Content element, contains oldChildDiv/childDiv elements.
     * @type Element
     */
    contentDiv: null,
    
    /**
     * The transition type value (retrieved from the component).
     * @type Number
     */
    type: null,
    
    /**
     * The transition which is actively running (null when content is not being transitioned).
     * @type Extras.Sync.TransitionPane.Transition
     */
    _transition: null,
    
    /**
     * Reference to the Extras.Sync.TransitionPane.Transition object type which will be instantiated to perform a transition.
     */
    _transitionClass: null,
    
    /**
     * The element containing the old child element, which is being transitioned FROM.
     * @type Element
     */
    oldChildDiv: null,
    
    /**
     * The element containing the current/new child element, which is being transitioned TO.
     * @type Element
     */
    childDiv: null,
    
    /**
     * Flag indicating whether initial content has been loaded (no transition effect is used on the first load).
     * @type Boolean
     */
    _initialContentLoaded: false,

    /**
     * Performs an immediate transition between old content and new content with no animated effect.
     */
    doImmediateTransition: function() {
        this.removeOldContent();
        if (this.childDiv) {
            this.showContent();
        }
    },

    /**
     * Determines the transition class that will be used to change content based on the
     * type value of the supported Extras.TransitionPane component. 
     */
    _loadTransition: function() {
        this.type = this.component.render("type");
        switch (this.type) {
        case Extras.TransitionPane.TYPE_FADE:
            this._transitionClass = Extras.Sync.TransitionPane.FadeOpacityTransition;
            break;
        case Extras.TransitionPane.TYPE_FADE_TO_BLACK:
        case Extras.TransitionPane.TYPE_FADE_TO_WHITE:
            this._transitionClass = Extras.Sync.TransitionPane.FadeOpacityColorTransition;
            break;
        case Extras.TransitionPane.TYPE_CAMERA_PAN_DOWN:
        case Extras.TransitionPane.TYPE_CAMERA_PAN_LEFT:
        case Extras.TransitionPane.TYPE_CAMERA_PAN_RIGHT:
        case Extras.TransitionPane.TYPE_CAMERA_PAN_UP:
            this._transitionClass = Extras.Sync.TransitionPane.CameraPanTransition;
            break;
        case Extras.TransitionPane.TYPE_BLIND_BLACK_IN:
        case Extras.TransitionPane.TYPE_BLIND_BLACK_OUT:
            this._transitionClass = Extras.Sync.TransitionPane.BlindTransition;
            break;
        default:
            this._transitionClass = null;
        }
    },
    
    /**
     * Removes old content: remove oldChildDiv from parent, set oldChildDiv to null.
     */
    removeOldContent: function() {
        if (this.oldChildDiv) {
            this.contentDiv.removeChild(this.oldChildDiv);
            this.oldChildDiv = null;
        }
    },

    /**
     * Shows new content.
     */
    showContent: function() {
        if (this.childDiv) {
            this.childDiv.style.visibility = "visible";
        }
    },

    /** @see Echo.Render.ComponentSync#renderAdd */
    renderAdd: function(update, parentElement) {
        this._containerDiv = document.createElement("div");
        this._containerDiv.id = this.component.renderId;
        this._containerDiv.style.cssText = "position:absolute;overflow:auto;top:0;left:0;width:100%;height:100%;";
        
        this.contentDiv = document.createElement("div");
        this.contentDiv.style.cssText = "position:absolute;overflow:hidden;top:0;left:0;width:100%;height:100%;";
        this._containerDiv.appendChild(this.contentDiv);
        
        parentElement.appendChild(this._containerDiv);
        if (this.component.children.length > 0) {
            this._renderAddChild(update);
        }
    },
    
    /**
     * Renders new content (a new child) added in an update.  Starts the transition.
     * 
     * @param {Echo.Update.ComponentUpdate} the update 
     */
    _renderAddChild: function(update) {
        this._loadTransition();
        this.childDiv = document.createElement("div");
        this.childDiv.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
        
        Echo.Render.renderComponentAdd(update, this.component.children[0], this.childDiv);
        
        if (this._initialContentLoaded) {
            this.childDiv.style.visibility = "hidden";
            if (this._transitionClass) {
                this._transitionStart();
            } else {
                this.doImmediateTransition();
            }
        } else {
            this._initialContentLoaded = true;
        }

        this.contentDiv.appendChild(this.childDiv);
    },
    
    /** @see Echo.Render.ComponentSync#renderDispose */
    renderDispose: function(update) {
        this._initialContentLoaded = false;
        if (this._transition) {
            this._transition.abort();
        }
        this.childDiv = null;
        this.contentDiv = null;
        this._containerDiv = null;
    },

    /** @see Echo.Render.ComponentSync#renderUpdate */
    renderUpdate: function(update) {
        var fullRender = false;
        if (update.hasUpdatedLayoutDataChildren()) {
            fullRender = true;
        } else if (update.hasUpdatedProperties()) {
            // Property updates
            var propertyNames = update.getUpdatedPropertyNames();
            if (!(propertyNames.length == 1 && propertyNames[0] == "type")) {
                // Properties other than 'type' have changed.
                fullRender = true;
            }
        }

        if (fullRender) {
            var contentDiv = this._containerDiv;
            var containerElement = contentDiv.parentNode;
            Echo.Render.renderComponentDispose(update, update.parent);
            containerElement.removeChild(contentDiv);
            this.renderAdd(update, containerElement);
        } else {
            if (this._transition) {
                this._transition.abort();
            }
        
            var removedChildren = update.getRemovedChildren();
            if (removedChildren) {
                // Remove children.
                this.oldChildDiv = this.childDiv;
                this.childDiv = null;
            }
            var addedChildren = update.getAddedChildren();
            if (update.parent.children > 1) {
                throw new Error("Cannot render more than one child in a TransitionPane.");
            }
            
            if (addedChildren) {
                // Add children.
                this._renderAddChild(update); 
            }
        }
        
        return fullRender;
    },
    
    /**
     * Initiates the animated transition effect.
     */
    _transitionStart: function() {
        this._transition = new this._transitionClass(this);
        this._transition.runTime = this.component.render("duration", this._transition.runTime);
        this._transition.start(Core.method(this, this._transitionFinish));
    },
    
    /**
     * Completes the animated transition effect. 
     */
    _transitionFinish: function(abort) {
        // Abort current transition, if necessary.
        if (this._transition) {
            this._transition = null;
            this.showContent();
        }
        
        // Remove content which was transitioned from.
        this.removeOldContent();
        
        // Refocus current focused component if it is within TransitionPane.
        if (this.component && this.component.application) {
            var focusedComponent = this.component.application.getFocusedComponent();
            if (focusedComponent != null && this.component.isAncestorOf(focusedComponent)) {
                Echo.Render.updateFocus(this.client);
            }
        }
    }
});

/**
 * Abstract base class for transition implementations.
 */
Extras.Sync.TransitionPane.Transition = Core.extend(Extras.Sync.Animation, {

    /**
     * The transition pane synchronization peer.
     * @type Extras.Sync.TransitionPane
     */
    transitionPane: null,

    /**
     * Duration of the transition, in milliseconds.
     * This value should be overridden when a custom duration time is desired.
     * This value will automatically be overridden if the TransitionPane component
     * has its "duration" property set.
     * @type Number
     * @see Extras.Sync.Animation#runTime
     */
    runTime: 350,

    /**
     * Interval at which transition steps should be invoked, in milliseconds.
     * @type Number
     * @see Extras.Sync.Animation#sleepInterval
     */
    sleepInterval: 10,
    
    $abstract: true,

    /**
     * Constructor.
     * 
     * @param {Extras.Sync.TransitionPane} transitionPane the transition pane peer 
     */
    $construct: function(transitionPane) {
        this.transitionPane = transitionPane;
    }
});

/**
 * Transition implementation to translate between old content and new content by flipping horizontal blinds, as though the old
 * screen were written to one side and the new screen were written to the other.
 * Uses a series of alpha-channeled PNG images to approximate the effect.
 */
Extras.Sync.TransitionPane.BlindTransition = Core.extend(Extras.Sync.TransitionPane.Transition, {

    /** @see Extras.Sync.Animation#runTime */
    runTime: 700,

    /**
     * The mask DIV that will display the blind graphic effect over the content.
     * @type Element
     */
    _maskDiv: null,
    
    /**
     * Number of steps (images) to display.
     * @type Number
     */
    _stepCount: 14,
    
    /**
     * Step number where old content will be swapped for new content.
     * @type Number
     */
    _swapStep: null,
    
    /**
     * Flag indicating whether the transition will occur in reverse order.
     * @type Boolean
     */
    _reverse: false,
    
    /** @see Extras.Sync.Animation#complete */
    complete: function(abort) {
        this._maskDiv.parentNode.removeChild(this._maskDiv);
    },
    
    /** @see Extras.Sync.Animation#init */
    init: function() {
        this._swapStep = Math.floor(this._stepCount) / 2 + 1;
        this._reverse = this.transitionPane.type === Extras.TransitionPane.TYPE_BLIND_BLACK_OUT;

        this._maskDiv = document.createElement("div");
        this._maskDiv.style.cssText = "position:absolute;width:100%;height:100%;z-index:30000;";
        this.transitionPane.contentDiv.appendChild(this._maskDiv);
    },

    /** @see Extras.Sync.Animation#step */
    step: function(progress) {
        var currentStep = Math.ceil(progress * this._stepCount);
        if (currentStep === 0) {
            currentStep = 1;
        }
        if (currentStep === this._renderedStep) {
            // No need to update, already current.
            return;
        }
        var url = this.transitionPane.client.getResourceUrl("Extras", 
                "image/transitionpane/blindblack/Frame" + currentStep + ".gif");
        this._maskDiv.style.backgroundImage = "url(" + url + ")";
        
        if (currentStep < this._swapStep) {
            if (this.transitionPane.oldChildDiv) {
                if (this._reverse) {
                    this.transitionPane.oldChildDiv.style.top = currentStep + "px";
                } else {
                    this.transitionPane.oldChildDiv.style.top = (0 - currentStep) + "px";
                }
            }
        } else {
            if (this._renderedStep < this._swapStep) {
                // blind is crossing horizontal, swap content.
                this.transitionPane.showContent();
                this.transitionPane.removeOldContent();
            }
            if (this.transitionPane.childDiv) {
                if (this._reverse) {
                    this.transitionPane.childDiv.style.top = (currentStep - this._stepCount) + "px";
                } else {
                    this.transitionPane.childDiv.style.top = (this._stepCount - currentStep) + "px";
                }
            }
        }

        this._renderedStep = currentStep;
    }    
});

/**
 * Transition implementation to pan from old content to new content, as though both were either horizontally
 * or vertically adjacent and the screen (camera) were moving from one to the other.
 */
Extras.Sync.TransitionPane.CameraPanTransition = Core.extend(
        Extras.Sync.TransitionPane.Transition, {
    
    /**
     * Flag indicating whether the new child (being transitioned to) has been placed on the screen.
     * @type Boolean
     */
    _newChildOnScreen: false,
    
    /**
     * The distance, in pixels, which content will travel across the screen (the width/height of the region).
     * @type Number 
     */
    _travel: null,

    /** @see Extras.Sync.Animation#complete */
    complete: function(abort) {
        if (this.transitionPane.childDiv) {
            this.transitionPane.childDiv.style.zIndex = 0;
            this.transitionPane.childDiv.style.top = "0px";
            this.transitionPane.childDiv.style.left = "0px";
        }
    },
    
    /** @see Extras.Sync.Animation#init */
    init: function() {
        var bounds = new Core.Web.Measure.Bounds(this.transitionPane.contentDiv);
        this._travel = (this.transitionPane.type == Extras.TransitionPane.TYPE_CAMERA_PAN_DOWN || 
                this.transitionPane.type == Extras.TransitionPane.TYPE_CAMERA_PAN_UP) ? bounds.height : bounds.width;
        if (this.transitionPane.oldChildDiv) {
            this.transitionPane.oldChildDiv.style.zIndex = 1;
        }
    },
    
    /** @see Extras.Sync.Animation#step */
    step: function(progress) {
        switch (this.transitionPane.type) {
        case Extras.TransitionPane.TYPE_CAMERA_PAN_DOWN:
            if (this.transitionPane.childDiv) {
                this.transitionPane.childDiv.style.top = ((1 - progress) * this._travel) + "px";
            }
            if (this.transitionPane.oldChildDiv) {
                this.transitionPane.oldChildDiv.style.top = (0 - (progress * this._travel)) + "px";
            }
            break;
        case Extras.TransitionPane.TYPE_CAMERA_PAN_UP:
            if (this.transitionPane.childDiv) {
                this.transitionPane.childDiv.style.top = (0 - ((1 - progress) * this._travel)) + "px";
            }
            if (this.transitionPane.oldChildDiv) {
                this.transitionPane.oldChildDiv.style.top = (progress * this._travel) + "px";
            }
            break;
        case Extras.TransitionPane.TYPE_CAMERA_PAN_RIGHT:
            if (this.transitionPane.childDiv) {
                this.transitionPane.childDiv.style.left = ((1 - progress) * this._travel) + "px";
            }
            if (this.transitionPane.oldChildDiv) {
                this.transitionPane.oldChildDiv.style.left = (0 - (progress * this._travel)) + "px";
            }
            break;
        default:
            if (this.transitionPane.childDiv) {
                this.transitionPane.childDiv.style.left = (0 - ((1 - progress) * this._travel)) + "px";
            }
            if (this.transitionPane.oldChildDiv) {
                this.transitionPane.oldChildDiv.style.left = (progress * this._travel) + "px";
            }
            break;
        }
        if (!this._newChildOnScreen && this.transitionPane.childDiv) {
            this.transitionPane.showContent();
            this.transitionPane.childDiv.style.zIndex = 2;
            this._newChildOnScreen = true;
        }
    }
});

/**
 * Transition implementation to fade from old content to new content.
 */
Extras.Sync.TransitionPane.FadeOpacityTransition = Core.extend(Extras.Sync.TransitionPane.Transition, {
    
    /** @see Extras.Sync.Animation#runTime */
    runTime: 1000,
    
    /** @see Extras.Sync.Animation#complete */
    complete: function(abort) {
        if (this.transitionPane.childDiv) {
            this.transitionPane.childDiv.style.zIndex = 0;
            if (Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
                this.transitionPane.childDiv.style.filter = "";
            } else {
                this.transitionPane.childDiv.style.opacity = 1;
            }
        }
    },
    
    /** @see Extras.Sync.Animation#init */
    init: function() {
        if (this.transitionPane.childDiv) {
            if (Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
                this.transitionPane.childDiv.style.filter = "alpha(opacity=0)";
            } else {
                this.transitionPane.childDiv.style.opacity = 0;
            }
        }
        this.transitionPane.showContent();
    },
    
    /** @see Extras.Sync.Animation#step */
    step: function(progress) {
        var percent;
        if (this.transitionPane.childDiv) {
            if (Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
                percent = Math.floor(progress * 100);
                this.transitionPane.childDiv.style.filter = "alpha(opacity=" + percent + ")";
            } else {
                this.transitionPane.childDiv.style.opacity = progress;
            }
        } else if (this.transitionPane.oldChildDiv) {
            if (Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
                percent = Math.floor((1 - progress) * 100);
                this.transitionPane.oldChildDiv.style.filter = "alpha(opacity=" + percent + ")";
            } else {
                this.transitionPane.oldChildDiv.style.opacity = 1 - progress;
            }
        }
    }
});

/**
 * Transition implementation to fade from old content to a solid color, then fade to new content.
 */
Extras.Sync.TransitionPane.FadeOpacityColorTransition = Core.extend(Extras.Sync.TransitionPane.Transition, {

    /** @see Extras.Sync.Animation#runTime */
    runTime: 1000,

    /**
     * The masking color DIV element being faded in/out over the changing content.
     * @type Element
     */
    _maskDiv: null,
    
    /**
     * Flag indicating whether old content has been fully faded out and swapped for new content.
     * @type Boolean
     */
    _swapped: false,
    
    /** @see Extras.Sync.Animation#complete */
    complete: function(abort) {
        this._maskDiv.parentNode.removeChild(this._maskDiv);
    },
    
    /** @see Extras.Sync.Animation#init */
    init: function() {
        this._maskDiv = document.createElement("div");
        this._maskDiv.style.cssText = "position:absolute;width:100%;height:100%;z-index:30000;";
        if (Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
            this._maskDiv.style.filter = "alpha(opacity=0)";
        } else {
            this._maskDiv.style.opacity = 0;
        }
        if (this.transitionPane.type === Extras.TransitionPane.TYPE_FADE_TO_WHITE) {
            this._maskDiv.style.backgroundColor = "#ffffff";
        } else {
            this._maskDiv.style.backgroundColor = "#000000";
        }
        this.transitionPane.contentDiv.appendChild(this._maskDiv);
    },

    /** @see Extras.Sync.Animation#step */
    step: function(progress) {
        var opacity = 1 - Math.abs(progress * 2 - 1);
        if (progress > 0.5 && !this._swapped) {
            this.transitionPane.showContent();
            this.transitionPane.removeOldContent();
            this._swapped = true;
        }
        if (Core.Web.Env.PROPRIETARY_IE_OPACITY_FILTER_REQUIRED) {
            var percent = Math.floor(opacity * 100);
            this._maskDiv.style.filter = "alpha(opacity=" + percent + ")";
        } else {
            this._maskDiv.style.opacity = opacity;
        }
    }
});
Extras.Sync.Viewer = { };

Extras.Sync.Viewer.ScrollContainer = Core.extend({
    
    _accumulator: 0,
    _rowHeight: null,
    _scrollPosition: 0,
    _barPosition: 0,
    onScroll: null,
    gain: 0.2,
    
    /**
     * Creates a ScrollContainer.  The dispose() method should be invoked when the ScrollContainer will no longer be used.
     */
    $construct: function(client, component, rows, rowHeight) {
        this.client = client;
        this.component = component;
        this._rowHeight = rowHeight;
        
        this.rootElement = document.createElement("div");
        this.rootElement.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;";
        
        this._barDiv = document.createElement("div");
        this._barDiv.style.cssText = "position:absolute;top:0;bottom:0;right:0;overflow:scroll;";
        this._barDiv.style.width = (1 + Core.Web.Measure.SCROLL_WIDTH) + "px";
        this._vScrollContent = document.createElement("div");
        this._vScrollContent.style.cssText = "width:1px;";
        this._barDiv.appendChild(this._vScrollContent);
        this.rootElement.appendChild(this._barDiv);
        
        this.contentElement = document.createElement("div");
        this.contentElement.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden;background:white;";
        this.rootElement.appendChild(this.contentElement);
        
        Core.Web.Event.add(this._barDiv, "scroll", Core.method(this, this._processScroll), true);
        Core.Web.Event.add(this.rootElement, Core.Web.Env.BROWSER_MOZILLA ? "DOMMouseScroll" :  "mousewheel",
                Core.method(this, this._processWheel), true);
                
        this.setRows(rows);
        this._accumulatorRunnable = new Core.Web.Scheduler.MethodRunnable(Core.method(this, this._accumulatedScroll), 10);
    },
        
    _accumulatedScroll: function() {
        if (this._accumulator) {
            var increment = this._accumulator;
            this._adjustScrollPosition(this.gain * this._accumulator);
            this._accumulator = 0;
        }
    },

    /**
     * Disposes of the ScrollContainer, releasing any resources in use.
     */
    dispose: function() {
        Core.Web.Event.removeAll(this._barDiv);
        Core.Web.Event.removeAll(this.rootElement);
    
        this.rootElement = null;
        this.contentElement = null;
        this._barDiv = null;        
    },
    
    _adjustScrollPosition: function(screenFactor) {
        this._scrollPosition += this._height * screenFactor;
        this._scrollPosition = Math.max(0, Math.min(this._scrollPosition, this._maxScrollPosition));
        this._barPosition = Math.floor(this._scrollPosition * this._barFactor);
        this._rowPosition = this._scrollPosition / this._rowHeight;
        this._barDiv.scrollTop = this._barPosition;
        if (this.onScroll) {
            this.onScroll({ source: this, type: "scroll", row: this._rowPosition });
        }
    },
    
    /**
     * Process a scroll bar drag adjustment event.
     *
     * @param e the event
     */
    _processScroll: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            // Reset scroll bar position.
            this._barDiv.scrollTop = this._barPosition;
            return;
        }
        if (this._barDiv.scrollTop !== this._barPosition) {
            this._barPosition = this._barDiv.scrollTop;
            this._scrollPosition = this._barPosition / this._barFactor;
            this._rowPosition = this._scrollPosition / this._rowHeight;
            if (this.onScroll) {
                this.onScroll({ source: this, type: "scroll", row: this._rowPosition });
            }
        }
    },
    
    /**
     * Processes a scroll wheel event.
     *
     * @param e the event
     */
    _processWheel: function(e) {
        if (!this.client || !this.client.verifyInput(this.component)) {
            return;
        }

        // Convert scroll wheel direction/distance data into uniform/cross-browser format:
        // A value of 1 indicates one notch scroll down, -1 indicates one notch scroll up.
        var wheelScroll;
        if (e.wheelDelta) {
            wheelScroll = e.wheelDelta / -120;
        } else if (e.detail) {
            wheelScroll = e.detail / 3;
        } else {
            return;
        }
        
        if (this._accumulator === 0) {
            Core.Web.Scheduler.add(this._accumulatorRunnable);
        }
        
        // Scroll vertically.
        this._accumulator += wheelScroll;
        
        // Prevent default scrolling action, or in the case of modifier keys, font adjustments, etc.
        Core.Web.DOM.preventEventDefault(e);
        
        return true;
    },
    
    renderDisplay: function() {
        Core.Web.VirtualPosition.redraw(this.rootElement);
        Core.Web.VirtualPosition.redraw(this.contentElement);
        Core.Web.VirtualPosition.redraw(this._barDiv);
        this._height = this._barDiv.offsetHeight;
        this._vScrollContent.style.height = Math.min(this._height * 50, this._totalRowHeight) + "px";
        this._scrollHeight = this._barDiv.scrollHeight;
        this._barRange = this._scrollHeight - this._height;
        this._updateSizes();
    },
    
    _updateSizes: function() {
        this._maxScrollPosition = Math.max(0, this._totalRowHeight - this._height);
        this._barFactor = this._barRange / this._maxScrollPosition;
    },
    
    setActive: function(active) {
        if (active) {
            this.contentElement.style.right = Core.Web.Measure.SCROLL_WIDTH + "px";
        } else {
            this.contentElement.style.right = 0;
        }
    },

    setRows: function(rows) {
        this._totalRowHeight = rows * this._rowHeight;
        this._updateSizes();
        this.renderDisplay();
    }
});
Extras.Sync.CalendarSelect.resource.set("bg", {
    "DayOfWeek.0":      "\u041d\u0435\u0434\u0435\u043b\u044f",
    "DayOfWeek.1":      "\u041f\u043e\u043d\u0435\u0434\u0435\u043b\u043d\u0438\u043a",
    "DayOfWeek.2":      "\u0412\u0442\u043e\u0440\u043d\u0438\u043a",
    "DayOfWeek.3":      "\u0421\u0440\u044f\u0434\u0430",
    "DayOfWeek.4":      "\u0427\u0435\u0442\u0432\u044a\u0440\u0442\u044a\u043a",
    "DayOfWeek.5":      "\u041f\u0435\u0442\u044a\u043a",
    "DayOfWeek.6":      "\u0421\u044a\u0431\u043e\u0442\u0430",
    "Month.0":          "\u042f\u043d\u0443\u0430\u0440\u0438",
    "Month.1":          "\u0424\u0435\u0432\u0440\u0443\u0430\u0440\u0438",
    "Month.2":          "\u041c\u0430\u0440\u0442",
    "Month.3":          "\u0410\u043f\u0440\u0438\u043b",
    "Month.4":          "\u041c\u0430\u0439",
    "Month.5":          "\u042e\u043d\u0438",
    "Month.6":          "\u042e\u043b\u0438",
    "Month.7":          "\u0410\u0432\u0433\u0443\u0441\u0442",
    "Month.8":          "\u0421\u0435\u043f\u0442\u0435\u043c\u0432\u0440\u0438",
    "Month.9":          "\u041e\u043a\u0442\u043e\u043c\u0432\u0440\u0438",
    "Month.10":         "\u041d\u043e\u0435\u043c\u0432\u0440\u0438",
    "Month.11":         "\u0414\u0435\u043a\u0435\u043c\u0432\u0440\u0438",
    "FirstDayOfWeek":   "1"
});
Extras.Sync.CalendarSelect.resource.set("de", {
    "DayOfWeek.0":      "Sonntag",
    "DayOfWeek.1":      "Montag",
    "DayOfWeek.2":      "Dienstag",
    "DayOfWeek.3":      "Mittwoch",
    "DayOfWeek.4":      "Donnerstag",
    "DayOfWeek.5":      "Freitag",
    "DayOfWeek.6":      "Samstag",
    "Month.0":          "Januar",
    "Month.1":          "Februar",
    "Month.2":          "M\u00e4rz",
    "Month.3":          "April",
    "Month.4":          "Mai",
    "Month.5":          "Juni",
    "Month.6":          "Juli",
    "Month.7":          "August",
    "Month.8":          "September",
    "Month.9":          "Oktober",
    "Month.10":         "November",
    "Month.11":         "Dezember",
    "FirstDayOfWeek":   "1"
});
Extras.Sync.RichTextArea.resource.set("de", {
    "ColorDialog.Title.Foreground" : "Textfarbe",
    "ColorDialog.Title.Background" : "Hintergrundfarbe",
    "ColorDialog.PromptForeground" : "Textfarbe:",
    "ColorDialog.PromptBackground" : "Hintergrundfarbe:",
    "Error.ClipboardAccessDisabled" : "Der Zugriff auf die Zwischenablage ist in diesem Browser deaktiviert. " +
            "Bitte benutzen Sie die entsprechenden Tastenkombinationen oder \u00e4ndern Sie die " +
            "Sicherheitseinstellungen des Browsers.",
    "Generic.Cancel" : "Abbrechen",
    "Generic.Error" : "Fehler",
    "Generic.Ok" : "Ok",
    "HyperlinkDialog.Title" : "Hyperlink einf\u00fcgen",
    "HyperlinkDialog.PromptURL" : "URL:",
    "HyperlinkDialog.PromptDescription" : "Beschreibung:",
    "HyperlinkDialog.ErrorDialogTitle" : "Hyperlink konnte nicht eingef\u00fcgt werden",
    "HyperlinkDialog.ErrorDialog.URL" : "Die eingegebene URL ist nicht g\u00fcltig.",
    "ImageDialog.Title" : "Bild einf\u00fcgen",
    "ImageDialog.PromptURL" : "URL:",
    "ImageDialog.ErrorDialogTitle" : "Bild konnte nicht eingef\u00fcgt werden",
    "ImageDialog.ErrorDialog.URL" : "Die eingegebene URL ist nicht g\u00fcltig.",
    "Menu.Edit" : "Bearbeiten",
    "Menu.Undo" : "R\u00fcckg\u00e4ngig",
    "Menu.Redo" : "Wiederherstellen",
    "Menu.Cut" : "Ausschneiden",
    "Menu.Copy" : "Kopie",
    "Menu.Paste" : "Einf\u00fcgen",
    "Menu.Delete" : "L\u00f6schen",
    "Menu.SelectAll" : "Alles ausw\u00e4hlen",
    "Menu.Insert" : "Einf\u00fcgen",
    "Menu.InsertImage" : "Bild...",
    "Menu.InsertHyperlink" : "Hyperlink...",
    "Menu.InsertHorizontalRule" : "Trennstrich",
    "Menu.InsertTable" : "Tabelle...",
    "Menu.BulletedList" : "Aufz\u00e4hlung (symbolisch)",
    "Menu.NumberedList" : "Aufz\u00e4hlung (numeriert)",
    "Menu.Format" : "Format",
    "Menu.Bold" : "Fett",
    "Menu.Italic" : "Kursiv",
    "Menu.Underline" : "Unterstrichen",
    "Menu.Strikethrough" : "Durchgestrichen",
    "Menu.Superscript" : "Hochgestellt",
    "Menu.Subscript" : "Tiefgestellt",
    "Menu.PlainText" : "Einfacher Text",
    "Menu.TextStyle" : "Textstil",
    "Menu.ParagraphStyle" : "Absatzstil",
    "Menu.Alignment" : "Ausrichtung",
    "Menu.Left" : "Linksb\u00fcndig",
    "Menu.Right" : "Rechtsb\u00fcndig",
    "Menu.Center" : "Zentriert",
    "Menu.Justified" : "Blocksatz",
    "Menu.Indent" : "Einr\u00fccken",
    "Menu.Outdent" : "Ausr\u00fccken",
    "Menu.SetForeground" : "Textfarbe setzen...",
    "Menu.SetBackground" : "Hintergrundfarbe setzen...",
    "Menu.Heading1" : "\u00dcberschrift 1",
    "Menu.Heading2" : "\u00dcberschrift 2",
    "Menu.Heading3" : "\u00dcberschrift 3",
    "Menu.Heading4" : "\u00dcberschrift 4",
    "Menu.Heading5" : "\u00dcberschrift 5",
    "Menu.Heading6" : "\u00dcberschrift 6",
    "Menu.Normal" : "Normal",
    "Menu.Preformatted" : "Formatiert",
    "TableDialog.Title" : "Tabelle einf\u00fcgen",
    "TableDialog.PromptRows" : "Zeilen:",
    "TableDialog.PromptColumns" : "Spalten:",
    "TableDialog.ErrorDialogTitle" : "Tabelle konnte nicht eingef\u00fcgt werden",
    "TableDialog.ErrorDialog.Columns" : "Die Anzahl der Spalten ist nicht g\u00fcltig. " +
            "Bitte geben Sie eine Zahl zwischen 1 und 50 ein.",
    "TableDialog.ErrorDialog.Rows" : "Die Anzahl der Zeilen ist nicht g\u00fcltig. " +
            "Bitte geben Sie eine Zahl zwischen 1 und 50 ein."
});

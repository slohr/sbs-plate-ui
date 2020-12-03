/**
 * SBS plate v2.3
 *
 * Simple Plate UI tool based on SlickGrid
 */


if (typeof jQuery === "undefined") {
  throw new Error("SBS requires jquery module to be loaded");
}
if (!jQuery.fn.drag) {
  throw new Error("SBS requires jquery.event.drag module to be loaded");
}
if (typeof SBS === "undefined") {
  throw new Error("sbs.core.js not loaded");
}


(function ($) {

  $.extend(true, window, {
    SBS: {
      Plate: SBSPlate
    }
  });

  noop = function(){}

  // shared across all grids on the page
  var scrollbarDimensions;
  var maxSupportedCssHeight;  // browser's breaking point

  var type96Well = "96"
  var type384Well = "384"

  /**
   * Creates a new instance of the plate.
   * @class SBSGrid
   * @constructor
   * @param {Node}              container   Container node to create the grid in.
   * @param {Array,Object}      data        An array of objects for databinding.
   * @param {Array}             type        plate type (96 or 384).
   * @param {Object}            options     Grid options.
   **/
  function SBSPlate(container, data, type, options) {
    // settings
    var defaults = {
        rowHeight: 30,
        defaultColumnWidth: 40,
        explicitInitialization: false,
        selectedWellCssClass: "selected",
        emptyCharacter: "-",
        writeWellContent: function(self,well,content) {
            if(content && 'name' in content) {
                well.text(content.name);
            } else {
                well.text(options.emptyCharacter);
            }

        }
    };

    var offset = 0;

    // private
    var initialized = false;
    var $container;
    var uid = "sbsplate_" + Math.round(1000000 * Math.random());
    var self = this;
    var activeRow, activeWell;
    var $focusSink, $focusSink2;
    var $viewport;
    var $canvas;
    var $style;
    var $boundAncestors;
    var $lastClicked;
    var viewportH, viewportW;
    var canvasWidth;
    var viewportHasHScroll, viewportHasVScroll;
    var wellWidthDiff = 0, wellHeightDiff = 0;

    var tabbingDirection = 1;

    var rowsCache = {};
    var activePosX, activePosY;
    var activeRow, activeWell;
    var activeWellNode = null;
    var currentEditor = null;
    var serializedEditorValue;
    var editController;

    var selectionModel;
    var selectedRows = [];

    var plugins = [];

    var wellCssClasses = {};

    var columnsById = {};
    var columnPosLeft = [];
    var columnPosRight = [];

    var columnCount;
    var rowCount;

    var columns = {};

    var wellsByCoordinate = {};
    var wellsByIndex = [];

    //////////////////////////////////////////////////////////////////////////////////////////////
    // Initialization

    function init() {
      if (container instanceof jQuery) {
        $container = container;
      } else {
        $container = $(container);
      }
      if ($container.length < 1) {
        throw new Error("SBSPlate requires a valid container, " + container + " does not exist in the DOM.");
      }

      options = $.extend({}, defaults, options);

        if(type==type96Well) {
            rowCount = 8;
            columnCount = 12;
        } else if(type===type384Well) {
            rowCount = 16;
            columnCount = 24;
        }
        var plate = clickablePlate(rowCount,columnCount);


      $container
          .empty()
          .css("overflow", "visible")
          .css("outline", 0)
          .addClass(uid)
          .addClass("ui-widget");


      // set up a positioning container if needed
      if (!/relative|absolute|fixed/.test($container.css("position"))) {
        $container.css("position", "relative");
      }

        $focusSink = $("<div tabIndex='0' hideFocus style='position:fixed;width:0;height:0;top:0;left:0;outline:0;'></div>").appendTo($container);

        $viewport = $("<div class='sbs-viewport' style='position:relative;'>").appendTo($container);
        $canvas = $("<div class='plate-canvas' />").appendTo($viewport);
        $canvas.css('width','250px');
        $canvas.css('width',(options.defaultColumnWidth*columnCount)+'px');
        plate.appendTo($canvas);

      if (!options.explicitInitialization) {
        finishInitialization();
      }

    }

    function finishInitialization() {
      if (!initialized) {
        initialized = true;
        createCssRules();
        viewportW = parseFloat($.css($container[0], "width", true));
        $focusSink.add($focusSink2).on("keydown", handleKeyDown);
        $canvas
            .on("keydown", handleKeyDown)
            .on("click", handleWellClick)
            .on("draginit", handleDragInit)
            .on("dragstart", {distance: 3}, handleDragStart)
            .on("drag", handleDrag)
            .on("dragend", handleDragEnd)
            .on("mouseenter", ".sbs-well", handleMouseEnter)
            .on("mouseleave", ".sbs-well", handleMouseLeave);
        $container.data('sbsplate',self);
      }

    }

    function clickablePlate( rows, cols ){
        var i=0;
        var plate = $('<table>');
        plate.addClass('sbs-plate');
        plate.css('width',(options.defaultColumnWidth*columnCount)+'px');
        for (var r=0;r<rows;++r){
            var tr = $('<tr>');
            tr.addClass('r-'+r);
            for (var c=0;c<cols;++c){
                wellCoordinate = uid+"-"+r+"-"+c;
                wellIndex = uid+"-"+i;
                var well = $('<td>');
                var wellObject = {"row":r,"well":c}
                var content = getDataItem(i);
                well.attr("id",wellCoordinate);
                well.addClass('sbs-well')
                well.addClass('c-'+c)
                well.addClass('w-'+i)
                tr.append(well);
                wellsByCoordinate[wellCoordinate] = well;
                wellsByIndex[i] = well;
                options.writeWellContent(self,well,content);
                i++;
            }
            plate.append(tr);
        }
        return plate;
    }

    function getWellIndexFromNode(wellNode) {
      // read column number from .w-<columnNumber> CSS class
      var cls = /w-\d+/.exec(wellNode.className);
      if (!cls) {
        throw new Error("getWellIndexFromNode: cannot get well - " + wellNode.className);
      }
      return parseInt(cls[0].substr(2, cls[0].length - 1), 10);
    }

    function getWellFromNode(wellNode) {
      // read column number from .c-<columnNumber> CSS class
      var cls = /c-\d+/.exec(wellNode.className);
      if (!cls) {
        throw new Error("getWellFromNode: cannot get well - " + wellNode.className);
      }
      return parseInt(cls[0].substr(2, cls[0].length - 1), 10);
    }

    function getWellFromIndex(wellIndex) {
      return wellsByIndex[wellIndex];
    }

    function getRowFromNode(rowNode) {
      // read column number from .r-<rowNumber> CSS class
      var cls = /r-\d+/.exec(rowNode.className);
      if (!cls) {
        throw new Error("getRowFromNode: cannot get row - " + rowNode.className);
      }
      return parseInt(cls[0].substr(2, cls[0].length - 1), 10);
    }

    function getWellFromEvent(e) {
      var $well = $(e.target).closest(".sbs-well", $canvas);
      if (!$well.length) {
        return null;
      }

      var row = getRowFromNode($well[0].parentNode);
      var well = getWellFromNode($well[0]);

      if (row == null || well == null) {
        return null;
      } else {
        return {
          "row": row,
          "well": well
        };
      }
    }

    function getActiveWell() {
      if (!activeWellNode) {
        return null;
      } else {
        return {row: activeRow, well: activeWell, plate: self};
      }
    }

    function getActiveWellNode() {
      return activeWellNode;
    }

    function handleKeyDown(e) {
      trigger(self.onKeyDown, {row: activeRow, well: activeWell, grid: self}, e);
      var handled = e.isImmediatePropagationStopped();
      var keyCode = SBS.keyCode;

      if (!handled) {
        if (!e.shiftKey && !e.altKey && !e.ctrlKey) {
          // editor may specify an array of keys to bubble
          if (e.which == keyCode.ESCAPE) {
            handled = true;
          } else if (e.which == keyCode.PAGE_DOWN) {
            navigatePageDown();
            handled = true;
          } else if (e.which == keyCode.PAGE_UP) {
            navigatePageUp();
            handled = true;
          } else if (e.which == keyCode.LEFT) {
            handled = navigateLeft();
          } else if (e.which == keyCode.RIGHT) {
            handled = navigateRight();
          } else if (e.which == keyCode.UP) {
            handled = navigateUp();
          } else if (e.which == keyCode.DOWN) {
            handled = navigateDown();
          } else if (e.which == keyCode.TAB) {
            handled = navigateNext();
          } else if (e.which == keyCode.ENTER) {
            console.log('enter pressed');
            handled = true;
          }
        } else if (e.which == keyCode.TAB && e.shiftKey && !e.ctrlKey && !e.altKey) {
          handled = navigatePrev();
        }
      }

      if (handled) {
        // the event has been handled so don't let parent element (bubbling/propagation) or browser (default) handle it
        e.stopPropagation();
        e.preventDefault();
        try {
          e.originalEvent.keyCode = 0; // prevent default behaviour for special keys in IE browsers (F3, F5, etc.)
        }
        // ignore exceptions - setting the original event's keycode throws access denied exception for "Ctrl"
        // (hitting control key only, nothing else), "Shift" (maybe others)
        catch (error) {
        }
      }
    }

    //TODO(slohr): flesh out with actual data or structural info.
    function canWellBeSelected(row, well) {
        return true;
    }

    function handleWellClick(e) {
        var well = getWellFromEvent(e);
        if(well!=null) {
            setActiveWell(well.row,well.well);
            onWellClick.notify({
                "well":well,
                "data":getSelectedWellData()
            });
        }
    }

    function registerPlugin(plugin) {
      plugins.unshift(plugin);
      plugin.init(self);
    }

    function unregisterPlugin(plugin) {
      for (var i = plugins.length; i >= 0; i--) {
        if (plugins[i] === plugin) {
          if (plugins[i].destroy) {
            plugins[i].destroy();
          }
          plugins.splice(i, 1);
          break;
        }
      }
    }


    function destroy() {

      trigger(self.onBeforeDestroy, {grid: self});

      var i = plugins.length;
      while(i--) {
        unregisterPlugin(plugins[i]);
      }

      if (options.enableColumnReorder) {
          $headers.filter(":ui-sortable").sortable("destroy");
      }

      unbindAncestorScrollEvents();
      $container.off(".sbsplate");
      removeCssRules();

      $canvas.off("draginit dragstart dragend drag");
      $container.empty().removeClass(uid);
    }


    //////////////////////////////////////////////////////////////////////////////////////////////
    // General

    function trigger(evt, args, e) {
      e = e || new SBS.EventData();
      args = args || {};
      args.grid = self;
      return evt.notify(args, e, self);
    }

    function getColumnIndex(id) {
      return columnsById[id];
    }

    function getOptions() {
      return options;
    }

    function setOptions(args, suppressRender) {
      if (!getEditorLock().commitCurrentEdit()) {
        return;
      }

      makeActiveWellNormal();

      if (options.enableAddRow !== args.enableAddRow) {
        invalidateRow(getDataLength());
      }

      options = $.extend(options, args);
      validateAndEnforceOptions();

      $viewport.css("overflow-y", options.autoHeight ? "hidden" : "auto");
      if (!suppressRender) { render(); }
    }

    function validateAndEnforceOptions() {
      if (options.autoHeight) {
        options.leaveSpaceForNewRows = false;
      }
    }

    function setData(newData, scrollToTop) {
      data = newData;
      updateDisplay();
    }

    function updateDisplay() {
        wellsByIndex.forEach(function(well,index) {
            content = getDataItem(index);
            options.writeWellContent(self,well,content);
        });
    }

    function wellExists(row, well) {
        return true;
      //return !(row < 0 || row >= getDataLength() || well < 0 || well >= columns.length);
    }

    function getData() {
      return data;
    }

    function getDataLength() {
      if (data.getLength) {
        return data.getLength();
      } else {
        return data.length;
      }
    }

    function getDataLengthIncludingAddNew() {
      return getDataLength() + (!options.enableAddRow ? 0
        : (!pagingActive || pagingIsLastPage ? 1 : 0)
      );
    }

    function getDataItem(i) {
      if (data.getItem) {
        return data.getItem(i);
      } else {
        return data[i];
      }
    }

    function getWellNodeBox(row, well) {
      if (!wellExists(row, well)) {
        return null;
      }

      var y1 = getRowTop(row);
      var y2 = y1 + options.rowHeight - 1;
      var x1 = 0;
      for (var i = 0; i < well; i++) {
        x1 += options.defaultColumnWidth;
      }
      var x2 = x1 + options.defaultColumnWidth

      return {
        top: y1,
        left: x1,
        bottom: y2,
        right: x2
      };
    }

    function getContainerNode() {
      return $container.get(0);
    }

    function getCanvasNode() {
      return $canvas[0];
    }

    function getRowTop(row) {
      return options.rowHeight * row - offset;
    }

    function getRowFromPosition(y) {
      return Math.floor((y + offset) / options.rowHeight);
    }

    function handleDragInit(e, dd) {
      var well = getWellFromEvent(e);
      if (!well || !wellExists(well.row, well.well)) {
        return false;
      }

      var retval = trigger(self.onDragInit, dd, e);
      if (e.isImmediatePropagationStopped()) {
        return retval;
      }

      // if nobody claims to be handling drag'n'drop by stopping immediate propagation,
      // cancel out of it
      return false;
    }

    function handleMouseEnter(e) {
        var well = getWellFromEvent(e);
        trigger(self.onMouseEnter, {grid: self}, e);
        trigger(self.onWellEnter, well, e);
    }

    function handleMouseLeave(e) {
        var well = getWellFromEvent(e);
        trigger(self.onMouseLeave, {grid: self}, e);
        trigger(self.onWellLeave, well, e);
    }


    function handleDragStart(e, dd) {
      var well = getWellFromEvent(e);
      if (!well || !wellExists(well.row, well.well)) {
        return false;
      }

      var retval = trigger(self.onDragStart, dd, e);
      if (e.isImmediatePropagationStopped()) {
        return retval;
      }

      return false;
    }

    function handleDrag(e, dd) {
        return trigger(self.onDrag, dd, e);
    }

    function handleDragEnd(e, dd) {
        trigger(self.onDragEnd, dd, e);
    }

    function getWellFromPoint(x, y) {
      var row = getRowFromPosition(y);
      var well = 0;

      var w = 0;
      for (var i = 0; i < columnCount && w < x; i++) {
        w += options.defaultColumnWidth;
        well++;
      }

      if (well < 0) {
        well = 0;
      }

      return {row: row, well: well - 1};
    }


    function setSelectionModel(model) {
      if (selectionModel) {
        selectionModel.onSelectedRangesChanged.unsubscribe(handleSelectedRangesChanged);
        if (selectionModel.destroy) {
          selectionModel.destroy();
        }
      }

      selectionModel = model;
      if (selectionModel) {
        selectionModel.init(self);
        selectionModel.onSelectedRangesChanged.subscribe(handleSelectedRangesChanged);
      }
    }

    function getSelectionModel() {
      return selectionModel;
    }

    function handleSelectedRangesChanged(e, ranges) {
      selectedRows = [];
      selectedWells = [];
      var hash = {};

      $.each(wellsByCoordinate,function(i,v){
          v.removeClass(options.selectedWellCssClass);
      });

      for (var i = 0; i < ranges.length; i++) {
        for (var j = ranges[i].fromRow; j <= ranges[i].toRow; j++) {
          if (!hash[j]) {  // prevent duplicates
            selectedRows.push(j);
            hash[j] = {};
          }
          for (var k = ranges[i].fromWell; k <= ranges[i].toWell; k++) {
              var node = getWellNode(j,k);
              var wellIndex = getWellIndexFromNode(node);
              $(node).addClass(options.selectedWellCssClass);

              var data = getDataItem(wellIndex);
              var wellWithData = {
                'index': wellIndex,
                'data':data
              }
              selectedWells.push(wellWithData);
          }
        }
      }

      //setWellCssStyles(options.selectedWellCssClass, hash);
        console.log(selectedWells);
      trigger(self.onSelectedRowsChanged, {rows: getSelectedRows(), grid: self}, e);
      trigger(self.onSelectedWellsChanged, {wells: selectedWells, grid: self}, e);
      //trigger(self.onSelectedWellsChanged, {wells: getSelectedRows(), grid: self}, e);
    }

    function getSelectedWellData() {
        var node = getActiveWellNode()
        var index = getWellIndexFromNode(node)
        var data = getDataItem(index);
        return data;
    }

    function getSelectedRows() {
      if (!selectionModel) {
        throw new Error("Selection model is not set");
      }
      return selectedRows;
    }

    function setSelectedRows(rows) {
      if (!selectionModel) {
        throw new Error("Selection model is not set");
      }
      selectionModel.setSelectedRanges(rowsToRanges(rows));
    }

    function rowsToRanges(rows) {
      var ranges = [];
      var lastWell = columnCount - 1;
      for (var i = 0; i < rows.length; i++) {
        ranges.push(new SBS.Range(rows[i], 0, rows[i], lastWell));
      }
      return ranges;
    }

    function setFocus() {
        $focusSink[0].focus();
    }

    function createCssRules() {
      $style = $("<style type='text/css' rel='stylesheet' />").appendTo($("head"));
      var rowHeight = (options.rowHeight - wellHeightDiff);
      var rules = [
        "." + uid + " .sbs-well { height:" + rowHeight + "px; }",
        "." + uid + " .sbs-row { height:" + options.rowHeight + "px; }"
      ];

      //for (var i = 0; i < columns.length; i++) {
      for (var i = 0; i < columnCount; i++) {
        rules.push("." + uid + " .w-" + i + " { }");
        rules.push("." + uid + " .r-" + i + " { }");
      }

      if ($style[0].styleSheet) { // IE
        $style[0].styleSheet.cssText = rules.join(" ");
      } else {
        $style[0].appendChild(document.createTextNode(rules.join(" ")));
      }
    }

    function setActiveWell(row, well) {
      if (!initialized) { return; }
      setActiveWellInternal(getWellNode(row, well), false);
    }

    function setActiveWellInternal(newWell, opt_editMode, preClickModeOn) {
      if (activeWellNode !== null) {
        $(activeWellNode).removeClass("active");
      }

      var activeWellChanged = (activeWellNode !== newWell);
      activeWellNode = newWell;

      if (activeWellNode != null) {
        activeWell = activePosX = getWellFromNode(activeWellNode);
        activeRow = activePosY = getRowFromNode(activeWellNode.parentNode);
        $(activeWellNode).addClass("active");

      } else {
        activeRow = activeWell = null;
      }

      trigger(self.onActiveWellChanged, getActiveWell());
    }

    function getWellNode(row, well) {
        var wellCoordinate = uid+"-"+row+"-"+well;
        console.log(wellsByCoordinate)
        return wellsByCoordinate[wellCoordinate][0];
    }

    function wellHasThisData(well,key) {
        console.log(well);
        var node = getWellNode(well.row, well.well)
        var index = getWellIndexFromNode(node)
        var data = getDataItem(index);
        var keys = key.split('.');
        var currentObject = data;
        while(currentObject && keys.length) currentObject = currentObject[keys.shift()];
        return currentObject
    }

    //////////////////////////////////////////////////////////////////////////////////////////////
    // Debug

    this.debug = function () {
      var s = "";

      s += ("\n" + "counter_rows_rendered:  " + counter_rows_rendered);
      s += ("\n" + "counter_rows_removed:  " + counter_rows_removed);
      s += ("\n" + "renderedRows:  " + renderedRows);
      s += ("\n" + "numVisibleRows:  " + numVisibleRows);
      s += ("\n" + "maxSupportedCssHeight:  " + maxSupportedCssHeight);
      s += ("\n" + "n(umber of pages):  " + n);
      s += ("\n" + "(current) page:  " + page);
      s += ("\n" + "page height (ph):  " + ph);
      s += ("\n" + "vScrollDir:  " + vScrollDir);

      alert(s);
    };

    // a debug helper to be able to access private members
    this.eval = function (expr) {
      return eval(expr);
    };

    //////////////////////////////////////////////////////////////////////////////////////////////
    // Public API

    var onWellClick = new SBS.Event();
    var onWellDblClick = new SBS.Event();
    var onWellContextMenu = new SBS.Event();

    $.extend(this, {
      "sbsPlateVersion": "0.0.0",

      // Events
      "onWellClick": onWellClick,
      "onWellDblClick": onWellDblClick,
      "onWellContextMenu": onWellContextMenu,
      "onDragInit": new SBS.Event(),
      "onDragStart": new SBS.Event(),
      "onDrag": new SBS.Event(),
      "onDragEnd": new SBS.Event(),
      "onMouseEnter": new SBS.Event(),
      "onMouseLeave": new SBS.Event(),
      "onWellEnter": new SBS.Event(),
      "onWellLeave": new SBS.Event(),
      "onActiveWellChanged": new SBS.Event(),
      "onActiveWellPositionChanged": new SBS.Event(),
      "onSelectedRowsChanged": new SBS.Event(),
      "onSelectedWellsChanged": new SBS.Event(),
      "onKeyDown": new SBS.Event(),

      // Methods

      "registerPlugin": registerPlugin,
      "unregisterPlugin": unregisterPlugin,
      "getOptions": getOptions,
      "setOptions": setOptions,
      "getSelectionModel": getSelectionModel,
      "setSelectionModel": setSelectionModel,
      "getSelectedRows": getSelectedRows,
      "setSelectedRows": setSelectedRows,
      "getWellFromEvent": getWellFromEvent,
      "getWellFromNode": getWellFromNode,
      "getWellFromPoint": getWellFromPoint,
      "getWellFromIndex": getWellFromIndex,
      "getWellNodeBox":getWellNodeBox,
      "getWellNode":getWellNode,
      "getData": getData,
      "getDataLength": getDataLength,
      "getDataItem": getDataItem,
      "setData": setData,
      "setActiveWell": setActiveWell,
      "getContainerNode": getContainerNode,
      "getCanvasNode": getCanvasNode,
      "focus": setFocus,
      "canWellBeSelected":canWellBeSelected,
      "wellHasThisData":wellHasThisData,
      "init": finishInitialization,
      "destroy": destroy,

    });

    init();
  }
}(jQuery));

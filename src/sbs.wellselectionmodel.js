(function ($) {
  // register namespace
  $.extend(true, window, {
    "SBS": {
      "WellSelectionModel": WellSelectionModel
    }
  });


  function WellSelectionModel(options) {
    var _plate;
    var _canvas;
    var _ranges = [];
    var _self = this;
    var _selector = new SBS.WellRangeSelector({
      "selectionCss": {
        "border": "2px solid black"
      }
    });
    var _options;
    var _defaults = {
      selectActiveWell: true
    };


    function init(plate) {
      _options = $.extend(true, {}, _defaults, options);
      _plate = plate;
      _canvas = _plate.getCanvasNode();
      _plate.onActiveWellChanged.subscribe(handleActiveWellChange);
      _plate.onKeyDown.subscribe(handleKeyDown);
      plate.registerPlugin(_selector);
      _selector.onWellRangeSelected.subscribe(handleWellRangeSelected);
      _selector.onBeforeWellRangeSelected.subscribe(handleBeforeWellRangeSelected);
    }

    function destroy() {
      _plate.onActiveWellChanged.unsubscribe(handleActiveWellChange);
      _plate.onKeyDown.unsubscribe(handleKeyDown);
      _selector.onWellRangeSelected.unsubscribe(handleWellRangeSelected);
      _selector.onBeforeWellRangeSelected.unsubscribe(handleBeforeWellRangeSelected);
      _plate.unregisterPlugin(_selector);
    }

    function removeInvalidRanges(ranges) {
      var result = [];

      for (var i = 0; i < ranges.length; i++) {
        var r = ranges[i];
        if (_plate.canWellBeSelected(r.fromRow, r.fromWell) && _plate.canWellBeSelected(r.toRow, r.toWell)) {
          result.push(r);
        }
      }

      return result;
    }

    function setSelectedRanges(ranges) {
      // simle check for: empty selection didn't change, prevent firing onSelectedRangesChanged
      if ((!_ranges || _ranges.length === 0) && (!ranges || ranges.length === 0)) { return; }

      _ranges = removeInvalidRanges(ranges);
      _self.onSelectedRangesChanged.notify(_ranges);

    }

    function getSelectedRanges() {
      return _ranges;
    }

    function handleBeforeWellRangeSelected(e, args) {
    }

    function handleWellRangeSelected(e, args) {
      setSelectedRanges([args.range]);
    }

    function handleActiveWellChange(e, args) {
        //TODO(slohr):put this "if" check back in after sorting out the configuration of it
      //if (_options.selectActiveWell && args.row != null && args.well != null) {
        setSelectedRanges([new SBS.Range(args.row, args.well)]);
      //}
    }

    function handleKeyDown(e) {
      /***
       * Кey codes
       * 37 left
       * 38 up
       * 39 right
       * 40 down
       */
      var ranges, last;
      var active = _plate.getActiveWell();
      var metaKey = e.ctrlKey || e.metaKey;

      if ( active && e.shiftKey && !metaKey && !e.altKey &&
          (e.which == 37 || e.which == 39 || e.which == 38 || e.which == 40) ) {

        ranges = getSelectedRanges();
        if (!ranges.length)
         ranges.push(new SBS.Range(active.row, active.well));

        // keyboard can work with last range only
        last = ranges.pop();

        // can't handle selection out of active well
        if (!last.contains(active.row, active.well))
          last = new SBS.Range(active.row, active.well);

        var dRow = last.toRow - last.fromRow,
            dWell = last.toWell - last.fromWell,
            // walking direction
            dirRow = active.row == last.fromRow ? 1 : -1,
            dirWell = active.well == last.fromWell ? 1 : -1;

        if (e.which == 37) {
          dWell -= dirWell;
        } else if (e.which == 39) {
          dWell += dirWell ;
        } else if (e.which == 38) {
          dRow -= dirRow;
        } else if (e.which == 40) {
          dRow += dirRow;
        }

        // define new selection range
        var new_last = new SBS.Range(active.row, active.well, active.row + dirRow*dRow, active.well + dirWell*dWell);
        if (removeInvalidRanges([new_last]).length) {
          ranges.push(new_last);
          var viewRow = dirRow > 0 ? new_last.toRow : new_last.fromRow;
          var viewWell = dirWell > 0 ? new_last.toWell : new_last.fromWell;
         _plate.scrollRowIntoView(viewRow);
         _plate.scrollWellIntoView(viewRow, viewWell);
        }
        else
          ranges.push(last);

        setSelectedRanges(ranges);

        e.preventDefault();
        e.stopPropagation();
      }
    }

    $.extend(this, {
      "getSelectedRanges": getSelectedRanges,
      "setSelectedRanges": setSelectedRanges,

      "init": init,
      "destroy": destroy,

      "onSelectedRangesChanged": new SBS.Event()
    });
  }
})(jQuery);

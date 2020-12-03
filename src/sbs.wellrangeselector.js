(function ($) {
  // register namespace
  $.extend(true, window, {
    "SBS": {
      "WellRangeSelector": WellRangeSelector
    }
  });


  function WellRangeSelector(options) {
    var _plate;
    var _canvas;
    var _dragging;
    var _decorator;
    var _self = this;
    var _handler = new SBS.EventHandler();
    var _defaults = {
      selectionCss: {
        "border": "2px dashed blue"
      }
    };


    function init(plate) {
      options = $.extend(true, {}, _defaults, options);
      _decorator = new SBS.WellRangeDecorator(plate, options);
      _plate = plate;
      _canvas = _plate.getCanvasNode();
      _handler
        .subscribe(_plate.onDragInit, handleDragInit)
        .subscribe(_plate.onDragStart, handleDragStart)
        .subscribe(_plate.onDrag, handleDrag)
        .subscribe(_plate.onDragEnd, handleDragEnd);
    }

    function destroy() {
      _handler.unsubscribeAll();
    }

    function handleDragInit(e, dd) {
      // prevent the plate from cancelling drag'n'drop by default
      e.stopImmediatePropagation();
    }

    function handleDragStart(e, dd) {
      var well = _plate.getWellFromEvent(e);
      if (_self.onBeforeWellRangeSelected.notify(well) !== false) {
        if (_plate.canWellBeSelected(well.row, well.well)) {
          _dragging = true;
          e.stopImmediatePropagation();
        }
      }
      if (!_dragging) {
        return;
      }

      _plate.focus();

      var start = _plate.getWellFromPoint(
          dd.startX - $(_canvas).offset().left,
          dd.startY - $(_canvas).offset().top);

      dd.range = {start: start, end: {}};

      return _decorator.show(new SBS.Range(start.row, start.well));
    }

    function handleDrag(e, dd) {
      if (!_dragging) {
        return;
      }
      e.stopImmediatePropagation();

      var end = _plate.getWellFromPoint(
          e.pageX - $(_canvas).offset().left,
          e.pageY - $(_canvas).offset().top
      );
      dd.range.end = end;
      _decorator.show(new SBS.Range(dd.range.start.row, dd.range.start.well, end.row, end.well));
    }

    function handleDragEnd(e, dd) {

      if (!_dragging) {
        return;
      }

      _dragging = false;
      e.stopImmediatePropagation();

      _decorator.hide();
      _self.onWellRangeSelected.notify({
        range: new SBS.Range(
            dd.range.start.row,
            dd.range.start.well,
            dd.range.end.row,
            dd.range.end.well
        )
      });

    }

    $.extend(this, {
      "init": init,
      "destroy": destroy,
      "onBeforeWellRangeSelected": new SBS.Event(),
      "onWellRangeSelected": new SBS.Event()
    });
  }
})(jQuery);

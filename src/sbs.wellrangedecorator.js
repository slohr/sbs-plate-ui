(function ($) {
  // register namespace
  $.extend(true, window, {
    "SBS": {
      "WellRangeDecorator": WellRangeDecorator
    }
  });

  /***
   * Displays an overlay on top of a given cell range.
   *
   * @param {Plate} plate
   * @param {Object} options
   */
  function WellRangeDecorator(plate, options) {
    var _elem;
    var _defaults = {
      selectionCssClass: 'sbs-range-decorator',
      selectionCss: {
        "zIndex": "9999",
        "border": "2px dashed red"
      }
    };

    options = $.extend(true, {}, _defaults, options);


    function show(range) {

      if (!_elem) {
        _elem = $("<div></div>", {css: options.selectionCss})
            .addClass(options.selectionCssClass)
            .css("position", "absolute")
            .appendTo(plate.getCanvasNode());
      }

      var from = plate.getWellNodeBox(range.fromRow, range.fromWell);
      var to = plate.getWellNodeBox(range.toRow, range.toWell);

      _elem.css({
        top: from.top,
        left: from.left,
        height: to.bottom - from.top,
        width: to.right - from.left - 2
        //height: to.bottom - from.top + 2,
        //width: to.right - from.left + 1
      });

      return _elem;
    }

    function hide() {
      if (_elem) {
        _elem.remove();
        _elem = null;
      }
    }

    $.extend(this, {
      "show": show,
      "hide": hide
    });
  }
})(jQuery);
